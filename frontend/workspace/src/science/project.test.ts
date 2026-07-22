import { describe, expect, test } from "bun:test"
import { parseProjectFiles } from "./project"

describe("parseProjectFiles", () => {
  test("returns undefined for an uninitialized project", () => {
    expect(parseProjectFiles("", "")).toBeUndefined()
  })

  test("returns undefined for a damaged project manifest", () => {
    expect(parseProjectFiles('{"schema":', '{"schema":"science.workflow/v1","stages":[]}')).toBeUndefined()
  })

  test("parses a valid science project", () => {
    const project = JSON.stringify({ schema: "science.open/v1", name: "Test" })
    const workflow = JSON.stringify({ schema: "science.workflow/v1", stages: [] })
    expect(parseProjectFiles(project, workflow)?.project.name).toBe("Test")
  })
})
