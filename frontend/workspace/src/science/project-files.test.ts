import { describe, expect, test } from "bun:test"
import { buildProjectFiles, explainSkill, generateStages, parseProjectFiles, stageProfile, stageSystem } from "./project"

describe("buildProjectFiles", () => {
  test("builds a complete operations research fallback project", () => {
    const files = buildProjectFiles({
      name: "Robust routing",
      goal: "Study robust routing under uncertain customer demand.",
      pack: "operations-research",
    })
    const parsed = parseProjectFiles(files[".science/project.json"], files[".science/workflow.json"])
    expect(parsed?.project.domainPack).toBe("operations-research")
    expect(parsed?.workflow.stages.some((stage) => stage.id === "model")).toBe(true)
    expect(Object.keys(files)).toContain(".science/reviews/.gitkeep")
  })

  test("assigns distinct runtime capabilities to workflow stages", () => {
    expect(stageProfile("model", "operations-research").skills).toContain("sympy")
    expect(stageProfile("theory", "operations-research").validators).toContain("proof-checklist")
    expect(stageProfile("experiment", "operations-research").skills).toContain("statistical-analysis")
    expect(stageProfile("evidence", "biology").agent).toBe("biology")
  })

  test("builds hidden prompt context from the active stage", () => {
    const stage = {
      id: "model",
      name: "Model",
      description: "Build model",
      order: 3,
      review: true,
      status: "active" as const,
      ...stageProfile("model", "operations-research"),
    }
    const system = stageSystem(stage)
    expect(system).toContain("sympy")
    expect(system).toContain("stage-priority-skills")
    expect(system).toContain("not optional recommendations")
    expect(system).toContain("model-consistency")
    expect(system).toContain("Mathematical Modeler")
  })

  test("keeps generated workflow edits and explains its skills", () => {
    const stages = generateStages("general")
    stages[0] = { ...stages[0], name: "自定义研究问题", skills: ["literature-review"] }
    const files = buildProjectFiles({
      name: "Edited workflow",
      goal: "Keep researcher edits in the generated workflow configuration.",
      pack: "general",
      stages,
    })
    const parsed = parseProjectFiles(files[".science/project.json"], files[".science/workflow.json"])
    expect(parsed?.workflow.stages[0].name).toBe("自定义研究问题")
    expect(explainSkill("literature-review")).toContain("文献")
  })
})
