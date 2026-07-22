import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { Auth } from "../../../auth"
import { Config } from "../../../config/config"
import { Provider } from "../../../provider/provider"
import { lazy } from "../../../util/lazy"
import { JsonStore } from "../../../util/jsonstore"
import { Global } from "../../../global"
import fs from "fs/promises"
import path from "path"

// scienceos's managed model service is intentionally fixed for the
// source-distribution build. Do not read this address from user configuration.
const ORIGIN = "https://claw.xiaohu.me"
const BASE_URL = "https://claw.xiaohu.me/v1"
const PROVIDER_ID = "xiaohu"
const TOKEN_NAME = "scienceos"
const ACCOUNT_FILE = path.join(Global.Path.data, "external-account.json")
const QUOTA_PER_USD = 500_000

const Login = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(256),
})

const Signup = z
  .object({
    username: z.string().trim().min(1, "请输入账号").max(20, "账号不能超过 20 个字符"),
    password: z.string().min(8, "密码至少需要 8 个字符").max(20, "密码不能超过 20 个字符"),
    confirmation: z.string(),
  })
  .refine((input) => input.password === input.confirmation, {
    message: "两次输入的密码不一致",
    path: ["confirmation"],
  })

const State = z.object({
  connected: z.boolean(),
  provider: z.string(),
  baseURL: z.string(),
  username: z.string().optional(),
  model: z.string().optional(),
  models: z.array(z.string()).optional(),
  balanceUsd: z.number().optional(),
})

const Account = z.object({
  username: z.string(),
  userID: z.number().int().positive(),
  balanceUsd: z.number().optional(),
  session: z.string().optional(),
  sessionExpiresAt: z.number().optional(),
  updatedAt: z.number(),
})

type Envelope<T> = { success?: boolean; message?: string; data?: T }
type User = { id: number; username: string; require_2fa?: boolean; quota?: number }
type Token = { id: number; name: string; status: number }

async function account() {
  const data = await JsonStore.read(ACCOUNT_FILE)
  const result = Account.safeParse(data)
  return result.success ? result.data : undefined
}

async function saveAccount(data: z.infer<typeof Account>) {
  await fs.mkdir(path.dirname(ACCOUNT_FILE), { recursive: true })
  await JsonStore.update(ACCOUNT_FILE, () => data)
}

