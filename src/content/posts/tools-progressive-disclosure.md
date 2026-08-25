---
title: Tools 的渐进式披露为什么这么难？
published: 2026-08-08
description: 从 Provider 原生、客户端折中到协议改造，盘点业界实现工具渐进式加载的四种方案，以及「初始无 N 个工具、前缀缓存稳定、原生严格 schema」三个目标只能取二的取舍。
tags: [Agent, Tools, 渐进式披露, Prompt Cache, Claude Code]
category: Agent
draft: false
---

# Tools 的渐进式披露为什么这么难？

## 0. 我们是怎么把 Agent 喂胖的

把大模型看成一个函数：

```
Response = LLM(System_Prompt, History, Tools, Skills)
```

做 Agent 时我们有个很常见的习惯：为了让它在长程任务里「不犯错」，把业务规范全部写进 System Prompt，把能想到的 API 全部注册成 Tools。

这种「暴力堆料」会撞上两面墙：

- **理论墙（信息论）**：输入与期望输出之间的互信息决定了模型表现的上限。长程任务的决策树是指数膨胀的；为了覆盖所有分支而在开头塞入全部信息，那么对「当前这一步」的决策而言，大部分上下文是无效噪声。有效信息被淹没，模型调和冲突与「瞎猜」的空间变大，幻觉和偏离目标的概率随之飙升。
- **工程墙（成本与延迟）**：无限膨胀的上下文意味着难以忍受的首字延迟（TTFT）、飞速燃烧的 token 预算，以及超出 Prompt Cache 命中范围后的高昂算力成本。

破局方向是**渐进式披露**（progressive disclosure）：不在一开始把所有知识甩给模型，而是给它一个目录/索引，让它按需检索和加载。Anthropic 的 Skills 机制把这个哲学带进了工程界——知识（Skills）可以渐进披露，那占据上下文另一大头的工具（Tools）行不行？

答案是可以，但是相比于 SKills 的渐进式披露，Tools 的渐进式披露要难得多得多。这篇文章盘点一下业界为了实现工具的渐进式加载，演变出了哪几种截然不同的方向。

## 1. 底层机制：模型只会「吐 token」

所有 Agent——Claude Code、Codex、Cursor 还是自研 harness——内部模型永远只做一件事：**预测并输出下一个 token**。所谓调用工具，本质是模型在某时刻按约定格式吐出的一段结构化文本。

一次请求长这样（简化）：

```json
{
  "messages": [{ "role": "user", "content": "查询北京天气" }],
  "tools": [
    {
      "name": "get_weather",
      "description": "查询指定城市的天气",
      "parameters": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  ]
}
```

模型如果决定调用工具，返回的是 Provider API 的原生结构：

```json
{
  "role": "assistant",
  "content": null,
  "tool_calls": [
    { "id": "call_123", "name": "get_weather", "arguments": { "city": "北京" } }
  ]
}
```

注意 `tool_calls` 不是从普通文本里正则抠出来的，它通常还带一个 `finish_reason: "tool_calls"` 标记——这就是 harness 判断「模型在要求执行工具」的依据。至于 Provider 内部怎么让模型乖乖吐这种格式（特殊提示词格式、专用 tool-call token、输出阶段的 JSON Schema 约束），各家实现不同，但本质不变：**输入多了工具定义，输出多了一个结构化的工具调用通道。**

### 1.1 如果不注册呢？

不把工具放进 `tools` 数组，只在聊天消息里写一句「你可以调用 get_weather，参数是 {...}」，模型也能输出一段看起来很规整的 JSON——但它只是普通文本：Provider 不会标记 `finish_reason`，不会校验参数，不会给 `call_id`。本地程序必须自己解析、自己判断、自己校验。

这条「文本协议」路线在过去很流行：2023–2025 年的 ReAct、Claude Dev/Cline、Roo Code 和 Kilo Code 早期版本都是这么干的——在 System Prompt 里用 XML/Markdown 描述所有工具，模型按约定输出调用指令，客户端捕获符合格式的文本块后解析执行。它的历史价值是快速兼容不支持原生 Tool Calling 的模型渠道；代价是没有 Provider 层的语法约束，模型偶尔写跑偏（参数名拼错、少一个括号、自由发挥一段解释），可靠性全靠框架兜底。随着 Strict Tool Use、结构化输出等能力普及，这条路线慢慢退出了主流。

### 1.2 算一笔账

