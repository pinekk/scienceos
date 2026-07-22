import fs from "node:fs/promises"
import path from "node:path"
import z from "zod"

export namespace ScienceProject {
  export const Pack = z.enum(["general", "physics", "biology", "chemistry", "operations-research", "machine-learning"])
  export type Pack = z.infer<typeof Pack>

  export const Stage = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    review: z.boolean(),
    order: z.number().int().positive().optional(),
    status: z.enum(["active", "pending", "complete"]).optional(),
    agent: z.string().optional(),
    specialist: z.string().optional(),
    skills: z.array(z.string()).optional(),
    validators: z.array(z.string()).optional(),
    artifacts: z.array(z.string()).optional(),
    exitCriteria: z.array(z.string()).optional(),
  })

  export const Input = z.object({
    directory: z.string().min(1),
    name: z.string().trim().min(1).max(120),
    goal: z.string().trim().min(10).max(4000),
    pack: Pack,
    stages: z.array(Stage).min(1).max(30).optional(),
  })
  export type Input = z.infer<typeof Input>

  export const Manifest = z.object({
    schema: z.literal("science.open/v1"),
    id: z.string(),
    name: z.string(),
    goal: z.string(),
    status: z.enum(["draft", "active", "review", "complete"]),
    domainPack: Pack,
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  export type Manifest = z.infer<typeof Manifest>

  const common = [
    { id: "scope", name: "研究问题与范围", description: "明确研究问题、边界、假设与成功标准。", review: true },
    { id: "evidence", name: "证据与相关工作", description: "收集、评估并组织文献、数据和已有证据。", review: true },
    { id: "design", name: "研究设计", description: "形成可执行、可证伪且可复现的研究方案。", review: true },
    { id: "execution", name: "计算与实验", description: "运行分析、仿真或实验，并记录完整来源。", review: false },
    { id: "validation", name: "结果校验", description: "检查稳健性、替代解释、误差和可复现性。", review: true },
    { id: "communication", name: "论文与传播", description: "将研究对象组织为论文、报告和可复用材料。", review: true },
    { id: "review", name: "模拟审查与迭代", description: "根据独立审查意见回流修改前序研究对象。", review: true },
  ]

  const operations = [
    common[0],
    common[1],
    {
      id: "model",
      name: "数学模型生成与校验",
      description: "定义集合、参数、变量、目标与约束，并检查一致性。",
      review: true,
    },
    { id: "theory", name: "理论推导与校验", description: "提出性质、定理与证明，并进行反例和边界检查。", review: true },
    { id: "algorithm", name: "算法与求解代码", description: "设计精确或启发式算法并生成可复现实现。", review: true },
    { id: "experiment", name: "数值实验与案例", description: "运行基准、消融、敏感性分析与实际案例。", review: false },
    common[4],
    common[5],
    common[6],
  ]

  export function workflow(pack: Pack) {
    if (pack === "operations-research") return operations
    return common
  }

  export function agents(pack: Pack) {
    const base = [
      { id: "research-lead", name: "Research Lead", role: "组织研究目标、检查点与人工决策。" },
      { id: "evidence-scout", name: "Evidence Scout", role: "检索并评估相关证据。" },
      { id: "method-reviewer", name: "Method Reviewer", role: "独立检查研究设计与结论边界。" },
    ]
    if (pack !== "operations-research") return base
    return [
      ...base,
      { id: "modeler", name: "Mathematical Modeler", role: "辅助建模并执行结构化模型校验。" },
      { id: "theorist", name: "Theory Critic", role: "检查理论推导、证明和反例。" },
      { id: "solver", name: "Solver Engineer", role: "实现算法、求解器接口和计算实验。" },
    ]
  }

  export function skills(pack: Pack) {
    const base = ["literature-review", "citation-management", "scientific-visualization", "peer-review"]
    if (pack !== "operations-research") return base
    return [...base, "multi-objective-optimization", "pymoo", "sympy"]
  }

  export function validators(pack: Pack) {
    const base = ["evidence-sufficiency", "logic-consistency", "reproducibility", "provenance"]
    if (pack !== "operations-research") return base
    return [...base, "model-consistency", "proof-checklist", "solver-verification"]
  }

  export async function init(input: Input) {
    const data = Input.parse(input)
    const root = await fs.realpath(data.directory)
    const stat = await fs.stat(root)
    if (!stat.isDirectory()) throw new Error("Project path is not a directory")

    const dir = path.join(root, ".science")
    const file = path.join(dir, "project.json")
    if (await Bun.file(file).exists()) throw new Error("Science project already exists in this directory")

    const now = new Date().toISOString()
    const manifest: Manifest = {
      schema: "science.open/v1",
      id: crypto.randomUUID(),
      name: data.name,
      goal: data.goal,
      status: "draft",
      domainPack: data.pack,
      createdAt: now,
      updatedAt: now,
    }
    const stages = (data.stages?.length ? data.stages : workflow(data.pack)).map((stage) => Stage.parse(stage))
    const flow = {
      schema: "science.workflow/v1",
      pack: data.pack,
      current: stages[0].id,
      stages: stages.map((stage, index) => ({
        ...stage,
        order: index + 1,
        status: index === 0 ? "active" : "pending",
      })),
    }
    const pack = {
      schema: "science.domain-pack/v1",
      id: data.pack,
      agents: agents(data.pack),
      skills: [...new Set([...skills(data.pack), ...stages.flatMap((stage) => stage.skills ?? [])])],
      validators: [...new Set([...validators(data.pack), ...stages.flatMap((stage) => stage.validators ?? [])])],
    }

    await Promise.all([
      fs.mkdir(path.join(dir, "objects"), { recursive: true }),
      fs.mkdir(path.join(dir, "evidence"), { recursive: true }),
      fs.mkdir(path.join(dir, "runs"), { recursive: true }),
      fs.mkdir(path.join(dir, "reviews"), { recursive: true }),
    ])
    await Promise.all([
      Bun.write(file, JSON.stringify(manifest, null, 2) + "\n"),
      Bun.write(path.join(dir, "workflow.json"), JSON.stringify(flow, null, 2) + "\n"),
      Bun.write(path.join(dir, "domain-pack.json"), JSON.stringify(pack, null, 2) + "\n"),
      Bun.write(path.join(dir, "README.md"), `# ${data.name}\n\n${data.goal}\n`),
    ])
    return { directory: root, project: manifest, workflow: flow, domainPack: pack }
  }
}
