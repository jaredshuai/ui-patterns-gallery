<!-- lazypack:start block=artifacts-register src=DECISIONS.md@0.7.0 gen=cee4751c0d95793d input=9d7cfbe86a9a312e fp=11150c7fd7c8311a -->
# 产物登记册 (ARTIFACTS)

> 派生自 lazypack-discipline 固定层 DECISIONS.md@0.7.0（依据 lazypack-setup 内置快照编译，来源内容标识: 6f537b1ef390cbbfa9cea245fc615cb5f727fe2b；离线事实源查阅 lazypack-setup/references/DECISIONS.md）§4。
> 原则：一个东西只有一个家；能推导出来的不手写；有生命周期的写清何时死。

## 1. 产物状态词与流转规则

| 状态词 | 含义 | 流转约束 |
|---|---|---|
| `current` | 当前唯一的现行有效基准 | **在同一主题/用途的权威范围内全局唯一**（不同 feature 规格或多项有效 ADR 可各自主管对应主题的 current）。经明确确认存在替代关系的新产物标为 `current` 时，被替代旧产物方可标记为 `superseded` 并互指；未确认替代关系的不自动假定废弃 |
| `reference` | 外部素材、外部规范、参考设计 | 永久作为参照依据 |
| `exploration` | 探索方案、对比调研 | 仅供比对，不作为实现基准 |
| `superseded` | 已废弃或被取代的旧产物 | 状态变化本身不构成文件移动或删除授权；按材料类型、保留目的、有效引用及四步关卡（确认替代、核查引用、安全封存、登记更新）处理；setup 首期保持原位保留（preserve-existing），不执行自动 `git mv` 物理迁移；登记行同步更新互指新产物 |
| `pipeline` | 由源文件生成的派生品（图标、数据） | 登记源与生成器命令；严禁手工修改派生文件，重新运行 pipeline 生成 |
| `wip` | 正在编写或设计中的未决草案 | 完成后裁决为 `current` 或归档 |

> [!IMPORTANT]
> **未登记产物视为未决**：册上查不到的产物，先向维护者核实，严禁按文件名或创建日期猜测新旧！

## 2. 现存产物登记表

| 产物相对路径 | 类别 | 状态 | 来源/对应票/ADR | 说明 |
|---|---|---|---|---|
| docs/agents/issue-tracker.md | 任务跟踪 | current | 维护者 / 工单流程变更时 | GitHub Issues 工作流（Matt Pocock 前置配置） |
| CODING_STANDARDS.md | 编码规范 | current | 审查者 / 固定层升级时 | lazypack-discipline 固定层 §6 |
| RELEASE.md | 发版规范 | current | 书记员 / 发版流程变更时 | lazypack-discipline 固定层 §5 |
| docs/agents/roles.md | 角色映射 | current | 维护者 / 角色或 Skill 变化时 | lazypack-discipline 固定层 §3 |
<!-- lazypack:end block=artifacts-register -->

## 3. 项目自选材料与存量文档登记（非受管协作区）

> 本区由团队与 Agent 协同维护，位于受管托管区外部。遵循保留既有模式（preserve-existing），登记已存在各逻辑区域的实际原件、探索性想法池、访谈纪要归档或外部参考素材。八大逻辑区域（方向、需求与验收、设计与决策、规则与术语、工作与进度、现状与使用说明、验证与观察、来源材料）为逻辑导航，不强制预建八个物理目录。支持 path#anchor 细粒度定位；setup 重跑保持本区已有手工排版与字节不变：

| 产物相对路径 / 锚点 | 逻辑区域 | 状态 | 维护者 / 更新触发 | 来源 / 替代关系 / 依据说明 |
|---|---|---|---|---|
| docs/ideas/inbox.md | 来源材料 | exploration | 团队与规划者 / 讨论产生新想法时 | 规划研讨碎片想法池；非现行基准 |
| docs/interviews/ | 来源材料 | reference | 团队与规划者 / 每次研讨结束后 | 结构化纪要入口目录；仅存脱敏材料 |
| docs/agents/domain.md | 规则与术语 | reference | Matt skills 配置 / 领域文档规则变更时 | 单上下文 domain docs 消费规则 |
| docs/agents/triage-labels.md | 规则与术语 | reference | Matt skills 配置 / triage 标签变化时 | 五角色 triage 标签映射 |
| docs/agents/section9-discussion-protocol.md | 规则与术语 | current | 固定层维护者 / §9 章程变更时 | 修改固定层条文的多 AI 讨论执行规程 |
| CHANGELOG.md | 工作与进度 | current | 书记员 / 每次发版时 | 提交历史编译的变更记录；Keep a Changelog |
| scripts/changelog.mjs | 工作与进度 | current | 书记员 / 发版流程变更时 | CHANGELOG 播种、校验与发版编译工具 |
| scripts/check_report_layers.mjs | 验证与观察 | current | 审查者 / 报告分层规则变更时 | 交付报告分层段落播种与结构校验器 |
| package.json | 现状与使用说明 | current | 维护者 / 启动或质量门禁命令变化时 | 本地静态服务器与质量门禁入口：npm start、npm run check、npm run test:e2e |
| playwright.config.mjs | 验证与观察 | current | 维护者 / 浏览器或测试入口变化时 | Playwright 配置；自动拉起 scripts/serve.mjs 并对 127.0.0.1:4173 执行回归；chromium / webkit / firefox 三浏览器 project |
| scripts/serve.mjs | 现状与使用说明 | current | 维护者 / 本地服务行为变化时 | 零依赖静态服务器；禁止目录穿越，关闭缓存便于本地验收 |
| tests/gallery.spec.mjs | 验证与观察 | current | 维护者 / 交互行为或回归范围变化时 | Playwright 端到端回归：遮罩拦截、浮层定位、焦点陷阱、键盘/触屏路径、重复 id 与热区尺寸；三浏览器各跑一遍 |
<!-- 示例：| README.md#快速开始 | 现状与使用说明 | current | 维护者与各角色 / 上手流程或命令变化时 | 根目录快速上手指引 | -->
<!-- 示例：| specs/pay-v2.md | 需求与验收 | current | 规划者 / 支付网关变更时 | 现行支付网关重构规格；supersedes specs/pay-v1.md | -->
<!-- 示例：| specs/pay-v1.md | 需求与验收 | superseded | 规划者 / 历史保留 | 初版支付规格；superseded by specs/pay-v2.md；原位保留 | -->
<!-- 示例：| docs/ideas/inbox.md | 来源材料 | exploration | 团队与规划者 / 讨论产生新想法时 | 规划研讨碎片想法池，非现行基准 | -->
