---
title: Trellis 把项目规范留在仓库里
published: 2026-07-18
updated: 2026-10-04
description: 对照官方文档，说明 Trellis 怎样把 spec、任务和会话记录放进仓库，以及什么项目用了会更慢。
tags:
  - Trellis
  - Coding Agent
  - Spec
  - harness
category: Agent
draft: false
---

# Trellis 把项目规范留在仓库里

我把 Trellis 的安装文档、spec 写法说明和 npm 上的介绍对了一遍。它要管的事情很小，也很具体。你换一个会话，模型不记得上次为什么把错误写成那种 JSON，也不记得登录失败该返回哪几个字段。

npm 上的介绍把这件事说得很直接。模型写代码很快，换一个会话就忘了这个仓库里已经定过的约定。Trellis 把 spec、任务和会话记录放进仓库，让不同的编码工具读同一套东西。包名是 `@mindfoldhq/trellis`。

## 会话里丢掉的是哪几样东西

同一句需求，两次会话可以写出两套风格。lint 守不守、类型写不写、命名跟不跟仓库里已有的走，看这次上下文里有没有人提过。

新会话一开始，模型不知道上次做到哪，也不知道仓库里已经写过的规矩。你得再讲一遍。

那些规矩常常不在仓库里。它们在 PR 评论、聊天记录和某个人脑子里。模型读不到，就按自己的习惯写，而它的习惯多半跟你们上次吵完留下的约定不一样。

值得留下来的，经常是这些规矩。代码可以重写。错误格式、目录怎么分、哪个模块不能直接调用哪个模块，重写一次就容易写歪。

## 模型外面还要有一份项目事实

模型负责理解和写代码。几个月前为什么这么设计，它读不到，除非这些话写在它每次都能打开的文件里。

常见的补法各自有缺口。

prompt 停在这一次对话里。会话结束，内容就没了。下次要么重说，要么让它看 diff 猜。diff 能看出改了哪几行，看不出当时为什么这样改。

规则文件能跨过会话，但各跟各的工具走。`AGENTS.md`、`CLAUDE.md`、`.cursorrules` 换到另一个工具往往用不上。文件还会越写越长，旧条文舍不得删，模型读到后面抓不住眼下这次要守的那几条。它也不知道任务走到哪一步。

Trellis 把这几样拆开，放进仓库。

规范在 `.trellis/spec/`，分成 frontend、backend、guides。每个目录用 `index.md` 当入口，细节另写文件再链过去。文档要求写具体，带上文件路径，最好贴项目里已经在用的写法。只写「注意错误处理」，模型不知道该去看哪个文件。

每个人的会话记录在 `.trellis/workspace/{名字}/journal-N.md`。官方说，SessionStart hook 或者平台自己的 prelude 会读 journal 和当前任务列表，新会话才能接上一次做到哪、对应哪次提交。

任务在 `.trellis/tasks/`。一个任务目录里有 `task.json` 和 `prd.md`。复杂任务再加 `design.md`、`implement.md`，以及 `implement.jsonl`、`check.jsonl`。这两份 jsonl 只记要读的 spec 和 research 路径，文档写明不要把源码路径塞进去。做完的任务进 `.trellis/tasks/archive/`，按年月分目录。

流程说明在 `.trellis/workflow.md`。`.trellis/` 这一套各平台共用。命令、hook、子代理怎么装，则按 cursor、claude、codex 各自写到自己的配置目录。

## 文档里的登录功能是怎么走完的

官方用加一个用户登录来举例。我按安装文档里的步骤复述，不是我自己跑过的某次记录。

你说要加登录。模型先判断这次够不够单独建任务。闲聊和改动很小的事，不会自动建。够复杂，它会先问你同不同意建，同意了才进入规划。`task.py create` 建出目录和默认的 `prd.md`，brainstorm 一次只问一个问题，答案写回这份 PRD。登录失败怎么返回、token 过期怎么办、要不要第三方登录，当时没问，实现时就会各写各的。复杂任务会补设计和实现计划，要查的资料放进 `research/`。你看过以后，`task.py start` 把状态改成进行中。

写代码时读的是 `prd.md`、这次用得到的 spec，有设计文档就一起读。spec 按任务挑，不会把十几份模板一次灌进提示词。`trellis init` 会先放下大约 17 个占位文件，分布在 backend、frontend、guides，题目覆盖目录、错误处理、日志、组件。占位文件本身几乎没信息。文档让你先做 bootstrap 任务 `00-bootstrap-guidelines`，再用自带的 `trellis-spec-bootstrap`，让模型从现有代码里起草第一版，然后你自己看质量。空模板就开写业务，模型读到的还是套话。

检查时看 diff，对照 `check.jsonl` 里点名的 spec 和 research，再跑 lint、类型检查和测试。接口的错误格式、漏掉的权限校验、依赖方向写反，lint 经常看不见。spec 里如果写了「错误都走 `src/lib/errors.ts` 的 AppError，别直接抛普通 Error」，这一步才有东西可对。

收尾时，update-spec 只把以后还要遵守的写法写进 `.trellis/spec/`。某次把登录路径改成某个具体 URL，留在任务记录里就够了。业务代码先按你点头的批次提交。提交已经在了，再跑 `/trellis:finish-work`。这个命令用 `add_session.py` 追加一条 journal。任务确实做完、验收也过了，它再通过 `task.py archive` 把任务目录挪进归档。

