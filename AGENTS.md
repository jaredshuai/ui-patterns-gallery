## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues, managed with the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical triage roles mapped to the default labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `GLOSSARY.md` plus `docs/adr/` at the repo root. See `docs/agents/domain.md`.
<!-- lazypack:start block=resident-discipline src=DECISIONS.md@0.7.0 gen=cee4751c0d95793d input=48b1e9221ebc158f fp=30c1985d51f97844 -->
## 工程纪律指针 (lazypack-discipline)

> 派生自 lazypack-discipline 固定层 DECISIONS.md@0.7.0（依据 lazypack-setup 内置快照编译，来源内容标识: 6f537b1ef390cbbfa9cea245fc615cb5f727fe2b；离线事实源查阅 lazypack-setup/references/DECISIONS.md）。本段为受管托管区，请勿手工破坏标记行。

- **纪律唯一事实源**：固定层规则跨项目不变。如需修改固定层，须走 [多 AI 讨论章程（§9）](docs/agents/section9-discussion-protocol.md)。
- **双角色门禁要求**：执行者和审查者都必须运行适用的质量门禁；未接线、不适用、运行失败等按事实报告，不宣称通过或已生效。
- **角色与职责**：查阅 [docs/agents/roles.md](docs/agents/roles.md)，遵循各角色防撞车边界与项目指引。
- **产物登记册**：查阅 [docs/ARTIFACTS.md](docs/ARTIFACTS.md)，产物状态与归属以登记册为准。
- **编码标准**：查阅 [CODING_STANDARDS.md](CODING_STANDARDS.md)，执行者与审查者共同执行。
- **发版纪律**：查阅 [RELEASE.md](RELEASE.md)，提交、版本与发版按该文件执行。
<!-- lazypack:end block=resident-discipline -->
