export type DomainPackID = "general" | "physics" | "biology" | "chemistry" | "operations-research" | "machine-learning"

export type ScienceProject = {
  schema: "science.open/v1"
  id: string
  name: string
  goal: string
  status: "draft" | "active" | "review" | "complete"
  domainPack: DomainPackID
  createdAt: string
  updatedAt: string
}

export type ScienceStage = {
  id: string
  name: string
  description: string
  review: boolean
  order: number
  status: "active" | "pending" | "complete"
  agent?: string
  specialist?: string
  skills?: string[]
  validators?: string[]
  artifacts?: string[]
  exitCriteria?: string[]
}

export type ScienceWorkflow = {
  schema: "science.workflow/v1"
  pack: DomainPackID
  current: string
  stages: ScienceStage[]
}

export function parseProjectFiles(project: string, workflow: string) {
  if (!project.trim() || !workflow.trim()) return
  try {
    const manifest = JSON.parse(project) as Partial<ScienceProject>
    const flow = JSON.parse(workflow) as Partial<ScienceWorkflow>
    if (manifest.schema !== "science.open/v1") return
    if (flow.schema !== "science.workflow/v1" || !Array.isArray(flow.stages)) return
    return { project: manifest as ScienceProject, workflow: flow as ScienceWorkflow }
  } catch {
    return
  }
}

export const domainPacks = [
  { id: "general", name: "General Research", tone: "slate" },
  { id: "physics", name: "Physics", tone: "blue" },
  { id: "biology", name: "Biology", tone: "green" },
  { id: "operations-research", name: "Operations Research", tone: "amber" },
  { id: "chemistry", name: "Chemistry", tone: "violet" },
  { id: "machine-learning", name: "Machine Learning", tone: "cyan" },
] as const satisfies readonly { id: DomainPackID; name: string; tone: string }[]

export function recommend(goal: string): DomainPackID {
  const text = goal.toLowerCase()
  if (/protein|cell|gene|biology|生物|细胞|基因|蛋白/.test(text)) return "biology"
  if (/supply|schedule|routing|optimization|运筹|优化|调度|供应链/.test(text)) return "operations-research"
  if (/chemical|molecule|reaction|化学|分子|反应/.test(text)) return "chemistry"
  if (/machine learning|neural|模型训练|机器学习|神经网络/.test(text)) return "machine-learning"
  if (/quantum|material|physics|量子|材料|物理/.test(text)) return "physics"
  return "general"
}

export function preview(pack: DomainPackID) {
  if (pack === "operations-research")
    return ["研究问题", "数学模型与校验", "理论推导", "算法与代码", "数值实验", "论文与审查"]
  return ["研究问题", "证据与相关工作", "研究设计", "计算与实验", "结果校验", "论文与审查"]
}

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

export function workflowTemplate(pack: DomainPackID) {
  return pack === "operations-research" ? operations : common
}

export const skillDescriptions: Record<string, string> = {
  "literature-review": "检索、筛选并归纳相关文献，梳理已有结论、研究缺口和可引用证据。",
  "citation-management": "管理参考文献与引用关系，检查引文是否完整、准确并可追溯。",
  "scientific-visualization": "把实验数据和研究结论转成清晰、可复现的科研图表。",
  "peer-review": "模拟同行评审，从贡献、方法、证据和表达方面提出修改意见。",
  "scholar-evaluation": "按学术标准评估研究的新颖性、严谨性、影响力和潜在缺陷。",
  "statistical-analysis": "选择并执行统计分析，检查显著性、效应量、误差与稳健性。",
  "multi-objective-optimization": "构建和分析多目标优化问题，处理目标冲突与 Pareto 解集。",
  pymoo: "使用 pymoo 实现多目标优化算法、约束处理、基准测试与结果分析。",
  sympy: "使用符号计算辅助化简公式、求解方程、验证推导并搜索边界或反例。",
  "venue-templates": "根据目标期刊或会议规范组织论文结构、格式、图表和投稿材料。",
}