结论先摆出来：**要做原生 Tool Calling，工具就必须出现在请求的 `tools` 参数里。Provider 在推理开始前就要拿到所有工具的完整契约**，否则无法建立语法约束，也就无法产出合法的原生 tool call。听起来像「人被杀就会死」一样自然——直到我们期望一个 Agent 在会话中灵活调度上百个工具。

按原文的保守估算：一个工具定义（名称 + 描述 + 参数 Schema）平均 400 token，200 个工具就是 **80k token**。主流旗舰模型的实际可用上下文窗口虽然几个月内从 150k 涨到了 400–500k，但注意力机制在大量低相关性工具描述上仍会产生信息稀释与「上下文腐烂」——窗口变大，不等于可以当败家子。

### 1.3 Skills 容易，Tools 难

Skills 之所以能优雅地渐进披露，是因为它的本质是纯文本内容：用户提问 → 模型判断需要某 Skill → 客户端把对应 markdown 追加到消息末尾。关键点在于：**所有信息增量都发生在消息末尾，不碰请求最前方的任何结构。**

这对 **Prompt Cache** 机制极其友好：主流 Provider（Anthropic、OpenAI）的缓存逻辑是「两次连续请求的前缀在 token 层面完全一致，就直接复用上一次的 KV 计算结果」——哪怕只修改或插入一个 token，后续缓存全部作废。Skills 的加载方式恰好不动前缀，庞大的基础上下文稳定命中缓存。

但 Tools 不同。原生 Tool Calling 要求工具定义出现在 `tools` 参数里，而 `tools` 数组永远驻扎在请求的最前端。设想：Agent 有 200 个工具，第一轮只注册 5 个高频的；第三轮模型需要「创建 PDF」工具，客户端只剩两条路：

- **改 `tools` 数组** → 请求最前方的结构变了 → 整个 Prompt Cache 报废 → 几万甚至几十万 token 的历史全部重算，又慢又贵；
- **不改** → 让模型在普通对话里按格式纯文本输出参数 → 失去原生调用的一切保障，参数幻觉和格式错误由客户端兜底。

于是核心死结出现了：

> **原生工具调用的可信度建立在「Provider 在推理前就知道所有工具的完整契约」这一前提上；而渐进式披露的本质是「推理前坚决不让 Provider 知道所有工具」。这两个需求在系统结构上是天然互斥的。**

理解了这一点，才能看懂下面四种方案各自在跟什么较劲。

## 2. 四种方案横评

### 2.1 方案一（Provider 原生）：Anthropic Tool Search Tool

Anthropic 在 2025 年 11 月发布 Tool Search Tool。原理上，客户端**仍然把全部工具契约发给 Anthropic**，但把不那么必要的工具标上 `defer_loading`——被标注的工具不会进入模型初始上下文，Anthropic 在服务端维护一个隐藏的工具目录：

```json
{
  "tools": [
    { "type": "tool_search_tool_bm25_20251119", "name": "tool_search_tool_bm25" },
    {
      "name": "learning_create_cards",
      "description": "Create learning cards...",
      "input_schema": { "...": "完整严格 schema" },
      "defer_loading": true
    }
  ]
}
```

模型需要某工具时，调用搜索工具（BM25 变体接受自然语言查询，上限 500 字符；regex 变体让模型自己写 `re.search()` 正则，上限 200 字符；两者都搜索工具名、描述、参数名和参数描述），Provider 在服务端检索后返回特殊的引用：

```json
{ "type": "tool_reference", "tool_name": "learning_create_cards" }
```

随后 Provider 在**当前对话位置**把这个引用展开成完整工具定义——搜索结果和最终的工具调用甚至可以出现在同一次 assistant response 里，客户端只需要执行最终的具体工具。

缓存为什么没坏？关键在于 `defer_loading` 的特殊语义：完整定义是在**发现位置追加**的，没有回头修改最前面的工具前缀。历史消息里出现过的 `tool_reference` 会被 API 全程展开，模型后续轮次可以直接复用已发现的工具，无需重新搜索。

**短板**：强绑定 Anthropic。OpenAI 自家的 Responses API 提供了同构的 `tool_search` + `defer_loading`（支持按需加载 Function、Namespace 和 MCP 工具），但广大 OpenAI 兼容生态——vLLM、OpenRouter、各家自建兼容层——通常只能二选一：发送 `tools` 就全部进模型上下文，不发送 Provider 就不承认对应的原生调用。它们缺少 `defer_loading` / `tool_reference` 这种 Provider 级协议，于是才有了下面两条客户端自救路线。

