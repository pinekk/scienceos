// General — Account, Model defaults, and Licensing, plus the appearance/theme
// controls. Everything here is wired to a real endpoint:
//   • Account   → client.account.get / client.account.logout, billing link.
//   • Model      → global config `model` / `small_model` (client.global.config.update
//                  via useGlobalSync().updateConfig) + the reasoning effort store.
//   • Licensing  → /settings/preferences (real JSON store, persisted to ~/.openscience).
//   • Appearance → the extracted AppearanceSections (theme, sounds, updates, …).
import { Component, Show, createMemo, createSignal, onMount, type JSX } from "solid-js"
import { Button } from "@synsci/ui/button"
import { Select } from "@synsci/ui/select"
import { useGlobalSync } from "@/context/global-sync"
import { useModels } from "@/context/models"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"
import { FONT_SANS } from "@/styles/tokens"
import { AppearanceSections } from "../settings-general"
import { settingsApi } from "./api"
import { useLanguage } from "@/context/language"

type Account = {
  connected: boolean
  username?: string
  balanceUsd?: number
}

type Preferences = {
  reasoning_effort: "minimal" | "low" | "medium" | "high"
  intent: "commercial" | "non-commercial"
  extra_budget_usd: number
}

const REASONING = ["minimal", "low", "medium", "high"] as const