export function explainSkill(name: string) {
  return skillDescriptions[name] ?? "为当前研究阶段提供可复用的专业执行步骤和质量检查方法。"
}

const profiles: Record<
  string,
  Pick<ScienceStage, "specialist" | "skills" | "validators" | "artifacts" | "exitCriteria">
> = {
  scope: {
    specialist: "Research Lead",
    skills: ["literature-review"],
    validators: ["scope-completeness", "falsifiability"],
    artifacts: ["研究问题", "核心假设", "范围与边界"],
    exitCriteria: ["研究问题明确且可证伪", "关键假设和边界已由研究者确认"],
  },
  evidence: {
    specialist: "Evidence Scout",
    skills: ["literature-review", "citation-management"],
    validators: ["evidence-sufficiency", "source-quality"],
    artifacts: ["文献矩阵", "证据清单", "研究缺口"],
    exitCriteria: ["关键主张均有可追溯证据", "研究缺口与已有工作区别清晰"],
  },
  model: {
    specialist: "Mathematical Modeler",
    skills: ["sympy", "multi-objective-optimization"],
    validators: ["model-consistency", "assumption-coverage", "dimension-check"],
    artifacts: ["数学模型", "符号与变量表", "建模假设"],
    exitCriteria: ["目标、约束和变量定义一致", "模型假设和适用边界已确认"],
  },
  theory: {
    specialist: "Theory Critic",
    skills: ["sympy"],
    validators: ["proof-checklist", "logic-consistency", "counterexample-search"],
    artifacts: ["命题与定理", "证明草稿", "反例与边界条件"],
    exitCriteria: ["推导步骤可复核", "反例和边界情况已经检查"],
  },
  algorithm: {
    specialist: "Solver Engineer",
    skills: ["pymoo", "multi-objective-optimization"],
    validators: ["solver-verification", "complexity-check"],
    artifacts: ["算法设计", "伪代码", "可运行求解代码"],
    exitCriteria: ["算法与数学模型一致", "实现通过小规模实例和边界测试"],
  },
  experiment: {
    specialist: "Experiment Analyst",
    skills: ["statistical-analysis", "scientific-visualization"],
    validators: ["reproducibility", "provenance", "benchmark-coverage"],
    artifacts: ["实验方案", "运行记录", "结果与图表"],
    exitCriteria: ["实验可复现且参数完整", "基准、消融和敏感性分析充分"],
  },
  design: {
    specialist: "Method Advisor",
    skills: ["statistical-analysis"],
    validators: ["method-validity", "reproducibility"],
    artifacts: ["研究设计", "变量与测量方案"],
    exitCriteria: ["研究设计能够检验核心假设", "方法和成功标准已确认"],
  },
  execution: {
    specialist: "Experiment Analyst",
    skills: ["statistical-analysis", "scientific-visualization"],
    validators: ["reproducibility", "provenance"],
    artifacts: ["实验运行", "数据与结果"],
    exitCriteria: ["运行记录和数据来源完整", "结果可以复现"],
  },
  validation: {
    specialist: "Method Reviewer",
    skills: ["statistical-analysis", "scientific-visualization"],
    validators: ["logic-consistency", "robustness", "alternative-explanations"],
    artifacts: ["校验报告", "稳健性分析", "局限性"],
    exitCriteria: ["主要结论通过稳健性检查", "替代解释和局限性已说明"],
  },
  communication: {
    specialist: "Scientific Writer",
    skills: ["citation-management", "venue-templates", "scientific-visualization"],
    validators: ["citation-completeness", "claim-evidence-alignment"],
    artifacts: ["论文草稿", "图表与附录"],
    exitCriteria: ["论文主张与证据一致", "引用、图表和复现信息完整"],
  },
  review: {
    specialist: "Peer Reviewer",
    skills: ["peer-review", "scholar-evaluation"],
    validators: ["evidence-sufficiency", "logic-consistency", "reproducibility"],
    artifacts: ["模拟审稿意见", "修改清单", "作者回复"],
    exitCriteria: ["关键审稿意见均已处理", "修改已经回流到对应研究对象"],
  },
}

