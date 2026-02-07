# FPGA FAE 助手

一个由 AI 驱动的 FPGA 现场应用工程师（FAE）智能咨询网站，基于 Claude AI 和 RAG 向量检索技术。

## 核心特性

- 🤖 **智谱AI驱动** - 使用智谱 GLM-4-Flash 模型，每月1000万tokens免费
- 📚 **RAG 向量检索** - 支持上传 FPGA 数据手册 PDF，智能检索相关内容
- 💬 **流式对话** - 实时流式响应，提供流畅的对话体验
- 🎨 **现代化 UI** - 基于 Next.js 14 和 Tailwind CSS，响应式设计
- 📱 **移动端适配** - 完美支持桌面和移动设备
- ☁️ **云端部署** - 支持 Vercel、Railway 等平台一键部署

## 技术栈

- **前端**: Next.js 14 (App Router) + React 18 + Tailwind CSS
- **AI 模型**: 智谱 AI GLM-4-Flash
- **向量数据库**: ChromaDB (内存模式)
- **PDF 处理**: pdf-parse
- **语言**: TypeScript

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`：

```bash
cp .env.example .env
```

编辑 `.env` 文件，配置智谱AI：

```env
AI_PROVIDER=zhipu
ZHIPU_API_KEY=your-api-key-here
ZHIPU_MODEL=glm-4-flash
```

> 💡 **获取免费 API Key**: 访问 [智谱AI开放平台](https://open.bigmodel.cn/)，注册后即可获得每月1000万tokens的免费额度。

### 3. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

### 4. 生产部署

```bash
npm run build
npm start
```

## 使用指南

### 上传 FPGA 文档

1. 点击侧边栏的"文档库"标签
2. 点击"点击上传 PDF 文档"按钮
3. 选择 FPGA 数据手册 PDF 文件（最大 10MB）
4. 等待上传和处理完成

### 与 AI 对话

1. **输入问题**: 在输入框中输入问题
2. **查看回答**: AI 会自动检索相关文档内容并回答

支持 Markdown 格式、代码高亮等。

**示例问题：**
- "Xilinx 7 系列 FPGA 的时钟资源有哪些？"
- "如何配置 FPGA 的 I/O 标准？"
- "FPGA 设计中如何优化时序？"

## 项目结构

```
fpga-fae-assistant/
├── app/                      # Next.js App Router
│   ├── api/                  # API 路由
│   │   ├── chat/            # AI 对话接口
│   │   ├── upload/          # 文档上传接口
│   │   └── search/          # 向量检索接口
│   ├── globals.css          # 全局样式
│   ├── layout.tsx           # 根布局
│   └── page.tsx             # 首页
├── components/              # React 组件
│   ├── ChatInterface.tsx    # 聊天界面主组件
│   ├── ChatInput.tsx        # 消息输入框
│   ├── MessageList.tsx      # 消息列表
│   ├── Sidebar.tsx          # 侧边栏
│   ├── DocumentList.tsx     # 文档列表
│   └── DocumentUploader.tsx # 文档上传组件
├── lib/                     # 工具库
│   ├── ai-service.ts        # AI 服务抽象层
│   ├── vectorStore.ts       # 向量数据库封装
│   └── pdfProcessor.ts      # PDF 处理工具
└── public/                  # 静态资源
```

## 部署指南

### 云端部署（推荐）

支持一键部署到 Vercel、Railway、Netlify 等平台。

**Vercel 部署（最简单）:**

1. Fork 本项目到你的 GitHub
2. 访问 [Vercel](https://vercel.com/new)
3. 导入你的仓库
4. 配置环境变量（至少配置一个 AI 模型）
5. 点击 Deploy

详细步骤和配置说明请查看 [部署指南](./DEPLOYMENT.md)

### 本地部署

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 点击部署

### Docker 部署

```bash
# 使用 Docker Compose
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

### 传统服务器部署

使用 PM2 管理进程：