export default function General() {
  const sync = useGlobalSync()
  const models = useModels()
  const platform = usePlatform()
  const server = useServer()
  const language = useLanguage()
  const chinese = () => language.locale() === "zh" || language.locale() === "zht"
  const text = (en: string, cn: string) => (chinese() ? cn : en)

  const fetchFn = () => platform.fetch ?? fetch
  const base = () => server.url

  const [account, setAccount] = createSignal<Account | undefined>()
  const [prefs, setPrefs] = createSignal<Preferences | undefined>()
  const [error, setError] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)

  const loadAccount = async () => {
    try {
      setAccount(await settingsApi<Account>(base(), fetchFn(), "/settings/external-api/account"))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  const loadPrefs = async () => {
    try {
      setPrefs(await settingsApi<Preferences>(base(), fetchFn(), "/settings/preferences"))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }
  onMount(() => {
    void loadAccount()
    void loadPrefs()
  })

  const savePref = async (patch: Partial<Preferences>) => {
    const next = await settingsApi<Preferences>(base(), fetchFn(), "/settings/preferences", {
      method: "PATCH",
      body: JSON.stringify(patch),
    })
    setPrefs(next)
  }

  const signOut = async () => {
    if (busy()) return
    setBusy(true)
    setError(undefined)
    const result = await settingsApi<Account>(base(), fetchFn(), "/settings/external-api/disconnect", {
      method: "POST",
    })
      .catch(() =>
        settingsApi<boolean>(base(), fetchFn(), "/auth/xiaohu", { method: "DELETE" }).then(
          () => ({ connected: false }) as Account,
        ),
      )
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : String(reason))
        return undefined
      })
    setBusy(false)
    if (!result) return
    window.location.assign("/login")
  }

  // Model catalog → dropdown options (provider/model). Persisted to real config.
  const modelOptions = createMemo(() =>
    models
      .list()
      .map((m) => ({ value: `${m.provider.id}/${m.id}`, label: `${m.name} · ${m.provider.name}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  )
  const defaultModel = () => sync.data.config.model
  const subagentModel = () => sync.data.config.small_model
  const setDefaultModel = (value: string) => void sync.updateConfig({ model: value })
  const setSubagentModel = (value: string) => void sync.updateConfig({ small_model: value })

  const reasoning = createMemo(() =>
    REASONING.map((value) => ({
      value,
      label:
        value === "minimal"
          ? text("Minimal", "最少")
          : value === "low"
            ? text("Low", "低")
            : value === "medium"
              ? text("Medium", "中")
              : text("High", "高"),
    })),
  )

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-8">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-8 pb-8 max-w-[760px]">
          <h2 class="text-16-medium text-text-strong">{text("General", "通用")}</h2>
          <p class="text-13-regular text-text-weak">
            {text("Your account, default models, and appearance.", "管理账户、默认模型与外观。")}
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-8 w-full max-w-[760px]">
        <Show when={error()}>
          <div
            style={{
              "font-family": FONT_SANS,
              "font-size": "12px",
              color: "var(--color-error)",
              border: "1px solid var(--color-error-muted)",
              "border-radius": "4px",
              padding: "10px 12px",
            }}
          >
            {error()}
          </div>
        </Show>

        {/* Account */}
        <Section title={text("Account", "账户")} description={text("Your unified scienceos account.", "当前工作台使用的统一登录账号。")}>
          <div class="border border-border-weak-base rounded-[4px] overflow-hidden bg-surface-base/40">
            <Row title={text("Account", "账号")}>
              <span class="text-13-regular text-text-strong">{account()?.username ?? "—"}</span>
            </Row>
            <Row title={text("Session", "登录状态")}>
              <div class="flex items-center gap-3">
                <span class="text-13-medium text-text-success">
                  {account()?.connected ? text("Connected", "已登录") : text("Loading…", "读取中…")}
                </span>
                <Button size="small" variant="secondary" disabled={busy() || !account()?.connected} onClick={() => void signOut()}>
                  {busy() ? text("signing out…", "正在退出…") : text("sign out", "退出登录")}
                </Button>
              </div>
            </Row>
          </div>
        </Section>

        {/* Model */}
        <Section title={text("Model", "模型")} description={text("Defaults applied to new sessions and background tasks.", "设置新对话和后台任务使用的默认模型。")}>
          <div class="border border-border-weak-base rounded-[4px] overflow-hidden bg-surface-base/40">
            <Row title={text("Default model", "默认模型")} description={text("Primary model used when a session starts.", "新对话启动时使用的主要模型。")}>
              <Select
                options={modelOptions()}
                current={modelOptions().find((o) => o.value === defaultModel())}
                value={(o) => o.value}
                label={(o) => o.label}
                onSelect={(o) => o && setDefaultModel(o.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
                placeholder={text("Auto", "自动")}
              />
            </Row>
            <Row title={text("Subagent model", "子智能体模型")} description={text("Model for titles, summaries, and subagent tasks (small_model).", "用于标题、摘要与子智能体任务的模型。")}>
              <Select
                options={modelOptions()}
                current={modelOptions().find((o) => o.value === subagentModel())}
                value={(o) => o.value}
                label={(o) => o.label}
                onSelect={(o) => o && setSubagentModel(o.value)}
                variant="secondary"
                size="small"
                triggerVariant="settings"
                placeholder={text("Auto", "自动")}
              />
            </Row>
            <Row title={text("Reasoning effort", "推理强度")} description={text("Thinking budget for models that support it.", "支持推理模型的思考预算。")}>
              <Select
                options={reasoning()}
                current={reasoning().find((o) => o.value === prefs()?.reasoning_effort) ?? reasoning()[2]}
                value={(o) => o.value}
                label={(o) => o.label}
                onSelect={(o) => o && void savePref({ reasoning_effort: o.value })}
                variant="secondary"
                size="small"
                triggerVariant="settings"
              />
            </Row>
          </div>
        </Section>

        {/* Appearance / theme / notifications / sounds */}
        <AppearanceSections />
      </div>
    </div>
  )
}

function message(err: unknown) {
  return err instanceof Error ? err.message : String(err)
}

const Section: Component<{ title: string; description?: string; children: JSX.Element }> = (props) => (
  <div class="flex flex-col gap-3">
    <div class="flex flex-col gap-0.5">
      <h3 class="text-13-medium text-text-weak tracking-wide">{props.title}</h3>
      <Show when={props.description}>
        <p class="text-12-regular text-text-weak">{props.description}</p>
      </Show>
    </div>
    {props.children}
  </div>
)

const Row: Component<{ title: string; description?: string; children: JSX.Element }> = (props) => (
  <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 border-b border-border-weak-base last:border-none">
    <div class="flex flex-col gap-0.5 min-w-0">
      <span class="text-14-medium text-text-strong">{props.title}</span>
      <Show when={props.description}>
        <span class="text-12-regular text-text-weak">{props.description}</span>
      </Show>
    </div>
    <div class="flex-shrink-0">{props.children}</div>
  </div>
)