export function stageProfile(id: string, pack: DomainPackID) {
  const profile = profiles[id] ?? profiles.scope
  const agent =
    pack === "biology" ? "biology" : pack === "physics" ? "physics" : pack === "machine-learning" ? "ml" : "research"
  return { agent, ...profile }
}

export function generateStages(pack: DomainPackID): ScienceStage[] {
  return workflowTemplate(pack).map((stage, index) => ({
    ...stage,
    ...stageProfile(stage.id, pack),
    order: index + 1,
    status: index === 0 ? "active" : "pending",
  }))
}

export function stageSystem(stage: ScienceStage) {
  const skills = stage.skills ?? []
  const priority =
    skills.length === 0
      ? "No stage-priority skills are configured."
      : [
          `<stage-priority-skills names="${skills.join(", ")}">`,
          "These are primary execution capabilities for this stage, not optional recommendations.",
          "Before conducting specialized work or presenting a stage result, invoke the skill tool to load every listed skill that materially applies.",
          "Do not substitute a matching stage-priority skill with an unrelated global skill. Use global skills only when they provide necessary complementary capability.",
          "</stage-priority-skills>",
        ].join("\n")
  return [
    "You are collaborating inside a structured scientific workflow.",
    `Current stage: ${stage.name} (${stage.id}).`,
    `Stage objective: ${stage.description}`,
    `Act as: ${stage.specialist ?? "Research Lead"}.`,
    priority,
    `Required validators: ${(stage.validators ?? []).join(", ") || "none"}. Apply these checks before presenting a result as validated.`,
    `Expected research objects: ${(stage.artifacts ?? []).join(", ") || "none"}.`,
    `Exit criteria: ${(stage.exitCriteria ?? []).join("; ") || "researcher confirmation"}.`,
    "Keep assumptions explicit, preserve provenance, distinguish suggestions from verified results, and leave final scientific decisions to the researcher.",
  ].join("\n")
}

export function buildProjectFiles(input: {
  name: string
  goal: string
  pack: DomainPackID
  stages?: ScienceStage[]
}) {
  const now = new Date().toISOString()
  const stages = input.stages?.length ? input.stages : generateStages(input.pack)
  const project: ScienceProject = {
    schema: "science.open/v1",
    id: crypto.randomUUID(),
    name: input.name,
    goal: input.goal,
    status: "draft",
    domainPack: input.pack,
    createdAt: now,
    updatedAt: now,
  }
  const workflow: ScienceWorkflow = {
    schema: "science.workflow/v1",
    pack: input.pack,
    current: "scope",
    stages: stages.map((stage, index) => ({
      ...stageProfile(stage.id, input.pack),
      ...stage,
      order: index + 1,
      status: index === 0 ? "active" : "pending",
    })),
  }
  const extra = input.pack === "operations-research"
  const pack = {
    schema: "science.domain-pack/v1",
    id: input.pack,
    agents: ["research-lead", "evidence-scout", "method-reviewer", ...(extra ? ["modeler", "theorist", "solver"] : [])],
    skills: [...new Set(stages.flatMap((stage) => stage.skills ?? []))],
    validators: [
      "evidence-sufficiency",
      "logic-consistency",
      "reproducibility",
      "provenance",
      ...(extra ? ["model-consistency", "proof-checklist", "solver-verification"] : []),
    ],
  }
  const text = (value: unknown) => JSON.stringify(value, null, 2) + "\n"
  return {
    ".science/project.json": text(project),
    ".science/workflow.json": text(workflow),
    ".science/domain-pack.json": text(pack),
    ".science/README.md": `# ${input.name}\n\n${input.goal}\n`,
    ".science/objects/.gitkeep": "",
    ".science/evidence/.gitkeep": "",
    ".science/runs/.gitkeep": "",
    ".science/reviews/.gitkeep": "",
  }
}
