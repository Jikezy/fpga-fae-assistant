# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

FPGA FAE 助手 — AI 驱动的 FPGA 现场应用工程师咨询平台，包含两大核心模块：
1. **AI 对话 + RAG** — BYOK（自带 Key）模式，用户自行配置任意 OpenAI/Anthropic 兼容 API，支持 PDF 文档分析
2. **BOM 模块** — 智能电子元器件采购系统，DeepSeek AI 解析（用户可自配或回退系统默认）+ 淘宝联盟推广链接 + 多平台搜索

## 技术栈

- **框架**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **3D 图形**: Three.js + @react-three/fiber + @react-three/drei + 自定义 GLSL Shaders
- **动画**: Framer Motion
- **数据库**: PostgreSQL (Neon Serverless) via `@neondatabase/serverless`
- **PDF 处理**: unpdf
- **Excel/CSV 处理**: xlsx
- **状态管理**: Zustand
- **Markdown 渲染**: react-markdown + remark-gfm + react-syntax-highlighter

## 常用命令

```bash
npm install          # 安装依赖（.npmrc 设置 legacy-peer-deps=true）
npm run dev          # 开发服务器 http://localhost:3000
npm run build        # 生产构建
npm start            # 生产服务器
npm run lint         # ESLint 检查
```

项目未配置测试框架。`.npmrc` 中 `legacy-peer-deps=true` 解决 React 18 与 @react-three/drei 的依赖冲突。

## 代码风格

- `.prettierrc`: 无分号、单引号、2空格缩进、80字符宽、ES5尾逗号
- `.eslintrc.js`: 继承 `next/core-web-vitals` + `next/typescript`，`no-unused-vars` 和 `no-explicit-any` 为 warn 级别
- `.editorconfig`: LF 换行符、UTF-8

## 开发工作流

**自动同步到云端**: 完成代码修改后必须立即 commit 并 push 到 GitHub，触发 Spaceship 自动部署。不要等待用户确认。

```bash
git add -A && git commit -m "message" && git push origin main
```

## 架构

### 目录结构

```
app/
├── api/
│   ├── auth/          # 登录、注册、登出、获取用户、初始化管理员
│   ├── chat/          # 流式对话 (SSE)，从 DB 读用户 AI 配置
│   ├── documents/     # 文档增删查 + 清空
│   ├── pdf/           # PDF 分析 (full-read, full-read-by-name)
│   ├── upload/        # 文件上传
│   ├── search/        # 向量搜索
│   ├── user/settings/ # 用户 AI 配置 + BOM 解析配置
│   ├── admin/         # 管理员操作（用户列表、数据库迁移）
│   ├── bom/           # BOM 模块（解析、上传、项目管理、商品搜索）
│   └── health/        # 存活检查
├── chat/              # 主对话界面（需登录）
├── settings/          # AI 配置页（预设平台 + API格式 + BOM配置）
├── bom/               # BOM 模块页面
│   ├── page.tsx       # 项目列表
│   ├── upload/        # 文件/文本上传
│   └── project/[id]/  # 项目详情
├── landing/           # 公开落地页
├── login/ register/   # 认证页面
├── admin/             # 管理员仪表盘
└── page.tsx           # 根路由重定向

lib/
├── ai-service.ts      # BYOK AI 服务（OpenAI + Anthropic 双格式）
├── db-schema.ts       # 数据库表结构 + 自动初始化 + 迁移
├── auth.ts            # 会话管理
├── auth-middleware.ts  # API 鉴权中间件
├── rate-limit.ts      # 滑动窗口限速器（内存实现）
├── simpleVectorStore.ts # TF-IDF + Jaccard 向量搜索
├── pdfProcessor.ts    # PDF 文本提取与分块
├── bom-parser.ts      # BOM 文本解析（DeepSeek AI + 规则兜底）
├── bom-file-parser.ts # Excel/CSV/PDF 文件解析
├── bom-db.ts          # BOM 数据库操作
└── taobao-client.ts   # 淘宝联盟推广客户端（带PID佣金追踪，未配置时 mock）
```

### 路由与中间件

