#!/bin/bash

# 智能刷题系统 - 生产环境启动脚本
# 提供稳定的后台运行服务

echo "🚀 智能刷题系统 - 生产环境部署脚本"
echo "==================================="

# 检查Node.js是否安装
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装，请先安装 Node.js 14.0.0 或更高版本"
    exit 1
fi

# 检查Node.js版本
NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="14.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "✅ Node.js 版本: $NODE_VERSION"
else
    echo "❌ Node.js 版本过低 ($NODE_VERSION)，需要 $REQUIRED_VERSION 或更高版本"
    exit 1
fi

# 检查public目录
if [ ! -d "public" ]; then
    echo "❌ public 目录不存在，正在创建..."
    mkdir -p public
fi

# 检查index.html文件
if [ ! -f "public/index.html" ]; then
    echo "❌ public/index.html 文件不存在，正在复制..."
    if [ -f "index.html" ]; then
        cp index.html public/
        echo "✅ 已复制 index.html 到 public 目录"
    else
        echo "❌ index.html 文件不存在，请确保项目文件完整"
        exit 1
    fi
fi

# 创建logs目录
if [ ! -d "logs" ]; then
    echo "📁 创建日志目录..."
    mkdir -p logs
fi

# 检查端口80是否被占用
if lsof -i :80 &> /dev/null; then
    echo "⚠️  端口80已被占用，尝试停止占用该端口的进程..."
    sudo lsof -ti:80 | xargs sudo kill -9 2>/dev/null || true
    sleep 2
fi

# 设置权限
chmod +x production-server.js
chmod +x start-production.sh

echo ""
echo "📊 系统信息"
echo "-----------"
echo "Node.js版本: $(node -v)"
echo "操作系统: $(uname -s) $(uname -r)"
echo "主机名: $(hostname)"
echo "当前目录: $(pwd)"
echo "公网IP: $(curl -s ifconfig.me 2>/dev/null || echo "无法获取")"
echo ""

echo "🚀 启动生产服务器"
echo "----------------"
echo "服务地址: http://0.0.0.0:80"
echo "日志文件: ./logs/access.log, ./logs/error.log"
echo "静态文件: ./public/"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 启动服务器
node production-server.js

# 捕获退出信号
trap "echo '🛑 服务已停止'; exit 0" SIGINT SIGTERM

# 保持脚本运行
wait