```bash
# 安装 PM2
npm install -g pm2

# 构建项目
npm run build

# 启动应用
pm2 start npm --name "fpga-fae" -- start

# 设置开机自启
pm2 startup
pm2 save
```

## 环境变量说明

| 变量名 | 说明 | 必需 | 默认值 |
|--------|------|------|--------|
| `AI_PROVIDER` | AI 提供商 (zhipu) | ✅ | zhipu |
| `ZHIPU_API_KEY` | 智谱AI API 密钥 | ✅ | - |
| `ZHIPU_MODEL` | 智谱AI 模型版本 | ❌ | glm-4-flash |
| `NEXT_PUBLIC_APP_NAME` | 应用名称 | ❌ | FPGA FAE助手 |
| `NEXT_PUBLIC_MAX_FILE_SIZE` | 最大文件大小（字节） | ❌ | 10485760 (10MB) |

## 常见问题

### Q: 使用的是什么 AI 模型？

使用**智谱 GLM-4-Flash**，这是智谱AI推出的高性能模型：
- 每月 1000 万 tokens 免费额度
- 响应速度快
- 支持中文和英文

### Q: 如何获取 API Key？

1. 访问 [智谱AI开放平台](https://open.bigmodel.cn/)
2. 注册并登录账号
3. 进入控制台创建 API Key
4. 复制 API Key 到 `.env` 文件

### Q: 免费额度用完了怎么办？

1. 智谱AI提供按量付费，价格很便宜
2. 或者注册新账号获取新的免费额度
3. 可以考虑升级到付费套餐

### Q: Ollama 如何安装和使用？

```bash
# 1. 安装 Ollama
# 访问 https://ollama.ai 下载安装

# 2. 拉取模型
ollama pull llama3.1:8b

# 3. 启动服务（通常自动启动）
ollama serve

# 4. 配置 .env
AI_PROVIDER=ollama
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1:8b
```

### Q: 端口被占用怎么办？

```bash
# 更改端口启动
PORT=3001 npm run dev
```

### Q: API 调用失败？

检查：
1. API 密钥是否正确填写在 `.env` 文件中
2. Ollama 服务是否正在运行（如果使用 Ollama）
3. 网络连接是否正常
4. 查看浏览器控制台和服务器日志

### Q: 文档上传失败？

可能原因：
1. 文件大小超过 10MB 限制
2. 文件不是有效的 PDF 格式
3. PDF 文件已损坏

### Q: 如何清除上传的文档？

当前版本文档存储在内存中，重启应用即可清除。

## 安全建议

1. **保护 API 密钥** - 永远不要将 API 密钥提交到代码仓库
2. **启用 HTTPS** - 生产环境必须使用 SSL 证书
3. **限制文件上传** - 设置合理的文件大小和类型限制
4. **定期更新** - 保持依赖包最新以修复安全漏洞

## 性能优化

### 启用持久化向量存储

默认使用内存存储，重启后数据丢失。生产环境建议配置持久化：

```typescript
// lib/vectorStore.ts
const client = new ChromaClient({
  path: process.env.CHROMA_PATH || './chroma_data'
})
```

### 配置 CDN

```javascript
// next.config.js
module.exports = {
  assetPrefix: process.env.CDN_URL || '',
}
```

## 开发指南

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 使用 Prettier 格式化代码

### 运行测试

```bash
npm run lint
npm run build
```

### 提交规范

```
feat: 添加新功能
fix: 修复 bug
docs: 更新文档
style: 代码格式调整
refactor: 重构代码
```

## 许可证

MIT License

## 致谢

- [Anthropic](https://www.anthropic.com/) - Claude AI
- [Ollama](https://ollama.ai/) - 本地大模型运行
- [Next.js](https://nextjs.org/) - React 框架
- [ChromaDB](https://www.trychroma.com/) - 向量数据库
- [Tailwind CSS](https://tailwindcss.com/) - CSS 框架

---

**Made with ❤️ for FPGA Engineers**
