---
title: MCP 新协议 vs 老协议：变化、取舍与 Agent 开发者的下一步
published: 2026-08-01
description: 从「握手 + 会话」到「无状态 + 每请求自述」：MCP 2026-07-28 更新同时改了连接、交互、扩展三个模型，这篇文章梳理变化脉络与取舍，以及对 Agent 应用开发者的具体启示。
tags:
  - MCP
  - Agent
  - MRTR
  - 工具调用
category: Agent
draft: false
---

# MCP 新协议 vs 老协议：变化、取舍与 Agent 开发者的下一步

> 内容基准：MCP 官方规范 **2026-07-28**，对比基线 **2025-11-25 及更早**（下称 Legacy 时代）

## 开场：一个反直觉的事实

老的能用，新的也能用——工具调用、资源读取、提示词，这些能力一个都没少，字段也兼容。但如果你只看「能做什么」，会完全错过这次更新的分量。真正变的是**一次** `tools/call` **意味着什么**：

在老协议里，一次工具调用默认发生在「一段已协商好的会话里」——双方握手时谈好了版本和能力，之后所有请求都活在这个语境的庇护下。在新协议里，这个语境没了：每个请求自己背着版本、能力和身份，服务端看这一次请求的内容独立决定接不接受。

打个比方：老协议是「进门登记一次，之后刷脸就行」；新协议是「每个人每次进门都要出示证件」。后者显然更繁琐，但它换来一个关键的自由——**你不再需要记住这个人，也不需要为他保留一个座位**。

这篇文章回答三个问题：新协议到底改了什么（不是只多了几个 RPC）？为什么要这么改（老模型撞上了哪堵墙）？对做 Agent 应用的人，哪些习惯必须改、哪些能力必须补？

## 1. 背景：MCP 这一年

MCP 的第一版规范发布于 2024-11-05；此后 Streamable HTTP 取代了旧传输；2025-11-25 加入了 URL Elicitation、实验性 Tasks、OIDC Discovery 等。到此为止，每个版本都是**能力增量**：核心协议变厚，但骨架没动。

2026-07-28 不一样。它同时动了三根承重梁：**连接模型**（握手 + 会话 → 无状态）、**交互模型**（服务端反向请求 → MRTR 多轮往返）、**扩展模型**（能力硬塞核心 → extensions 协商）。所以它看起来像一次架构换代，而不是一次常规发版。

还有个现实要记住：Legacy、Modern 和同时支持两者的 Dual-era 会**三态并存相当长一段时间**。你写的客户端，大概率要同时面对三种服务端。

## 2. 变化一：连接模型——从「握手 + 会话」到「无状态 + 每请求自述」

老协议的流程是：客户端先发 `initialize`，和服务端一次性协商 `protocolVersion` 与双方 capabilities；客户端再发 `notifications/initialized` 确认握手完成；此后连接进入会话态（可能带 `Mcp-Session-Id`），后续请求默认享受这份「谈好的约定」。

这个设计本身合理——一次协商，大家都省事。但它的代价是隐性的：**状态粘在连接上**。`tools/call` 的语义依赖「我们还在同一段会话里」，于是请求只能路由到同一个实例，没法水平扩展、没法上 Serverless、断线后也没法用新连接独立重试。

新协议的解法是**把语境从连接里拆出来，塞进每个请求**：

- 每个请求在 `_meta` 里声明 `protocolVersion`、`clientCapabilities`、clientInfo（HTTP 上另有 `MCP-Protocol-Version` header）。
- 版本不匹配时，服务端返回 `UnsupportedProtocolVersionError`（JSON-RPC 错误码 -32022），`data.supported` 列出它实际支持的版本，客户端据此选共同版本重试。
- 新增 `server/discover`：一个**可选**的探测 RPC，返回 supportedVersions、capabilities、extensions、identity。服务端必须实现它，客户端可以调用也可以不调用——它只是探测，**不是换了个名字的 initialize**，没有「谈完就记住一整场」的语义。

