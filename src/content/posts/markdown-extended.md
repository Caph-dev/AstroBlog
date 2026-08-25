---
title: Markdown 扩展功能
published: 2024-05-01
updated: 2024-11-29
description: '了解更多 Fuwari 中的 Markdown 功能'
image: ''
tags: [演示, 示例, Markdown, Fuwari]
category: 'Examples'
draft: true
---

## GitHub 仓库卡片
你可以添加链接到 GitHub 仓库的动态卡片，页面加载时会从 GitHub API 拉取仓库信息。

::github{repo="Fabrizz/MMM-OnSpotify"}

使用代码 `::github{repo="<owner>/<repo>"}` 创建 GitHub 仓库卡片。

```markdown
::github{repo="saicaca/fuwari"}
```

## 提示框（Admonitions）

支持以下类型的提示框：`note` `tip` `important` `warning` `caution`

:::note
突出显示用户即使快速浏览也应留意的重要信息。
:::

:::tip
可选信息，帮助用户更顺利地完成任务。
:::

:::important
用户成功所必需的关键信息。
:::

:::warning
因潜在风险需要用户立即关注的严重内容。
:::

:::caution
操作可能带来的负面后果。
:::

### 基本语法

```markdown
:::note
突出显示用户即使快速浏览也应留意的重要信息。
:::

:::tip
可选信息，帮助用户更顺利地完成任务。
:::
```

### 自定义标题

可以自定义提示框的标题。

:::note[我的自定义标题]
这是一个带有自定义标题的提示框。
:::

```markdown
:::note[我的自定义标题]
这是一个带有自定义标题的提示框。
:::
```

### GitHub 语法

> [!TIP]
> 也支持 [GitHub 语法](https://github.com/orgs/community/discussions/16925)。

```
> [!NOTE]
> 也支持 GitHub 语法。

> [!TIP]
> 也支持 GitHub 语法。
```

### 剧透（Spoiler）

你可以为文本添加剧透效果，内容同样支持 **Markdown** 语法。

内容 :spoiler[被隐藏了 **嘿嘿**]！

```markdown
内容 :spoiler[被隐藏了 **嘿嘿**]！

```
