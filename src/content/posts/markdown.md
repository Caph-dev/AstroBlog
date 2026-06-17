---
title: Markdown 示例
published: 2023-10-01
description: 一个简单的 Markdown 博客文章示例。
tags: [Markdown, 博客, 演示]
category: Examples
draft: false
---

# 一级标题

段落之间用空行分隔。

第二段。_斜体_、**粗体**和 `等宽字体`。列表项如下：

- 这一项
- 那一项
- 另一项

请注意——不考虑星号——实际文本内容从第 4 列开始。

> 引用块
> 可以这样写。
>
> 如果需要，可以跨多个段落，
> 像这样。

用 3 个连字符表示破折号。用 2 个连字符表示范围（例如，"第 12--14 章"）。三个点 ... 会被转换为省略号。支持 Unicode。☺

## 二级标题

这是一个有序列表：

1. 第一项
2. 第二项
3. 第三项

再次注意实际文本从第 4 列开始（距左侧 4 个字符）。下面是一个代码示例：

    # 让我重申 ...
    for i in 1 .. 10 { do-something(i) }

如你所料，缩进 4 个空格。顺便说一下，除了缩进代码块，你也可以使用定界符块：

```
define foobar() {
    print "Welcome to flavor country!";
}
```

（这样复制粘贴更方便）。你还可以选择让 Pandoc 对定界符块进行语法高亮：

```python
import time
# Quick, count to ten!
for i in range(10):
    # (but not *too* quick)
    time.sleep(0.5)
    print i
```

### 三级标题

现在是一个嵌套列表：

1. 首先，准备这些食材：

    - 胡萝卜
    - 芹菜
    - 扁豆

2. 烧一些水。

3. 把所有东西倒进锅里，然后
    按以下步骤操作：

        find wooden spoon
        uncover pot
        stir
        cover pot
        balance wooden spoon precariously on pot handle
        wait 10 minutes
        goto first step (or shut off burner when done)

    不要碰到木勺，否则它会掉下来。

再次注意，文本始终在 4 空格缩进处对齐（包括上面第 3 项的最后一行）。

这是一个指向 [网站](http://foo.bar)、[本地文档](local-doc.html) 和[当前文档中的章节标题](#二级标题) 的链接。这是一个脚注 [^1]。

[^1]: 脚注内容写在这里。

表格可以是这样的：

size material color

---

9 leather brown
10 hemp canvas natural
11 glass transparent

Table: 鞋子、尺码及材质

（上面是表格的标题。）Pandoc 也支持多行表格：

---

keyword text

---

red Sunsets, apples, and
other red or reddish
things.

green Leaves, grass, frogs
and other things it's
not easy being.

---

下面是一条水平分隔线。

---

这是一个定义列表：

apples
: 适合做苹果酱。
oranges
: 柑橘类水果！
tomatoes
: tomatoe 里没有 "e"。

同样，文本缩进 4 个空格。（在每个术语/定义对之间加空行，可以让排版更宽松。）

这是一个「行块」：

| Line one
| Line too
| Line tree

图片可以这样指定：

[//]: # (![example image]&#40;./demo-banner.png "An exemplary image"&#41;)

行内数学公式这样写：$\omega = d\phi / dt$。行间公式应单独成行，并用双美元符号包裹：

$$I = \int \rho R^{2} dV$$

$$
\begin{equation*}
\pi
=3.1415926535
 \;8979323846\;2643383279\;5028841971\;6939937510\;5820974944
 \;5923078164\;0628620899\;8628034825\;3421170679\;\ldots
\end{equation*}
$$

请注意，你可以用反斜杠转义任何希望原样显示的标点字符，例如：\`foo\`、\*bar\* 等。