*图 1：新旧消息流并排——Legacy（握手 + 会话）与 Modern（无状态 + 每请求自述）*

Legacy 消息流Modern 消息流

*图 2：同一个「部署前选环境」故事的两种讲法——Legacy 嵌套反向请求 vs Modern MRTR 重放*

Legacy：嵌套反向请求Modern：MRTR 重放

这里有个高频误解要先拆掉：**无状态 ≠ 业务不能有状态**。协议无状态禁止的是「靠连接记住版本、能力、身份」；业务状态（一个跑了 30 分钟的部署任务、一个购物车）完全可以放数据库、缓存或显式 handle 里，客户端每次把它当参数带回来。

## 3. 变化二：交互模型——从「Server 反向请求」到「MRTR」

如果说连接模型的变化是「拆掉会话语境」，那它立刻引发一个问题：**服务端中途需要用户输入怎么办？**

老协议里，Server 缺东西（用户的选择、目录列表、一次模型采样）时，会**反向**向 Client 发一条 JSON-RPC Request，比如 `elicitation/create`。这条反向请求能成立，依赖三个条件：连接还活着、双方记得是同一段会话、Client 事先在握手时声明过会处理这类请求——也就是那条被拆掉的「会话 + 长连接」。所以老协议的死穴是：请求钉死在一个连接实例上，断线即丢失。

新协议用 **MRTR（Multi Round-Trip Requests，多轮往返请求）** 解决了这个矛盾，思路是把「Server 需要输入」从**反向请求**改写成**原请求的中间结果**：

1. Client 发 `tools/call`（id=1，带 `_meta`）；
2. Server 返回 `resultType: "input_required"` ——原调用到此结束，这是一个 Result 而不是一条新 Request——并附上 `inputRequests`（要什么：比如一个 `elicitation/create` 的表单说明）和 `requestState`（恢复用的不透明句柄）；
3. Client 向用户展示可拒绝的界面，收集 `inputResponses`（用户回答的 `action`：accept / decline / cancel）；
4. Client 用**新的 JSON-RPC ID**（id=2）重发原请求，带上 `inputResponses` 和原样回传的 `requestState`；
5. Server 校验后继续执行，返回 `complete`。

两个场景的业务意图一模一样，但协议契约完全相反：报文从 Request 变成 Result，调用从嵌套变成重放，状态从隐式 session 变成显式 `requestState`。**意图相近，契约相反**——这是理解整次更新最重要的一句话。交互始终由 Client 驱动，无状态才得以成立。

三个容易混的点，说清楚：

- `input_required` **不是报错**。协议错误（未知工具、结构不合法）走 JSON-RPC error；工具执行失败（API 挂了、校验不过）走 `complete` + `isError: true`，错误文本放 `content` 里喂给模型自纠；`input_required` 是第三种东西：**还缺输入**。
- `inputRequests` 里出现 `method: "elicitation/create"` 是**结果里的说明书**（「请你按这个去办」），不是 Server 在线上又发了一条请求。报文类型不同，下一跳的发起方也不同。
- `requestState` 对 Client 不透明：MUST NOT 解析或修改，原样回传。Server 必须把它当攻击者可控输入，影响授权时做 HMAC/AEAD 完整性保护，并绑定主体、短 TTL、原请求参数摘要。

顺带一提，同一思路下的几个衍生变化，方向完全一致：长任务从核心的实验性 `tasks`（阻塞取结果）变成 `io.modelcontextprotocol/tasks` 扩展（`tasks/get` 轮询、`tasks/update` 补输入）；订阅从 `resources/subscribe` 变成统一的 `subscriptions/listen` 长期响应流；日志从 `logging/setLevel` 变成按请求的 `logLevel` 元数据加标准的 stderr / OpenTelemetry。**共享的动机都是：不依赖会话，不依赖长连接。**

## 4. 变化三：扩展模型——从「能力硬塞核心」到「extensions 协商」

