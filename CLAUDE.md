# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

FPGA FAE 助手 — AI 驱动的 FPGA 现场应用工程师咨询平台，包含两大核心模块：
1. **AI 对话 + RAG** — 多后端 AI 技术问答（免费模型默认可用 + Claude 可选升级），支持 PDF 文档分析
2. **BOM 模块** — 智能电子元器件采购系统，使用 DeepSeek AI 解析 + 淘宝商品搜索

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **3D 图形**: Three.js + 自定义 GLSL Shaders
- **动画**: Framer Motion
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL (Neon Serverless) + @neondatabase/serverless
- **AI（对话 — 免费）**: SiliconFlow API（OpenAI 兼容格式，fetch 调用）— 模型: `deepseek-ai/DeepSeek-V3`, `Qwen/Qwen2.5-72B-Instruct`
- **AI（对话 — 高级）**: Anthropic Claude SDK (@anthropic-ai/sdk) — 模型: `claude-opus-4-20250514`（需用户配置 API Key）
- **AI（BOM 解析）**: DeepSeek API — 模型: `deepseek-chat`（免费，无需用户 API Key）
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
│   ├── chat/          # 流式对话接口 (SSE)
│   ├── documents/     # 文档增删查 + 清空
│   ├── pdf/           # PDF 分析 (full-read, full-read-by-name)
│   ├── upload/        # 文件上传处理
│   ├── search/        # 向量搜索
│   ├── user/          # 用户设置（API Key 管理）
│   ├── admin/         # 管理员操作（用户列表、数据库迁移）
│   ├── bom/           # BOM 模块（解析、上传、项目管理、商品搜索）
│   └── health/        # AI 服务健康检查
├── landing/           # 公开落地页
├── login/             # 登录页
├── register/          # 注册页
├── chat/              # 主对话界面（需登录）
├── settings/          # 用户设置页
├── admin/             # 管理员仪表盘
├── bom/               # BOM 模块页面
│   ├── page.tsx           # 项目列表
│   ├── upload/page.tsx    # 文件/文本上传
│   └── project/[id]/     # 项目详情（元器件编辑器）
└── page.tsx           # 根路由重定向

lib/
├── ai-service.ts          # 多后端 AI 服务（Anthropic Claude + SiliconFlow OpenAI 兼容）
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
- 顶点着色器: Simplex 噪声 + 鼠标磁力吸引
- 片段着色器: 多层颜色混合 + 焦散效果 + 边缘发光
- Uniforms: `uTime`, `uMouse`, `uResolution`

**玻璃拟态卡片**:
- `from-white/95 to-gray-50/90`, `backdrop-blur-[60px] backdrop-saturate-[200%]`
- `border-gray-200/60`, `shadow-[0_8px_32px_rgba(0,0,0,0.1),inset_0_1px_0_rgba(255,255,255,0.8)]`

**Z-Index 层级**: `-10`（WebGL 画布）→ `0`（渐变遮罩）→ `20`（主内容）→ `30`（顶部导航）→ `50`（侧边栏）→ `100`（页面过渡）

## 数据库表结构

### 核心表

| 表名 | 用途 |
|---|---|
| `users` | 用户账户（email, password_hash, role, anthropic_api_key, anthropic_base_url） |
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

**用户角色**:
- `admin`: 可使用系统默认 ANTHROPIC_API_KEY
- `user`: 免费模型（SiliconFlow）无需配置即可使用；使用 Claude 需在 `/settings` 中配置个人 API Key

### 2. RAG 管线

```
1. PDF 上传 → /api/upload → unpdf 提取文本 → 500 字符分块（100 重叠）→ 写入 documents + embeddings 表
2. 查询 → /api/chat → simpleVectorStore.search() → TF-IDF + Jaccard 相似度 → top-k 分块（阈值: 0.005，每文档最多 3 块）
3. 上下文注入 → 拼接到用户消息前: 【参考文档】...【用户问题】...
4. AI 响应 → 根据所选 provider 流式输出（Anthropic SDK 或 fetch OpenAI 格式）→ SSE → 前端实时渲染
```

**关键模式**（Anthropic 专用）:
```typescript
// ✅ 正确: 将 RAG 上下文拼接到用户消息内容中
const messages = [{ role: 'user', content: `【参考文档】\n${ragContext}\n\n【用户问题】\n${userQuestion}` }]

// ❌ 错误: 在 messages 数组中使用 system 角色（Anthropic 会忽略）
const messages = [{ role: 'system', content: ragContext }, { role: 'user', content: userQuestion }]
```

Anthropic 的 `system` 参数与 `messages` 是分离的。系统提示词通过 `lib/ai-service.ts` 中的 `system` 参数单独传递。

### 3. AI 服务配置（多后端）

**双后端架构** (`lib/ai-service.ts`):
- `provider: 'siliconflow'` — 免费模型，用 `fetch` 调 OpenAI 兼容 SSE 流，任何登录用户可用
- `provider: 'anthropic'` — Claude 高级模型，用 Anthropic SDK，需用户或系统 API Key