### 2.2 方案二（客户端折中）：Stub 注册 + load_tool_schemas

既然 `tools` 数组一个字都不能动，那就「注册全部工具、但把未被需要的契约压缩到极限」。这是原文作者自己实现过的方案：

- 每个真实工具注册成一个 **stub**：保留真实工具名，描述压到一句话，参数契约换成宽松的万能外壳；
- 工具列表常驻一个客户端实现的 `load_tool_schemas` 工具。

```json
{
  "name": "learning_create_cards",
  "description": "从学习笔记创建记忆卡片。调用前必须先调用 load_tool_schemas 获取完整参数契约。",
  "parameters": {
    "type": "object",
    "properties": { "arguments": { "type": "object", "additionalProperties": true } }
  }
}
```

调用流程：

```text
模型认为自己需要制卡能力
  → 调 load_tool_schemas({ "tools": ["learning_create_cards"] })
  → 客户端把完整 JSON Schema 作为普通 tool_result 消息返回
    （追加在对话尾部，不碰任何前缀，缓存安全）
  → 模型按刚拿到的 schema 调用对应的 stub
```

账很好算：200 个工具从约 80k token 压到约 15k（每个 stub 约 60–80 token），降低约 80%。

**短板**：这是「半原生」方案——stub 数量依然是 O(N)，没有实现真正的按需加载，每个 stub 都常驻上下文、真实占用注意力；Provider 的语法约束约束的是那个宽松外壳，真实参数的合法性完全靠客户端自己保证。

### 2.3 方案三（客户端激进）：search_tools + invoke_tool

再进一步。注册工具有两个基本前提——「工具在 Provider 注册」和「模型能遵守契约」。第一条可以收窄到极限：注册**一个**全能力工具；第二条随着旗舰模型指令遵循能力的提升，「把契约以文本形式交给模型、它照着填参数」已相当可靠：

```json
{
  "name": "invoke_tool",
  "description": "执行工具目录中的工具。请先用 search_tools 找到目标工具，再按返回的契约填写 arguments。",
  "parameters": {
    "type": "object",
    "properties": {
      "tool_name": { "type": "string" },
      "arguments": { "type": "object", "additionalProperties": true }
    },
    "required": ["tool_name", "arguments"]
  }
}
```

`tools` 数组从此恒定，只有 `search_tools` 和 `invoke_tool` 两个：

```text
1. 模型 → search_tools({ "query": "create flashcards from study notes" })
2. 客户端 → 返回目录条目（工具名 + 一行描述，不含完整 schema）
3. 模型 → invoke_tool({ "tool_name": "learning_create_cards", "arguments": { "notes": "..." } })
4. 客户端 → 按 tool_name 取出真实 schema 校验 → 执行 → 回传结果
   （校验失败 → 返回结构化错误 → agent 修正重试）
```

初始上下文占用从 O(N) 直接变成 O(1)——工具目录里躺 100 个还是 10,000 个工具，模型永远只看到两个（几百 token）。目录本身可以是本地索引、数据库表甚至 embedding 检索服务，检索自由度在自己手里。

**代价**：Provider 只认识 `invoke_tool` 的外层 schema，不认识内层 schema——外层有语法约束，`arguments` 内部却是不设防的黑盒，真实校验必须客户端全权承担，失败就返回结构化错误让 agent 修正；真实参数变成「JSON 里的 JSON」，多一层转义与嵌套；且对模型指令遵循能力有门槛，弱模型会在第 3 步频繁出错。

**补偿**：所有具体调用收敛到同一个入口后，校验、授权、审计、限流这些横切关注点只需要在 Gateway 一处实现——多用户/多 Agent 场景下是意外之喜。

### 2.4 方案四（Provider 原生 + 协议改造）：Kimi K3 动态加载工具

Moonshot 在 Kimi K3 的 API 里提供「动态加载工具」机制，思路是：**工具声明不一定要待在请求开头的 `tools` 字段里，它可以是一条消息。**

```json
{
  "messages": [
    { "role": "system", "content": "You are Kimi, an AI assistant..." },
    { "role": "user", "content": "Calculate fuel consumption." },
    {
      "role": "system",
      "tools": [
        {
          "type": "function",
          "function": {
            "name": "Calculator",
            "description": "计算器，只支持单个算术表达式的求值",
            "parameters": {
              "type": "object",
              "properties": { "expr": { "type": "string" } },
              "required": ["expr"]
            }
          }
        }
      ]
    }
  ]
}
```

