#!/bin/bash
# FPGA FAE助手 - Linux/macOS快速启动脚本

echo "========================================"
echo "🚀 FPGA FAE助手 - 快速启动"
echo "========================================"
echo ""

# 检查Node.js
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未安装Node.js"
    echo "请访问 https://nodejs.org/ 下载安装"
    exit 1
fi

echo "✅ Node.js已安装"
node -v
echo ""

# 检查.env文件
if [ ! -f .env ]; then
    echo "⚠️  未找到.env文件，正在创建..."
    cp .env.example .env
    echo "✅ 已创建.env文件"
    echo ""
    echo "📝 请配置AI提供商（二选一）:"
    echo ""
    echo "方案1: 使用Ollama本地模型（免费）"
    echo "  AI_PROVIDER=ollama"
    echo "  需要先安装Ollama: https://ollama.ai"
    echo ""
    echo "方案2: 使用Claude API（付费，效果更好）"
    echo "  AI_PROVIDER=anthropic"
    echo "  ANTHROPIC_API_KEY=你的密钥"
    echo "  获取密钥: https://console.anthropic.com/"
    echo ""
    echo "请编辑.env文件配置后继续..."
    echo ""
    read -p "按回车键打开编辑器..."
    ${EDITOR:-nano} .env
fi

# 检查node_modules
if [ ! -d node_modules ]; then
    echo "📦 正在安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo "❌ 依赖安装失败"
        exit 1
    fi
    echo "✅ 依赖安装完成"
    echo ""
fi

# 快速健康检查
echo "🔍 快速健康检查..."
if [ -f "app/page.tsx" ]; then
    echo "✅ 核心文件完整"
else
    echo "❌ 核心文件缺失"
    exit 1
fi

# 检查AI配置
if ! grep -q "AI_PROVIDER=" .env; then
    echo "⚠️  警告: .env中未配置AI_PROVIDER"
    echo "请编辑.env文件配置AI提供商"
    read -p "按回车键继续..."
fi

echo ""
echo "========================================"
echo "🎉 启动开发服务器..."
echo "========================================"
echo ""
echo "访问: http://localhost:3000"
echo "健康检查: http://localhost:3000/api/health"
echo ""
echo "按 Ctrl+C 停止服务器"
echo "========================================"
echo ""

npm run dev
