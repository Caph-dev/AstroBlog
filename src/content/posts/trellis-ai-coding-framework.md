---
title: Trellis：Spec-Driven Development 框架
published: 2026-07-18
description: 给团队同事的一篇介绍：Trellis 想解决什么问题，它怎样用 hook 自动注入上下文、让团队共享规范、让 AI 跨会话记住项目，以及上手前该知道的代价。
tags:
  - Trellis
  - Spec
  - Coding Agent
  - harness
category: Agent
draft: false
---

# Trellis：Spec-Driven Development 框架

最近我在用 Trellis，用下来觉得值得跟大家讲一讲。

先说我们大概都碰到过的几件事。同一个需求，今天让 AI 写一遍，明天换个会话再写一遍，风格能差很多。新开一个会话，上次聊好的约定它全忘了，得再讲一遍。还有团队里那些不成文的规矩，比如错误怎么返回、目录怎么分，都在 PR 评论和老同事脑子里，AI 看不到，只能按它自己的习惯来写。

Trellis 想解决的就是这几件事。它的做法也不复杂：把规范、任务、会话记录都放进仓库，再用 hook 在合适的时候把它们送到 AI 面前。

官网的说法是，AI 的能力像藤蔓一样生长，充满活力但四处蔓延，Trellis 是给它搭的脚手架（trellis 本来就是花架的意思），引导它沿着你们定的路径走。

## 它长什么样

装好之后，仓库里会多一个 `.trellis/` 目录，里面主要三样东西：

| 目录 | 放什么 |
| --- | --- |
| `.trellis/spec/` | 团队的编码规范，Markdown 写的，按 frontend、backend、guides 分文件 |
| `.trellis/tasks/` | 一个任务一个目录，里面有需求文档 `prd.md`，复杂任务还有设计和实施计划 |
| `.trellis/workspace/` | 每个开发者自己的会话日志（journal） |

此外还有 `.trellis/workflow.md`，写的是整个工作流怎么走。这些东西都是普通文件，能 diff、能 review、能进 git。

`.trellis/` 这一套不绑定某个 AI 工具。Cursor、Claude Code、Codex、OpenCode 这些，加起来官方列了 20 多个平台，各自在自己的配置目录里装一层适配（hook、命令、子代理），读的是同一个 `.trellis/`。

## 一个会话是怎么跑的

先看一次完整的流程，后面讲的设计点基本都在这张图里。