关键语义：携带 `tools` 的 system 消息与普通消息地位相同——**它出现在 `messages` 的哪个位置，工具就从哪个位置开始对模型可见**；动态加载的工具与顶层声明的全局工具并存；声明必须是完整定义，不能只传工具名；这条消息不能再带 `content` 字段，否则请求报 400。

缓存规则官方给了四条：

| 操作 | 对前缀缓存的影响 |
| --- | --- |
| 在 `messages` 末尾追加工具声明 | 不影响已有前缀缓存 |
| 后续请求原样保留已注入的工具声明 | 前缀稳定，有利于持续命中缓存 |
| 删除、修改对话中间的消息，或中间插入新声明 | 变更位置之后的缓存可能无法命中 |
| 在顶层 `tools` 字段声明全局工具 | 不影响缓存命中 |

总结成一句话：**追加，不要插入；注入了就别删。** 工具声明被当成普通对话内容的一部分往后追加，前缀纹丝不动——和 Skills 的加载路径一模一样。

官方参考实现也很朴素：顶层只注册客户端实现的 `search_tools` → system prompt 里告诉模型工具目录/领域关键词 → 模型需要时先 search → 应用把命中工具的完整声明追加到末尾 → 模型原生调用。

我的评价：这是**协议层面**的改造，不需要 `defer_loading`、`tool_reference` 这类新概念，声明格式与顶层 `tools` 完全一致；位置语义直觉且可控，天然缓存友好；同时保留 Provider 侧的原生约束，不会像 `invoke_tool` 那样把参数黑盒化。原文作者说它「十分优雅，令人眼馋」，我同意。

旁证：Anthropic 在 2026 年 7 月推出的 mid-conversation system messages 和 tool changes，也允许通过对话中途的 system message 添加或移除工具并保留前缀缓存——但没有人回头重新采用 Kimi 的方案。这个「为什么」很有意思，见 4.3 节。

## 3. 取舍：三个目标，只能要两个

把四个方案抽象一下，会发现三个互相拉扯的目标：

1. 初始上下文不包含 N 个具体工具或 Stub；
2. 工具列表始终稳定，不破坏早期 Prompt Cache；
3. 每个具体工具仍以独立原生工具 + 严格 schema 被 Provider 调用、约束。

没有 Provider 原生配合时，三者只能取二：

| 选择 | 结果 |
| --- | --- |
| 缓存稳定 + 具体工具原生调用 | 必须常驻 N 个真实工具或 Stub（对应方案二） |
| 初始无 N 个工具 + 具体工具原生调用 | 发现后动态修改 `tools`，破坏早期缓存 |
| 缓存稳定 + 初始无 N 个工具 | 只能常驻一个通用调用外壳，由客户端还原并校验（对应方案三） |

所以没有「最好的方案」，只有「最适合的取舍」——取决于三个工程变量：

- **工具规模**：不到 20 个工具就全量注册，别折腾。社区里 CJackHwang 提到一个反直觉的点：工具数量少的时候，渐进式披露因为多出检索步骤，长任务下消耗的 token 反而更多。「没有最好的，只有最适合的」。
- **Provider 绑定程度**：工具多且目标 Provider 支持原生机制（Anthropic / Moonshot），优先用原生方案，别自己造轮子；要兼容 vLLM、OpenRouter、自建网关等多后端，方案三才是通解。
- **任务形态**：长程多轮任务里缓存命中的收益被放大，方案二/三的「前缀稳定」价值更高；一次性短任务直接全量注册更划算。

### 3.1 社区补充思路

原文评论区一百多楼里，有几条值得记下的补充：

