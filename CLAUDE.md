# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

FPGA FAE 助手 — AI 驱动的 FPGA 现场应用工程师咨询平台，包含两大核心模块：
1. **AI 对话 + RAG** — BYOK（自带 Key）模式，用户自行配置任意 OpenAI 兼容 API，支持 PDF 文档分析
2. **BOM 模块** — 智能电子元器件采购系统，使用系统 DeepSeek API 解析 + 淘宝商品搜索

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **3D 图形**: Three.js + 自定义 GLSL Shaders
- **动画**: Framer Motion
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL (Neon Serverless) + @neondatabase/serverless
- **AI（对话）**: BYOK — 用户自配 OpenAI 兼容 API（支持云雾AI、SiliconFlow、DeepSeek、OpenRouter、OpenAI 等）
- **AI（BOM 解析）**: 系统 DeepSeek API — 模型: `deepseek-chat`（系统级，用户无需配置）
- **PDF 处理**: unpdf
- **Excel/CSV 处理**: xlsx
- **状态管理**: Zustand
- **Markdown 渲染**: react-markdown + remark-gfm + react-syntax-highlighter

## 常用命令

```bash
npm install          # 安装依赖（使用 .npmrc legacy-peer-deps=true）
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 生产环境构建
npm start            # 启动生产服务器
npm run lint         # 运行 ESLint 检查
```

**注意**: 项目未配置测试框架。`.npmrc` 中设置了 `legacy-peer-deps=true` 以解决 React 18 与 @react-three/drei 的依赖冲突。

## 开发工作流

**重要 — 自动同步到云端**:
- 完成任何代码修改后，必须立即 commit 并 push 到 GitHub
- 这会触发 Spaceship 平台的自动部署
- 工作流: `git add -A && git commit -m "message" && git push origin main`
- 不要等待用户确认 — 完成任务后自动同步
- 用户期望修改立即上线到云端

## 架构

### 目录结构

```
app/
├── api/
│   ├── auth/          # 登录、注册、登出、获取用户、初始化管理员、提升权限
│   ├── chat/          # 流式对话接口 (SSE)，从 DB 读用户 AI 配置
│   ├── documents/     # 文档增删查 + 清空
│   ├── pdf/           # PDF 分析 (full-read, full-read-by-name)
│   ├── upload/        # 文件上传处理
│   ├── search/        # 向量搜索
│   ├── user/          # 用户设置（Base URL + API Key + 模型名称）
│   ├── admin/         # 管理员操作（用户列表、数据库迁移）
│   ├── bom/           # BOM 模块（解析、上传、项目管理、商品搜索）
│   └── health/        # 服务存活检查
├── landing/           # 公开落地页
├── login/             # 登录页
├── register/          # 注册页
├── chat/              # 主对话界面（需登录）
├── settings/          # AI 配置页（BYOK 三字段 + 预设平台）
├── admin/             # 管理员仪表盘
├── bom/               # BOM 模块页面
│   ├── page.tsx           # 项目列表
│   ├── upload/page.tsx    # 文件/文本上传
│   └── project/[id]/     # 项目详情（元器件编辑器）
└── page.tsx           # 根路由重定向

lib/
├── ai-service.ts          # BYOK AI 服务（统一 OpenAI 兼容格式，无 Anthropic SDK）
├── simpleVectorStore.ts   # PostgreSQL 向量存储（TF-IDF + Jaccard）
├── pdfProcessor.ts        # PDF 文本提取与分块
├── auth.ts                # 会话管理工具
├── auth-middleware.ts     # API 路由鉴权中间件
├── db-schema.ts           # 数据库表结构 + 自动初始化
├── bom-parser.ts          # BOM 文本解析（DeepSeek AI + 规则兜底）
├── bom-file-parser.ts     # Excel/CSV/PDF 文件解析（用于 BOM）
├── bom-db.ts              # BOM 项目/元器件数据库操作
└── taobao-client.ts       # 淘宝 API 客户端（未配置时使用 mock 模式）
```

### 路由架构

- **`/`** → 自动重定向（未登录 → `/landing`，已登录 → `/chat`）
- **`/landing`** → 公开落地页
- **`/chat`** → 主对话界面（需鉴权）
- **`/login` / `/register`** → 登录/注册成功后跳转至 `/chat`
- **`/settings`** → AI 服务配置页（BYOK 三字段 + 5 个预设平台按钮）
- **`/bom`** → BOM 项目列表（需鉴权）
- **`/bom/upload`** → BOM 文件/文本上传
- **`/bom/project/[id]`** → BOM 项目详情（搜索与编辑）
- **中间件** (`middleware.ts`): 处理鉴权重定向和公开路径豁免

### UI 设计系统：清爽通透 + 液态玻璃

