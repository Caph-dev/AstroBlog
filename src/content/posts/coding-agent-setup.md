---
title: Coding Agent 配置分享
published: 2026-10-22
description: 梳理我个人使用的Coding Agent、常驻 skill、MCP/CLI 与几个常用提示词
draft: false
tags:
  - skill
  - MCP
  - coding-agent
category: Agent
---

## Coding Agent

1. [Pi](https://pi.dev/) : 简洁、高性能、高可自定义

   ![在基准测试中的成本与性能对比](https://imgbed.caph.me/file/1793620731078_image-20261102195844118.png)

   > 基准测试来自 [databricks](https://www.databricks.com/blog/benchmarking-coding-agents-databricks-multi-million-line-codebase)

2. Cursor: 

   1. 所有 Coding Agent Desktop App 中最好的 UI/UX
   2. [pstack](https://github.com/cursor/plugins/blob/main/pstack/docs/guide/README.md)(完善的工程技能包与工作流框架) 原生支持
   3. BYOK 支持：[Cursor++ ](https://github.com/CometixSpace/CCursor ) 或 [Cursor Private Inference](https://byronfinn.github.io/en/cursor-local-download/)
   4. The X Subcription 提供充足的第一方模型额度(Grok, Composer)

3. [Oh My Pi](https://omp.sh/)

   1. 开箱即用的 TUI Coding Agent，首次尝试 TUI 的最佳选择
   2. 基于 Pi，复用 Pi 的插件生态

4. 不推荐：

   1. Claude Code：对第三方模型支持差（不支持应用内 3 个以上的模型切换，早期仅支持 200K/1M 上下文的模型的上下文压缩）
   2. Codex：Desktop 卡顿严重，CLI 可配置项少
   3. DeepSeek Harness：
      1. 官方自称**未来将出现破坏兼容性的变更**；
      2. ~~一切皆插件~~为了插件而插件：
         1. 插件市场混乱，极易出现冲突
         2. 官方不维护常用插件，开发成本和心智成本转嫁给用户

## Skill

### 常驻

1. [pstack](https://github.com/cursor/plugins/blob/main/pstack/docs/guide/README.md)：
   1. 介绍：[The Complete Guide to pstack Pt. 1](https://x.com/poteto/article/2094457600259842065), [The Complete Guide to pstack Pt. 2](https://x.com/poteto/article/2097732320606507506)
   2. 完善的开源 AI 辅助工程工作流插件/技能包
   3. Pi Coding Agent 内使用 pstack：[pi-herdr-pstack](https://github.com/giuseppecrj/pi-herdr-pstack), [pi-herdr-agents](https://github.com/giuseppecrj/pi-herdr-agents)
2. [smart-search](https://github.com/konbakuyomu/smartsearch)：联网增强（Jev 语义路由 + 多信息源整合）
3. [show-me](https://github.com/humanlayer/skills/blob/main/plugins/show-me/skills/show-me/SKILL.md)：用简洁的图表、代码形状草图和重点突出的 HTML 示例来解释当前主题
4. [archify](https://github.com/tt-a1i/archify)：将想法、计划、代码库变成精美的可互动作品
   1. 应用场景: https://archify.si/zh/gallery#proof-deployment-ownership
   2. 架构图、工作流、时序图、数据流、生命周期、实体关系图、类图、树图、时间线和瀑布图
5. [answer-with-html](https://github.com/QingYunA/answer-me-with-html)：让 Agent 根据 ASD-STE100 原则使用一页 HTML 回答复杂问题
6. [i-have-adhd](https://github.com/ayghri/i-have-adhd)：让 Agent 的回复格式更易读
7. [retro](https://github.com/mattpocock/skills/blob/main/skills/engineering/retro/SKILL.md)：一次 session 结束后，针对 coding agent 的环境（navigation、automated checks、coding standards、steering files、tooling）提出改进建议
8. [pr](https://github.com/mattpocock/skills/blob/main/skills/engineering/pr/SKILL.md)：用最小的可视化 summary 讲清变更，附上证明它有效的 before/after 证据，再做一次合并风险判断
9. [web-access](https://github.com/eze-is/web-access)：浏览器操作，不抢焦点、多Agent共享同一个Proxy

### 前端设计

1. [taste](https://github.com/leonxlnx/taste-skill)
2. [impeccable](https://github.com/pbakaus/impeccable)
3. [emilkowal](https://github.com/emilkowalski/skills)

## MCP/CLI

1. [DBX](https://github.com/t8y2/dbx)：轻量级跨平台数据库管理工具，内置 AI 助手和 MCP
2. [fast-context-mcp](https://github.com/SammySnake-d/fast-context-mcp)：Devin 提供的语义代码检索
3. [EdgeEver](https://github.com/tianma-if/edgeever)：AI 原生的个人知识库
4. [Open Code Review](https://github.com/alibaba/open-code-review)：AI 驱动的代码审查 CLI 工具

## Commands

1. 任务深化/Sharpen：

   > 我要的是这个任务更深入的版本，而不是规模更大的版本。在重写它之前，请先做四件事：
   >
   > 1. 说出这个领域顶尖的专业人士会在这里做什么，而我并没有要求。
   >
   > 2. 说出他们真正会从哪些最原始的材料开始，而不是从已经替我消化好的内容开始。
   >
   > 3. 说出他们会使用的具体方法和工具。
   >
   > 4. 说出除了你和我之外，还有什么能证明结果是正确的。
   >
   >    然后按这些要求重写我的提示词，让它恰好要求这些内容。
   >
   >    那些该由我来做的选择，请留空给我，不要替我决定。

2. 项目复用/借鉴：

   > 遇到不熟悉的功能，不要立即从零实现。
   >
   > 先检索维护活跃的同类开源项目，clone 到本地references 目录，比较实现思路、依赖和已知问题。
   >
   > 优先借鉴经过验证的设计，不要直接复制不兼容或来源不明的代码。
   >
   > references 里顺手留一张小卡片：仓库地址、当时的 commit、借鉴了哪个文件。

3. 反防御性编程：

   > 在你为不太可能或纯属假设的竞争条件或安全边缘情况添加代码之前，用一个 10 岁孩子能理解的话告诉我：
   >
   > 1. 到底会出什么问题；
   >
   > 2. 这种情况有多大可能性；
   > 3. 以及额外代码会增加多少复杂性。
   >
   > 然后等待我的 OK。不要悄悄地扩大范围来防范那些仅存在于理论中的问题。

