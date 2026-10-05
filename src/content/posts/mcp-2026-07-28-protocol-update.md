---
title: MCP 2026-07-28 把工具调用从会话里拆出来
published: 2026-08-01
updated: 2026-10-04
description: 对照 2026-07-28 规范，说明握手取消、MRTR 和扩展之后，Agent 客户端一次工具调用要怎么写。
tags:
  - MCP
  - Agent
  - MRTR
  - 工具调用
category: Agent
draft: false
---

# MCP 2026-07-28 把工具调用从会话里拆出来

我把 2026 年 7 月 28 日的规范公告、版本协商页和 MRTR 说明对了一遍。工具、资源和提示词都还在，字段也还能对上老客户端。变的是一次 `tools/call` 靠什么成立。

2025-11-25 以及更早的规范里，客户端先发 `initialize`，和服务端谈好 `protocolVersion` 和双方 capabilities，再发 `notifications/initialized`。之后的请求默认活在这段会话里，HTTP 上还可能带着 `Mcp-Session-Id`。请求得回到同一个实例，断线以后也不能拿一条新连接单独重试。水平扩展和 Serverless 都会卡在这里。

2026-07-28 把 `initialize`、`initialized` 和 `Mcp-Session-Id` 退掉了，对应 SEP-2575 和 SEP-2567。每个请求自己带上协议版本、客户端身份和 capabilities，放在 `_meta` 里。规范点名的字段是 `io.modelcontextprotocol/protocolVersion`、`io.modelcontextprotocol/clientInfo`、`io.modelcontextprotocol/clientCapabilities`。HTTP 上还要带 `MCP-Protocol-Version`，以及 `Mcp-Method`、`Mcp-Name`，网关可以只看头就做路由和限流，不必先解析 JSON。官方博客里的例子是一次 `tools/call`，头上写着方法名和工具名，body 里的 `_meta` 写着客户端叫什么。

服务端必须实现 `server/discover`。客户端可以先调它，问支持哪些版本、有哪些能力和身份，也可以不调，直接发业务请求。版本对不上，服务端必须返回 `UnsupportedProtocolVersionError`，错误码 `-32022`，`data.supported` 里列出它实际支持的版本，`data.requested` 是你刚才要的那个。客户端从 `supported` 里挑一个双方都有的版本重试。没有共同版本，就告诉用户。

stdio 没有按请求返回的 HTTP 状态，规范建议先发 `server/discover`。探到的如果不是可识别的现代错误，再按老握手回退。HTTP 上先发带 `_meta` 的请求。看到 `400`，而且错误体不是这种现代 JSON-RPC 错误，再考虑回退。

版本页把两边分成现代、Legacy 和双时代，列了一张兼容表，没有写统一的切换日期。现代对现代，discover 可有可无。现代客户端打到只懂握手的服务端，对面可能拒绝，也可能一直没有回应。有的实现还会拿旧语义去处理一个看起来眼熟的方法。双时代客户端碰到现代服务端，就留在现代这一边。探测结果按服务端记，不按单次请求记。stdio 记到这个进程结束，HTTP 记到这个源。下次连同一处，不必每次都先探一遍。记错了，请求失败再探。

协议不再在连接上记会话。业务如果要跨请求记住进度，就由工具发出一个显式 handle，让模型下次当参数传回来。官方博客写了，这样比把状态藏在传输层里更清楚，因为模型看得见这个 handle，也能把它从一个工具交到下一个工具。列表结果也变了。`tools/list`、`prompts/list`、`resources/list`、`resources/read` 可以带 `ttlMs` 和 `cacheScope`，客户端能决定缓存多久，重连以后提示词缓存也不必每次打乱。

## 服务端中途要输入，改由客户端再发一次

握手没了以后，马上碰到一个老问题。工具执行到一半，要用户确认，或者要补一个参数，以前怎么办。

老规范里，服务端会顺着还开着的流，反向发 JSON-RPC 请求。`elicitation/create`、`sampling/createMessage`、`roots/list` 都是这种。它成立，靠的是连接还活着，两边还记得这是同一段会话，客户端也在握手时说过自己会处理这类请求。连接一断，这次询问就丢了。

2026-07-28 规定，这类服务端到客户端的请求必须走 MRTR，SEP 编号是 2322。旧的反向请求不再支持，这是破坏性变更。`input_required` 只能出现在三种客户端请求的结果里，`tools/call`、`resources/read`、`prompts/get`。`tools/list` 和 `server/discover` 不能中途停下来问人。

