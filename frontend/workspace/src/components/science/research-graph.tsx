import "./research-graph.css"
import { createMemo, For, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { useSDK } from "@/context/sdk"
import { useWorkflow } from "@/context/workflow"
import { IconCheckCircle, IconClock, IconFolderTree, IconNetwork } from "@/atlas/shared/Icon"
import { toast } from "@/atlas/Toast"

export function ResearchGraph(): JSX.Element {
  const sdk = useSDK()
  const language = useLanguage()
  const workflow = useWorkflow()
  const chinese = () => language.locale().startsWith("zh")
  const stages = workflow.stages
  const done = createMemo(() => stages().filter((stage) => stage.status === "complete").length)
  const progress = createMemo(() => (stages().length ? Math.round((done() / stages().length) * 100) : 0))
  const title = createMemo(
    () => workflow.project()?.name ?? sdk.directory.split("/").filter(Boolean).at(-1) ?? sdk.directory,
  )
  const goal = createMemo(() => workflow.project()?.goal)
  const status = (value: "active" | "pending" | "complete") => {
    if (value === "complete") return chinese() ? "已完成" : "Complete"
    if (value === "active") return chinese() ? "进行中" : "In progress"
    return chinese() ? "待开始" : "Pending"
  }
  const select = (id: string) =>
    workflow
      .select(id)
      .catch((error) =>
        toast.error(
          language.t("science.workflow.switchFailed"),
          error instanceof Error ? error.message : String(error),
        ),
      )

  return (
    <section class="research-graph">
      <header class="research-graph-summary">
        <div class="research-graph-heading">
          <span class="research-graph-icon">
            <IconNetwork size={15} />
          </span>
          <div>
            <small>{chinese() ? "本地研究项目" : "Local research project"}</small>
            <strong title={title()}>{title()}</strong>
          </div>
          <i>{chinese() ? "本地" : "LOCAL"}</i>
        </div>
        <Show when={goal()}>{(value) => <p>{value()}</p>}</Show>
        <div class="research-graph-progress-copy">
          <span>{chinese() ? "研究进度" : "Research progress"}</span>
          <b>
            {done()} / {stages().length} · {progress()}%
          </b>
        </div>
        <div class="research-graph-progress" aria-label={`${progress()}%`}>
          <span style={{ width: `${progress()}%` }} />
        </div>
      </header>

      <div class="research-graph-scroll atlas-scroll">
        <div class="research-graph-root">
          <IconFolderTree size={16} />
          <span>
            <small>{chinese() ? "项目根节点" : "Project root"}</small>
            <strong>{title()}</strong>
          </span>
        </div>
        <div class="research-graph-trunk" />

        <div class="research-graph-nodes">
          <For each={stages()}>
            {(stage, index) => {
              const selected = () => workflow.current()?.id === stage.id
              return (
                <div class="research-graph-branch">
                  <Show when={index() > 0}>
                    <i class="research-graph-edge" />
                  </Show>
                  <button
                    classList={{
                      "research-graph-node": true,
                      active: selected(),
                      complete: stage.status === "complete",
                    }}
                    disabled={workflow.saving()}
                    onClick={() => void select(stage.id)}
                  >
                    <span class="research-graph-marker">
                      <Show
                        when={stage.status === "complete"}
                        fallback={stage.status === "active" ? <IconClock size={14} /> : stage.order}
                      >
                        <IconCheckCircle size={14} />
                      </Show>
                    </span>
                    <span class="research-graph-node-copy">
                      <span>
                        <small>{chinese() ? `阶段 ${stage.order}` : `Stage ${stage.order}`}</small>
                        <em class={`research-graph-state ${stage.status}`}>{status(stage.status)}</em>
                      </span>
                      <strong>{stage.name}</strong>
                      <small>{stage.description}</small>
                    </span>
                  </button>

                  <Show when={selected()}>
                    <div class="research-graph-detail">
                      <Show when={stage.specialist}>
                        <div>
                          <span>{language.t("science.workflow.specialist")}</span>
                          <strong>{stage.specialist}</strong>
                        </div>
                      </Show>
                      <Show when={stage.skills?.length}>
                        <div>
                          <span>{language.t("science.workflow.skills")}</span>
                          <p>
                            <For each={stage.skills}>{(item) => <i>{item}</i>}</For>
                          </p>
                        </div>
                      </Show>
                      <Show when={stage.validators?.length}>
                        <div>
                          <span>{language.t("science.workflow.validators")}</span>
                          <p>
                            <For each={stage.validators}>{(item) => <i>{item}</i>}</For>
                          </p>
                        </div>
                      </Show>
                      <Show when={stage.artifacts?.length}>
                        <div>
                          <span>{language.t("science.workflow.artifacts")}</span>
                          <p>
                            <For each={stage.artifacts}>{(item) => <i>{item}</i>}</For>
                          </p>
                        </div>
                      </Show>
                    </div>
                  </Show>
                </div>
              )
            }}
          </For>
        </div>
      </div>
    </section>
  )
}