**配色方案**:
- **主文本**: `gray-800`（深炭灰色，高对比度）
- **辅助文本**: `gray-600`, `gray-700`（元数据、标签）
- **背景**: `white/95`, `gray-50/90`（高透明度玻璃卡片）
- **边框**: `gray-200/60`, `gray-300`（微妙分隔）
- **AI 紫色强调**: `purple-500` (#7C3AED), `purple-600`（落地页 CTA）
- **蓝色强调**: `blue-400` 到 `blue-600`（按钮、图标、AI 头像）
- **PDF 红色**: `red-600`（PDF 文档图标）

**对比度规范**（可读性关键）:
- 所有正文: `text-gray-800` + `font-medium` 或 `font-semibold`
- 时间戳: `text-gray-600` + `font-medium`（禁止使用白色/透明色）
- 按钮文字: 深色背景用白色，浅色背景用 `gray-800`
- 选中状态: `bg-blue-100 text-blue-800`

**3D 液态玻璃背景** (`LiquidGlassBackground.tsx`):
- Three.js 自定义 GLSL 顶点/片段着色器
- 工作室灯光效果: 银白色 → 冰蓝色渐变
- 柔和流体运动（0.05 速度），鼠标交互极简（减少 70%）
- Uniforms: `uTime`, `uMouse`, `uResolution`

**玻璃拟态卡片**:
- `from-white/95 to-gray-50/90`, `backdrop-blur-[60px] backdrop-saturate-[200%]`
- `border-gray-200/60`, `shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]`

**Z-Index 层级**: `-10`（WebGL 画布）→ `0`（渐变遮罩）→ `20`（主内容）→ `30`（顶部导航）→ `50`（侧边栏）→ `100`（页面过渡）

## 数据库表结构

### 核心表

| 表名 | 用途 |
|---|---|
| `users` | 用户账户（email, password_hash, role, anthropic_api_key, anthropic_base_url, ai_model） |
| `sessions` | 登录会话（30 天过期，token 存储在 HTTP-only cookie 中） |
| `documents` | PDF 文档分块（500 字符 + 100 字符重叠，按 user_id 隔离） |
| `embeddings` | 文档向量（TF-IDF + Jaccard 相似度，按 user_id 隔离） |

### BOM 表

| 表名 | 用途 |
|---|---|
| `bom_projects` | BOM 项目（user_id, name, source_text, status: draft/purchasing/completed, total_estimated_price） |
| `bom_items` | 单个元器件（project_id, parsed_name, parsed_spec, quantity, status: pending/found/deleted, search_results JSONB, best_price, buy_url） |
| `price_cache` | 按关键词 + 平台缓存搜索结果，带过期时间 |

**自动初始化**: `lib/db-schema.ts` 在首次 API 调用时自动创建所有表。

## 核心工作流

### 1. 认证流程

**基于会话**（非 JWT）:
- 登录 → 在数据库创建 session → 设置 `auth_token` HTTP-only cookie
- 中间件在每个受保护路由检查 token
- API 端点使用 `lib/auth-middleware.ts` 中的 `requireAuth()` 或 `requireAdmin()`
- 管理员初始化: `POST /api/auth/init-admin` 创建默认管理员（`admin@fpga.com` / `admin123`）

### 2. BYOK AI 服务架构

**核心设计**: 系统不提供任何默认/免费对话模型，每个用户自行配置：
- **Base URL** — OpenAI 兼容 API 地址（必须以 `/v1` 结尾）
- **API Key** — 用户自己的 Key
- **模型名称** — 平台支持的模型 ID

**`lib/ai-service.ts`**: 统一使用 `fetch` 调 OpenAI 兼容格式 SSE 流。`AIService` 构造函数接收 `{ apiKey, baseURL, model }` 三个必填参数。无 provider 区分，无单例导出。

**API 端点的 BYOK 模式**:
```typescript
// 后端从 DB 读取用户配置，前端只发 { messages }
const user = await sql`SELECT anthropic_api_key, anthropic_base_url, ai_model FROM users WHERE id = ${userId}`
if (!apiKey || !baseURL || !model) {
  return Response.json({ error: 'AI 未配置', needsConfig: true }, { status: 403 })
}
const aiService = new AIService({ apiKey, baseURL, model })
```

**前端错误处理**: 检测 `needsConfig: true` 时引导用户前往设置页。

**设置页预设平台**（点击填充 Base URL + 推荐模型）:
- 云雾 AI: `https://yunwu.ai/v1` → `claude-opus-4-20250514`
- 米醋 API: `https://www.openclaudecode.cn/v1` → `claude-opus-4-20250514`
- SiliconFlow: `https://api.siliconflow.cn/v1` → `deepseek-ai/DeepSeek-V3`
- DeepSeek: `https://api.deepseek.com/v1` → `deepseek-chat`
- OpenRouter: `https://openrouter.ai/api/v1` → `anthropic/claude-opus-4`
- OpenAI: `https://api.openai.com/v1` → `gpt-4o`

**用户设置 API** (`/api/user/settings`):
- GET → `{ hasApiKey, baseUrl, model }`
- POST → `{ api_key, base_url, model_name }`（`api_key` 为 `__KEEP_EXISTING__` 时保留原 Key）
- DELETE → 清空三个字段

### 3. RAG 管线

```
1. PDF 上传 → /api/upload → unpdf 提取文本 → 500 字符分块（100 重叠）→ 写入 documents + embeddings 表
2. 查询 → /api/chat → simpleVectorStore.search() → TF-IDF + Jaccard 相似度 → top-k 分块（阈值: 0.005，每文档最多 3 块）
3. 上下文注入 → 拼接到用户消息前: 【参考文档】...【用户问题】...
4. AI 响应 → 用户配置的 OpenAI 兼容 API 流式输出 → SSE → 前端实时渲染
```

**RAG 上下文注入方式**: 将检索结果拼接到 `messages` 最后一条 user 消息的 `content` 中，系统提示词通过 OpenAI 格式 `system` role 传递。

### 4. BOM 模块工作流

```
1. 输入: 用户提供 BOM（文本、Excel xlsx/xls、CSV 或 PDF）→ /api/bom/upload 或 /api/bom/parse
2. 解析: DeepSeek AI 提取元器件名称、规格、数量、搜索关键词
   - 主引擎: DeepSeek API（deepseek-chat，temperature 0.1）
   - 兜底: 规则解析（DeepSeek 不可用时）
3. 存储: 在 PostgreSQL 中创建 bom_project + bom_items
4. 搜索: 逐条查询淘宝 API → /api/bom/search（未配置 TAOBAO_* 环境变量时使用 mock 模式）
5. 结果: 价格缓存带过期时间，状态追踪（pending/found/deleted）
```

BOM 使用系统 `DEEPSEEK_API_KEY`，独立于用户的 BYOK 配置。

### 5. 向量搜索实现

**算法** (`lib/simpleVectorStore.ts`):
- TF-IDF 向量化 + 余弦相似度 + Jaccard 相似度
- 中英文分词
- 多文档均衡（每文档最多 3 块）
- 概览问题优化: 检测"什么"、"讲"、"pdf"、"介绍"等关键词，返回文档开头分块

## 环境变量

```bash
# AI 服务 — BOM 解析（系统级，用户无需配置）
DEEPSEEK_API_KEY=sk-xxx...

# 数据库（Neon PostgreSQL）
POSTGRES_URL=postgresql://...  # Spaceship/Vercel 自动注入

# 淘宝 API（可选 — 未配置时使用 mock 模式）
TAOBAO_APP_KEY=...
TAOBAO_APP_SECRET=...
TAOBAO_PID=...

# 应用配置
NEXT_PUBLIC_APP_NAME=FPGA FAE助手
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB
```

**注意**: 对话 AI 不再需要系统级环境变量（无 `SILICONFLOW_API_KEY`、`ANTHROPIC_API_KEY`、`ANTHROPIC_BASE_URL`）。每个用户在 `/settings` 页面自行配置。

## 部署

- **Git 仓库**: https://github.com/Jikezy/fpga-fae-assistant
- **平台**: Spaceship（推送到 `main` 分支自动部署）
- **数据库**: Neon PostgreSQL（无服务器）
- **构建**: Spaceship 使用 `.npmrc` 配置运行 `npm install`

## 关键实现细节

### SSE 流式输出模式

所有 AI 对话接口使用 Server-Sent Events:

```typescript
const stream = new ReadableStream({
  async start(controller) {
    await aiService.streamChat(messages, (chunk) => {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk })}\n\n`))
    })
    controller.enqueue(encoder.encode('data: [DONE]\n\n'))
    controller.close()
  }
})
return new Response(stream, {
  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', 'Connection': 'keep-alive' }
})
```

### 用户数据隔离

所有查询（文档、向量、BOM 项目）均包含 `user_id` 过滤:

```typescript
const documents = await sql`SELECT * FROM documents WHERE user_id = ${userId}`
```

### 路径别名

`@/*` 映射到项目根目录（在 `tsconfig.json` 中配置）:

```typescript
import Component from '@/components/Component'
import { utility } from '@/lib/utility'
```

### 代码高亮

使用 react-syntax-highlighter 的 `oneLight` 主题，与浅色玻璃 UI 风格保持一致。

## UIPro 集成

项目包含 UIPro CLI 技能包 (`.claude/skills/ui-ux-pro-max/`):

- 67 种设计风格 + 96 套配色方案 + 57 组字体搭配
- 查询命令: `python .claude/skills/ui-ux-pro-max/scripts/search.py --domain <domain> "<query>"`