前面几个版本的 MCP，习惯是把想得到的能力都写进核心协议：roots、sampling、logging、tasks，每版都在加。核心协议越来越厚，而很多能力其实只是部分场景需要。

2026-07-28 把可选能力全部移出核心：通过 `capabilities.extensions` 用带命名空间的标识协商（`io.modelcontextprotocol/tasks`、`io.modelcontextprotocol/ui` 等）。规则只有一条：**双方都支持才用它**；客户端不支持时，服务端必须能降级——Tasks 降级成普通结果，MCP Apps 降级成文本。

这带来一个此前没有的常态：**同一个 Server 在不同客户端上能力不同**。你的 Agent 连接同一个 Server，在一个客户端里能弹表单、能轮询长任务，在另一个里只能看文本——这不是 bug，是协商的结果，代码必须按 capability 而不是按「Server 宣称支持」来写。

配套的还有一份弃用清单（新项目别碰）：Roots、Sampling、MCP Logging、HTTP+SSE、Dynamic Client Registration、`includeContext: "thisServer"/"allServers"`。注意 Deprecated ≠ 已删除：它们仍在兼容窗口内，最早可移除时间以官方 deprecated registry 为准。

## 5. 一张对照总表


| 主题           | 老协议（2025-11-25 及更早）          | 新协议（2026-07-28）                                                |
| ------------ | ---------------------------- | -------------------------------------------------------------- |
| 协议版本         | `initialize` 阶段协商一次          | 每请求 `_meta` 声明；不支持返回 -32022 + supported                        |
| 能力声明         | 初始化时保存双方 capabilities        | 每次请求的 `_meta`；可选能力走 extensions 协商                              |
| 状态           | MCP session + 连接内状态          | 协议无状态；业务状态显式 handle/DB                                         |
| 用户输入         | Server 主动发请求（反向 RPC，嵌套）      | `input_required` 中间结果；Client 补 `inputResponses` 后新 ID 重放（MRTR） |
| 谁还能发 Request | Server 与 Client 都能           | 协议层只有 Client                                                   |
| 长任务          | 核心实验性 tasks，阻塞取结果            | tasks 扩展：`tasks/get` 轮询 + task handle                          |
| 订阅           | `resources/subscribe`        | `subscriptions/listen` 长流 + subscriptionId                     |
| 断线恢复         | SSE Last-Event-ID 重投         | 不恢复 in-flight；客户端新 ID 重发 → 副作用工具必须幂等                           |
| 传输           | HTTP+SSE（已弃用）                | Streamable HTTP                                                |
| 日志           | `logging/setLevel` 按 session | 每请求 logLevel + stderr/OpenTelemetry                            |




## 6. 对 Agent 应用开发者的启示



### 6.1 心智模型：从「调用工具」到「编排工作流」

最需要改的是心态。以前写 Agent 工具调用，心里想的是「发请求 → 等结果」；现在要把它想成**可暂停、可恢复、可拒绝的多轮工作流**。你的客户端代码要能接受一个调用中途停下来等用户；Agent 开发的重心也从连接管理，转向协议兼容、交互编排、扩展能力和用户安全。

落地到代码，一次调用有三条结果路径，必须都处理：`complete`（含 `isError: true` 的执行失败，**应**把错误文本喂回模型让它自纠）、`input_required`（弹可拒绝的 UI，收集输入后重试）、协议 error（模型难自愈，通常直接上报）。

### 6.2 必须补的底层能力清单

对照自查，缺哪条补哪条：

