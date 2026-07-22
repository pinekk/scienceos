import { For, Show, createMemo, createSignal, onMount } from "solid-js"
import { currentDirectory } from "@/utils/base64"
import { Icon } from "@synsci/ui/icon"
import { Switch } from "@synsci/ui/switch"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"

// Outbound domain allow-list. Wired to a real backend store:
// GET/PUT /settings/network (backend/cli/src/settings/network.ts). The catalog
// of science-connector domain groups is served by the backend; this panel
// persists which groups are enabled plus any custom domains. The effective
// allow-list is readable by the backend via Network.allowlist().

type Group = { id: string; label: string; description: string; domains: string[] }
type State = { allowlistEnabled: boolean; enabled: string[]; custom: string[] }

const NETWORK_GROUPS: Record<string, { label: string; description: string }> = {
  "package-management": { label: "软件包管理", description: "Python、R、JavaScript、Rust 软件包索引与源码托管。" },
  "ncbi-nih": { label: "NCBI / NIH", description: "PubMed、Entrez E-utilities 与 NIH 数据服务。" },
  "genomics-biology": { label: "基因组与生物学", description: "Ensembl、UCSC Genome Browser 与 EBI 资源。" },
  proteomics: { label: "蛋白质组学", description: "UniProt、RCSB PDB 与 AlphaFold 结构服务。" },
  "literature-citations": { label: "文献与引文", description: "预印本、Semantic Scholar、Crossref 与 DOI 服务。" },
  "clinical-pharma": { label: "临床与药物", description: "临床试验、药物数据库与监管机构。" },
}