async function refreshAccount(cached: z.infer<typeof Account>) {
  if (!cached.session || (cached.sessionExpiresAt ?? 0) <= Date.now()) throw new Error("账户会话已过期")
  const response = await fetch(`${ORIGIN}/api/user/self`, {
    headers: { cookie: cached.session, "new-api-user": String(cached.userID) },
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await response.json().catch(() => ({}))) as Envelope<User>
  if (!response.ok || body.success !== true || !body.data) throw new Error(body.message || "无法读取账户余额")
  const next = {
    username: body.data.username || cached.username,
    userID: body.data.id || cached.userID,
    balanceUsd: typeof body.data.quota === "number" ? body.data.quota / QUOTA_PER_USD : cached.balanceUsd,
    session: cached.session,
    sessionExpiresAt: cached.sessionExpiresAt,
    updatedAt: Date.now(),
  }
  await saveAccount(next)
  return next
}

async function connect(input: z.infer<typeof Login>) {
  const login = await fetch(`${ORIGIN}/api/user/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(15_000),
  })
  const auth = (await login.json().catch(() => ({}))) as Envelope<User>
  if (!login.ok || auth.success !== true || !auth.data?.id) {
    throw new Error(auth.message || "第三方账号或密码不正确")
  }
  if (auth.data.require_2fa) throw new Error("该第三方账号已启用双重验证，当前登录方式暂不支持")

  const cookieHeader = login.headers.get("set-cookie")
  const cookie = cookieHeader?.split(";", 1)[0]
  if (!cookie) throw new Error("第三方登录成功，但没有返回有效会话")
  const expires = cookieHeader
    ?.split(";")
    .map((item) => item.trim())
    .find((item) => item.toLowerCase().startsWith("expires="))
    ?.slice("expires=".length)
  const sessionExpiresAt = expires ? Date.parse(expires) : Date.now() + 30 * 24 * 60 * 60 * 1000
  const headers = {
    "content-type": "application/json",
    cookie,
    "new-api-user": String(auth.data.id),
  }

  const list = async () => {
    const response = await fetch(`${ORIGIN}/api/token/?p=0&page_size=100`, {
      headers,
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => ({}))) as Envelope<{ items?: Token[] }>
    if (!response.ok || body.success !== true) throw new Error(body.message || "无法读取第三方令牌")
    return body.data?.items ?? []
  }

  const existing = (await list()).find((token) => token.name === TOKEN_NAME && token.status === 1)
  const token = await (async () => {
    if (existing) return existing
    const response = await fetch(`${ORIGIN}/api/token/`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: TOKEN_NAME,
        expired_time: -1,
        remain_quota: 0,
        unlimited_quota: true,
        model_limits_enabled: false,
        model_limits: "",
        allow_ips: "",
        group: "",
      }),
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await response.json().catch(() => ({}))) as Envelope<unknown>
    if (!response.ok || body.success !== true) throw new Error(body.message || "无法创建第三方访问令牌")
    const created = (await list())
      .filter((item) => item.name === TOKEN_NAME && item.status === 1)
      .sort((a, b) => b.id - a.id)[0]
    if (!created) throw new Error("第三方访问令牌已创建，但无法读取")
    return created
  })()

  const keyResponse = await fetch(`${ORIGIN}/api/token/${token.id}/key`, {
    method: "POST",
    headers,
    signal: AbortSignal.timeout(15_000),
  })
  const keyBody = (await keyResponse.json().catch(() => ({}))) as Envelope<{ key?: string }>
  const key = keyBody.data?.key
  if (!keyResponse.ok || keyBody.success !== true || !key) {
    throw new Error(keyBody.message || "无法读取第三方访问令牌")
  }

  const modelResponse = await fetch(`${BASE_URL}/models`, {
    headers: { authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
  })
  const modelBody = (await modelResponse.json().catch(() => ({}))) as { data?: Array<{ id?: string }> }
  if (!modelResponse.ok) throw new Error("第三方 API 连接成功，但无法读取模型列表")
  const models = [...new Set((modelBody.data ?? []).map((item) => item.id?.trim()).filter((id): id is string => !!id))]
    .filter((id) => !/(embedding|image|audio|tts|whisper|rerank)/i.test(id))
    .sort()
  if (models.length === 0) throw new Error("第三方 API 当前没有可用的对话模型")

  const preferred = ["gpt-5.4", "gpt-5.5", "claude-sonnet-4-6", "gpt-5.3-codex"]
  const model = preferred.find((id) => models.includes(id)) ?? models[0]
  const catalog = Object.fromEntries(
    models.map((id) => [
      id,
      {
        name: id,
        reasoning: /^(gpt-5|claude-)/.test(id),
        temperature: true,
        tool_call: true,
        attachment: false,
        modalities: { input: ["text" as const], output: ["text" as const] },
        limit: { context: 128_000, output: 16_384 },
        options: {},
      },
    ]),
  )

  await Auth.set(PROVIDER_ID, { type: "api", key })
  await Config.updateGlobal({
    billing: { llm: "byok" },
    model: `${PROVIDER_ID}/${model}`,
    provider: {
      [PROVIDER_ID]: {
        name: "KK API",
        npm: "@ai-sdk/openai-compatible",
        api: BASE_URL,
        options: { baseURL: BASE_URL },
        models: catalog,
      },
    },
  })
  Provider.invalidate()

  const profile = {
    username: auth.data.username || input.username,
    userID: auth.data.id,
    balanceUsd: typeof auth.data.quota === "number" ? auth.data.quota / QUOTA_PER_USD : undefined,
    session: cookie,
    sessionExpiresAt,
    updatedAt: Date.now(),
  }
  const saved = await refreshAccount(profile).catch(async () => {
    await saveAccount(profile)
    return profile
  })

  return {
    connected: true,
    provider: "KK API",
    baseURL: BASE_URL,
    username: saved.username,
    model: `${PROVIDER_ID}/${model}`,
    models,
    balanceUsd: saved.balanceUsd,
  }
}

async function signup(input: z.infer<typeof Signup>) {
  const response = await fetch(`${ORIGIN}/api/user/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: input.username, password: input.password }),
    signal: AbortSignal.timeout(15_000),
  })
  const body = (await response.json().catch(() => ({}))) as Envelope<unknown>
  if (!response.ok || body.success !== true) throw new Error(body.message || "账号注册失败")

  return connect({ username: input.username, password: input.password }).catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`注册成功，但自动登录失败：${message}`)
  })
}

