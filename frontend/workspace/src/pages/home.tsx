import "./home.css"
import "@/styles/science-workbench.css"
import { createMemo, createResource, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { base64Encode } from "@synsci/util/encode"
import { DateTime } from "luxon"
import { useDialog } from "@synsci/ui/context/dialog"
import { useTheme } from "@synsci/ui/theme"
import { FolderPicker } from "@/atlas/FolderPicker"
import { DialogSettings } from "@/components/dialog-settings"
import { useGlobalSync } from "@/context/global-sync"
import { useLayout } from "@/context/layout"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { useServer } from "@/context/server"
import { useGlobalSDK } from "@/context/global-sdk"
import { ToastContainer, toast } from "@/atlas/Toast"
import { projectPrefs } from "@/atlas/store/projectPrefs"
import { Wordmark } from "@/atlas/Wordmark"
import {
  buildProjectFiles,
  domainPacks,
  explainSkill,
  generateStages,
  preview,
  recommend,
  type DomainPackID,
  type ScienceStage,
} from "@/science/project"
import { settingsApi } from "@/components/settings/api"
import {
  IconArrowRight,
  IconAtom,
  IconBookOpen,
  IconBraces,
  IconChevronLeft,
  IconClock,
  IconFolder,
  IconHome,
  IconLayoutGrid,
  IconMoon,
  IconPlus,
  IconSearch,
  IconSettings,
  IconSparkles,
  IconSun,
} from "@/atlas/shared/Icon"

const nav = [
  { id: "projects", name: "研究项目", icon: IconHome },
  { id: "templates", name: "模板与领域包", icon: IconBraces },
  { id: "settings", name: "Settings", icon: IconSettings },
] as const

type Account = { username?: string; balanceUsd?: number }

export default function Home(): JSX.Element {
  const sync = useGlobalSync()
  const layout = useLayout()
  const platform = usePlatform()
  const language = useLanguage()
  const server = useServer()
  const sdk = useGlobalSDK()
  const dialog = useDialog()
  const navigate = useNavigate()
  const theme = useTheme()
  const [state, setState] = createStore({
    query: "",
    goal: "",
    name: "",
    pack: "" as DomainPackID | "",
    step: "draft" as "draft" | "review" | "creating",
    view: "grid" as "grid" | "list",
    page: "projects" as "projects" | "templates",
    all: false,
    collapsed: false,
    stages: [] as ScienceStage[],
  })
  const home = createMemo(() => sync.data.path.home)
  const projects = createMemo(() => {
    const hidden = projectPrefs.hidden()
    const seen = new Map<string, (typeof sync.data.project)[number]>()
    for (const project of sync.data.project) {
      if (!project.worktree || hidden.has(project.worktree)) continue
      const saved = seen.get(project.worktree)
      if (!saved || (project.time.updated ?? project.time.created) > (saved.time.updated ?? saved.time.created)) {
        seen.set(project.worktree, project)
      }
    }
    return [...seen.values()].sort((a, b) => (b.time.updated ?? b.time.created) - (a.time.updated ?? a.time.created))
  })
  const filtered = createMemo(() => {
    const query = state.query.trim().toLowerCase()
    if (!query) return projects()
    return projects().filter((project) => project.worktree.toLowerCase().includes(query))
  })
  const displayed = createMemo(() => {
    const list = filtered()
    if (state.all || state.query.trim()) return list
    return list.slice(0, 6)
  })
  const [labels] = createResource(projects, async (list) => {
    const entries = await Promise.all(
      list.map(async (project) => {
        const response = await sdk.client.file
          .read({ directory: project.worktree, path: ".science/project.json" })
          .catch(() => undefined)
        const result = response as { data?: { content?: string }; content?: string } | undefined
        const content = result?.data?.content ?? result?.content
        if (!content) return [project.worktree, "general"] as const
        const data = JSON.parse(content) as { domainPack?: DomainPackID }
        return [project.worktree, data.domainPack ?? "general"] as const
      }),
    )
    return Object.fromEntries(entries) as Record<string, DomainPackID>
  })
  const [account] = createResource(
    () => server.url,
    (base) =>
      settingsApi<Account>(base, platform.fetch ?? fetch, "/settings/external-api/account").catch(() => ({}) as Account),
  )
  const username = createMemo(() => account()?.username || "已登录用户")
  const balance = createMemo(() => {
    const value = account()?.balanceUsd
    if (typeof value !== "number") return account.loading ? "余额读取中…" : "余额暂不可用"
    return `余额 $${value.toFixed(2)}`
  })
  const pack = createMemo(() => state.pack || recommend(state.goal))
  const meta = createMemo(() => domainPacks.find((item) => item.id === pack()) ?? domainPacks[0])
  const packName = (id: DomainPackID) => {
    if (id === "physics") return language.t("science.pack.physics")
    if (id === "biology") return language.t("science.pack.biology")
    if (id === "operations-research") return language.t("science.pack.operationsResearch")
    if (id === "chemistry") return language.t("science.pack.chemistry")
    if (id === "machine-learning") return language.t("science.pack.machineLearning")
    return language.t("science.pack.general")
  }

  function open(directory: string) {
    projectPrefs.unhide(directory)
    layout.projects.open(directory)
    server.projects.touch(directory)
    navigate(`/${base64Encode(directory)}/session`)
  }

  async function choose() {
    function resolve(result: string | string[] | null) {
      if (Array.isArray(result)) {
        for (const directory of result) open(directory)
        return
      }
      if (result) open(result)
    }
    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog({
        title: language.t("command.project.open"),
        multiple: true,
      })
      resolve(result)
      return
    }
    dialog.show(() => <FolderPicker onSelect={resolve} />, { onClose: () => resolve(null), lite: true })
  }

  function plan() {
    const goal = state.goal.trim()
    if (goal.length < 10) {
      toast.error("请先补充研究目标", "至少输入 10 个字符，以便生成可靠的初始化方案。")
      return
    }
    const pack = recommend(goal)
    setState({
      step: "review",
      pack,
      name: goal.replace(/[。！？.!?].*$/, "").slice(0, 42),
      stages: generateStages(pack),
    })
  }

  function changePack(next: DomainPackID) {
    setState({ pack: next, stages: generateStages(next) })
  }

  function move(index: number, offset: number) {
    const target = index + offset
    if (target < 0 || target >= state.stages.length) return
    const stages = [...state.stages]
    const current = stages[index]
    stages[index] = stages[target]
    stages[target] = current
    setState("stages", stages.map((stage, order) => ({ ...stage, order: order + 1 })))
  }

  function remove(index: number) {
    if (state.stages.length <= 1) return
    setState("stages", state.stages.filter((_, current) => current !== index))
  }

  function addStage() {
    const order = state.stages.length + 1
    setState("stages", [
      ...state.stages,
      {
        id: `custom-${crypto.randomUUID().slice(0, 8)}`,
        name: "新的研究阶段",
        description: "说明本阶段要完成的研究任务。",
        review: true,
        order,
        status: "pending",
        agent: "research",
        specialist: "Research Lead",
        skills: [],
        validators: [],
        artifacts: [],
        exitCriteria: ["本阶段结果已经由研究者确认"],
      },
    ])
  }

  async function init(directory: string) {
    setState("step", "creating")
    const request = platform.fetch ?? fetch
    const files = buildProjectFiles({
      name: state.name.trim(),
      goal: state.goal.trim(),
      pack: pack(),
      stages: state.stages,
    })
    const response = await request(`${server.url}/api/science/project`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directory,
        name: state.name.trim(),
        goal: state.goal.trim(),
        pack: pack(),
        stages: state.stages,
      }),
    })
    if (response.status === 404) {
      const existing = await sdk.client.file
        .read({ directory, path: ".science/project.json" })
        .then((value) => {
          const result = value as { data?: { content?: string }; content?: string }
          return result.data?.content ?? result.content ?? ""
        })
        .catch(() => "")
      if (existing.trim()) {
        setState("step", "review")
        toast.error("项目创建失败", "该目录已经包含 .science/project.json")
        return
      }
      await Promise.all(
        Object.entries(files).map(([path, content]) => sdk.client.file.write({ directory, path, content })),
      )
    } else if (!response.ok) {
      const body = (await response.json().catch(() => ({ message: response.statusText }))) as {
        message?: string
        data?: { message?: string }
      }
      setState("step", "review")
      toast.error("项目创建失败", body.data?.message ?? body.message ?? `HTTP ${response.status}`)
      return
    }
    await Promise.all(
      [".science/workflow.json", ".science/domain-pack.json"].map((path) =>
        sdk.client.file.write({ directory, path, content: files[path as keyof typeof files] }),
      ),
    )
    projectPrefs.unhide(directory)
    layout.projects.open(directory)
    server.projects.touch(directory)
    toast.info("科研项目已创建", `${directory}/.science`)
    navigate(`/${base64Encode(directory)}/session`)
  }

  async function chooseCreate() {
    function resolve(result: string | string[] | null) {
      const directory = Array.isArray(result) ? result[0] : result
      if (directory)
        void init(directory).catch((error) => {
          setState("step", "review")
          toast.error("项目创建失败", error instanceof Error ? error.message : String(error))
        })
    }
    if (platform.openDirectoryPickerDialog && server.isLocal()) {
      const result = await platform.openDirectoryPickerDialog({ title: "选择项目目录", multiple: false })
      resolve(result)
      return
    }
    dialog.show(() => <FolderPicker onSelect={resolve} />, { onClose: () => resolve(null), lite: true })
  }

  function go(id: (typeof nav)[number]["id"]) {
    if (id === "projects" || id === "templates") {
      setState("page", id)
      return
    }
    dialog.show(() => <DialogSettings initial="general" />)
  }

  return (
    <div class="science-home">
      <ToastContainer />
      <aside classList={{ "science-sidebar": true, collapsed: state.collapsed }}>
        <div class="science-brand">
          <Wordmark size="md" />
        </div>
        <nav class="science-nav">
          <For each={nav}>
            {(item) => (
              <button
                classList={{
                  "science-nav-item": true,
                  active: (item.id === "projects" || item.id === "templates") && state.page === item.id,
                }}
                title={item.name}
                onClick={() => go(item.id)}
              >
                <item.icon size={19} strokeWidth={1.6} />
                <span>{item.name}</span>
              </button>
            )}
          </For>
        </nav>
        <button class="science-account" title="账户设置" onClick={() => dialog.show(() => <DialogSettings initial="general" />)}>
          <span class="science-account-avatar">{username().slice(0, 1).toUpperCase()}</span>
          <span class="science-account-copy">
            <strong>{username()}</strong>
            <small>{balance()}</small>
          </span>
          <span class="science-account-status" />
        </button>
        <button
          class="science-collapse"
          title={state.collapsed ? "展开侧栏" : "收起侧栏"}
          onClick={() => setState("collapsed", !state.collapsed)}
        >
          <IconChevronLeft size={18} />
        </button>
      </aside>

      <section class="science-shell">
        <header class="science-topbar">
          <label class="science-search">
            <IconSearch size={19} />
            <input
              value={state.query}
              onInput={(event) => setState("query", event.currentTarget.value)}
              placeholder="搜索研究项目..."
            />
            <kbd>⌘ K</kbd>
          </label>
          <div class="science-local">
            <span />
            Local
          </div>
          <button
            class="science-icon"
            title="切换主题"
            onClick={() => theme.setColorScheme(theme.mode() === "dark" ? "light" : "dark")}
          >
            <Show when={theme.mode() === "dark"} fallback={<IconMoon size={19} />}>
              <IconSun size={19} />
            </Show>
          </button>
        </header>

        <div class="science-body">
          <Show
            when={state.page === "projects"}
            fallback={
              <Templates
                name={packName}
                onUse={(id) => {
                  setState({ page: "projects", pack: id, step: "draft" })
                }}
              />
            }
          >
          <main class="science-projects">
            <div class="science-heading">
              <div>
                <p>SCIENCE WORKBENCH</p>
                <h1>{state.all || state.query.trim() ? "全部项目" : "最近项目"}</h1>
              </div>
              <div class="science-heading-actions">
                <div class="science-view">
                  <button classList={{ active: state.view === "grid" }} onClick={() => setState("view", "grid")}>
                    <IconLayoutGrid size={16} />
                  </button>
                  <button classList={{ active: state.view === "list" }} onClick={() => setState("view", "list")}>
                    <IconBraces size={16} />
                  </button>
                </div>
                <button class="science-all" onClick={() => setState("all", !state.all)}>
                  {state.all ? "收起" : "查看全部"} <IconArrowRight size={14} />
                </button>
              </div>
            </div>

            <Show when={filtered().length > 0} fallback={<Empty onChoose={choose} query={state.query} />}>
              <div classList={{ "science-grid": true, list: state.view === "list" }}>
                <For each={displayed()}>
                  {(project, index) => {
                    const name = () => project.worktree.split("/").filter(Boolean).at(-1) ?? project.worktree
                    const kind = () =>
                      domainPacks.find((item) => item.id === labels()?.[project.worktree]) ?? domainPacks[0]
                    const path = () => (home() ? project.worktree.replace(home()!, "~") : project.worktree)
                    return (
                      <button class="science-card" onClick={() => open(project.worktree)}>
                        <div class={`science-cover cover-${index() % 5}`}>
                          <div class="science-orbit">
                            <IconAtom size={44} strokeWidth={1} />
                          </div>
                        </div>
                        <div class="science-card-body">
                          <h2>{name()}</h2>
                          <p title={path()}>{path()}</p>
                          <div class="science-card-meta">
                            <span class={`science-tag ${kind().tone}`}>{packName(kind().id)}</span>
                            <time>
                              <IconClock size={12} />
                              {DateTime.fromMillis(project.time.updated ?? project.time.created).toRelative() ?? "—"}
                            </time>
                          </div>
                        </div>
                      </button>
                    )
                  }}
                </For>
                <button class="science-new-card" onClick={choose}>
                  <span>
                    <IconPlus size={24} />
                  </span>
                  <strong>创建本地项目</strong>
                  <small>从一个研究目标或已有目录开始</small>
                </button>
              </div>
            </Show>
          </main>

          <aside class="science-create">
            <div class="science-create-title">
              <div>
                <p>NEW RESEARCH</p>
                <h2>创建研究项目</h2>
              </div>
              <IconSparkles size={22} />
            </div>
            <Show
              when={state.step !== "draft"}
              fallback={
                <>
                  <label for="research-goal">描述你的研究目标</label>
                  <div class="science-question">
                    <textarea
                      id="research-goal"
                      value={state.goal}
                      onInput={(event) => setState({ goal: event.currentTarget.value, pack: "" })}
                      maxlength={1000}
                      placeholder="输入你的研究问题、目标或初步想法…"
                    />
                    <div class="science-question-footer">
                      <span class="science-question-hint">
                        <IconSparkles size={15} />
                        AI 将据此组织工作流、智能体与 Skills
                      </span>
                      <span class="science-count">{state.goal.length}/1000</span>
                    </div>
                  </div>
                  <section class="science-pack">
                    <h3>推荐领域包</h3>
                    <Show
                      when={state.goal.trim().length >= 10}
                      fallback={
                        <div class="science-pack-empty">
                          <span>
                            <IconBraces size={25} />
                          </span>
                          <strong>等待研究目标</strong>
                          <p>
                            AI 将根据目标推荐合适的领域包
                            <br />
                            你可以随时调整
                          </p>
                        </div>
                      }
                    >
                      <div class="science-pack-result">
                        <span class={`science-tag ${meta().tone}`}>{packName(meta().id)}</span>
                        <strong>已识别研究方向</strong>
                        <p>下一步可确认工作流、Agents、Skills 与校验器。</p>
                      </div>
                    </Show>
                  </section>
                  <button class="science-create-button" onClick={plan}>
                    <IconSparkles size={18} />
                    生成项目方案
                  </button>
                </>
              }
            >
              <div class="science-review">
                <label for="project-name">项目名称</label>
                <input
                  id="project-name"
                  value={state.name}
                  onInput={(event) => setState("name", event.currentTarget.value)}
                />
                <label for="domain-pack">领域包</label>
                <select
                  id="domain-pack"
                  value={pack()}
                  onChange={(event) => changePack(event.currentTarget.value as DomainPackID)}
                >
                  <For each={domainPacks}>{(item) => <option value={item.id}>{packName(item.id)}</option>}</For>
                </select>
                <div class="science-plan-title">
                  <span class={`science-tag ${meta().tone}`}>{packName(meta().id)}</span>
                  <strong>生成的领域包 · 可修改</strong>
                </div>
                <div class="science-plan-editor">
                  <For each={state.stages}>
                    {(stage, index) => (
                      <article class="science-stage-editor">
                        <div class="science-stage-editor-head">
                          <b>{index() + 1}</b>
                          <span>研究阶段</span>
                          <button title="上移" disabled={index() === 0} onClick={() => move(index(), -1)}>↑</button>
                          <button title="下移" disabled={index() === state.stages.length - 1} onClick={() => move(index(), 1)}>↓</button>
                          <button title="删除阶段" disabled={state.stages.length <= 1} onClick={() => remove(index())}>×</button>
                        </div>
                        <input
                          aria-label="阶段名称"
                          value={stage.name}
                          onInput={(event) => setState("stages", index(), "name", event.currentTarget.value)}
                        />
                        <textarea
                          aria-label="阶段说明"
                          value={stage.description}
                          onInput={(event) => setState("stages", index(), "description", event.currentTarget.value)}
                        />
                        <label>
                          Specialist
                          <input
                            value={stage.specialist ?? ""}
                            onInput={(event) => setState("stages", index(), "specialist", event.currentTarget.value)}
                          />
                        </label>
                        <label>
                          Skill（用英文逗号分隔）
                          <input
                            value={(stage.skills ?? []).join(", ")}
                            onChange={(event) =>
                              setState(
                                "stages",
                                index(),
                                "skills",
                                event.currentTarget.value.split(",").map((item) => item.trim()).filter(Boolean),
                              )
                            }
                          />
                        </label>
                        <Show when={stage.skills?.length}>
                          <div class="science-skill-help">
                            <For each={stage.skills}>
                              {(skill) => <p><strong>{skill}</strong><span>{explainSkill(skill)}</span></p>}
                            </For>
                          </div>
                        </Show>
                        <label>
                          校验器（用英文逗号分隔）
                          <input
                            value={(stage.validators ?? []).join(", ")}
                            onChange={(event) =>
                              setState(
                                "stages",
                                index(),
                                "validators",
                                event.currentTarget.value.split(",").map((item) => item.trim()).filter(Boolean),
                              )
                            }
                          />
                        </label>
                        <label class="science-stage-review">
                          <input
                            type="checkbox"
                            checked={stage.review}
                            onChange={(event) => setState("stages", index(), "review", event.currentTarget.checked)}
                          />
                          本阶段需要研究者确认
                        </label>
                      </article>
                    )}
                  </For>
                  <button class="science-add-stage" onClick={addStage}>
                    <IconPlus size={14} /> 添加研究阶段
                  </button>
                </div>
                <p class="science-review-note">创建前可调整。所有理论、模型与结论检查点仍由研究者确认。</p>
              </div>
              <div class="science-create-actions">
                <button
                  class="science-back"
                  disabled={state.step === "creating"}
                  onClick={() => setState("step", "draft")}
                >
                  返回修改
                </button>
                <button
                  class="science-create-button"
                  disabled={state.step === "creating" || !state.name.trim()}
                  onClick={chooseCreate}
                >
                  <IconFolder size={18} />
                  {state.step === "creating" ? "正在创建..." : "选择目录并创建"}
                </button>
              </div>
            </Show>
          </aside>
          </Show>
        </div>
      </section>
    </div>
  )
}

