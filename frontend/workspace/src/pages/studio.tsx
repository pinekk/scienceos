import "./studio.css"
import { createMemo, createResource, For, Show, type JSX } from "solid-js"
import { useNavigate, useParams } from "@solidjs/router"
import { useSDK } from "@/context/sdk"
import { Wordmark } from "@/atlas/Wordmark"
import { domainPacks, parseProjectFiles, type ScienceProject, type ScienceWorkflow } from "@/science/project"
import {
  IconActivity,
  IconAlertCircle,
  IconArrowRight,
  IconBookOpen,
  IconBraces,
  IconCheckCircle,
  IconFile,
  IconFolderTree,
  IconHome,
  IconMessageSquare,
  IconNetwork,
  IconSettings,
  IconSparkles,
} from "@/atlas/shared/Icon"

const nav = [
  { name: "Overview", icon: IconHome, active: true },
  { name: "Workflow", icon: IconActivity },
  { name: "Research Objects", icon: IconBraces },
  { name: "Data & Evidence", icon: IconNetwork },
  { name: "Documents", icon: IconFile },
  { name: "Reviews", icon: IconMessageSquare },
]

type Data = { project: ScienceProject; workflow: ScienceWorkflow }

export default function Studio(): JSX.Element {
  const sdk = useSDK()
  const navigate = useNavigate()
  const params = useParams()
  const [data] = createResource(async (): Promise<Data | undefined> => {
    const read = async (path: string) => {
      const response = await sdk.client.file.read({ path })
      const result = response as { data?: { content?: string }; content?: string }
      return result.data?.content ?? result.content ?? ""
    }
    const files = await Promise.all([read(".science/project.json"), read(".science/workflow.json")]).catch(
      () => undefined,
    )
    if (!files) return
    return parseProjectFiles(files[0], files[1])
  })
  const pack = createMemo(() => domainPacks.find((item) => item.id === data()?.project.domainPack) ?? domainPacks[0])
  const active = createMemo(() => data()?.workflow.stages.find((stage) => stage.status === "active"))
  const progress = createMemo(() => {
    const flow = data()?.workflow.stages ?? []
    if (!flow.length) return 0
    return Math.round((flow.filter((stage) => stage.status === "complete").length / flow.length) * 100)
  })

  function session() {
    navigate(`/${params.dir}/session`)
  }

  return (
    <div class="studio-root">
      <aside class="studio-sidebar">
        <button class="studio-brand" onClick={() => navigate("/")}>
          <Wordmark size="md" />
        </button>
        <Show when={data()} fallback={<LegacyNav onSession={session} />}>
          <nav>
            <For each={nav}>
              {(item) => (
                <button classList={{ active: item.active }} onClick={() => !item.active && session()}>
                  <item.icon size={18} />
                  <span>{item.name}</span>
                </button>
              )}
            </For>
          </nav>
        </Show>
        <button class="studio-settings">
          <IconSettings size={17} />
          Settings
        </button>
      </aside>

      <main class="studio-main">
        <Show when={!data.loading} fallback={<div class="studio-loading">正在读取本地研究项目…</div>}>
          <Show when={data()} fallback={<Legacy onSession={session} />}>
            {(loaded) => (
              <>
                <header class="studio-header">
                  <div>
                    <span>SCIENCE PROJECT</span>
                    <h1>{loaded().project.name}</h1>
                  </div>
                  <div class="studio-header-actions">
                    <span class={`science-tag ${pack().tone}`}>{pack().name}</span>
                    <button onClick={session}>
                      <IconMessageSquare size={15} />
                      打开研究 Session
                    </button>
                  </div>
                </header>
                <section class="studio-hero">
                  <div class="studio-goal">
                    <span>研究目标</span>
                    <p>{loaded().project.goal}</p>
                  </div>
                  <div class="studio-progress">
                    <strong>{progress()}%</strong>
                    <span>项目进度</span>
                    <div>
                      <i style={{ width: `${progress()}%` }} />
                    </div>
                  </div>
                </section>
                <section class="studio-grid">
                  <div class="studio-panel workflow">
                    <div class="studio-panel-title">
                      <div>
                        <IconActivity size={18} />
                        <h2>研究工作流</h2>
                      </div>
                      <span>{loaded().workflow.stages.length} 个阶段</span>
                    </div>
                    <div class="studio-stages">
                      <For each={loaded().workflow.stages}>
                        {(stage) => (
                          <div
                            classList={{
                              "studio-stage": true,
                              active: stage.status === "active",
                              complete: stage.status === "complete",
                            }}
                          >
                            <span>{stage.status === "complete" ? <IconCheckCircle size={16} /> : stage.order}</span>
                            <div>
                              <strong>{stage.name}</strong>
                              <p>{stage.description}</p>
                            </div>
                            <Show when={stage.review}>
                              <small>人工检查点</small>
                            </Show>
                          </div>
                        )}
                      </For>
                    </div>
                  </div>
                  <aside class="studio-side">
                    <div class="studio-panel studio-current">
                      <div class="studio-panel-title">
                        <div>
                          <IconSparkles size={18} />
                          <h2>当前阶段</h2>
                        </div>
                      </div>
                      <Show when={active()}>
                        {(stage) => (
                          <>
                            <strong>{stage().name}</strong>
                            <p>{stage().description}</p>
                            <button onClick={session}>
                              开始协作 <IconArrowRight size={14} />
                            </button>
                          </>
                        )}
                      </Show>
                    </div>
                    <div class="studio-panel studio-local">
                      <div class="studio-panel-title">
                        <div>
                          <IconFolderTree size={18} />
                          <h2>本地项目</h2>
                        </div>
                      </div>
                      <p>
                        <code>.science/project.json</code> 已建立
                      </p>
                      <p>
                        <code>objects / evidence / runs / reviews</code>
                      </p>
                      <span>
                        <IconCheckCircle size={14} />
                        Local
                      </span>
                    </div>
                    <div class="studio-panel studio-next">
                      <div class="studio-panel-title">
                        <div>
                          <IconAlertCircle size={18} />
                          <h2>下一步</h2>
                        </div>
                      </div>
                      <p>与 Research Lead 明确范围、假设和成功标准，然后确认工作流。</p>
                    </div>
                  </aside>
                </section>
              </>
            )}
          </Show>
        </Show>
      </main>
    </div>
  )
}

function LegacyNav(props: { onSession: () => void }) {
  return (
    <nav>
      <button class="active">
        <IconHome size={18} />
        <span>Overview</span>
      </button>
      <button onClick={props.onSession}>
        <IconMessageSquare size={18} />
        <span>Sessions</span>
      </button>
    </nav>
  )
}

function Legacy(props: { onSession: () => void }) {
  return (
    <div class="studio-legacy">
      <span>
        <IconBookOpen size={30} />
      </span>
      <h1>这是一个普通 scienceos 项目</h1>
      <p>它还没有本地 Science Project 清单。你仍然可以继续使用原有科研 Session。</p>
      <button onClick={props.onSession}>
        打开 Session <IconArrowRight size={14} />
      </button>
    </div>
  )
}
