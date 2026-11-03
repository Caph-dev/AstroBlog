import type { BooknavGroup, BooknavPageConfig } from "../types/booknavConfig";

// 书签导航页面配置
export const booknavPageConfig: BooknavPageConfig = {
	// 页面标题，如果留空则使用 i18n 中的翻译
	title: "",

	// 页面描述文本，如果留空则使用 i18n 中的翻译
	description: "",

	// favicon 自动获取配置
	favicon: {
		// 书签未填写 icon 时，是否自动获取目标站点的 favicon 图标
		enabled: true,

		// favicon 接口地址，{domain} 为占位符，会被替换成目标站点域名
		// 更换接口只需保证地址里含有 {domain}，例如：
		//   https://a.favicon.im/{domain}
		//   https://favicon.im/{domain}
		api: "https://a.favicon.im/{domain}",
	},
};

// 书签导航配置
// 每个数组项是一个分类组，分类组内的 items 是该分类下的书签
export const booknavConfig: BooknavGroup[] = [
	{
		id: "ai-agent",
		name: "AI 与 Agent",
		icon: "material-symbols:smart-toy-outline",
		desc: "模型服务状态与 Agent 资料",
		weight: 110,
		items: [
			{
				title: "DeepSeek Status",
				url: "https://status.deepseek.com/",
				desc: "DeepSeek 官方服务状态页，查看各服务可用性与历史事故记录",
				weight: 30,
			},
			{
				title: "DeepSeek Monitor Archive",
				url: "https://deepseek-monitor-archive.pages.dev/",
				desc: "DeepSeek 监测记录与公开分析",
				weight: 20,
			},
			{
				title: "Phistory",
				url: "https://phistory.cc/",
				desc: "按版本归档的 AI 编程 Agent 系统提示词与工具定义",
				weight: 10,
			},
			{
				title: "Skills.sh",
				url: "https://skills.sh/",
				desc: "可复用的 Agent Skills 目录与排行榜",
			},
			{
				title: "UI/UX Pro Max",
				url: "https://skills.sh/nextlevelbuilder/ui-ux-pro-max-skill/ui-ux-pro-max",
				desc: "面向多种技术栈的 UI 设计与体验指南",
			},
			{
				title: "Anthropic PDF Skill",
				url: "https://skills.sh/anthropics/skills/pdf",
				desc: "PDF 提取、创建与处理的 Agent 技能",
			},
			{
				title: "Anthropic PPTX Skill",
				url: "https://skills.sh/anthropics/skills/pptx",
				desc: "演示文稿创建、编辑与检查的 Agent 技能",
			},
			{
				title: "Impeccable Critique",
				url: "https://skills.sh/pbakaus/impeccable/critique",
				desc: "分析界面层级、排版与交互的设计评审技能",
			},
			{
				title: "GitHub Actions Docs Skill",
				url: "https://skills.sh/xixu-me/skills/github-actions-docs",
				desc: "依据官方文档查找 GitHub Actions 配置",
			},
			{
				title: "MCPMarket",
				url: "https://mcpmarket.com/zh",
				desc: "第三方 MCP 服务器、客户端与技能目录",
			},
			{
				title: "DeepWiki MCP",
				url: "https://docs.devin.ai/zh/work-with-devin/deepwiki-mcp",
				desc: "访问公共仓库知识库的 MCP 官方文档",
			},
			{
				title: "Claude Code 工作原理",
				url: "https://zhangchitc.github.io/claude_code/",
				desc: "用交互演示拆解 Claude Code 的内部机制",
			},
			{
				title: "LangChain Agent Memory",
				url: "https://docs.langchain.com/oss/python/concepts/memory",
				desc: "Agent 短期与长期记忆的概念指南",
			},
			{
				title: "Pi Agent 源码学习",
				url: "https://dg-ai-notes.pages.dev/",
				desc: "Pi Agent 内核与开发实践教程",
			},
			{
				title: "Maestro Flow",
				url: "https://catlog22.github.io/maestro-flow/guides/quick-start",
				desc: "面向编程 Agent 的工作流快速入门",
			},
		],
	},
	{
		id: "dev",
		name: "开发",
		icon: "material-symbols:code-rounded",
		desc: "写代码时离不开的站点",
		weight: 100,
		items: [
			{
				title: "GitHub",
				url: "https://github.com",
				desc: "全球最大的代码托管平台",
				// icon 字段可以使用 astro-icon 图标库的图标名称
				// 也可以使用图片 URL 和本地图片路径
				// 不填则会通过接口自动获取目标站点的 favicon 图标（需要在上面配置）
				icon: "fa7-brands:github",
				weight: 10,
			},
			{
				title: "MDN Web Docs",
				url: "https://developer.mozilla.org",
				desc: "最权威的 Web 技术文档",
				weight: 9,
			},
			{
				title: "Astro",
				url: "https://astro.build",
				desc: "内容驱动型网站的 Web 框架",
				weight: 8,
			},
			{
				title: "Svelte",
				url: "https://svelte.dev",
				desc: "把组件编译成高效原生 JS 的框架",
				weight: 7,
			},
			{
				title: "Tailwind CSS",
				url: "https://tailwindcss.com",
				desc: "一个功能强大且灵活的 CSS 框架",
				weight: 6,
			},
			{
				title: "代码随想录",
				url: "https://programmercarl.com/",
				desc: "算法与数据结构学习路线和题解",
			},
			{
				title: "卡码笔记",
				url: "https://notes.kamacoder.com/base/",
				desc: "操作系统、网络与数据库等计算机基础知识",
			},
			{
				title: "AI Coding Dictionary",
				url: "https://www.aicodingdictionary.com/",
				desc: "AI 编程和 Agent 工作流术语表",
			},
		],
	},
	{
		id: "ai-evaluations",
		name: "AI 评测",
		icon: "material-symbols:smart-toy-outline",
		desc: "模型与编程 Agent 的评测参考",
		weight: 95,
		items: [
			{
				title: "Artificial Analysis",
				url: "https://artificialanalysis.ai/#intelligence",
				desc: "独立模型能力、速度和成本评测",
			},
			{
				title: "OpenBench",
				url: "https://minghinmatthewlam.github.io/openbench/",
				desc: "编程 Agent 框架的公开基准与测试方法",
			},
			{
				title: "Agent Security League",
				url: "https://www.endorlabs.com/research/ai-code-security-benchmark",
				desc: "编程 Agent 生成代码的功能与安全性评测",
			},
			{
				title: "Real API Pricing",
				url: "https://real-api-pricing.vercel.app/#lang=zh&fee=0-30&channels=OpenAI&channels=Anthropic",
				desc: "第三方模型套餐与用量价格比较，数据以站点标注为准",
			},
		],
	},
	{
		id: "ui-components",
		name: "UI 组件",
		icon: "material-symbols:code-rounded",
		desc: "组件库、设计系统与交互素材",
		weight: 92,
		items: [
			{
				title: "Kumo UI",
				url: "https://kumo-ui.com/",
				desc: "Cloudflare 的 React 组件库与设计系统",
			},
			{
				title: "Astryx",
				url: "https://astryx.atmeta.com/",
				desc: "Meta 的开源 React 设计系统与组件",
			},
			{
				title: "AI Elements",
				url: "https://elements.ai-sdk.dev/",
				desc: "构建 AI 对话与工作流界面的组件库",
			},
			{
				title: "React Bits: Split Text",
				url: "https://reactbits.dev/text-animations/split-text",
				desc: "React 文本拆分与入场动画组件",
			},
			{
				title: "Aceternity UI",
				url: "https://ui.aceternity.com/",
				desc: "React 与 Tailwind 界面组件和动效",
			},
			{
				title: "Uiverse",
				url: "https://uiverse.io/",
				desc: "社区分享的开源 UI 元素与代码",
			},
		],
	},
	{
		id: "opensource",
		name: "项目",
		icon: "material-symbols:code-rounded",
		desc: "好用的开源项目",
		weight: 90,
		items: [
			{
				title: "Firefly",
				url: "https://github.com/CuteLeaf/Firefly",
				desc: "清晰美观的 Astro 个人博客主题模板",
				icon: "/favicon/firefly-32.png",
				weight: 10,
			},
			{
				title: "fff",
				url: "https://github.com/dmtrKovalenko/fff",
				desc: "面向 AI Agent 和开发工具的文件搜索项目",
			},
		],
	},
	{
		id: "design",
		name: "设计",
		icon: "material-symbols:palette-outline-rounded",
		desc: "配色、图标与灵感来源",
		weight: 90,
		items: [
			{
				title: "Iconify",
				url: "https://icon-sets.iconify.design",
				desc: "海量开源图标集合搜索",
				weight: 10,
			},
			{
				title: "iconfont",
				url: "https://www.iconfont.cn",
				desc: "阿里巴巴矢量图标库",
				weight: 9,
			},
			{
				title: "Phosphor Icons",
				url: "https://phosphoricons.com/",
				desc: "可用于界面和图表的开源图标库",
			},
			{
				title: "Skill Icons",
				url: "https://skillicons.dev/",
				desc: "用于 GitHub README 的技术栈图标",
			},
			{
				title: "Dashboard Icons",
				url: "https://dashboardicons.com/",
				desc: "服务与应用的图标素材库",
			},
			{
				title: "Color Hunt",
				url: "https://colorhunt.co/",
				desc: "社区配色方案与灵感",
			},
			{
				title: "Coolors",
				url: "https://coolors.co/",
				desc: "调色板生成、图片取色与对比度检查",
			},
			{
				title: "DesignPrompts",
				url: "https://www.designprompts.dev/",
				desc: "面向编程 Agent 的网页设计风格与提示词参考",
			},
			{
				title: "DESIGN.md",
				url: "https://github.com/google-labs-code/design.md",
				desc: "向编程 Agent 描述视觉设计系统的规范与工具",
			},
			{
				title: "Awwwards",
				url: "https://www.awwwards.com/",
				desc: "网页设计作品与获奖案例",
			},
			{
				title: "Geist × Anthropic",
				url: "https://geist.co/work/anthropic",
				desc: "Anthropic 品牌视觉设计案例",
			},
			{
				title: "Claude 界面设计解析",
				url: "https://rar.design/posts/claude-interface-design-philosophy",
				desc: "Claude 的色彩、字体与交互设计分析",
			},
			{
				title: "Prompt Gallery",
				url: "https://weiyyin.github.io/linux-do-gpt-image/prompt_gallery.html",
				desc: "图片生成提示词与示例图库",
			},
		],
	},
	{
		id: "developer-blogs",
		name: "技术博客",
		icon: "material-symbols:auto-stories-outline-rounded",
		desc: "开发者的工程实践与思考",
		weight: 85,
		items: [
			{
				title: "Mario Zechner",
				url: "https://mariozechner.at/",
				desc: "编程 Agent、工具与软件开发实践",
			},
			{
				title: "Armin Ronacher",
				url: "https://lucumr.pocoo.org/",
				desc: "软件工程、开源工具与 AI 开发随笔",
			},
			{
				title: "Thariq Shihipar",
				url: "https://www.thariq.io/",
				desc: "工程实践与 AI 相关的个人文章",
			},
			{
				title: "Boris Cherny",
				url: "https://borischerny.com/",
				desc: "TypeScript、Web 开发与工程实践",
			},
			{
				title: "时歌的博客",
				url: "https://www.lapis.cafe/",
				desc: "AI、深度学习与技术思考",
			},
		],
	},
	{
		id: "tools",
		name: "工具",
		icon: "material-symbols:build-outline-rounded",
		desc: "顺手的在线小工具",
		weight: 80,
		items: [
			{
				title: "TinyPNG",
				url: "https://tinypng.com",
				desc: "在线压缩 PNG / JPEG 图片",
				weight: 10,
			},
			{
				title: "Squoosh",
				url: "https://squoosh.app",
				desc: "Google 出品的图片压缩与格式转换",
				weight: 9,
			},
			{
				title: "Carbon",
				url: "https://carbon.now.sh",
				desc: "把代码片段生成漂亮的图片",
				weight: 8,
			},
			{
				title: "ITDOG",
				url: "https://www.itdog.cn/",
				desc: "在线 Ping、网站测速、路由追踪与 DNS 查询",
			},
			{
				title: "TLD List",
				url: "https://tld-list.com/",
				desc: "域名后缀的注册与续费价格比较",
			},
			{
				title: "docsmall 图片压缩",
				url: "https://docsmall.com/image-compress",
				desc: "在线图片压缩工具",
			},
			{
				title: "OpenAI 内容溯源",
				url: "https://openai.com/zh-Hans-CN/research/verify/",
				desc: "检查图片和音频中与 OpenAI 工具相关的溯源信号",
			},
		],
	},
	{
		id: "resources",
		name: "资源",
		icon: "material-symbols:auto-stories-outline-rounded",
		desc: "文档、教程与阅读",
		weight: 70,
		items: [
			{
				title: "Firefly Docs",
				url: "https://docs-firefly.cuteleaf.cn",
				desc: "Firefly 主题模板文档",
				icon: "https://docs-firefly.cuteleaf.cn/logo.png",
				weight: 10,
			},
			{
				title: "夏夜流萤",
				url: "https://blog.cuteleaf.cn",
				desc: "飞萤之火自无梦的长夜亮起",
				weight: 9,
			},
		],
	},
];
