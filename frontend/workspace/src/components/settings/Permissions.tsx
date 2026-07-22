// Permissions — governs what the agent may do to your registry (create/update
// agents, publish/edit/attach/detach skills, attach/detach connectors) and at
// what scope, plus the per-tool allow/ask/deny defaults.
//
// Registry-write grants persist to routes/settings/permissions.ts (a real JSON
// store under ~/.openscience/). Tool defaults reuse the config `permission` key via
// the existing globalSync-backed component.
import { Component, For, Show, createResource, createSignal } from "solid-js"
import { Select } from "@synsci/ui/select"
import { Button } from "@synsci/ui/button"
import { showToast } from "@synsci/ui/toast"
import { useGlobalSDK } from "@/context/global-sdk"
import { usePlatform } from "@/context/platform"
import { settingsApi } from "./api"
import { PermissionToolDefaults } from "../settings-permissions"
import { useLanguage } from "@/context/language"

type Scope = "global" | "session" | "revoked"
interface PermissionInfo {
  grants: Record<string, Scope>
}

const ACTIONS = [
  {
    id: "create_agent",
    title: "Create agent",
    zh: "创建智能体",
    description: "Register a new specialist agent.",
    zhDescription: "注册新的专业智能体。",
  },
  {
    id: "update_agent",
    title: "Update agent",
    zh: "更新智能体",
    description: "Modify an existing agent's config or prompt.",
    zhDescription: "修改现有智能体的配置或提示词。",
  },
  {
    id: "publish_skill",
    title: "Publish skill",
    zh: "发布 Skill",
    description: "Publish a skill to the registry.",
    zhDescription: "将 Skill 发布到注册表。",
  },
  {
    id: "edit_skill",
    title: "Edit skill",
    zh: "编辑 Skill",
    description: "Change the contents of a skill.",
    zhDescription: "修改 Skill 内容。",
  },
  {
    id: "attach_skill",
    title: "Attach skill",
    zh: "加载 Skill",
    description: "Enable a skill for an agent or session.",
    zhDescription: "为智能体或对话启用 Skill。",
  },
  {
    id: "detach_skill",
    title: "Detach skill",
    zh: "卸载 Skill",
    description: "Remove a skill from an agent or session.",
    zhDescription: "从智能体或对话中移除 Skill。",
  },
  {
    id: "attach_connector",
    title: "Attach MCP",
    zh: "加载 MCP",
    description: "Enable an MCP connector for use.",
    zhDescription: "启用一个 MCP 服务。",
  },
  {
    id: "detach_connector",
    title: "Detach MCP",
    zh: "卸载 MCP",
    description: "Disable an MCP connector.",
    zhDescription: "停用一个 MCP 服务。",
  },
]

const SCOPES: { value: Scope; label: string }[] = [
  { value: "session", label: "Session" },
  { value: "global", label: "Global" },
  { value: "revoked", label: "Revoked" },
]

const Permissions: Component = () => {
  const language = useLanguage()
  const chinese = () => language.locale() === "zh" || language.locale() === "zht"
  const text = (en: string, cn: string) => (chinese() ? cn : en)
  const scopes = () =>
    SCOPES.map((scope) => ({
      ...scope,
      label: text(scope.label, scope.value === "session" ? "当前对话" : scope.value === "global" ? "全局" : "已撤销"),
    }))
  const sdk = useGlobalSDK()
  const platform = usePlatform()
  const fetchFn = platform.fetch ?? fetch
  const call = <T,>(path: string, init?: RequestInit) =>
    settingsApi<T>(sdk.url, fetchFn, `/settings/permissions${path}`, init)

  const [info, { mutate, refetch }] = createResource(() => call<PermissionInfo>(""))
  const [busy, setBusy] = createSignal(false)

  const scopeFor = (id: string): Scope => info()?.grants[id] ?? "session"

  const setScope = async (id: string, scope: Scope) => {
    setBusy(true)
    try {
      mutate(await call<PermissionInfo>(`/${id}`, { method: "PUT", body: JSON.stringify({ scope }) }))
    } catch (err) {
      showToast({
        title: text("Failed to update permission", "更新权限失败"),
        description: err instanceof Error ? err.message : String(err),
      })
      refetch()
    }
    setBusy(false)
  }

  const revokeAll = async () => {
    setBusy(true)
    try {
      mutate(
        await call<PermissionInfo>("/revoke-all", {
          method: "POST",
          body: JSON.stringify({ actions: ACTIONS.map((a) => a.id) }),
        }),
      )
    } catch (err) {
      showToast({
        title: text("Failed to revoke", "撤销权限失败"),
        description: err instanceof Error ? err.message : String(err),
      })
      refetch()
    }
    setBusy(false)
  }

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 px-4 py-8 sm:p-8 max-w-[760px]">
          <h2 class="text-16-medium text-text-strong">{chinese() ? "权限" : "Permissions"}</h2>
          <p class="text-13-regular text-text-weak">
            {chinese()
              ? "控制智能体可以修改的注册表内容，以及工具的使用方式。"
              : "Control what the agent may change in your registry and how it uses tools."}
          </p>
        </div>
      </div>

      <div class="flex flex-col gap-8 px-4 pb-12 sm:px-8 max-w-[760px]">
        {/* ── Registry actions ── */}
        <div class="flex flex-col gap-3">
          <div class="flex items-end justify-between gap-4">
            <div class="flex flex-col gap-0.5">
              <h3 class="text-13-medium text-text-weak tracking-wide">{text("Registry actions", "注册表操作")}</h3>
              <p class="text-12-regular text-text-weak">
                {text(
                  "Grant each action at Global scope (all sessions) or Session scope (this session), or revoke it.",
                  "可将每项操作授权给所有对话或仅当前对话，也可以完全撤销。",
                )}
              </p>
            </div>
            <Button size="small" variant="ghost" disabled={busy()} onClick={revokeAll}>
              {text("revoke all", "全部撤销")}
            </Button>
          </div>

          <div class="border border-border-weak-base rounded-[4px] overflow-hidden bg-surface-base/40">
            <For each={ACTIONS}>
              {(action) => (
                <div class="flex flex-wrap items-center justify-between gap-4 px-4 py-3.5 border-b border-border-weak-base last:border-none">
                  <div class="flex flex-col gap-0.5 min-w-0">
                    <span class="text-14-medium text-text-strong">{chinese() ? action.zh : action.title}</span>
                    <span class="text-12-regular text-text-weak">
                      {chinese() ? action.zhDescription : action.description}
                    </span>
                  </div>
                  <Show when={info()} fallback={<span class="text-12-regular text-text-weak/60">…</span>}>
                    <Select
                      options={scopes()}
                      current={scopes().find((s) => s.value === scopeFor(action.id))}
                      value={(o) => o.value}
                      label={(o) => o.label}
                      onSelect={(o) => o && setScope(action.id, o.value)}
                      variant="secondary"
                      size="small"
                      triggerVariant="settings"
                    />
                  </Show>
                </div>
              )}
            </For>
          </div>
        </div>

        {/* ── Tool defaults (existing, config-backed) ── */}
        <PermissionToolDefaults />
      </div>
    </div>
  )
}

export default Permissions
