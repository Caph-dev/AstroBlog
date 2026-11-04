---
title: Dispatch
published: 2026-11-04
order: 1
description: 面向客服场景的多 Agent 运行时，把意图识别、主辅路由、三级记忆、监控和评测串成一条可观测的闭环。
tags:
  - Python
  - 多 Agent
  - RAG
status: published
image: /assets/images/projects/dispatch-demo.png
link:
  - label: GitHub
    icon: fa7-brands:github
    value: https://github.com/Caph-dev/Dispatch
  - label: 前端
    icon: fa7-brands:github
    value: https://github.com/Caph-dev/DispatchFrontend
  - label: Demo
    icon: material-symbols:open-in-new
    value: https://dispatch-demo.caph.me
---

Dispatch 是一个面向客服与运营场景的多 Agent 运行时。后端是 Python 和 FastAPI，前端只是一个调试台。它想解决客服里三个反复出现的问题：分流不准、多轮对话的上下文断掉、以及改了规则之后没法验证。

一次请求走的主路径是固定的七步：

```text
读取记忆 → 意图识别 → 路由决策 → 单 Agent / 并行多 Agent → 回复合并 → 记忆回写 → 监控与评测反馈
```

这条链路上每一环都把依据交出来。`POST /chat` 除了回复本身，还返回 `intent`、`primary_agent`、`supporting_agents`、`routing_reason`、`routing_confidence` 和 `latency_ms`。路由不是黑箱，界面右侧那一栏就是这些字段。

![Dispatch 前端对话页，右侧是这一次请求的路由结果：主 Agent technical、意图 technical_login、置信度 75%、耗时 3151.5 ms](/assets/images/projects/dispatch-demo.png)

## 意图识别是加权投票，不是让模型直接下结论

三路识别同时跑，最后按权重合并成一条结果：

| 识别路径 | 权重 | 特点 |
| --- | --- | --- |
| LLM | 0.7 | 能读长句和上下文，要花钱，有延迟 |
| Embedding | 0.2 | 对换了说法的问法更稳 |
| 关键词 Pattern | 0.1 | 零延迟兜底，只在少数关键短语上可靠 |

这张权重表会随可用性变形。Embedding 未启用时改成 LLM 0.85 加关键词 0.15。LLM 调用失败时干脆不投票，先信 Embedding，Embedding 也没有结果才退回关键词。降级规则集中写在 `_vote()` 一处，不散落在三个分支里。

还有一个容易被忽略的判断：识别结果归到 `OTHER`、置信度又低于 0.5 时，系统先追问一句再决定路由，而不是硬挑一个 Agent 接单。误路由的代价比多问一句高。

## 路由先处理必须升级的情况，再打分

紧急度为 CRITICAL，或者意图本身就是转人工，路由直接指向 `EscalationAgent`，不进入后面的打分环节。这类请求没有「再看看」的余地。

其余请求按领域打分。起始分里 General 是 0.1，Technical 和 Billing 从 0 开始，加分有三个来源：

- 意图组命中：技术类意图给 Technical 加 0.75，账务类给 Billing 加 0.75，通用类给 General 加 0.55
- 关键词命中：每条 0.18（General 0.12），技术类和账务类封顶 0.45，通用封顶 0.35
- 实体命中：出现错误码给 Technical 加 0.2，出现金额给 Billing 加 0.15，出现订单号给 General 加 0.1

最高分当主 Agent。辅助 Agent 要同时满足两个条件，分数不低于 0.45，且不低于主 Agent 分数的 0.55 倍。双阈值是「主处理加辅助诊断」和「关键词一命中就乱配」之间的分界线。一旦有辅助 Agent，两个 Agent 用 `asyncio.gather` 并行执行，再由 `ResponseComposer` 合成一条回复，而不是把两段答案拼在一起。

同类型 Agent 有多个实例时，按在线表现挑一个：

```text
routing_score = 成功率 × 0.7 + 延迟得分 × 0.3
最终得分 = routing_score × (1 − 监控降权)
```

监控把某个专属类型的降权推高到 0.5 以上时，路由层会把它整个从候选里摘掉，回到 General，并在 `routing_reason` 后面追加 `monitor_fallback=[...]`。回退的条件是该类型所有实例都已经被降权，只要还剩一个健康实例就继续用。这条逻辑在路由层实现，单实例部署也能看到效果。

## 四个角色各有自己的工具白名单

| Agent | 职责 | 工具范围 |
| --- | --- | --- |
| `GeneralAgent` | 通用接待和分诊 | `inspect_request_context`、`suggest_required_fields` |
| `TechnicalAgent` | 登录失败、崩溃、错误码排障 | `lookup_error_code`、`build_diagnostic_plan` |
| `BillingAgent` | 退款、发票、重复扣款 | `check_billing_fields`、`compare_amounts` |
| `EscalationAgent` | 转人工，输出结构化交接 | `create_handoff_summary` |

角色之间不是同一份提示词改几个字。每个 Agent 有自己的角色契约、模型覆盖变量和工具白名单，白名单之外的工具调用会被工具层拒绝。

