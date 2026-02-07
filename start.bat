@echo off
chcp 65001 >nul
REM FPGA FAE助手 - Windows快速启动脚本

echo ========================================
echo 🚀 FPGA FAE助手 - 快速启动
echo ========================================
echo.

REM 检查Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ❌ 错误: 未安装Node.js
    echo 请访问 https://nodejs.org/ 下载安装
    pause
    exit /b 1
)

echo ✅ Node.js已安装
node -v
echo.

REM 检查.env文件
if not exist .env (
    echo ⚠️  未找到.env文件，正在创建...
    copy .env.example .env >nul
    echo ✅ 已创建.env文件
    echo.
    echo 📝 请配置AI提供商（二选一）:
    echo.
    echo 方案1: 使用Ollama本地模型（免费）
    echo   AI_PROVIDER=ollama
    echo   需要先安装Ollama: https://ollama.ai
    echo.
    echo 方案2: 使用Claude API（付费，效果更好）
    echo   AI_PROVIDER=anthropic
    echo   ANTHROPIC_API_KEY=你的密钥
    echo   获取密钥: https://console.anthropic.com/
    echo.
    echo 正在打开.env文件，请配置后保存...
    echo.
    pause
    notepad .env
)

REM 检查node_modules
if not exist node_modules (
    echo 📦 正在安装依赖...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo ❌ 依赖安装失败
        pause
        exit /b 1
    )
    echo ✅ 依赖安装完成
    echo.
)

REM 快速健康检查
echo 🔍 快速健康检查...
if exist "app\page.tsx" (
    echo ✅ 核心文件完整
) else (
    echo ❌ 核心文件缺失
    pause
    exit /b 1
)

REM 检查AI配置
findstr /C:"AI_PROVIDER=" .env >nul
if %ERRORLEVEL% NEQ 0 (
    echo ⚠️  警告: .env中未配置AI_PROVIDER
    echo 请编辑.env文件配置AI提供商
    pause
)

echo.
echo ========================================
echo 🎉 启动开发服务器...
echo ========================================
echo.
echo 访问: http://localhost:3000
echo 健康检查: http://localhost:3000/api/health
echo.
echo 按 Ctrl+C 停止服务器
echo ========================================
echo.

npm run dev
