// First-run setup — the browser equivalent of the terminal `openscience init`
// wizard (cli/onboard.ts). The default path signs into the configured external
// OpenAI-compatible API and lets the local backend create + store its API token;
// alternate BYOK / managed paths remain available.
//
//   • Atlas managed → open the dashboard sign-in in a new tab, paste the `thk_`
//     key, POST /account/login-key, then resync so managed models light up.
//   • Your own keys → the real Credentials add-key flow (auth.set + global.sync).
//   • Not now → dismiss + persist a localStorage marker so we don't re-prompt.
//
// The one hosted checkout that leaves the app is "add funds"; everything else
// completes in-app without a terminal.
import { type JSX, For, Show, createSignal } from "solid-js"
import { Dialog } from "@synsci/ui/dialog"
import { useDialog } from "@synsci/ui/context/dialog"
import { Button } from "@synsci/ui/button"
import { TextField } from "@synsci/ui/text-field"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"
import { URLS } from "@/config/urls"
import { FONT_MONO, FONT_SANS } from "@/styles/tokens"
import { settingsApi } from "@/components/settings/api"

export const SETUP_DISMISS_KEY = "openscience.setup.dismissed"

export function readSetupDismissed(): boolean {
  try {
    return localStorage.getItem(SETUP_DISMISS_KEY) === "1"
  } catch {
    return false
  }
}

/** Open the setup dialog. `onDismiss` fires when the user picks "Not now" so a
 *  caller (the gate) can stop auto-prompting for the rest of the session. */
export function openSetupDialog(dialog: ReturnType<typeof useDialog>, onDismiss?: () => void) {
  dialog.show(() => <SetupDialog onDismiss={onDismiss} />)
}

const BYOK_PROVIDERS: { id: string; label: string; placeholder: string }[] = [
  { id: "anthropic", label: "Anthropic", placeholder: "sk-ant-…" },
  { id: "openai", label: "OpenAI", placeholder: "sk-…" },
  { id: "google", label: "Google", placeholder: "AIza…" },
  { id: "openrouter", label: "OpenRouter", placeholder: "sk-or-…" },
]

const money = (n: number) => `$${(n < 0 ? 0 : n).toFixed(n >= 100 ? 0 : 2)}`

type View = "external" | "choose" | "managed" | "byok" | "done"
type ExternalState = { username?: string; model?: string; models?: string[] }