![Trellis 一次完整会话的协作流程：开发者、AI 主会话、Hook、.trellis/ 和 implement/check 子代理之间的交互](https://imgbed.caph.me/file/1791913559510_image.png)

整体分三段：Plan、Execute、Finish。`workflow.md` 里把每一段该做什么、怎么切换写得很具体。

几个细节我觉得挺实在：

- 要不要建任务，AI 会先问你。简单问答、小改动可以直接做，不会为了走流程硬建任务。
- 同意建任务，不等于同意开始写代码。中间还有一次需求和方案的确认，确认完才进入实现。
- 实现完有 `trellis-check` 来复核，它不只是报告问题，能修的会直接修，修完再跑一遍检查。
- commit 是主会话先列一个分批计划，你点头一次，它再提交。`finish-work` 只负责归档和写 journal，不碰业务代码。

## 几处设计上的巧思

### Hook：该给的上下文自动给

规范写得再好，要靠人每次记得去贴，迟早会漏。Trellis 的思路是别靠人。

在支持 hook 的平台上，有三个时机会自动注入：

- 会话启动时，注入开发者身份、当前 git 状态、进行中的任务、spec 索引和你最近的 journal。注入的是一份索引和状态报告，不会把所有文档整个塞进去。
- 每条消息发出时，注入一小段当前任务状态对应的提示，让 AI 清楚现在在哪个阶段、下一步该做什么。这段文字写在 `workflow.md` 里，想改流程就改这个文件，不用去改 hook 脚本。
- 子代理启动前，把这个任务需要的 spec 和需求文档注入给它。

所以你不用每次开场先说一遍"先读一下规范"。写一次，之后每次都在。

没有 hook 的平台也有办法：靠 `AGENTS.md` 之类每次必读的入口文件，让 AI 自己去读。效果会差一点，文档里也写明了各平台的能力差异。

### 按任务给 spec，不是一股脑全灌

最常见的做法是写一个很大的 `CLAUDE.md` 或 `.cursorrules`，每次全塞进去。文件一长，容易被截断，模型也容易抓不住重点。

Trellis 把 spec 拆成多个文件，再用任务目录里的 `implement.jsonl` 和 `check.jsonl` 列出"这次实现要读哪几份、这次检查要读哪几份"。每行就是一个文件路径加一句理由：

```jsonl
{"file": ".trellis/spec/backend/error-handling.md", "reason": "接口错误格式"}
```

这样做前端任务的时候，不会把数据库规范也带进来。清单里只放 spec 和调研文档，不放要改的源码。

### Spec 绑定代码路径（动态加载）

这是官方文档里标成 beta 的一个功能，我觉得思路很好。你可以在 spec 的 frontmatter 里写 `paths`，声明它约束哪些文件：

```md
---
name: commands-workflow
description: Workflow command and resolver contracts
paths:
  - packages/cli/src/commands/workflow.ts
  - packages/cli/test/commands/workflow*.test.ts
---
```

之后 AI 读或改到这些文件时，对应的规则会在那个时刻送过来。同一会话里已经送过、内容没变的，不会重复发，隔一段时间才用一个简短的提醒；spec 改了，或者会话被压缩过，就重新发完整内容。规则会出现在它要约束的那处修改旁边，而不是在会话开头说一句，聊了一百轮之后就被冲淡了。

### 经验沉淀回 spec

任务做完之后，`trellis-update-spec` 会判断这次有没有值得长期遵守的做法。有的话写进 `.trellis/spec/`，只跟这个任务有关的事实留在任务目录里。

文档里有一个说法我挺认同：用得越多，AI 越懂你们。前提是有人把 review 里反复出现的意见变成 spec。今天 review 里说了一句"这里要校验入参"，明天它就应该成为规范里的一条，不再需要有人每次说。

### 跨会话记忆：记在文件里

AI 本身没有跨会话的记忆，Trellis 的办法是让仓库来记。

每次 `finish-work` 会往 `.trellis/workspace/你的名字/journal-N.md` 追加一条，写这次做了什么。下一次会话启动时 hook 会读到近期的 journal 和进行中的任务。任务本身的需求、设计、调研也都留在 `.trellis/tasks/` 里。

文档里有句话说得很清楚：下一次 AI 会话会重新读取仓库状态，不需要上一段聊天记录，也能知道任务是什么、哪些 spec 适用、下一步该做哪一步。聊天记录压缩了、换了台电脑、换了个 AI 工具，都不影响。

## 对团队：共享规范，不强制统一工具

对公司来说，我觉得 Trellis 最有价值的是这一块。

![团队共享 .trellis/ 的方式：不同 AI 工具读取同一份规范，新规范经 PR 评审后合入仓库](https://imgbed.caph.me/file/1791913603682_image.png)

分工大概是这样：

- `.trellis/spec/` 和 `.trellis/tasks/` 进 git，团队共用。spec 的改动跟代码一样走 PR review。
- `.trellis/workspace/你的名字/` 是每个人自己的 journal，互不干扰。
- `.trellis/.developer`（你是谁）和 `.trellis/.runtime/`（当前会话在做哪个任务）不提交，每台机器、每个窗口各用各的，所以同一个仓库里开两个窗口做不同任务也不会串。

新同事加入也简单：clone 仓库，跑一次 `trellis init`，选"Set up developer identity on this device"，填个名字就行。注意别选 Full re-initialize，那会覆盖掉已有配置，影响全团队。

这套东西带来的好处，是团队里有人把规范写好了，其他人的 AI 一起变好。有人用 Cursor，有人用 Claude Code，新人用 Codex，读的都是同一份。换工具的时候规范不用重写。

## 使用成本

介绍了这么多优点，也要说说代价，不然像在卖东西。

- **小任务会变慢。** 它的节奏是先问清、再实现、再检查、最后收尾。改一行文案也走一遍就很重，所以它本来也允许跳过，直接 inline 做。
- **空模板没用。** `trellis init` 会放大约 17 个占位的 spec 文件，内容几乎是空的。要先做 bootstrap 任务，让 AI 从现有代码里提炼出第一版规范，再由人把关。直接拿空模板开始写业务，AI 读到的还是套话。
- **各平台能力不一样。** Cursor、Claude Code、OpenCode 这些有完整的 hook 和子代理。Codex 要在配置里打开 hook（`~/.codex/config.toml` 里写 `hooks = true`，0.129 及以后版本还要在 TUI 里用 `/hooks` 批准一次），不开的话只能靠 `AGENTS.md`。Kilo、Antigravity、Devin 这几个没有 hook，要手动进入工作流。
- **要有人维护 spec。** spec 不更新就会过时，建议当成代码来对待。
- **需要 Node.js 18+ 和 Python 3.9+。**
- **协议是 AGPL-3.0。** 团队内部使用不需要额外授权，要基于它做商业化产品或服务才需要联系作者。

## 怎么开始试

不用全员铺开，官方也建议先选一个仓库试点。

```bash
npm install -g @mindfoldhq/trellis@latest
cd your-project
trellis init -u your-name --cursor   # 按你用的工具换成 --claude / --codex 等
```

装完之后的顺序我建议这样走：

1. 先跑 bootstrap 任务，让 AI 从真实代码里提出第一版 spec，自己过一遍。
2. 日常直接说需求。AI 会判断要不要建任务，问你的时候确认就行。
3. 它停下来或者跳步了，用 `/trellis:continue` 往下推进。
4. 代码 commit 之后，用 `/trellis:finish-work` 归档并写 journal。
5. 试用一两周，把 review 里重复出现的意见沉淀成 spec，看看新会话里要重复解释的东西有没有变少。

## 参考

- [Trellis 官方文档](https://docs.trytrellis.app/zh)
- [架构全景](https://docs.trytrellis.app/zh/advanced/architecture)
- [How It Works](https://docs.trytrellis.app/zh/start/how-it-works)
- [多平台与团队配置](https://docs.trytrellis.app/zh/advanced/multi-platform)
- [真实业务场景](https://docs.trytrellis.app/zh/start/real-world-scenarios)
- [Trellis on GitHub](https://github.com/mindfold-ai/Trellis)