`middleware.ts` 处理所有鉴权重定向：
- **`/`** → 未登录跳 `/landing`，已登录跳 `/chat`
- **公开路径**: `/login`, `/register`, `/landing`, `/api/auth/*` — 直接放行
- **已登录访问 login/register** → 重定向到 `/chat`
- **其他路径无 token** → 重定向到 `/login?redirect=原路径`
- **Matcher 排除**: `_next/static`, `_next/image`, `favicon.ico`, 图片文件 (`.png/.jpg/.jpeg/.gif/.svg`), `.txt` 文件（淘宝联盟验证需要）

### 两套 AI 服务：对话 vs BOM

**对话 AI（BYOK）** — `lib/ai-service.ts`:
- 每个用户在 `/settings` 自行配置 Base URL + API Key + 模型名称 + API 格式
- `AIServiceConfig` 接口：`{ apiKey, baseURL, model, format?: 'auto'|'openai'|'anthropic' }`
- `format='openai'` → `POST {baseURL}/chat/completions`，`Authorization: Bearer`
- `format='anthropic'` → `POST {baseURL}/messages`，`Authorization: Bearer` + `x-api-key` + `anthropic-version`
- `format='auto'` → 先试 OpenAI，失败回退 Anthropic
- 所有 API 路由从 DB 读取用户配置，前端只发 `{ messages }`
- 未配置时返回 `{ error: 'AI 未配置', needsConfig: true }` (403)

**BOM 解析 AI** — `lib/bom-parser.ts`:
- `parseBomText(text, userConfig?)` — 优先用户自配 DeepSeek，回退系统 `DEEPSEEK_API_KEY`
- 模型固定 `deepseek-chat`，temperature 0.1
- AI 不可用时降级到规则解析引擎

### 设置页预设平台

当前仅保留 2 个预设（`app/settings/page.tsx`）：
- **米醋 API**: `https://www.openclaudecode.cn/v1` / `claude-sonnet-4-5-20250929` / format=auto
- **SiliconFlow**: `https://api.siliconflow.cn/v1` / `deepseek-ai/DeepSeek-V3` / format=openai

### 用户设置 API (`/api/user/settings`)

- **GET** → `{ hasApiKey, maskedKey, baseUrl, model, apiFormat, hasBomKey, maskedBomKey, bomBaseUrl }`
- **POST** → `{ api_key, base_url, model_name, api_format, bom_api_key, bom_base_url }`
  - `api_key='__KEEP_EXISTING__'` 保留原 Key 不变
- **DELETE** → 清空所有 AI 配置字段

### 认证系统

基于会话（非 JWT）：
- 登录 → bcrypt 验证 + IP 限速（10次/15分钟） → DB 创建 session → `auth_token` HTTP-only cookie
- API 端点用 `requireAuth()` / `requireAdmin()` 鉴权（`lib/auth-middleware.ts`）
- 会话 30 天过期
- 密码迁移：旧 SHA-256 密码在首次登录时自动升级为 bcrypt
- 管理员初始化: `POST /api/auth/init-admin`（`admin@fpga.com` / `admin123`）

### RAG 管线

```
PDF 上传 → unpdf 提取 → 500字符分块(100重叠) → documents + embeddings 表
用户提问 → simpleVectorStore.search() → TF-IDF+Jaccard → top-k 分块
上下文注入 → 拼到 user 消息 content 前: 【参考文档】...【用户问题】...
AI 响应 → 用户配置的 API SSE 流式输出 → 前端实时渲染
```

### BOM 模块工作流

```
输入 → 文本/Excel/CSV/PDF → /api/bom/upload 或 /api/bom/parse
解析 → DeepSeek AI 提取元器件（名称、规格、数量、搜索关键词）→ 失败降级规则解析
存储 → bom_projects + bom_items
搜索 → 多平台跳转（立创商城、1688、淘宝）
```

**淘宝联盟推广** — `lib/taobao-client.ts`:
- 配置了 `TAOBAO_PID` 时，所有淘宝链接生成为 `uland.taobao.com/sem/tbsearch` 格式（带 PID 佣金追踪）
- 未配置时降级为普通淘宝搜索链接（无佣金）
- 前端通过 `/api/bom/search` GET 获取 `affiliateUrlTemplate`，替换关键词生成推广链接
- BOM 项目详情页所有"淘宝"按钮、批量搜索、复制链接、导出 CSV 均使用推广链接

## 数据库

### 表结构