客户端先发 `tools/call`，JSON-RPC 的 id 是 1，`_meta` 必须带齐。服务端发现还缺东西，就返回一个 Result，`resultType` 为 `input_required`。里面可以有 `inputRequests`，这是一张表，键由服务端定，值是要客户端去办的请求，比如一份 `elicitation/create` 表单，或者一次 `sampling/createMessage`。也可以带 `requestState`，给服务端自己恢复用的不透明字符串。两者至少得有一个。这条结果把 id 为 1 的调用结束掉，服务端并没有再发一条新的 Request。

客户端按 `inputRequests` 去收集回答。用户可以接受、拒绝或取消。然后用新的 id，比如 2，把原来的 `tools/call` 再发一遍，带上 `inputResponses`，并把 `requestState` 原样放回去。服务端只看这一次请求里有的东西，校验通过就返回最终结果。规范写明，重试可以由另一台实例处理。服务端不该假定客户端一定会答、一定会重试。信息还缺，它应该再回一次 `input_required`。JSON 不合法、schema 不对，才走 JSON-RPC error。

`requestState` 对客户端不透明。客户端不得解析、修改，也不得套用到并行的别的请求上。它会经过客户端，所以规范把它当成攻击者能改的输入。一旦它影响授权、资源访问或业务判断，服务端必须做完整性保护，HMAC 或 AEAD 都可以，校验失败就拒绝。为了缩小重放窗口，规范建议在签过名的载荷里写上调用者、过期时间，以及原请求的方法名和参数摘要。对不上就拒绝。这还不能保证只用一次。只能兑现一次的场景，服务端自己还得记已经用过。

同一版规范里，长任务从实验性的核心能力挪到扩展 `io.modelcontextprotocol/tasks`。取状态用 `tasks/get` 轮询，补输入用 `tasks/update`，SEP-2663。变更通知从原来的 HTTP GET 收成一条 `subscriptions/listen` 流，客户端按通知类型自己选择订阅。Roots、Sampling、Logging 被标成弃用，SEP-2577，至少还能再用十二个月，新实现别再采用。旧的 HTTP 加 SSE 传输同样弃用，也给了一年的退出时间。Dynamic Client Registration 转向客户端元数据文档，旧注册方式还能用，以后的规范版本会拿掉。

可选能力放进扩展以后，客户端没在 capabilities 里声明的，服务端就不能塞进 `inputRequests`。你的 Agent 连着同一个 Server，在一个客户端里能弹表单、能轮询长任务，在另一个客户端里这些请求发不出去。写代码时看的是这次请求声明了什么，不能看服务端主页上写过支持什么。

授权这一版也收紧了几处，公告里写的是实现者最耗时间的部分。授权服务器应按 RFC 9207 返回 `iss`，客户端在兑换授权码之前必须核验，用来堵授权服务器混淆。客户端凭据绑定签发它的那一家，不能拿到另一家去用。DCR 里还要求带上 `application_type`，避免桌面和命令行客户端的 localhost 回调被拒。这些是规范文本里的要求。我没有拿某一家云厂商的接入时长做验证。

## 写客户端时，一次调用会在中途停住

以前写工具调用，代码路径大致是发出去，然后等一个结果。现在这条路径会停在 `input_required`。你得把这次还没做完的调用存下来，设最大轮数和超时。规范允许连续多次 `input_required`，不设上限就会转圈。接受、拒绝、取消要分开处理。用户拒绝以后，不能假装他已经填完，再把原请求打回去。

有副作用的工具要单独看。MRTR 的第二次请求是一条新请求，换了 JSON-RPC id，也可能落到另一台机器。服务端如果在返回 `input_required` 之前已经扣过款、建过资源，重试又做一遍，就会重复。进度得写进 `requestState`，或者写进工具自己发出来的 handle，让下一次请求知道这件事已经做过。

SEP-2567 把 handle 写成工具设计上的建议，协议里没有单独的 handle 类型。已经登录的服务端，每次都要拿 handle 和当前这次请求的身份一起核。没登录的服务端，handle 本身就是凭证，SEP 建议至少 128 位加密安全随机数，并且给它一个有限寿命。handle 会出现在聊天记录里，光拿到字符串不能当成已经授权。

一个 Host 连着很多 Server 时，工具重名、权限怎么划，以及某个扩展这边有、那边没有，得在接进来的时候就定。等到两个 Server 都暴露了同名工具再改，调用方已经分不清该打哪一个。

官方 Tier 1 的 TypeScript、Python、Go、C# SDK 在公告当天已经能说 2026-07-28，Rust SDK 还在 beta。迁移说明主要打在还依赖会话标识的实现上。

## 来源

- [2026-07-28 规范公告](https://blog.modelcontextprotocol.io/posts/2026-07-28/)
- [协议版本协商](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning)
- [多轮往返请求](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/mrtr)
- [SEP-2567 用显式 handle 去掉会话](https://modelcontextprotocol.io/seps/2567-sessionless-mcp)
