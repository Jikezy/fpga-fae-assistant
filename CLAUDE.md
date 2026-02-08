# CLAUDE.md

## 项目概述

FPGA FAE Assistant — 基于 Claude AI + RAG 的 FPGA 现场应用工程师智能咨询网站。

提供技术咨询、文档检索、PDF 智能分析功能。

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + TypeScript + Tailwind CSS
- **3D 渲染**: Three.js + @react-three/fiber + @react-three/drei
- **动画**: Framer Motion
- **后端**: Next.js API Routes
- **数据库**: PostgreSQL (Neon Serverless) + @neondatabase/serverless
- **AI**: Anthropic Claude (@anthropic-ai/sdk) - 模型 claude-opus-4-20250514
- **PDF 处理**: unpdf
- **状态管理**: Zustand
- **Markdown 渲染**: react-markdown + remark-gfm + react-syntax-highlighter

## 常用命令

```bash
npm install          # 安装依赖
npm run dev          # 本地开发 (http://localhost:3000)
npm run build        # 生产构建
npm start            # 生产运行
```

**注意**: 项目包含 `.npmrc` 配置 `legacy-peer-deps=true` 解决 React 18 依赖冲突。

## 目录结构

```
app/                    # Next.js App Router
├── api/               # API 路由
│   ├── auth/         # 认证 API
│   ├── chat/         # 聊天 API (SSE 流式)
│   ├── documents/    # 文档管理 API
│   ├── pdf/          # PDF 分析 API
│   ├── upload/       # 文件上传 API
│   ├── search/       # 向量搜索 API
│   ├── user/         # 用户设置 API
│   └── admin/        # 管理员 API
├── login/            # 登录页面
├── register/         # 注册页面
└── page.tsx          # 主聊天页面

components/             # React 组件
├── LiquidGlassBackground.tsx  # 3D 流体背景
├── ChatInterface.tsx          # 聊天界面
├── Sidebar.tsx                # 侧边栏
├── Header.tsx                 # 顶部导航
├── MessageList.tsx            # 消息列表
└── ChatInput.tsx              # 输入框

lib/                    # 核心库
├── ai-service.ts              # AI 服务 (Anthropic Claude)
├── simpleVectorStore.ts       # 向量存储 (PostgreSQL + TF-IDF)
├── pdfProcessor.ts            # PDF 文本提取
├── auth.ts                    # 认证工具
├── auth-middleware.ts         # API 认证中间件
└── db-schema.ts               # 数据库 Schema
```

## UI 设计：Liquid Glass

**3D 流体背景** (`LiquidGlassBackground.tsx`):
- Three.js + 自定义 GLSL Shader
- 配色：蓝灰色调 (#0a0e1a → #2d3748)，淡青点缀 (#7dd3fc)
- 特效：光线折射、色散、焦散纹路、鼠标磁力交互
- 尺寸：20×15 平面，64×64 细分，60fps 性能

**磨砂玻璃卡片**:
- 背景：`from-white/15 to-white/8`
- 模糊：`backdrop-blur-[40px] backdrop-saturate-[180%]`
- 双层阴影 + 涟漪动画

**Z 轴层级**:
```
-10: 3D 背景
0:   淡色遮罩
20:  主内容
30:  顶部导航
50:  侧边栏
100: 转场动画
```

## 数据库表

| 表名 | 说明 |
|---|---|
| `users` | 用户信息（email、密码哈希、角色、API Key） |
| `sessions` | 登录会话（30天有效期） |
| `documents` | PDF 文档分块存储（含 user_id 隔离） |
| `embeddings` | 文档向量索引（TF-IDF + 余弦相似度） |

## 核心功能

### 1. 认证系统

- **Session-based 认证**: HTTP-only cookie 存储 token
- **用户角色**:
  - `admin`: 可使用系统默认 API Key
  - `user`: 需配置个人 API Key
- **中间件保护**: `requireAuth()` / `requireAdmin()`

### 2. RAG (检索增强生成) 流程

```
1. PDF 上传 → unpdf 提取文本 → 500字符分块（100重叠）→ documents 表
2. 分块生成向量 → TF-IDF + Jaccard 相似度 → embeddings 表
3. 用户提问 → 向量检索相关片段（相似度阈值 0.005）
4. 上下文拼接到用户消息（不使用 system role）
5. Claude API 流式响应（SSE）
```

**关键实现**:
```typescript
// ✅ 正确：将 RAG 上下文拼接到用户消息
const enhancedMessage = {
  role: 'user',
  content: `【参考文档】\n${ragContext}\n\n【用户问题】\n${userQuestion}`
}

// ❌ 错误：使用 system role（Anthropic 会忽略）
const messages = [
  { role: 'system', content: ragContext },
  { role: 'user', content: userQuestion }
]
```

### 3. AI 服务

**只支持 Anthropic Claude**:
- SDK: `@anthropic-ai/sdk`
- 模型: `claude-opus-4-20250514`
- API 中转: 云雾 AI (https://yunwu.ai)
- 流式响应: Server-Sent Events (SSE)

**配置优先级**:
1. 用户个人 API Key (user.anthropic_api_key)
2. 系统默认 API Key (环境变量 ANTHROPIC_API_KEY)

### 4. 向量存储

**SimpleVectorStore** (基于 PostgreSQL):
- 算法: TF-IDF + 余弦相似度 / Jaccard 相似度
- 中英文分词
- 多文档均衡检索（每个文档取 3 个最相关片段）
- 相似度阈值: 0.005

## API 端点

| 端点 | 方法 | 说明 |
|---|---|---|
| `/api/auth/register` | POST | 用户注册 |
| `/api/auth/login` | POST | 用户登录 |
| `/api/auth/logout` | POST | 登出 |
| `/api/auth/me` | GET | 获取当前用户 |
| `/api/chat` | POST | 聊天（SSE 流式） |
| `/api/upload` | POST | 上传 PDF（FormData，限 10MB） |
| `/api/documents` | GET/DELETE | 文档列表/删除 |
| `/api/documents/clear` | DELETE | 清空所有文档 |
| `/api/search` | POST | 向量搜索 |
| `/api/pdf/full-read` | POST | 完整 PDF 分析 |
| `/api/pdf/full-read-by-name` | POST | 按文件名分析 PDF |
| `/api/user/settings` | GET/POST/DELETE | API Key 管理 |
| `/api/admin/users` | GET | 用户列表（管理员） |
| `/api/admin/migrate` | POST | 数据库迁移（管理员） |

## 环境变量

```bash
# AI 服务（只支持 Anthropic Claude）
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-xxx...
ANTHROPIC_BASE_URL=https://yunwu.ai

# 数据库（Neon PostgreSQL）
POSTGRES_URL=postgresql://...

# 应用配置
NEXT_PUBLIC_APP_NAME=FPGA FAE助手
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB
```

**重要**:
- `ANTHROPIC_BASE_URL` **必须**设置为 `https://yunwu.ai`（云雾 AI 中转）
- 生产环境变量在部署平台（Spaceship）配置，不从 GitHub 拉取

## 部署

### 云端自动部署

- **代码托管**: GitHub - https://github.com/Jikezy/fpga-fae-assistant
- **部署平台**: Spaceship
- **数据库**: Neon PostgreSQL (Serverless)
- **自动部署**: 推送到 `main` 分支自动触发

### 标准工作流

```bash
# 修改代码后
git add .
git commit -m "描述修改内容"
git push origin main

# 等待 1-3 分钟自动部署完成
```

**注意**:
- `.env` 文件仅用于本地开发
- 生产环境变量在 Spaceship 控制面板配置
- `.npmrc` 配置会自动应用于云端构建
