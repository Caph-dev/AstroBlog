---
title: 是时候精简你的 AGENTS.md 了——By 渐进式披露
published: 2026-05-28
description: 用 agents-progressive-disclosure skill 把膨胀的 AGENTS.md 重构成精简路由入口与按需加载的专项文档。
tags: [开源, Agent, AGENTS.md, 渐进式披露, Cursor, Codex]
category: 开源
draft: false
---

Agent 指令文件很容易越写越大。命令示例、搜索策略、包管理器规则、部署说明、工具细节……全堆进 `AGENTS.md` 或 `CLAUDE.md` 之后，每个任务都要为大量无关规则买单，最重要的常驻规则反而被稀释。

[agents-progressive-disclosure](https://github.com/Caph-dev/agents-progressive-disclosure) 是一个开源 agent skill，用来把这种「规则仓库」重构成**精简路由入口 + 按需读取的专项文档**——核心思想就是渐进式披露（Progressive Disclosure）。

::github{repo="Caph-dev/agents-progressive-disclosure"}

> 本文首发于 [LINUX DO 社区](https://linux.do/t/topic/2263095)。

## 为什么需要精简

团队维护 agent 指令文件时，常见两类问题：

1. **信号被稀释**：最重要的规则和低频细节混在一起，agent 很难抓住重点。
2. **上下文成本过高**：每个任务都加载整份百科全书，无关规则白白占用 token。

渐进式披露的思路很直接：

- 高频、长期有效、必须始终遵守的规则 → 留在入口文件
- 具体任务才需要的详细规则 → 下沉到 `docs/` 或平台专属规则文件
- 入口文件明确告诉 agent：**遇到什么任务，先读哪份文档**

一句话：`AGENTS.md` 应该是导航页，不应该是百科全书。

## 安装

推荐使用 [skills CLI](https://github.com/vercel-labs/skills)：

```bash
npx skills add Caph-dev/agents-progressive-disclosure
```

其他常用选项：

```bash
# 全局安装，所有项目可用
npx skills add Caph-dev/agents-progressive-disclosure -g

# 只安装到 Cursor
npx skills add Caph-dev/agents-progressive-disclosure -a cursor -y
```

也可以直接把仓库链接发给你的 agent，让它帮你安装；Codex 用户可以手动克隆到 skills 目录：

```zsh
git clone https://github.com/Caph-dev/agents-progressive-disclosure ~/.codex/skills/agents-progressive-disclosure
```

安装后重启 agent，以便加载新 skill。

## 使用方法

在 agent 对话中输入：

```text
使用 $agents-progressive-disclosure，把当前 AGENTS.md 重构成精简入口文件和 docs/ 专项文档。
```

skill 会引导 agent 完成以下流程：

1. 完整读取现有指令文件
2. 扫描相互矛盾的指令（风格、包管理器、测试命令、安全边界等）
3. 把规则分类为**常驻规则**和**任务细节**
4. 设计精简的文档路由地图
5. 重写入口文件为紧凑路由器
6. 创建或更新聚焦的 `docs/` 文件
7. 用 preservation checklist 验证规则没有丢失

:::tip
重构完成后，务必亲自检查一遍：当前策略会不会分得太细？有些常用流程是不是没必要放到 `docs/` 下？
:::

## 重构后的结构长什么样

入口文件通常包含这几块：

| 模块 | 内容 |
|------|------|
| 适用范围 | 说明这是全局还是项目级入口 |
| 常驻原则 | 必须始终遵守的高频规则 |
| 按需读取索引 | 任务类型 → 对应文档的路由表 |
| 常驻安全边界 | 破坏性操作、权限等底线规则 |
| 优先级 | 用户指令 > 项目 AGENTS.md > 全局 AGENTS.md > docs 细则 |

下面是我 Codex 全局 `AGENTS.md` 的简化示例（完整版见 [GitHub 仓库](https://github.com/Caph-dev/agents-progressive-disclosure)）：

```markdown
# 全局 Agent 指令

> 适用范围：本文件是全局代理行为入口。这里只保留必须常驻的规则；
> 任务细节按需读取 `docs/` 下的专项文档。

## 常驻原则

- 当前环境按 **macOS 原生环境 + Ghostty + zsh** 处理
- 需要当前信息、官方文档、API 细节时，默认使用本机 `smart-search` CLI
- 不要仅凭训练数据回答可能变化的事实
- `AGENTS.md` 是路由入口，不是规则仓库；只读取与当前任务相关的专项文档

## 按需读取索引

| 任务类型 | 先读文档 | 触发条件 |
| -------- | -------- | -------- |
| 联网搜索、网页抓取、API/SDK 用法 | `docs/search-and-evidence.md` | 需要当前信息、来源链接、高风险事实核验 |
| 本地环境、Shell、Homebrew | `docs/local-environment.md` | 需要运行命令、改 shell 配置、安装工具 |
| 项目命令、包管理器、Git | `docs/project-workflow.md` | 需要构建、测试、安装依赖、提交代码 |

## 优先级

1. 用户当前明确指令
2. 当前项目或更近目录的 `AGENTS.md`
3. 本文件
4. 本文件路由到的 `docs/*.md` 细则
```

## 好处

1. **AGENTS.md 保持精简**——入口文件只承担路由职责
2. **省上下文**——无关规则不再每次全量加载
3. **技术文档可以写得很详细**——只有需要时才读取；也可以进一步提炼为独立 skill
4. **更容易维护**——按主题拆分，改一处不影响全局

有佬友说这种模式像 MoE（混合专家）：路由不同的专家处理不同任务。本质上和 wiki 的分层索引是同一类思路。

## 常见问题

### Agent 一定会去读对应的 docs 吗？

坦白说，**不能保证 100%**。大模型是概率系统，强模型大多会遵守读取规则，但偶发忽略也是可能的。

降低遗漏概率的做法：

- 在路由表里写清楚触发条件，而不是只列文件名
- 对 plan / code / review 等不同阶段分别指定要加载的规则
- 更进一步：用 **hooks 强制注入**索引，在任务开始时把相关文档片段自动塞进上下文

### 常用规则要不要也放到 docs 里？

没必要。渐进式披露的目标是把**低频、任务相关**的细节下沉，而不是把每天都用的规则藏起来。

比如 response style、文件搜索策略这类几乎每次都会用到的内容，继续放在入口文件更合适。过度拆分反而会增加路由成本和维护负担。

### 文件太大会有截断问题吗？

会。有佬友反馈，当核心文件达到约 18KB 时，部分 agent 应用可能触发截断，导致文件中后段的规则 agent 根本看不到——这时候整理就不仅是优化，而是刚需了。

## 相关链接

- GitHub：[Caph-dev/agents-progressive-disclosure](https://github.com/Caph-dev/agents-progressive-disclosure)
- skills.sh：[agents-progressive-disclosure](https://skills.sh/Caph-dev/agents-progressive-disclosure)
- 社区讨论：[LINUX DO 原帖](https://linux.do/t/topic/2263095)

欢迎试用、提 Issue，也欢迎在社区继续交流你的 AGENTS.md 治理经验。