模型停住，或者跳步，文档让你跑 `/trellis:continue`。它看任务状态、目录里已经有哪些文件，以及每轮带上的 workflow-state，判断下一步该加载哪一段流程。

## 和另外几类做法比，它把力气花在仓库里

下面是我自己的归类，拿来看 Trellis 把力气放在哪，不是官方排行。

superpowers 那一类把步骤卡得很死。先问清，再做计划，再按测试往下写，最后审查。模糊的想法会被问成能执行的计划。小任务也会被反复问、反复审。做完以后，经验还在对话里。仓库里没有 task、spec 和 journal 接着存。

openspec 那一类先写 spec 再实现。变更围绕 proposal、spec、design、tasks 走，适合规则多、要改很久的系统。规范写出来以后，模型这次读没读、读的是不是这一份、写的时候守不守，还得另有办法盯着。任务现在走到哪、换一个工具以后还记不记得，不是它主要要管的事。

oh-my-claudecode 那一类把规划、实现、审查、排错拆成多个 agent。任务一大，这样分得开。agent、技能和 hook 一多，一个小需求也会被编排得很重。出了问题，更难查是哪一个环节偏了。

Trellis 把 spec、任务、每轮的 workflow-state、jsonl、journal，还有 finish 和 update-spec，放在同一个仓库结构里。换会话、换工具以后，还能不能读到同一份项目事实，是它主要在答的问题。

## 什么项目用了会更烦

一次性脚本，比如一个油猴脚本，直接让模型写完就行。没有长期维护的仓库，建任务、写 PRD、回头改 spec，都是额外的时间。两三个人如果没人愿意改 spec，仓库里会留下空模板和过时约定。模型照着过时的写，比没有 spec 更糟。

装之前先看运行环境。Mac、Linux、Windows 都支持，需要 Node.js 18 以上，还要 Python 3.9 以上。你得分得清 `.trellis/spec/`、`tasks/`、`workspace/`、`workflow.md`、`.runtime/` 各管什么，不然看不懂模型为什么忽然去改某一份 markdown。节奏也变了。vibe coding 是边说边写。这里先问清，写完再检查，最后才收尾。小任务会显得慢。

技术栈和目录一变，spec 要跟着改。过时的 spec 会把模型带偏。任务拆得太碎，就只剩流程。太大，模型又会在一堆文件里迷路。适合单独建任务的，是得复盘、牵涉多个文件或多个决定、而且你希望下次还能打开看的那些。

平台能力也不齐。`trellis init` 可以按 `--cursor`、`--codex`、`--claude` 这些旗标装适配层，核心目录相同，hook 和子代理则看平台给不给。Codex 靠仓库根上的 `AGENTS.md`，再加上 `UserPromptSubmit` hook。你得在 `~/.codex/config.toml` 里打开 hook，0.129 及以后写 `hooks = true`，更早的版本写 `codex_hooks = true`。不打开的话，聊天里输入 `/` 看不到这些命令，workflow-state 也不会自动注入。文档还说，每个要用的平台至少 init 一次。`/trellis:start` 主要留给没有 agent 的平台，文档点名的是 Kilo、Antigravity、Devin。支持 SessionStart 的，打开终端时已经读过 journal。

个人仓库也会碰到同样的断档。项目搁几个月，人自己也常常不记得上次为什么这样分目录。从 claude code 换到 codex 或 cursor，规则文件通常要重写，`.trellis/` 不用重写。同时养着几个仓库时，比如一个 Go 后端、一个 React 前端，各自的 spec 待在各自的目录里，模型不容易把上一个仓库的约定带过来。当时的取舍如果只在聊天记录里，记录一压缩就找不回。任务和 spec 进了 git，至少还有一份能打开的说明。

团队更直接的好处，是人不必用同一个工具。有人用 cursor，有人用 claude code，新人用 codex，读的是同一份 `.trellis/`。

## 哪些文件进 git

按官方目录，`.trellis/spec/`、`.trellis/tasks/`、`.trellis/workspace/` 里的 journal 应该进仓库。`.trellis/.developer` 是当前这份检出上的开发者名字，设计上不提交。新克隆出来的仓库没有这个文件，Trellis 拿它判断是不是新同事第一次打开。`.trellis/.runtime/` 记的是这一次会话正在做哪个任务，也不提交。

spec 和 task 进了 git，规范改动就可以走 PR。别人能看见错误格式和依赖方向是什么时候定的。

## 装上以后先填 spec

```bash
npm install -g @mindfoldhq/trellis@latest
cd your-project && trellis init -u your-name
```

不写 `-u` 时，文档说会用 `git config user.name`。只想装某几个平台，可以写成 `trellis init --cursor --codex -u your-name`。

init 之后先做 bootstrap，别让模型对着空模板写业务代码。日常直接说需求，由它判断这次要不要建任务。它问能不能建，你确认就行。卡住了用 `/trellis:continue`。业务提交已经在了，再用 `/trellis:finish-work` 写 journal。

## 来源

- [Trellis 安装与第一个任务](https://docs.trytrellis.app/start/install-and-first-task)
- [Trellis 快速开始](https://docs.trytrellis.app/quickstart)
- [怎样写 spec](https://docs.trytrellis.app/guides/specs)
- [npm 上的 Trellis](https://www.npmjs.com/package/@mindfoldhq/trellis)