| 表 | 关键字段 |
|---|---|
| `users` | email, password_hash, role, anthropic_api_key, anthropic_base_url, ai_model, api_format, bom_api_key, bom_base_url |
| `sessions` | user_id, token, expires_at |
| `documents` | content, source, page, user_id |
| `embeddings` | document_id, embedding_vector, user_id |
| `bom_projects` | user_id, name, source_text, status(draft/purchasing/completed) |
| `bom_items` | project_id, parsed_name, parsed_spec, quantity, status, search_results(JSONB), best_price |
| `price_cache` | keyword, platform, results(JSONB), expires_at |

`lib/db-schema.ts` 在首次 API 调用时自动 CREATE TABLE + ALTER TABLE 添加后续列。`ensureAiModelColumn()` 是运行时迁移函数，确保 `ai_model`、`api_format`、`bom_api_key`、`bom_base_url` 列存在。

### 数据隔离

所有查询必须包含 `user_id` 过滤：`WHERE user_id = ${userId}`

## 环境变量

```bash
POSTGRES_URL=postgresql://...       # Neon PostgreSQL（Spaceship 自动注入）
DEEPSEEK_API_KEY=sk-xxx             # BOM 解析系统默认 Key（用户可自配覆盖）
TAOBAO_APP_KEY=...                  # 淘宝联盟 AppKey（启用推广链接佣金追踪）
TAOBAO_APP_SECRET=...               # 淘宝联盟 AppSecret
TAOBAO_PID=mm_xxx_xxx_xxx           # 淘宝联盟推广位 PID（佣金归属标识）
NEXT_PUBLIC_APP_NAME=FPGA FAE助手
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB
```

对话 AI 无系统级环境变量，完全 BYOK。

## UI 设计系统

**主题色**: 紫色 (`purple-500/600`) 为主色调，橙色 (`orange-500/600`) 为辅助色

**页面风格**:
- 落地页 / 聊天页 / 侧边栏: 浅色玻璃拟态，`from-white/95 to-gray-50/90`
- 登录页: 火影忍者主题（橙色调，木叶标志，漂浮云朵，旋转手里剑）
- 注册页: 火影忍者主题（紫色调，佐助风格）
- 设置页: 深色主题，`bg-gray-900/40`、`border-gray-600/30`、`text-gray-100`

**3D 液态玻璃背景** (`components/LiquidGlassBackground.tsx`):
- Three.js GLSL 着色器，银白→冰蓝渐变
- Uniforms: `uTime`, `uMouse`, `uResolution`

**玻璃拟态卡片**: `backdrop-blur-[60px] backdrop-saturate-[200%]`

**Z-Index 层级**: `-10`(WebGL) → `0`(遮罩) → `20`(内容) → `30`(导航) → `50`(侧栏) → `100`(过渡)

## 关键实现模式

### SSE 流式输出

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
  headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' }
})
```

### BYOK API 路由模式

```typescript
const user = await sql`SELECT anthropic_api_key, anthropic_base_url, ai_model, api_format FROM users WHERE id = ${userId}`
if (!apiKey || !baseURL || !model) {
  return Response.json({ error: 'AI 未配置', needsConfig: true }, { status: 403 })
}
const aiService = new AIService({ apiKey, baseURL, model, format: user.api_format || 'auto' })
```

### 路径别名

`@/*` 映射到项目根目录（`tsconfig.json`）：`import { getSql } from '@/lib/db-schema'`

## 部署

- **仓库**: https://github.com/Jikezy/fpga-fae-assistant
- **平台**: Spaceship（推送 `main` 自动部署）
- **域名**: `fae219520.cn` / `www.fae219520.cn`（阿里云域名 + Vercel 托管）
- **数据库**: Neon PostgreSQL
- **构建**: `next.config.js` 配置了安全头（X-Frame-Options、CSP 等）和 webpack fs/net/tls fallback

## 合规

- **ICP备案**: 鄂ICP备2026007985号（已添加到所有页面底部，链接到 beian.miit.gov.cn）
- **投诉举报**: 3082463315@qq.com（已添加到所有页面底部和侧边栏）
- **淘宝联盟验证**: `public/root.txt` 为淘宝联盟网站验证文件，middleware 已排除 `.txt` 拦截
- **公安备案**: 审核中，通过后需添加备案号到页面底部