- **bash/CLI 收敛**：只暴露一个 bash 工具（或「伪 bash」），把其他工具下沉成 CLI，靠 `--help` 完成逐层披露。Vercel 的 just-bash、Pi 的思路（五六个极简工具覆盖读写与 bash，每个描述只有一句话、三四十个单词）都是这个路线。本质上把披露从 Provider 协议层挪到了命令行环境。适用面仅限于能跑 OS 的 Agent——跑在业务系统内部的 Agent 用不了 bash（社区里 jelly15 的疑问）。
- **大小模型协同**：bod 提出用便宜快的模型（如 DS V4 Flash）在会话/子 Agent 开始时先做一次工具编排预筛选，把可能用到的工具提前挑进新上下文，loop 里再让便宜模型做上下文整理、预压缩的杂活。
- **子代理专职校验**：LLMeme 提出起一个子 Agent 专门负责输出/校验工具调用（本质是 `invoke_tool` 的加强版）。反对意见也很实在：子 Agent 转述损失信息、增加延迟、双上下文管理复杂度。
- **一条重要的实测反例**：yuwkGoo 在 pi agent 上试过 `invoke_tool` + `search_tools`，结果是 **grok 4.5 基本不再调用工具了**（除了 GPT 系，其他模型普遍有这个倾向）；后来改用本地 BM25 做轻量 tool search，效果反而更好。这条反馈直接说明：方案三的成败不只在架构，更在**检索质量**——模型找不到、搜不准，就不会用。

## 4. 我的思考

（本节全部是个人推演与设计方案，不是实验结论。）

### 4.1 如果让我选，我会怎么选

第一步不是选方案，而是**量化**：工具总数、平均定义长度、单会话实际激活的工具数、当前缓存命中率。不量化就上方案，是拍脑袋。在此基础上我的排序是：

- 工具 < 20：全量注册。省心，且渐进披露的额外请求成本未必划算。
- 工具多 + 目标 Provider 有原生机制：优先 `defer_loading`（Anthropic）或动态加载（Moonshot）。协议层面兼容缓存，参数校验不黑盒，工程成本最低。
- 工具多 + 自建/多后端兼容：方案三为主，但必须把**本地工具检索质量**当一级指标来做（BM25 起步，目录规模大到语义检索有用再上 embedding），并接受「客户端校验代码会膨胀」的事实——校验逻辑写在哪，复杂度就在哪，这就是把黑盒从 Provider 挪到客户端的代价。
- 工具 schema 极复杂 + 团队短期不想写通用校验器：方案二（stub）是合理过渡。

关于社区里「通用工具 vs 特化工具」的争论（「四肢健全」论 vs 特化论），我的看法是两者不矛盾：**通用外壳负责寻址与横切，特化 schema 负责参数语义**。真正的分界在「谁维护索引」：内部系统 Agent 的工具集稳定，索引成本低，特化 schema 价值高；跨团队共用的工具网关，通用外壳 + 统一审计限流反而更值。

### 4.2 如果要落地，我会怎么验证

方案之间的争议大多停留在观点层面，缺可复现的对照实验。如果我来做，会这样设计：

- 同一任务集（覆盖各工具的使用频率梯度），分别跑「全量注册」和候选方案；
- 观测指标：工具调用成功率、参数错误率、单任务总 token 消耗、TTFT、缓存命中率、任务完成率；
- 先埋点 2 周拿基线，再单场景灰度，最后全量。

指标口径必须先写清楚——「缓存命中率」按请求数还是按 token 数算，结论会完全不同。

### 4.3 三个问题

1. **位置敏感性问题**：大模型对首尾的 prompt 更敏感，工具契约出现在对话中间（Kimi 方案的形态），模型遵循契约的能力会不会下降？

   「不好说塞满 80k 契约的 agent 和渐进披露之后的 agent 哪个更差」。

   如果 Kimi 方案要广泛落地，这是最值得先做对照实验的点。
2. **净账问题**：渐进披露增加请求次数，减少了单次成本，长任务下到底省不省？我猜存在一个阈值。但是具体的阈值在哪里，需要进一步测试。
3. **方案收敛悬念**：Kimi 方案被证明可行（Anthropic 2026 年 7 月也做了 mid-conversation tool changes 且保留缓存），为什么主流 harness 没有跟进？一方面可以说是积重难返，还有一层是：工具声明一旦可以出现在消息序列里，prompt injection 的攻击面也随之增大——社区里也有人提到过「权威性」与注入风险的考虑。

### 4.4 这篇文章对我的修正

读这篇文章之前，我对工具加载的理解停留在「全量注册 + 增大上下文窗口」的层面，顶多听说过「MCP 工具多了会挤占上下文」。最改变我看法的一点是：**工具动态加载的瓶颈不是检索算法，而是请求结构**——`tools` 数组在前缀里的位置决定了它与 Prompt Cache 的天然冲突，这个约束比「工具多不多」深刻得多。以后评估任何「工具按需加载」方案，我都会先问一句：它动了请求前缀吗？