这些工具的定义值得单独看一眼，因为每个都写清了自己不做什么：`inspect_request_context` 不查询外部业务系统，`lookup_error_code` 不读取服务端日志，`check_billing_fields` 不连接订单、支付或退款系统，`create_handoff_summary` 不创建真实工单。订单查询、退款执行、账单修改这类需要真实业务系统授权的动作，在工具层根本没有实现，也没有用假数据顶上。`EscalationAgent` 同样不会继续编答案，它只输出结构化的交接信息。

## 记忆分三层

- 工作记忆存 Redis，24 小时 TTL
- 累计到 15 条消息触发压缩，保留摘要和最近 5 条，摘要本身限制在 800 字符
- 情景记忆和用户画像存 ChromaDB 的 `episodic`、`user_profile` 两个 collection，知识库用独立的 collection

分层的理由是三类内容寿命不同。当前会话的原文几小时后就没用了，但「这个用户上次报过什么错」和「他习惯用什么支付渠道」值得跨会话留着。压缩也是为了不让历史无限膨胀，摘要加最近几条足够支撑指代和追问。

## Skills 是文件，改完热加载

`skills/` 下面放 `SKILL.md`，也支持 `.md`、`.txt`、`.json`。加载规则很直接：没有写 keywords 的当作全局规范注入，写了 keywords 的命中关键词才注入。单块内容限制 3200 字符，一次注入的总量限制 5000。

改完不用重启，`POST /skills/reload` 重新读一遍目录。这样做的好处是运营改话术不用碰代码；代价是文件写错了立刻影响线上回复，所以加载时会收集解析错误并在 `GET /skills` 里报出来。

## 监控降权，评测给基线

在线部分统计每个 Agent 的成功率、平均延迟和工具调用质量，表现差的会被降权，降权再反馈给路由。

离线部分走 `POST /eval/run`。意图识别用带标准答案的测试集算 accuracy 和 macro F1；回复质量用 LLM-as-Judge 多维打分。报告给出通过率、各项均分、相对基线的回归项和优化建议。基线文件由 `EVAL_BASELINE_PATH` 指定，默认指向 `/app/data/eval/baseline.json`。

## 部署

`docker compose up` 起五个容器，网络是 `dispatch-network`（`172.28.0.0/16`）。启动顺序是 Redis 与 ChromaDB 健康之后启动应用，应用健康之后启动 Nginx。

| 服务 | 端口（宿主机 → 容器） |
| --- | --- |
| Dispatch API | 8000 → 8000 |
| Redis 7 | 6379 → 6379 |
| ChromaDB 0.5.23 | 8001 → 8000 |
| Prometheus | 9090 → 9090 |
| Nginx | 80 → 80 |

镜像用 `python:3.12-slim` 多阶段构建，production 阶段以非 root 用户 `dispatch` 运行。`data/chroma`、`data/eval`、`skills`、`logs` 挂在宿主机上，重建镜像不会清掉知识库、评测基线和业务规则。

应用健康检查的 `start_period` 是 90 秒，因为首次启动要预下载 ChromaDB 的 ONNX embedding 模型。在此之前 `GET /health` 返回 503，含义是进程起来了但初始化没完成，不要当成启动失败去重启。

## 前端只是调试台

前端在另一个仓库 `DispatchFrontend`，React 19 配 Vite 7，组件库是 Astryx。一共三个页面：

- 对话：发消息，看意图、路由、耗时和工具调用
- 知识库：检索、导入文档、上传 `.txt` 和 `.md`、查看已加载的 Skills
- 评测：跑后端内置评测，看通过率、平均评分和优化建议

它没有自己的业务逻辑，做的就是把后端的中间结果摊开给人看。开发模式下 Vite 把 `/api/python` 代理到 8000，前端挂在 5173。演示环境只跑 Python 后端，`src/lib/backends.js` 里保留的 Java 客户端是给本地内部调用用的。

## 已知边界

- Grafana 面板和告警规则在 `config/` 里是预留目录，当前 Compose 不启动 Grafana，规则文件也没挂进 Prometheus。应用内真正生效的告警通道只有 webhook
- 路由评分里「多实例选最优」的那部分，在单实例部署下退化成恒定值，只有监控降权那半仍然有效
- 接口没有鉴权。Nginx 只按 IP 做了限流，10 请求/秒、突发 20、并发连接 10，挡得住误用挡不住刻意刷
- 评测基线和知识库都在 `data/` 下，这个目录被 gitignore 掉了，换机器要手动迁移
- HTTPS 的 server 块在 `config/nginx/nginx.conf` 里还是注释状态，对外靠上层代理终结 TLS

## 相关链接

- 后端仓库：[Caph-dev/Dispatch](https://github.com/Caph-dev/Dispatch)
- 前端仓库：[Caph-dev/DispatchFrontend](https://github.com/Caph-dev/DispatchFrontend)
- 在线演示：[dispatch-demo.caph.me](https://dispatch-demo.caph.me)