export const ExternalAPIRoutes = lazy(() =>
  new Hono()
    .get(
      "/",
      describeRoute({
        summary: "Get default external API connection status",
        operationId: "settings.externalApi.get",
        responses: {
          200: { description: "Connection state", content: { "application/json": { schema: resolver(State) } } },
        },
      }),
      async (c) => {
        const auth = await Auth.get(PROVIDER_ID)
        const config = await Config.getGlobal()
        const profile = await account()
        return c.json({
          connected: auth?.type === "api" && !!config.provider?.[PROVIDER_ID],
          provider: "KK API",
          baseURL: BASE_URL,
          model: config.model?.startsWith(`${PROVIDER_ID}/`) ? config.model : undefined,
          username: profile?.username,
          balanceUsd: profile?.balanceUsd,
        })
      },
    )
    .get(
      "/account",
      describeRoute({
        summary: "Get the signed-in workbench account and balance",
        operationId: "settings.externalApi.account",
        responses: {
          200: { description: "Account state", content: { "application/json": { schema: resolver(State) } } },
        },
      }),
      async (c) => {
        const auth = await Auth.get(PROVIDER_ID)
        const cached = await account()
        if (auth?.type !== "api") return c.json({ connected: false, provider: "KK API", baseURL: BASE_URL }, 401)
        if (!cached) return c.json({ connected: true, provider: "KK API", baseURL: BASE_URL })
        const profile = await refreshAccount(cached).catch(() => cached)
        return c.json({
          connected: true,
          provider: "KK API",
          baseURL: BASE_URL,
          username: profile.username,
          balanceUsd: profile.balanceUsd,
        })
      },
    )
    .post(
      "/disconnect",
      describeRoute({
        summary: "Sign out of the workbench account on this machine",
        operationId: "settings.externalApi.disconnect",
        responses: {
          200: { description: "Disconnected", content: { "application/json": { schema: resolver(State) } } },
        },
      }),
      async (c) => {
        await Promise.all([Auth.remove(PROVIDER_ID), fs.rm(ACCOUNT_FILE, { force: true })])
        await Config.removeProvider(PROVIDER_ID)
        Provider.invalidate()
        return c.json({ connected: false, provider: "KK API", baseURL: BASE_URL })
      },
    )
    .post(
      "/connect",
      describeRoute({
        summary: "Sign in and configure scienceos",
        operationId: "settings.externalApi.connect",
        responses: {
          200: { description: "Connected", content: { "application/json": { schema: resolver(State) } } },
        },
      }),
      validator("json", Login),
      async (c) =>
        connect(c.req.valid("json"))
          .then((state) => c.json(state))
          .catch((error) => c.text(error instanceof Error ? error.message : String(error), 400)),
    )
    .post(
      "/register",
      describeRoute({
        summary: "Register a scienceos account and configure it",
        operationId: "settings.externalApi.register",
        responses: {
          200: {
            description: "Registered and connected",
            content: { "application/json": { schema: resolver(State) } },
          },
        },
      }),
      validator("json", Signup),
      async (c) =>
        signup(c.req.valid("json"))
          .then((state) => c.json(state))
          .catch((error) => c.text(error instanceof Error ? error.message : String(error), 400)),
    ),
)