function Templates(props: { name: (id: DomainPackID) => string; onUse: (id: DomainPackID) => void }): JSX.Element {
  return (
    <main class="science-templates">
      <div class="science-heading">
        <div>
          <p>RESEARCH TEMPLATES</p>
          <h1>模板与领域包</h1>
        </div>
      </div>
      <p class="science-templates-intro">
        领域包会初始化对应的研究工作流、专业角色、优先 Skills 与校验器。选择后仍可在创建项目前调整研究目标。
      </p>
      <div class="science-template-grid">
        <For each={domainPacks}>
          {(item) => (
            <article class="science-template-card">
              <div class={`science-template-icon ${item.tone}`}>
                <IconAtom size={24} strokeWidth={1.4} />
              </div>
              <span class={`science-tag ${item.tone}`}>{props.name(item.id)}</span>
              <h2>{props.name(item.id)}工作流</h2>
              <p>{preview(item.id).join(" · ")}</p>
              <button onClick={() => props.onUse(item.id)}>
                使用此领域包 <IconArrowRight size={14} />
              </button>
            </article>
          )}
        </For>
      </div>
    </main>
  )
}

function Empty(props: { onChoose: () => void; query: string }): JSX.Element {
  return (
    <div class="science-empty">
      <span>
        <IconBookOpen size={28} />
      </span>
      <h2>{props.query ? "没有匹配的项目" : "从第一个研究项目开始"}</h2>
      <p>{props.query ? "尝试其他关键词，或打开一个新的本地目录。" : "每个项目都是一个独立、可追溯的科研工作空间。"}</p>
      <button onClick={props.onChoose}>
        <IconPlus size={15} />
        创建本地项目
      </button>
    </div>
  )
}
