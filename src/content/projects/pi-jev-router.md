---
title: pi-jev-router
published: 2026-10-04
description: Pi 的虚拟模型路由扩展，注册 jev/auto 虚拟模型，为每个请求分派物理模型。
tags:
  - Pi
  - AI Agent
  - TypeScript
status: published
link:
  - label: GitHub
    icon: fa7-brands:github
    value: https://github.com/Caph-dev/pi-jev-router
  - label: npm
    icon: simple-icons:npm
    value: https://www.npmjs.com/package/@caph42/pi-jev-router
---

pi-jev-router 是 [pi](https://pi.dev) 的扩展。它注册一个虚拟模型 `jev/auto`，并为发到该模型的每个请求挑选一个物理模型：由强模型负责规划，另一档模型按规划干活。

## 工作方式

普通请求可以通过分类器评估任务文本的复杂度，再选择规划模型。分类器只评估文本，不读取模型名和价格；分类不可用时，路由器会按回退规则选择或保留模型。

符合条件的成功写入后，路由器可能交接给实现模型。交接需要满足当前策略的条件，且实现模型没有被关闭。

## 三种策略

策略决定路由器多久重新看一次输入。

- `adaptive`（默认）：每条用户消息和每次压缩之后重新判定，符合条件时允许交接。
- `fixed`：只在第一条用户消息判定，第一次成功写入后换成实现模型，用到分支结束。
- `record`：路由与 `fixed` 相同，额外的分类只记录本会发生的升级，不改变实际路由。

## 安装

```sh
pi install npm:@caph42/pi-jev-router
```

安装后在 `/model` 里选择 Auto (Jev)，或者用 `pi --model jev/auto` 启动 pi。升级用 `pi update --extensions`。