export default function Network() {
  const sdk = useGlobalSDK()
  const platform = usePlatform()
  const language = useLanguage()
  const chinese = () => language.locale() === "zh" || language.locale() === "zht"
  const text = (en: string, cn: string) => (chinese() ? cn : en)
  const groupText = (group: Group) => NETWORK_GROUPS[group.id] ?? group
  const doFetch = platform.fetch ?? fetch

  const [catalog, setCatalog] = createSignal<Group[]>([])
  const [state, setState] = createSignal<State>({ allowlistEnabled: false, enabled: [], custom: [] })
  const [loading, setLoading] = createSignal(true)
  const [saving, setSaving] = createSignal(false)
  const [error, setError] = createSignal<string>()
  const [expanded, setExpanded] = createSignal<Record<string, boolean>>({})
  const [customDomain, setCustomDomain] = createSignal("")

  const endpoint = () => `${sdk.url}/settings/network?directory=${encodeURIComponent(currentDirectory())}`

  async function load() {
    setLoading(true)
    setError(undefined)
    try {
      const res = await doFetch(endpoint())
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { catalog: Group[]; state: State }
      setCatalog(data.catalog)
      setState(data.state)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function persist(next: State) {
    const previous = state()
    setState(next)
    setSaving(true)
    setError(undefined)
    try {
      const res = await doFetch(endpoint(), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      })
      if (!res.ok) throw new Error(await res.text())
      const data = (await res.json()) as { state: State }
      setState(data.state)
    } catch (e) {
      setState(previous)
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSaving(false)
    }
  }

  function toggleAllowlist(on: boolean) {
    void persist({ ...state(), allowlistEnabled: on })
  }

  function toggleGroup(id: string, on: boolean) {
    const enabled = on ? [...new Set([...state().enabled, id])] : state().enabled.filter((g) => g !== id)
    void persist({ ...state(), enabled })
  }

  function toggleExpanded(id: string) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  function addCustom() {
    const raw = customDomain()
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
    if (!raw) return
    setCustomDomain("")
    if (state().custom.includes(raw)) return
    void persist({ ...state(), custom: [...state().custom, raw] })
  }

  function removeCustom(domain: string) {
    void persist({ ...state(), custom: state().custom.filter((d) => d !== domain) })
  }

  function clearCustom() {
    if (state().custom.length === 0) return
    if (!window.confirm(text("Remove all custom allowed domains?", "移除全部自定义允许域名？"))) return
    void persist({ ...state(), custom: [] })
  }

  const effectiveCount = createMemo(() => {
    const set = new Set(state().custom)
    for (const group of catalog()) if (state().enabled.includes(group.id)) for (const d of group.domains) set.add(d)
    return set.size
  })

  onMount(() => void load())

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 px-4 py-8 sm:p-8 max-w-[760px]">
          <h2 class="text-16-medium text-text-strong">{chinese() ? "网络" : "Network"}</h2>
          <p class="text-13-regular text-text-weak">
            {chinese()
              ? "控制智能体可以访问的域名。可启用预设科研连接器域名组，也可以添加自定义域名。"
              : "Control which domains the agent may reach. Enable curated science-connector groups or add your own domains."}
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-5 px-4 pb-10 sm:px-8 max-w-[760px]">
        <Show when={error()}>
          <div class="rounded-xs border border-border-weak-base bg-surface-base/40 px-3 py-2 text-12-regular text-text-danger">
            {error()}
          </div>
        </Show>

        {/* Master allow-list toggle */}
        <div class="flex items-center justify-between gap-3 rounded-[4px] border border-border-weak-base bg-surface-base/40 px-4 py-3">
          <div class="flex flex-col gap-0.5 min-w-0">
            <span class="text-13-medium text-text-strong">{text("Enforce allow-list", "强制使用允许列表")}</span>
            <span class="text-12-regular text-text-weak">
              {state().allowlistEnabled
                ? text(`Only the ${effectiveCount()} allowed domains below are reachable.`, `仅可访问下方 ${effectiveCount()} 个允许域名。`)
                : text("Advisory only — the agent may reach any domain.", "当前仅作提示，智能体可以访问任意域名。")}
            </span>
          </div>
          <Switch checked={state().allowlistEnabled} onChange={toggleAllowlist} />
        </div>

        <Show when={!loading()} fallback={<div class="text-13-regular text-text-weak py-6 text-center">{text("Loading…", "加载中…")}</div>}>
          {/* Domain groups */}
          <div class="flex flex-col gap-2">
            <span class="atlas-section-label px-1">{text("Domain sets", "预设域名组")}</span>
            <For each={catalog()}>
              {(group) => {
                const on = () => state().enabled.includes(group.id)
                const open = () => !!expanded()[group.id]
                return (
                  <div class="rounded-[4px] border border-border-weak-base bg-surface-base/40 overflow-hidden">
                    <div class="flex items-center gap-2 px-3 py-3">
                      <button
                        type="button"
                        class="flex items-center justify-center size-6 rounded-xs text-icon-weak-base hover:bg-surface-raised-base/60 transition-colors flex-shrink-0"
                        onClick={() => toggleExpanded(group.id)}
                        aria-label={open() ? text("Collapse", "收起") : text("Expand", "展开")}
                      >
                        <Icon name={open() ? "chevron-down" : "chevron-right"} size="small" />
                      </button>
                      <div class="flex flex-col gap-0.5 min-w-0 flex-1">
                        <span class="text-13-medium text-text-strong truncate">{chinese() ? groupText(group).label : group.label}</span>
                        <span class="text-12-regular text-text-weak truncate">
                          {chinese() ? groupText(group).description : group.description} · {group.domains.length} {text("domains", "个域名")}
                        </span>
                      </div>
                      <Switch checked={on()} onChange={(v) => toggleGroup(group.id, v)} />
                    </div>
                    <Show when={open()}>
                      <div class="flex flex-wrap gap-1.5 px-4 pb-3 pt-0">
                        <For each={group.domains}>
                          {(domain) => (
                            <span class="inline-flex items-center h-6 px-2 rounded-xs bg-surface-raised-base/50 text-11-regular text-text-weak font-mono">
                              {domain}
                            </span>
                          )}
                        </For>
                      </div>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>

          {/* Custom allowed domains */}
          <div class="flex flex-col gap-2">
            <div class="flex items-center justify-between px-1">
              <span class="atlas-section-label">{text("Allowed domains", "自定义允许域名")}</span>
              <Show when={state().custom.length > 0}>
                <button
                  type="button"
                  class="text-11-medium text-text-danger hover:opacity-80 transition-opacity"
                  disabled={saving()}
                  onClick={clearCustom}
                >
                  {text("clear", "清空")}
                </button>
              </Show>
            </div>
            <div class="rounded-[4px] border border-border-weak-base bg-surface-base/40 overflow-hidden">
              <For
                each={state().custom}
                fallback={<span class="block px-4 py-3 text-12-regular text-text-weak/70">{text("No custom domains.", "暂无自定义域名。")}</span>}
              >
                {(domain) => (
                  <div class="group flex items-center gap-2 px-4 py-2.5 border-b border-border-weak-base/60 last:border-b-0">
                    <span class="flex-1 text-13-regular text-text-base font-mono truncate">{domain}</span>
                    <button
                      type="button"
                      class="flex items-center justify-center size-6 rounded-xs text-icon-weak-base hover:text-text-danger opacity-0 group-hover:opacity-100 transition-opacity"
                      disabled={saving()}
                      onClick={() => removeCustom(domain)}
                      aria-label={text(`Remove ${domain}`, `移除 ${domain}`)}
                    >
                      <Icon name="close-small" size="small" />
                    </button>
                  </div>
                )}
              </For>
              <div class="flex items-center gap-2 px-3 py-2.5 border-t border-border-weak-base">
                <input
                  type="text"
                  placeholder={text("add a domain, e.g. example.org", "添加域名，例如 example.org")}
                  value={customDomain()}
                  disabled={saving()}
                  class="flex-1 h-9 px-3 rounded-xs border border-border-weak-base bg-surface-raised-base/40 text-13-regular text-text-strong placeholder:text-text-weak/60 outline-none focus:border-border-base font-mono"
                  onInput={(e) => setCustomDomain(e.currentTarget.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                />
                <button
                  type="button"
                  class="flex items-center gap-1.5 h-9 px-4 rounded-xs text-13-medium bg-surface-raised-base-active text-text-strong hover:opacity-90 transition-opacity disabled:opacity-50"
                  disabled={saving() || !customDomain().trim()}
                  onClick={addCustom}
                >
                  <Icon name="plus" size="small" />
                  {text("add", "添加")}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </div>
  )
}
