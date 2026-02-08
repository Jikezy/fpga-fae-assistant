# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FPGA FAE Assistant — 基于 AI 的 FPGA 现场应用工程师智能咨询网站，使用 Claude AI + RAG（检索增强生成）技术提供技术咨询和文档检索服务。

## Tech Stack

- **Frontend:** Next.js 14 (App Router) + React 18 + Tailwind CSS 3.4 + TypeScript
- **Backend:** Next.js API Routes (Node.js runtime)
- **Database:** PostgreSQL (Neon serverless), client: `@neondatabase/serverless`
- **AI:** 多供应商支持 — Anthropic Claude, Ollama, OpenAI, 智谱AI, 通义千问, 文心一言, 讯飞星火
- **PDF处理:** unpdf
- **状态管理:** Zustand

## Common Commands

```bash
npm install          # 安装依赖
npm run dev          # 启动开发服务器 (http://localhost:3000)
npm run build        # 生产构建
npm start            # 启动生产服务器
npm run lint         # ESLint 检查
```

### Docker 部署

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

## Architecture

### 目录结构

- `app/` — Next.js App Router，包含页面和 API 路由
- `app/api/` — 所有后端 API 端点
- `components/` — React UI 组件
- `lib/` — 核心工具库（AI服务、向量存储、PDF处理、认证）

### 核心模块

- **`lib/ai-service.ts`** — AI 服务抽象层，统一接口支持 7 种 AI 供应商，支持流式响应
- **`lib/simpleVectorStore.ts`** — 基于 PostgreSQL 的向量存储，使用 TF-IDF + Jaccard 相似度实现文档检索，支持中英文分词和多文档均衡检索
- **`lib/pdfProcessor.ts`** — PDF 文本提取，500字符分块 + 100字符重叠
- **`lib/auth.ts` + `lib/auth-middleware.ts`** — 认证工具和 API 中间件
- **`lib/db-schema.ts`** — 数据库 schema 定义和自动初始化

### 认证机制

Session-based 认证：
- 注册/登录后创建 30 天有效期的 session，token 存储在 `auth_token` HTTP-only cookie
- `middleware.ts` 拦截路由，未认证用户重定向到 `/login`
- API 层通过 `requireAuth()` / `requireAdmin()` 中间件保护
- 用户角色：`admin`（可用系统默认 AI 配置）和 `user`（需配置个人 API Key）

### 数据库表

| 表 | 用途 |
|---|---|
| `users` | 用户信息、角色、个人 API Key |
| `sessions` | 登录会话管理 |
| `documents` | PDF 文档分块存储，含 `user_id` 隔离 |
| `embeddings` | 文档向量索引，含 `user_id` 隔离 |

### RAG 流程

1. 用户上传 PDF → `pdfProcessor` 提取文本并分块 → 存入 `documents` 表
2. 分块文本生成向量 → 存入 `embeddings` 表
3. 用户提问 → `simpleVectorStore` 检索相关文档片段 → 拼接为上下文注入 AI prompt
4. AI 通过 SSE 流式返回响应

### 用户文档隔离

所有文档查询和操作均包含 `user_id` 过滤，防止跨用户数据访问。

### API 端点概览

| 路径 | 方法 | 用途 |
|---|---|---|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/auth/logout` | POST | 登出 |
| `/api/chat` | POST | 主聊天端点（SSE 流式） |
| `/api/upload` | POST | 上传 PDF（FormData，限 10MB） |
| `/api/documents` | GET/DELETE | 文档列表/删除 |
| `/api/search` | POST | 向量搜索 |
| `/api/pdf/full-read` | POST | 完整 PDF 分析（SSE） |
| `/api/user/settings` | GET/POST/DELETE | 用户 API Key 管理 |
| `/api/admin/users` | GET | 管理员用户列表 |
| `/api/admin/migrate` | POST | 数据库迁移 |

## Environment Variables

关键环境变量见 `.env.example`：
- `AI_PROVIDER` — AI 供应商选择（anthropic/ollama/openai/zhipu/qwen/ernie/spark）
- `ANTHROPIC_API_KEY` / `ANTHROPIC_BASE_URL` — Anthropic 配置（支持 API 中转）
- `POSTGRES_URL` — 数据库连接（Vercel 自动注入）
- `NEXT_PUBLIC_APP_NAME` — 应用名称
- `NEXT_PUBLIC_MAX_FILE_SIZE` — 上传文件大小限制

## Key Patterns

- 路径别名：`@/*` 映射到项目根目录
- AI 聊天响应使用 Server-Sent Events (SSE) 流式传输
- 密码使用 SHA-256 哈希（生产环境应升级为 bcrypt）
- 数据库 schema 通过 `initializeDatabase()` 自动创建，无需手动迁移
- `next.config.js` 中 webpack externals 排除了 chromadb 和 onnxruntime-node