export function SetupDialog(props: { onDismiss?: () => void }): JSX.Element {
  const dialog = useDialog()
  const sdk = useGlobalSDK()
  const platform = usePlatform()

  const base = () => sdk.url
  const fetchFn = () => platform.fetch ?? fetch

  const [view, setView] = createSignal<View>("external")
  const [username, setUsername] = createSignal("")
  const [password, setPassword] = createSignal("")
  const [external, setExternal] = createSignal<ExternalState>()
  const [key, setKey] = createSignal("")
  const [provider, setProvider] = createSignal(BYOK_PROVIDERS[0].id)
  const [byokKey, setByokKey] = createSignal("")
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [balance, setBalance] = createSignal<number>()

  const connectExternal = async () => {
    if (busy()) return
    const user = username().trim()
    const pass = password()
    if (!user || !pass) return
    setBusy(true)
    setError(undefined)
    try {
      const result = await settingsApi<ExternalState>(base(), fetchFn(), "/settings/external-api/connect", {
        method: "POST",
        body: JSON.stringify({ username: user, password: pass }),
      })
      setPassword("")
      setExternal(result)
      await sdk.client.global.sync()
      setView("done")
    } catch (err) {
      setPassword("")
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const dismiss = () => {
    try {
      localStorage.setItem(SETUP_DISMISS_KEY, "1")
    } catch {}
    props.onDismiss?.()
    dialog.close()
  }

  const openManaged = () => {
    setError(undefined)
    setView("managed")
    // Kick the user straight into the dashboard sign-in in a new tab; they copy
    // their key back here.
    platform.openLink(URLS.dashboardCli)
  }

  const connectManaged = async () => {
    if (busy()) return
    const k = key().trim()
    if (!k) return
    setBusy(true)
    setError(undefined)
    try {
      const res = await settingsApi<{ ok: boolean; error?: string }>(base(), fetchFn(), "/account/login-key", {
        method: "POST",
        body: JSON.stringify({ key: k }),
      })
      if (!res.ok) {
        setError(res.error || "That key was rejected. Double-check it and try again.")
        return
      }
      // Refresh the frontend so the managed provider + models appear without a
      // reload (the backend already resynced services + rebuilt the provider
      // cache).
      await sdk.client.global.sync().catch(() => {})
      const wallet = await settingsApi<{ balanceUsd: number }>(base(), fetchFn(), "/settings/wallet").catch(() => null)
      if (wallet && wallet.balanceUsd >= 0) setBalance(wallet.balanceUsd)
      setExternal(undefined)
      setView("done")
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const saveByok = async () => {
    if (busy()) return
    const k = byokKey().trim()
    if (!k) return
    setBusy(true)
    setError(undefined)
    try {
      await sdk.client.auth.set({ providerID: provider(), auth: { type: "api", key: k } })
      await sdk.client.global.sync()
      dialog.close()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog title="登录科研工作台">
      <div
        style={{ display: "flex", "flex-direction": "column", gap: "16px", "max-width": "460px", padding: "4px 2px" }}
      >
        <Show when={error()}>
          <div
            style={{
              "font-family": FONT_SANS,
              "font-size": "12px",
              color: "var(--color-error)",
              border: "1px solid var(--color-error-muted)",
              "border-radius": "4px",
              padding: "9px 11px",
              "line-height": 1.5,
            }}
          >
            {error()}
          </div>
        </Show>

        {/* ── Default external API account login ── */}
        <Show when={view() === "external"}>
          <div
            style={{
              display: "flex",
              "align-items": "center",
              "justify-content": "space-between",
              gap: "12px",
              padding: "10px 12px",
              border: "1px solid var(--color-border)",
              "border-radius": "6px",
              background: "var(--color-bg-subtle)",
            }}
          >
            <div style={{ display: "flex", "flex-direction": "column", gap: "2px" }}>
              <strong style={{ "font-family": FONT_SANS, "font-size": "13px" }}>scienceos</strong>
              <span style={{ "font-family": FONT_MONO, "font-size": "10px", color: "var(--color-text-faint)" }}>
                Science Workbench
              </span>
            </div>
            <span
              style={{
                "font-family": FONT_MONO,
                "font-size": "9px",
                color: "#176fae",
                background: "#e8f3ff",
                padding: "3px 7px",
                "border-radius": "999px",
              }}
            >
              默认接入
            </span>
          </div>
          <p style={intro()}>
            使用产品账号登录。登录状态会安全保存在本机，账号密码不会保存。
          </p>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <span style={label()}>账号</span>
            <TextField
              hideLabel
              placeholder="请输入账号"
              value={username()}
              disabled={busy()}
              onChange={setUsername}
            />
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <span style={label()}>密码</span>
            <TextField
              type="password"
              hideLabel
              placeholder="请输入密码"
              value={password()}
              disabled={busy()}
              onChange={setPassword}
              onKeyDown={(event: KeyboardEvent) => {
                if (event.key !== "Enter") return
                event.preventDefault()
                void connectExternal()
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button
              variant="primary"
              size="small"
              disabled={busy() || !username().trim() || !password()}
              onClick={() => void connectExternal()}
            >
              {busy() ? "正在登录并配置…" : "登录并自动配置"}
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="small" onClick={() => setView("choose")}>
              其他接入方式
            </Button>
          </div>
        </Show>

        {/* ── Choose a path ── */}
        <Show when={view() === "choose"}>
          <p style={intro()}>选择其他模型接入方式，之后可随时在设置中修改。</p>
          <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
            <ChoiceCard
              title="工作台账号登录"
              hint="默认"
              body="使用产品账号登录并进入科研工作台。"
              onClick={() => {
                setError(undefined)
                setView("external")
              }}
            />
            <ChoiceCard
              title="Atlas managed"
              body="Prepaid wallet, zero setup. Metered credits — no API keys needed."
              onClick={openManaged}
            />
            <ChoiceCard
              title="Your own keys"
              body="Bring an Anthropic / OpenAI / Google key. Stored on this machine, free and unmetered here."
              onClick={() => {
                setError(undefined)
                setView("byok")
              }}
            />
            <ChoiceCard
              title="Not now"
              body="Explore first with the free demo models. Set up anytime."
              muted
              onClick={dismiss}
            />
          </div>
        </Show>

        {/* ── Atlas managed: paste key ── */}
        <Show when={view() === "managed"}>
          <p style={intro()}>
            A sign-in tab just opened at <span style={{ color: "var(--color-text)" }}>{hostOf(URLS.dashboardCli)}</span>
            . Copy your <code style={code()}>thk_</code> API key from there and paste it below.
          </p>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <span style={label()}>Atlas API key</span>
            <TextField
              type="password"
              hideLabel
              placeholder="thk_…"
              value={key()}
              disabled={busy()}
              onChange={setKey}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void connectManaged()
                }
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button
              variant="primary"
              size="small"
              disabled={busy() || !key().trim()}
              onClick={() => void connectManaged()}
            >
              {busy() ? "connecting…" : "connect"}
            </Button>
            <Button variant="ghost" size="small" onClick={() => platform.openLink(URLS.dashboardCli)}>
              reopen sign-in
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="small" onClick={() => setView("choose")}>
              back
            </Button>
          </div>
        </Show>

        {/* ── Managed connected ── */}
        <Show when={view() === "done"}>
          <Show
            when={external()}
            fallback={
              <p style={intro()}>
                Connected to Atlas.
                <Show when={balance() !== undefined}> Wallet balance {money(balance()!)}.</Show> Managed models are ready.
              </p>
            }
          >
            {(result) => (
              <div style={{ display: "flex", "flex-direction": "column", gap: "8px" }}>
                <p style={intro()}>工作台账号已连接，登录状态和模型配置已安全保存到本机。</p>
                <div
                  style={{
                    display: "grid",
                    "grid-template-columns": "auto minmax(0, 1fr)",
                    gap: "6px 12px",
                    padding: "11px 12px",
                    border: "1px solid var(--color-border)",
                    "border-radius": "6px",
                    "font-family": FONT_MONO,
                    "font-size": "10px",
                  }}
                >
                  <span style={{ color: "var(--color-text-faint)" }}>账号</span>
                  <span>{result().username}</span>
                  <span style={{ color: "var(--color-text-faint)" }}>默认模型</span>
                  <span>{result().model}</span>
                  <span style={{ color: "var(--color-text-faint)" }}>可用模型</span>
                  <span>{result().models?.length ?? 0} 个</span>
                </div>
              </div>
            )}
          </Show>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button variant="primary" size="small" onClick={() => dialog.close()}>
              开始研究
            </Button>
            <Show when={!external()}>
              <Button variant="ghost" size="small" onClick={() => platform.openLink(URLS.dashboardCli)}>
                add funds
              </Button>
            </Show>
          </div>
        </Show>

        {/* ── Bring your own key ── */}
        <Show when={view() === "byok"}>
          <p style={intro()}>Add a provider key. It's stored on this machine and billed directly by the provider.</p>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <span style={label()}>Provider</span>
            <div style={{ display: "flex", "flex-wrap": "wrap", gap: "6px" }}>
              <For each={BYOK_PROVIDERS}>
                {(p) => (
                  <button
                    type="button"
                    onClick={() => setProvider(p.id)}
                    style={{
                      all: "unset",
                      cursor: "pointer",
                      padding: "5px 12px",
                      "border-radius": "4px",
                      border: provider() === p.id ? "1px solid var(--color-text)" : "1px solid var(--color-border)",
                      background: provider() === p.id ? "var(--color-accent-subtle)" : "transparent",
                      "font-family": FONT_MONO,
                      "font-size": "11px",
                      color: provider() === p.id ? "var(--color-text)" : "var(--color-text-muted)",
                    }}
                  >
                    {p.label}
                  </button>
                )}
              </For>
            </div>
          </div>
          <div style={{ display: "flex", "flex-direction": "column", gap: "6px" }}>
            <span style={label()}>API key</span>
            <TextField
              type="password"
              hideLabel
              placeholder={BYOK_PROVIDERS.find((p) => p.id === provider())?.placeholder ?? "sk-…"}
              value={byokKey()}
              disabled={busy()}
              onChange={setByokKey}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === "Enter") {
                  e.preventDefault()
                  void saveByok()
                }
              }}
            />
          </div>
          <div style={{ display: "flex", gap: "8px", "align-items": "center" }}>
            <Button
              variant="primary"
              size="small"
              disabled={busy() || !byokKey().trim()}
              onClick={() => void saveByok()}
            >
              {busy() ? "saving…" : "save key"}
            </Button>
            <span style={{ flex: 1 }} />
            <Button variant="ghost" size="small" onClick={() => setView("choose")}>
              back
            </Button>
          </div>
        </Show>
      </div>
    </Dialog>
  )
}

function ChoiceCard(props: {
  title: string
  body: string
  hint?: string
  muted?: boolean
  onClick: () => void
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        all: "unset",
        cursor: "pointer",
        display: "flex",
        "flex-direction": "column",
        gap: "3px",
        padding: "12px 14px",
        "border-radius": "4px",
        border: "1px solid var(--color-border)",
        background: props.muted ? "transparent" : "var(--color-surface-solid, transparent)",
        transition: "border-color 120ms ease, background 120ms ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--color-border-strong)")}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
    >
      <span style={{ display: "flex", "align-items": "center", gap: "8px" }}>
        <span class="text-14-medium text-text-strong">{props.title}</span>
        <Show when={props.hint}>
          <span
            style={{
              "font-family": FONT_MONO,
              "font-size": "10px",
              padding: "1px 6px",
              "border-radius": "999px",
              background: "var(--color-accent-subtle)",
              color: "var(--color-text-muted)",
            }}
          >
            {props.hint}
          </span>
        </Show>
      </span>
      <span class="text-12-regular text-text-weak" style={{ "line-height": 1.5 }}>
        {props.body}
      </span>
    </button>
  )
}

function hostOf(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
}

function intro(): JSX.CSSProperties {
  return {
    "font-family": FONT_SANS,
    "font-size": "13px",
    color: "var(--color-text-muted)",
    "line-height": 1.55,
    margin: 0,
  }
}

function label(): JSX.CSSProperties {
  return { "font-family": FONT_MONO, "font-size": "10px", "letter-spacing": "0.04em", color: "var(--color-text-faint)" }
}

function code(): JSX.CSSProperties {
  return {
    "font-family": FONT_MONO,
    "font-size": "11px",
    padding: "1px 4px",
    "border-radius": "3px",
    background: "var(--color-bg-elevated)",
    border: "1px solid var(--color-border)",
  }
}
