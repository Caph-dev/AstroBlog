---
title: agents-progressive-disclosure
published: 2026-11-04
description: 一个 agent skill 的七次提交：从把重构写成固定流程，到先判断这件事该不该做。
tags:
  - Agent
  - AGENTS.md
  - Skills
status: published
image: /assets/images/projects/apd-cover.png
link:
  - label: GitHub
    icon: fa7-brands:github
    value: https://github.com/Caph-dev/agents-progressive-disclosure
  - label: skills.sh
    icon: material-symbols:extension
    value: https://skills.sh/Caph-dev/agents-progressive-disclosure
---

这个项目很小：一份 `SKILL.md`，一份 `README.md`，加一份七行的配置。它做一件事，评估膨胀的 `AGENTS.md` 或 `CLAUDE.md`，必要时拆成精简的入口文件和按需读取的 `docs/`。

效果不在这里证明。下面按提交顺序看这七个提交，重点是每一次改动把哪些默认做法换成了需要先回答的问题。

![agents-progressive-disclosure 的四个阶段：按提交顺序排列，每段标注改动内容和判断标准的变化](/assets/images/projects/apd-evolution.png)

## 初版把重构写成了一条固定流程

初版一次落地了三个文件：README、SKILL 和配置。当时的流程是一条直线：

> 识别目标文件，检查现有结构，把规则分成两桶，设计 docs 映射，重写入口，验证规则没有丢失。

两桶是写死的。语言默认值、安全边界和工具优先级留在入口。命令目录、搜索策略、框架指令、包管理器、环境配置、Git、部署、测试和文档风格全部下沉。文档名同样写死，例如 `docs/search-and-evidence.md` 和 `docs/local-environment.md`。验证命令直接用 macOS 上 zsh 的 `wc -l` 和 `rg`。

这套流程有一个没有写出来的前提：目标项目和自己的项目一样。文档名、命令和规则主题都取自那一个项目，换一个项目就不再成立。

## 矛盾检测被移到分类之前

第二次提交只改 SKILL，改动落在流程顺序上。

分类之前多了一步，先检测矛盾。要扫的东西包括互相冲突的风格规则、写了两个的包管理器、前后不一致的测试命令、相互矛盾的安全边界或优先级声明，以及同一条规则用不同措辞写了两遍。能依据用户明确指令、最近层级的指令文件或本地证据解决的，直接解决。解决不了才问用户。

这一步的位置说明了一个判断：矛盾要先收敛到一处解决。如果输入本身互相冲突，先分类就会把同一个冲突分散到不同文档里，之后更难发现。

同一个提交还清掉了模板里的具体值。文档名换成 `[rule cluster]` 和 `[focused-doc]` 占位符。验证命令从写死的 macOS 和 zsh 改成按当前环境适配，占位符换成实际文件。README 里那一串具体文档名也删了，改为要求保留各平台各自的 frontmatter、imports 和路径通配。

这一轮没有增加能力，只把模板里那些来自单个项目的默认值拆了出去。

## README 开始写明技能的适用边界

两个提交重写了 README，方向是中文优先，原来英文在前。改法以删减为主。

README 里第一次出现反面结论：

> 其实将全局 `AGENTS.md` 拆分的必要性并不高，主要是方便维护。省上下文的收益几乎为 0，反正都会命中缓存。
>
> 但是对于项目级的 `AGENTS.md` 用处就不小了。

这句是当时 README 的判断，没有配套实测。缓存命中也不等于这些指令不占上下文。但它标出了技能的适用面，主要解决项目级 `AGENTS.md` 的维护问题。

边界的表达方式也是删减。同一批提交删掉了「更多安装选项」和「手动安装」两段。提醒改用 `> [!IMPORTANT]` 和 `> [!CAUTION]` 提示块放到前面，而不是在文末补一节注意事项。

## 拆分不再是默认动作

最后一次提交只改 SKILL，换掉了技能的目标。旧目标是「把长指令文件转成精简入口和聚焦文档」，新目标是评估这个文件，然后在保持不动、原地整理和拆分三者中选最小的有效改动。

新增的步骤写了前提：只有用户没有明确要求拆分时才这样判断。如果拆分解决不了具体问题，就说明理由并停止。文件本来就不长、规则本来配套使用、收益不清楚，都属于解决不了具体问题。停止意味着不备份，也不新建文档。

分类标准也换了。原来按主题切分，测试的进测试文档，Git 的进 Git 文档。现在按内容和使用情境切分，并明确禁止「仅仅因为主题是测试、Git 或环境配置就下沉」。判断依据有两条：这条规则多常用，漏了会怎样。常驻规则和任务细节这两类仍然存在，变的是去向不再由主题单独决定。

验证环节也改了。旧版列一份关键词清单，到新文件里跑一遍 `rg`。新版指出这一步的边界：关键词命中只能发现遗漏，不能证明语义还在。因此新版保留关键词检查，并增加对每条被移动或改写规则的比对，比对力度（must、must not 或 should）、适用范围、生效时机和例外。

路由表的表头从「任务类型、先读文档、触发条件」改成「任务或对象、先读文档、触发时机」。新版另加一条要求：agent 必须能在不读目标文档的情况下认出触发条件，并在受该规则约束的动作发生前读完。

## 相关链接

- 仓库：[Caph-dev/agents-progressive-disclosure](https://github.com/Caph-dev/agents-progressive-disclosure)
- skills.sh：[agents-progressive-disclosure](https://skills.sh/Caph-dev/agents-progressive-disclosure)
- 用法与常见问题见博客另一篇：[是时候精简你的 AGENTS.md 了](/posts/agents-progressive-disclosure/)