1. **时代探测与回退**：stdio 下先 `server/discover`；HTTP 下发现代请求并检查错误 body。关键判断：收到 -32022 说明对端是 Modern，换版本重试，**不要**误回退到 initialize。
2. **每请求** `_meta`：构造 `protocolVersion`、`clientCapabilities`、clientInfo。
3. `complete` **/** `input_required` **状态机**：持久化 pending 状态；设最大轮次与超时（规范允许连续多轮 `input_required`，不设上限就是死循环）；accept / decline / cancel 三路分别处理。
4. **Elicitation UI**：表单渲染；URL 模式展示完整域名并征得同意；敏感数据保护。
5. **Tasks 轮询与取消**：按 `capabilities.extensions` 决定启用，不支持则降级。
6. `subscriptions/listen` **重连**：断线后重新订阅，不能指望自动补发。
7. **副作用工具的幂等**：这是最容易爆生产事故的一条，见 6.3。



### 6.3 状态与安全：无状态协议的两道新考题

**第一道：状态怎么放。** 协议不认连接内存，跨请求状态就必须外置：数据库、缓存、显式 handle（部署任务的 intentId、任务句柄），每次请求把 handle 当参数带回来。随之外置的还有安全责任——无状态之后，业务靠 handle 引用，「持有 handle」就成了新的攻击面：**handle ≠ 已认证**。高熵随机、短 TTL、绑定用户主体、服务端按 `userId:handle` 存，是基本要求。`requestState` 同理：签名 + 主体 + TTL + 请求绑定，缺一个就是提权漏洞。

**第二道：信任边界重画。** Tool 描述、Resource 正文、注解，全部默认不可信——提示注入就藏在这里，模型会把描述里的指令当命令执行。MCP Apps 的 HTML 来自已连接的 Server，但它依然是不可信前端代码：必须沙箱（限网络、限主应用 API、限导航），不支持就文本降级。敏感凭据（API Key、Token、支付信息）**MUST** 走 Elicitation 的 URL Mode，让用户在外部域名完成交互，数据不经过 MCP Client，更不进模型上下文；普通表单只收非敏感信息。

送一句每次上线前默念的清单：**Server 身份可见吗？用户同意了吗？密钥走 URL 吗？描述可信吗？handle 绑定用户了吗？副作用幂等了吗？**

### 6.4 现实约束：双时代共存与工程取舍

说清楚收益，也要说清楚成本。按新协议写客户端，你拿到的收益是无状态路由、可暂停的工作流、后台长任务、更丰富的 UI；付出的成本是时代探测与回退、MRTR 状态机、Elicitation 与沙箱、订阅重连、幂等重试。这些都是实打实的复杂度，不是免费的。

还有一个经常被忽略的点：**多 Server 治理**。一个 Host 连十个 Server 时，工具名冲突、权限边界、各自能力差异的降级策略，从第一天就要设计，而不是等冲突出现。

## 7. 收尾：回到三个问题

- **改了什么？** 同时改了连接模型、交互模型、扩展模型三个底座：无状态 + 每请求自述、MRTR 而非反向请求、extensions 协商而非硬塞核心。
- **为什么？** 老设计把「连接 = 会话」钉死，状态粘在连接上，挡死了水平扩展、Serverless 和独立重试；新设计把语境从连接拆到请求里，代价是交互必须由 Client 驱动。
- **对 Agent 开发者意味着什么？** 工具调用从「发请求等结果」变成「编排可暂停的工作流」；幂等、显式状态、信任边界从选修变成必修。

三条行动建议，今天就能做：

1. 把 Agent 调用的工具列出来：有副作用的那些，断线重试会不会重复执行？
2. 检查客户端代码是否还假设「连上 = 会话」；已连接的 Server 是否走了 discover + `_meta`。
3. 新功能默认按「扩展协商 + 文本降级」写，不要按「Server 宣布支持就一定有」写。

留给分享会的讨论题：我们的产品里，哪些工具天然适合改造成「可暂停工作流」？如果今天就要把内部一个远程 Server 迁到 Modern，最痛的一步会是什么？

---

*本文基于 MCP 官方 2026-07-28 规范、版本兼容说明、MRTR pattern、Elicitation 与扩展文档整理。术语与官方一致：Host 是用户使用的 LLM 应用，Client 是 Host 内连接单个 Server 的协议连接器，Server 提供 Tools / Resources / Prompts。*