import "./workflow-sidebar.css"
import { createEffect, createMemo, For, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useSDK } from "@/context/sdk"
import { useLanguage } from "@/context/language"
import { useWorkflow } from "@/context/workflow"
import { useLocal } from "@/context/local"
import { domainPacks, type ScienceStage } from "@/science/project"
import { toast } from "@/atlas/Toast"
import { IconCheckCircle, IconChevronRight, IconMessageSquare, IconPlus, IconTrash } from "@/atlas/shared/Icon"

type Session = { id: string; title?: string }

export function WorkflowSidebar(props: {
  sessions: Session[]
  activeId?: string
  creating: boolean
  onNew: () => void
  onSelect: (id: string) => void
  onDelete: (id: string) => void
}): JSX.Element {
  const sdk = useSDK()
  const language = useLanguage()
  const workflow = useWorkflow()
  const local = useLocal()
  const [state, setState] = createStore({ view: "workflow" as "workflow" | "chat" })
  const flow = workflow.stages
  const pack = createMemo(() => domainPacks.find((item) => item.id === workflow.pack()) ?? domainPacks[0])
  const packName = createMemo(() => {
    if (pack().id === "physics") return language.t("science.pack.physics")
    if (pack().id === "biology") return language.t("science.pack.biology")
    if (pack().id === "operations-research") return language.t("science.pack.operationsResearch")
    if (pack().id === "chemistry") return language.t("science.pack.chemistry")
    if (pack().id === "machine-learning") return language.t("science.pack.machineLearning")
    return language.t("science.pack.general")
  })
  const title = createMemo(
    () => workflow.project()?.name ?? sdk.directory.split("/").filter(Boolean).at(-1) ?? sdk.directory,
  )
  const chooseAgent = (stage: ScienceStage | undefined) => {
    const name = stage?.agent
    if (!name) return
    const available = local.agent.all().some((agent) => agent.name === name)
    local.agent.set(available ? name : "research")
  }

  createEffect(() => chooseAgent(workflow.current()))

  async function select(stage: ScienceStage) {
    return workflow
      .select(stage.id)
      .then(() => chooseAgent(stage))
      .catch((error) =>
        toast.error(
          language.t("science.workflow.switchFailed"),
          error instanceof Error ? error.message : String(error),
        ),
      )
  }

  async function complete() {
    return workflow
      .complete()
      .then(() => chooseAgent(workflow.current()))
      .catch((error) =>
        toast.error(
          language.t("science.workflow.completeFailed"),
          error instanceof Error ? error.message : String(error),
        ),
      )
  }

  return (
    <aside class="workflow-sidebar">
      <header>
        <span>{language.t("science.workflow.title")}</span>
        <h2 title={title()}>{title()}</h2>
        <div>
          <i class={`science-tag ${pack().tone}`}>{packName()}</i>
          <small>{language.t("science.workflow.stages", { count: flow().length })}</small>
        </div>
      </header>

      <div class="workflow-view-tabs" role="tablist" aria-label={language.t("science.workflow.viewTabs")}>
        <button
          role="tab"
          aria-selected={state.view === "workflow"}
          classList={{ active: state.view === "workflow" }}
          onClick={() => setState("view", "workflow")}
        >
          {language.t("science.workflow.tabWorkflow")}
        </button>
        <button
          role="tab"
          aria-selected={state.view === "chat"}
          classList={{ active: state.view === "chat" }}
          onClick={() => setState("view", "chat")}
        >
          {language.t("science.workflow.tabChat")}
        </button>
      </div>

      <div class="workflow-scroll atlas-scroll">
        <Show when={state.view === "workflow"}>
          <div class="workflow-list">
            <For each={flow()}>
              {(stage, index) => {
                const selected = () => workflow.current()?.id === stage.id
                return (
                  <div classList={{ "workflow-node-group": true, active: selected() }}>
                    <button
                      classList={{ "workflow-node": true, active: selected(), complete: stage.status === "complete" }}
                      onClick={() => void select(stage)}
                    >
                      <span class="workflow-marker">
                        <Show when={stage.status === "complete"} fallback={stage.order}>
                          <IconCheckCircle size={15} />
                        </Show>
                      </span>
                      <span class="workflow-copy">
                        <strong>{stage.name}</strong>
                        <small>{stage.description}</small>
                      </span>
                      <Show when={selected()}>
                        <IconChevronRight class="workflow-arrow" size={14} />
                      </Show>
                      <Show when={index() < flow().length - 1}>
                        <i class="workflow-line" />
                      </Show>
                    </button>
                    <Show when={selected() && stage.status !== "complete"}>
                      <button class="workflow-complete" disabled={workflow.saving()} onClick={() => void complete()}>
                        <IconCheckCircle size={14} />
                        {workflow.saving()
                          ? language.t("science.workflow.completing")
                          : language.t("science.workflow.complete")}
                      </button>
                    </Show>
                  </div>
                )
              }}
            </For>
          </div>
        </Show>

        <Show when={state.view === "chat"}>
          <section class="workflow-sessions">
            <div class="workflow-sessions-title">
              <IconMessageSquare size={15} />
              <strong>{language.t("science.workflow.conversations")}</strong>
            </div>
            <button class="workflow-new" disabled={props.creating} onClick={props.onNew}>
              <IconPlus size={14} />
              {props.creating
                ? language.t("science.workflow.creatingSession")
                : language.t("science.workflow.newSession")}
            </button>
            <div class="workflow-session-list">
              <For each={props.sessions}>
                {(session) => (
                  <button
                    classList={{ active: props.activeId === session.id }}
                    onClick={() => props.onSelect(session.id)}
                  >
                    <IconMessageSquare size={13} />
                    <span>{session.title || language.t("science.workflow.untitledSession")}</span>
                    <i
                      role="button"
                      title={language.t("session.delete.title")}
                      onClick={(event) => {
                        event.stopPropagation()
                        props.onDelete(session.id)
                      }}
                    >
                      <IconTrash size={12} />
                    </i>
                  </button>
                )}
              </For>
            </div>
          </section>
        </Show>
      </div>
    </aside>
  )
}
