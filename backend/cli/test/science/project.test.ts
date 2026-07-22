import { afterEach, describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { ScienceProject } from "../../src/science/project"

const dirs: string[] = []

afterEach(async () => {
  await Promise.all(dirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })))
})

describe("ScienceProject", () => {
  test("initializes a real local operations research project", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openscience-project-"))
    dirs.push(dir)
    const result = await ScienceProject.init({
      directory: dir,
      name: "Robust routing",
      goal: "Study robust vehicle routing under uncertain customer demand.",
      pack: "operations-research",
    })

    expect(result.project.schema).toBe("science.open/v1")
    expect(result.workflow.stages.some((stage) => stage.id === "model")).toBe(true)
    expect(result.domainPack.validators).toContain("solver-verification")
    expect(await Bun.file(path.join(dir, ".science/project.json")).exists()).toBe(true)
    expect((await fs.stat(path.join(dir, ".science/objects"))).isDirectory()).toBe(true)
  })

  test("refuses to overwrite an existing science project", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openscience-project-"))
    dirs.push(dir)
    const input = {
      directory: dir,
      name: "General study",
      goal: "Evaluate a reproducible scientific question with multiple sources.",
      pack: "general" as const,
    }
    await ScienceProject.init(input)
    expect(ScienceProject.init(input)).rejects.toThrow("already exists")
  })

  test("persists an edited generated workflow with stage skills", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "openscience-project-"))
    dirs.push(dir)
    const result = await ScienceProject.init({
      directory: dir,
      name: "Custom study",
      goal: "Evaluate a custom scientific workflow with an explicit verification stage.",
      pack: "general",
      stages: [
        {
          id: "custom-check",
          name: "自定义校验",
          description: "执行研究者定义的校验流程。",
          review: true,
          specialist: "Method Reviewer",
          skills: ["statistical-analysis"],
          validators: ["robustness"],
        },
      ],
    })

    expect(result.workflow.current).toBe("custom-check")
    expect(result.workflow.stages[0].skills).toEqual(["statistical-analysis"])
    expect(result.domainPack.skills).toContain("statistical-analysis")
    expect(result.domainPack.validators).toContain("robustness")
  })
})
