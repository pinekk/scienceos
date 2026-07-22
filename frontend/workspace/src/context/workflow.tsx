import { createMemo, createResource, type ParentProps } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@synsci/ui/context"
import { useSDK } from "./sdk"
import {
  parseProjectFiles,
  stageSystem,
  stageProfile,
  workflowTemplate,
  type DomainPackID,
  type ScienceProject,
  type ScienceStage,
  type ScienceWorkflow,
} from "@/science/project"

type Data = { project?: ScienceProject; workflow: ScienceWorkflow }

export const { use: useWorkflow, provider: WorkflowProvider } = createSimpleContext({
  name: "Workflow",
  init: (_props: ParentProps) => {
    const sdk = useSDK()
    const [state, setState] = createStore({ saving: false })
    const [data, actions] = createResource(async (): Promise<Data> => {
      const read = async (file: string) => {
        const response = await sdk.client.file.read({ path: file })
        const result = response as { data?: { content?: string }; content?: string }
        return result.data?.content ?? result.content ?? ""
      }
      const files = await Promise.all([read(".science/project.json"), read(".science/workflow.json")]).catch(
        () => undefined,
      )
      const parsed = files ? parseProjectFiles(files[0], files[1]) : undefined
      const pack = parsed?.project.domainPack ?? "general"
      const workflow = parsed?.workflow ?? {
        schema: "science.workflow/v1" as const,
        pack,
        current: "scope",
        stages: workflowTemplate(pack).map((stage, index) => ({
          ...stage,
          ...stageProfile(stage.id, pack),
          order: index + 1,
          status: index === 0 ? ("active" as const) : ("pending" as const),
        })),
      }
      return {
        project: parsed?.project,
        workflow: {
          ...workflow,
          stages: workflow.stages.map((stage) => ({ ...stageProfile(stage.id, pack), ...stage })),
        },
      }
    })

    const project = createMemo(() => data()?.project)
    const workflow = createMemo(() => data()?.workflow)
    const pack = createMemo<DomainPackID>(() => project()?.domainPack ?? workflow()?.pack ?? "general")
    const stages = createMemo<ScienceStage[]>(() => workflow()?.stages ?? [])
    const current = createMemo(() => {
      const flow = workflow()
      if (!flow) return
      return (
        flow.stages.find((stage) => stage.id === flow.current) ?? flow.stages.find((stage) => stage.status === "active")
      )
    })

    async function save(next: ScienceWorkflow) {
      const previous = data()
      actions.mutate({ project: previous?.project, workflow: next })
      setState("saving", true)
      return sdk.client.file
        .write({ path: ".science/workflow.json", content: JSON.stringify(next, null, 2) + "\n" })
        .catch((error) => {
          if (previous) actions.mutate(previous)
          throw error
        })
        .finally(() => setState("saving", false))
    }

    async function select(id: string) {
      const flow = workflow()
      const target = flow?.stages.find((stage) => stage.id === id)
      if (!flow || !target) return
      const next = {
        ...flow,
        current: id,
        stages:
          target.status === "complete"
            ? flow.stages
            : flow.stages.map((stage) => ({
                ...stage,
                status:
                  stage.id === id
                    ? ("active" as const)
                    : stage.status === "active"
                      ? ("pending" as const)
                      : stage.status,
              })),
      }
      await save(next)
    }

    async function complete() {
      const flow = workflow()
      const stage = current()
      if (!flow || !stage || stage.status === "complete") return
      const index = flow.stages.findIndex((item) => item.id === stage.id)
      const following = flow.stages[index + 1]
      const next = {
        ...flow,
        current: following?.id ?? stage.id,
        stages: flow.stages.map((item) => ({
          ...item,
          status:
            item.id === stage.id
              ? ("complete" as const)
              : item.id === following?.id
                ? ("active" as const)
                : item.status,
        })),
      }
      await save(next)
    }

    const system = createMemo(() => {
      const stage = current()
      if (!stage) return
      return stageSystem(stage)
    })

    return {
      project,
      workflow,
      pack,
      stages,
      current,
      system,
      saving: () => state.saving,
      select,
      complete,
    }
  },
})
