import "./external-auth.css"
import { Show, createEffect, createResource, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { Wordmark } from "@/atlas/Wordmark"
import { AsciiSpinner } from "@/atlas/shared/AsciiSpinner"
import { settingsApi } from "@/components/settings/api"
import { usePlatform } from "@/context/platform"
import { useServer } from "@/context/server"

type State = {
  connected: boolean
  provider: string
  baseURL: string
  username?: string
  model?: string
  models?: string[]
  balanceUsd?: number
}

export function ExternalAuthGate(props: ParentProps) {
  const server = useServer()
  const platform = usePlatform()
  const request = () => platform.fetch ?? fetch
  const [form, setForm] = createStore({
    mode: "login" as "login" | "register",
    username: "",
    password: "",
    confirmation: "",
    busy: false,
    error: "",
  })
  const [state, control] = createResource(
    () => server.url,
    (base) => settingsApi<State>(base, request(), "/settings/external-api"),
  )

  createEffect(() => {
    if (state.loading) return
    if (state()?.connected === true) {
      if (window.location.pathname === "/login") window.history.replaceState(null, "", "/")
      return
    }
    if (window.location.pathname !== "/login") window.history.replaceState(null, "", "/login")
  })

  const submit = async (event: SubmitEvent) => {
    event.preventDefault()
    if (form.busy) return
    const username = form.username.trim()
    if (!username || !form.password) return
    if (form.mode === "register" && username.length > 20) {
      setForm("error", "账号不能超过 20 个字符")
      return
    }
    if (form.mode === "register" && (form.password.length < 8 || form.password.length > 20)) {
      setForm("error", "密码需要为 8–20 个字符")
      return
    }
    if (form.mode === "register" && form.password !== form.confirmation) {
      setForm("error", "两次输入的密码不一致")
      return
    }
    setForm({ busy: true, error: "" })
    const path = form.mode === "register" ? "/settings/external-api/register" : "/settings/external-api/connect"
    const result = await settingsApi<State>(server.url, request(), path, {
      method: "POST",
      body: JSON.stringify({ username, password: form.password, confirmation: form.confirmation }),
    }).catch((reason) => {
      setForm("error", reason instanceof Error ? reason.message : String(reason))
      return undefined
    })
    setForm({ password: "", confirmation: "", busy: false })
    if (!result) return
    window.history.replaceState(null, "", "/")
    control.mutate(result)
  }

  return (
    <Show
      when={!state.loading}
      fallback={
        <main class="science-login science-login-loading">
          <Wordmark size="md" />
          <AsciiSpinner label="正在连接科研工作台…" color="var(--color-text-faint)" />
        </main>
      }
    >
      <Show
        when={state()?.connected === true}
        fallback={
          <main class="science-login">
            <div class="science-login-glow science-login-glow-a" />
            <div class="science-login-glow science-login-glow-b" />
            <header class="science-login-header">
              <Wordmark size="md" />
              <span>Science Workbench</span>
            </header>

            <section class="science-login-intro">
              <span class="science-login-kicker">AI 原生科研工作台</span>
              <h1>从研究想法，到可验证的科研成果</h1>
              <p>登录后统一进入项目、研究工作流、专业 Skills、模型求解与论文迭代。</p>
            </section>

            <section class="science-login-card" aria-labelledby="science-login-title">
              <div class="science-login-switch" role="tablist" aria-label="账户操作">
                <button
                  type="button"
                  role="tab"
                  aria-selected={form.mode === "login"}
                  classList={{ active: form.mode === "login" }}
                  disabled={form.busy}
                  onClick={() => setForm({ mode: "login", password: "", confirmation: "", error: "" })}
                >
                  登录
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={form.mode === "register"}
                  classList={{ active: form.mode === "register" }}
                  disabled={form.busy}
                  onClick={() => setForm({ mode: "register", password: "", confirmation: "", error: "" })}
                >
                  注册
                </button>
              </div>

              <div class="science-login-copy">
                <span>欢迎使用</span>
                <h2 id="science-login-title">{form.mode === "register" ? "创建 scienceos 账户" : "登录科研工作台"}</h2>
                <p>
                  {form.mode === "register"
                    ? "注册后将自动登录并配置模型服务。"
                    : "登录你的 scienceos 账户，继续研究项目与工作流。"}
                </p>
              </div>

              <Show when={state.error || form.error}>
                <div class="science-login-error" role="alert">
                  {form.error || "无法连接登录服务，请确认本地服务正在运行。"}
                </div>
              </Show>

              <form onSubmit={(event) => void submit(event)}>
                <label>
                  <span>账号</span>
                  <input
                    name="username"
                    autocomplete="username"
                    placeholder={form.mode === "register" ? "请输入账号（不超过 20 个字符）" : "请输入账号"}
                    value={form.username}
                    maxlength={form.mode === "register" ? 20 : 64}
                    disabled={form.busy}
                    onInput={(event) => setForm("username", event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>密码</span>
                  <input
                    name="password"
                    type="password"
                    autocomplete={form.mode === "register" ? "new-password" : "current-password"}
                    placeholder={form.mode === "register" ? "请输入密码（8–20 个字符）" : "请输入密码"}
                    value={form.password}
                    minlength={form.mode === "register" ? 8 : undefined}
                    maxlength={form.mode === "register" ? 20 : 256}
                    disabled={form.busy}
                    onInput={(event) => setForm("password", event.currentTarget.value)}
                  />
                </label>
                <Show when={form.mode === "register"}>
                  <label>
                    <span>确认密码</span>
                    <input
                      name="confirmation"
                      type="password"
                      autocomplete="new-password"
                      placeholder="请再次输入密码"
                      value={form.confirmation}
                      minlength={8}
                      maxlength={20}
                      disabled={form.busy}
                      onInput={(event) => setForm("confirmation", event.currentTarget.value)}
                    />
                  </label>
                </Show>
                <button
                  type="submit"
                  disabled={
                    form.busy ||
                    !form.username.trim() ||
                    !form.password ||
                    (form.mode === "register" && !form.confirmation)
                  }
                >
                  {form.busy
                    ? form.mode === "register"
                      ? "正在注册并配置…"
                      : "正在登录并配置…"
                    : form.mode === "register"
                      ? "注册并进入工作台"
                      : "登录并进入工作台"}
                </button>
              </form>
            </section>

            <footer class="science-login-footer">scienceos · Local-first Research Environment</footer>
          </main>
        }
      >
        {props.children}
      </Show>
    </Show>
  )
}