**模型 ID 格式**（前端 ↔ 后端约定）:
```
{provider}-{modelName}
```
示例: `siliconflow-deepseek-ai/DeepSeek-V3`, `anthropic-claude-opus-4-6`
前端用首个 `-` 分割: `provider = id.substring(0, dashIndex)`, `model = id.substring(dashIndex + 1)`

**API Key 路由逻辑** (`app/api/chat/route.ts`):
- `siliconflow` → 使用系统 `SILICONFLOW_API_KEY`，任何登录用户可用
- `anthropic` → 优先用户个人 Key → admin 可 fallback 到系统 `ANTHROPIC_API_KEY`

**PDF 分析降级**: `full-read` 和 `full-read-by-name` 接口在无 Claude key 时自动降级到 SiliconFlow 免费模型

**API 端点**:
- SiliconFlow Base URL: `https://api.siliconflow.cn/v1`
- Anthropic Base URL: `https://yunwu.ai`（云雾 AI 代理，非 Anthropic 官方 API）
- 流式输出: 始终通过 SSE 启用

### 4. BOM 模块工作流

```
1. 输入: 用户提供 BOM（文本、Excel xlsx/xls、CSV 或 PDF）→ /api/bom/upload 或 /api/bom/parse
2. 解析: DeepSeek AI 提取元器件名称、规格、数量、搜索关键词
   - 主引擎: DeepSeek API（deepseek-chat，temperature 0.1）
   - 兜底: 规则解析（DeepSeek 不可用时）
   - 解析引擎类型会持久化存储并展示给用户（localStorage）
3. 存储: 在 PostgreSQL 中创建 bom_project + bom_items
4. 搜索: 逐条查询淘宝 API → /api/bom/search（未配置 TAOBAO_* 环境变量时使用 mock 模式）
5. 结果: 价格缓存带过期时间，状态追踪（pending/found/deleted）
```

**UI 功能**: 批量勾选（复选框）、行内关键词编辑、已查看标记（localStorage）、批量"打开所有链接"、可展开商品结果卡片、总价计算。

### 5. 向量搜索实现

**算法** (`lib/simpleVectorStore.ts`):
- TF-IDF 向量化 + 余弦相似度 + Jaccard 相似度
- 中英文分词
- 多文档均衡（每文档最多 3 块）
- 概览问题优化: 检测"什么"、"讲"、"pdf"、"介绍"等关键词，返回文档开头分块

## API 接口

| 路由 | 方法 | 鉴权 | 用途 |
|---|---|---|---|
| `/api/auth/register` | POST | 公开 | 注册新用户 |
| `/api/auth/login` | POST | 公开 | 登录并创建会话 |
| `/api/auth/logout` | POST | 需登录 | 删除会话 |
| `/api/auth/me` | GET | 需登录 | 获取当前用户信息 |
| `/api/auth/init-admin` | POST | 公开 | 初始化首个管理员账户 |
| `/api/auth/promote` | POST | 需管理员 | 提升用户角色 |
| `/api/chat` | POST | 需登录 | 带 RAG 的流式对话 (SSE) |
| `/api/upload` | POST | 需登录 | 上传 PDF（FormData，10MB 限制） |
| `/api/documents` | GET/DELETE | 需登录 | 查询/删除用户文档 |
| `/api/documents/clear` | DELETE | 需登录 | 清空所有用户文档 |
| `/api/search` | POST | 需登录 | 向量相似度搜索 |
| `/api/pdf/full-read` | POST | 需登录 | 完整 PDF 分析（流式） |
| `/api/pdf/full-read-by-name` | POST | 需登录 | 按文件名分析 PDF |
| `/api/bom/parse` | POST | 需登录 | 通过 DeepSeek AI 解析 BOM 文本 |
| `/api/bom/upload` | POST | 需登录 | 上传 Excel/CSV/PDF 进行 BOM 解析 |
| `/api/bom/project` | GET/PUT/PATCH/DELETE | 需登录 | BOM 项目增删改查 |
| `/api/bom/search` | POST | 需登录 | 淘宝商品价格搜索 |
| `/api/user/settings` | GET/POST/DELETE | 需登录 | 管理用户 API Key |
| `/api/admin/users` | GET | 需管理员 | 查看所有用户 |
| `/api/admin/migrate` | POST | 需管理员 | 运行数据库迁移 |
| `/api/health` | GET | 公开 | AI 服务健康检查 |

## 环境变量

```bash
# AI 服务 — 对话免费模型（SiliconFlow）
SILICONFLOW_API_KEY=sk-xxx...  # 硅基流动 API Key，免费模型必需

# AI 服务 — 对话高级模型（Anthropic Claude，可选）
ANTHROPIC_API_KEY=sk-xxx...
ANTHROPIC_BASE_URL=https://yunwu.ai  # 必须: 使用云雾 AI 代理，非官方 API

# AI 服务 — BOM 解析（DeepSeek，免费）
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

**关键注意事项**:
- `SILICONFLOW_API_KEY` 是免费模型运行的必要条件
- `ANTHROPIC_BASE_URL` **必须**设置为 `https://yunwu.ai`（不是 Anthropic 官方 API）
- 生产环境变量在 Spaceship 控制台配置（不来自 `.env` 文件）
- DeepSeek 是免费的，仅用于 BOM 文本解析 — 与对话 AI 分离

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
