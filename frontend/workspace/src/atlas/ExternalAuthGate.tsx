import "./external-auth.css"
import { Show, createEffect, createResource, createSignal, type ParentProps } from "solid-js"
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
  const [form, setForm] = createStore({ username: "", password: "" })
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal("")
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

  const login = async (event: SubmitEvent) => {
    event.preventDefault()
    if (busy()) return
    const username = form.username.trim()
    if (!username || !form.password) return
    setBusy(true)
    setError("")
    const result = await settingsApi<State>(server.url, request(), "/settings/external-api/connect", {
      method: "POST",
      body: JSON.stringify({ username, password: form.password }),
    }).catch((reason) => {
      setError(reason instanceof Error ? reason.message : String(reason))
      return undefined
    })
    setForm("password", "")
    setBusy(false)
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
              <div class="science-login-copy">
                <span>欢迎使用</span>
                <h2 id="science-login-title">登录科研工作台</h2>
                <p>登录你的 scienceos 账户，继续研究项目与工作流。</p>
              </div>

              <Show when={state.error || error()}>
                <div class="science-login-error" role="alert">
                  {error() || "无法连接登录服务，请确认本地服务正在运行。"}
                </div>
              </Show>

              <form onSubmit={(event) => void login(event)}>
                <label>
                  <span>账号</span>
                  <input
                    name="username"
                    autocomplete="username"
                    placeholder="请输入账号"
                    value={form.username}
                    disabled={busy()}
                    onInput={(event) => setForm("username", event.currentTarget.value)}
                  />
                </label>
                <label>
                  <span>密码</span>
                  <input
                    name="password"
                    type="password"
                    autocomplete="current-password"
                    placeholder="请输入密码"
                    value={form.password}
                    disabled={busy()}
                    onInput={(event) => setForm("password", event.currentTarget.value)}
                  />
                </label>
                <button type="submit" disabled={busy() || !form.username.trim() || !form.password}>
                  {busy() ? "正在登录并配置…" : "登录并进入工作台"}
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
