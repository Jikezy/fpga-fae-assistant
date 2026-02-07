# 云端部署指南

本文档介绍如何将 FPGA FAE 助手部署到云端，使用国产免费 AI 模型。

## 支持的国产模型

| 模型 | 提供商 | 免费额度 | 注册链接 |
|------|--------|----------|----------|
| GLM-4-Flash | 智谱AI | ✅ 有 | https://open.bigmodel.cn/ |
| 通义千问 Plus | 阿里云 | ✅ 有 | https://dashscope.console.aliyun.com/ |
| 文心一言 4.0 | 百度 | ✅ 有 | https://cloud.baidu.com/product/wenxinworkshop |
| 讯飞星火 v3.5 | 科大讯飞 | ✅ 有 | https://console.xfyun.cn/ |

## 部署到 Vercel（推荐）

### 1. 准备工作

1. 注册 [Vercel](https://vercel.com) 账号
2. 注册至少一个国产 AI 模型平台（推荐智谱AI）
3. 获取对应的 API Key

### 2. 获取 API Key

#### 智谱 AI（推荐，最简单）

1. 访问 https://open.bigmodel.cn/
2. 注册并登录
3. 进入"个人中心" → "API Key"
4. 创建新的 API Key
5. 复制保存（只显示一次）

#### 通义千问

1. 访问 https://dashscope.console.aliyun.com/
2. 登录阿里云账号
3. 开通 DashScope 服务
4. 创建 API Key

#### 文心一言

1. 访问 https://cloud.baidu.com/product/wenxinworkshop
2. 登录百度账号
3. 创建应用
4. 获取 API Key 和 Secret Key

#### 讯飞星火

1. 访问 https://console.xfyun.cn/
2. 注册并登录
3. 创建应用
4. 获取 API Key

### 3. 部署步骤

#### 方式一：通过 Vercel Dashboard

1. 访问 https://vercel.com/new
2. 导入你的 GitHub 仓库
3. 配置环境变量：

```
AI_PROVIDER=zhipu
ZHIPU_API_KEY=你的智谱AI_API_Key
ZHIPU_MODEL=glm-4-flash
```

4. 点击 Deploy

#### 方式二：通过 Vercel CLI

```bash
# 1. 安装 Vercel CLI
npm i -g vercel

# 2. 登录
vercel login

# 3. 部署
vercel

# 4. 添加环境变量
vercel env add AI_PROVIDER
vercel env add ZHIPU_API_KEY
vercel env add ZHIPU_MODEL

# 5. 重新部署
vercel --prod
```

### 4. 环境变量配置

根据选择的模型配置对应的环境变量：

**使用智谱 AI：**
```
AI_PROVIDER=zhipu
ZHIPU_API_KEY=your-api-key
ZHIPU_MODEL=glm-4-flash
```

**使用通义千问：**
```
AI_PROVIDER=qwen
QWEN_API_KEY=your-api-key
QWEN_MODEL=qwen-plus
```

**使用文心一言：**
```
AI_PROVIDER=ernie
ERNIE_API_KEY=your-access-token
ERNIE_MODEL=ernie-4.0-8k-preview
```

**使用讯飞星火：**
```
AI_PROVIDER=spark
SPARK_API_KEY=your-api-key
SPARK_MODEL=generalv3.5
```

## 部署到其他平台

### Railway

1. 访问 https://railway.app/
2. 连接 GitHub 仓库
3. 添加环境变量（同 Vercel）
4. 部署

### Netlify

1. 访问 https://www.netlify.com/
2. 导入项目
3. Build command: `npm run build`
4. Publish directory: `.next`
5. 添加环境变量
6. 部署

## 多模型配置（推荐）

为了更好的可用性，建议配置多个模型的 API Key：

```env
# 默认使用智谱 AI
AI_PROVIDER=zhipu

# 智谱 AI
ZHIPU_API_KEY=your-zhipu-key
ZHIPU_MODEL=glm-4-flash

# 通义千问（备用）
QWEN_API_KEY=your-qwen-key
QWEN_MODEL=qwen-plus

# 文心一言（备用）
ERNIE_API_KEY=your-ernie-key
ERNIE_MODEL=ernie-4.0-8k-preview
```

配置多个模型后，用户可以在网页界面切换使用。

## 费用说明

### 免费额度（2024年数据）

- **智谱 GLM-4-Flash**: 每月 1000 万 tokens 免费
- **通义千问**: 每月 100 万 tokens 免费
- **文心一言**: 每月 5000 次调用免费
- **讯飞星火**: 每月 200 万 tokens 免费

### 超出免费额度后

各平台都有按量付费方案，价格较低：

- GLM-4-Flash: ¥0.001/千tokens
- 通义千问: ¥0.002/千tokens
- 文心一言: ¥0.012/千tokens
- 讯飞星火: ¥0.0036/千tokens

## 性能优化

### 1. 启用边缘函数

Vercel 配置：

```json
// vercel.json
{
  "functions": {
    "app/api/chat/route.ts": {
      "maxDuration": 60
    }
  }
}
```

### 2. 配置缓存

```typescript
// app/api/chat/route.ts
export const runtime = 'edge'
export const dynamic = 'force-dynamic'
```

## 故障排查

### API 调用失败

1. 检查 API Key 是否正确
2. 检查模型名称是否正确
3. 检查免费额度是否用尽
4. 查看平台控制台日志

### 部署失败

1. 检查环境变量是否配置
2. 检查构建日志
3. 确认 Node.js 版本兼容（建议 18+）

## 监控和日志

### Vercel 日志

```bash
vercel logs <deployment-url>
```

### 使用情况监控

各平台都提供使用统计：

- 智谱AI: https://open.bigmodel.cn/usagecenter
- 通义千问: https://dashscope.console.aliyun.com/usage
- 文心一言: https://console.bce.baidu.com/qianfan/overview
- 讯飞星火: https://console.xfyun.cn/app/myapp

## 安全建议

1. **保护 API Key**: 只在服务端使用，不要暴露给前端
2. **设置请求限制**: 防止滥用
3. **启用日志**: 监控异常调用
4. **定期轮换密钥**: 提高安全性

## 更新部署

```bash
# Git 提交
git add .
git commit -m "update"
git push

# Vercel 会自动重新部署
# 或手动触发
vercel --prod
```

## 回滚

```bash
# 查看部署历史
vercel ls

# 回滚到指定版本
vercel rollback <deployment-url>
```

---

**部署成功后，你的 FPGA FAE 助手将可以在云端访问，支持多模型切换！**
