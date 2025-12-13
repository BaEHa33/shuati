# 智能刷题系统 - 远程部署指南

## 🎯 部署方案概述

本系统提供两种远程部署方式：

### 方案一：直接服务器部署
- **适用场景**：云服务器、VPS、物理服务器
- **优点**：配置简单，资源占用少
- **缺点**：依赖服务器环境

### 方案二：Docker容器化部署
- **适用场景**：支持Docker的任何环境
- **优点**：环境隔离，易于管理，跨平台
- **缺点**：额外的Docker资源开销

## 📋 系统要求

### 硬件要求
- **CPU**: 1核或更高
- **内存**: 512MB以上
- **磁盘**: 1GB可用空间
- **网络**: 公网IP，开放80端口

### 软件要求
- **方案一**: Node.js 14.0.0+
- **方案二**: Docker 20.10+ 和 Docker Compose 2.0+

## 🚀 方案一：直接服务器部署

### 1. 连接到远程服务器

```bash
ssh root@your-server-ip
```

### 2. 上传部署包

使用SCP或其他方式将部署包上传到服务器：

```bash
scp -r smart-exam-system root@your-server-ip:/opt/
```

### 3. 执行部署脚本

```bash
cd /opt/smart-exam-system
chmod +x deploy-remote.sh
./deploy-remote.sh
```

### 4. 部署脚本功能

部署脚本会自动完成：
- ✅ 安装系统依赖（Node.js 18、PM2等）
- ✅ 配置防火墙（开放80、443、22端口）
- ✅ 安装安全防护（Fail2ban）
- ✅ 创建应用用户和目录
- ✅ 配置PM2进程管理
- ✅ 设置系统服务和开机自启
- ✅ 配置监控和自动恢复
- ✅ 设置定时任务（日志清理、备份）

### 5. 访问系统

部署完成后，通过浏览器访问：
```
http://your-server-ip
```

## 🐳 方案二：Docker容器化部署

### 1. 安装Docker和Docker Compose

```bash
# 安装Docker
curl -fsSL https://get.docker.com | bash -s docker

# 安装Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose
```

### 2. 上传部署包

```bash
scp -r smart-exam-system root@your-server-ip:/opt/
cd /opt/smart-exam-system
```

### 3. 构建并启动容器

```bash
# 构建镜像并启动容器
docker-compose up -d --build

# 查看容器状态
docker-compose ps
```

### 4. Docker部署特点

- **多容器架构**：
  - `smart-exam-system`: 主应用服务
  - `nginx-proxy`: Nginx反向代理（支持HTTPS）
  - `monitor`: 监控服务

- **自动管理**：
  - ✅ 自动重启失败的容器
  - ✅ 健康检查和自动恢复
  - ✅ 资源限制和性能优化
  - ✅ 日志集中管理

### 5. 访问系统

```
http://your-server-ip:80
```

## 🔧 管理命令

### 服务管理

```bash
# 方案一：PM2管理
pm2 status smart-exam-system      # 查看状态
pm2 logs smart-exam-system        # 查看日志
pm2 restart smart-exam-system     # 重启服务
pm2 stop smart-exam-system        # 停止服务

# 方案二：Docker管理
docker-compose ps                 # 查看容器状态
docker-compose logs -f            # 查看所有日志
docker-compose restart            # 重启所有服务
docker-compose down               # 停止所有服务
```

### 监控管理

```bash
# 查看监控状态
systemctl status smart-exam-monitor

# 查看监控日志
tail -f /opt/smart-exam-system/logs/monitor.log

# Docker监控
docker logs smart-exam-monitor -f
```

### 更新系统

```bash
# 方案一：使用更新脚本
/opt/smart-exam-system/update.sh

# 方案二：Docker更新
docker-compose pull
docker-compose up -d
```

## 📊 监控和维护

### 自动监控功能

系统内置了完整的监控体系：

1. **服务监控**：
   - 每5分钟检查服务状态
   - 自动重启异常服务
   - 资源使用监控（CPU、内存、磁盘）

2. **日志管理**：
   - 访问日志：`/opt/smart-exam-system/logs/access.log`
   - 错误日志：`/opt/smart-exam-system/logs/error.log`
   - 监控日志：`/opt/smart-exam-system/logs/monitor.log`

3. **自动维护**：
   - 日志自动清理（超过100MB自动压缩）
   - 定期备份（每周日凌晨3点）
   - 旧备份自动删除（保留7天）

### 手动维护

```bash
# 清理日志
find /opt/smart-exam-system/logs -name "*.log" -size +100M -exec gzip {} \;

# 查看系统状态
pm2 monit

# Docker系统状态
docker stats
```

## 🔒 安全配置

### HTTPS配置（Nginx）

1. 创建SSL证书目录：
```bash
mkdir -p nginx/ssl
```

2. 复制SSL证书到目录：
```bash
cp your-cert.pem nginx/ssl/
cp your-key.pem nginx/ssl/
```

3. 配置Nginx：
```bash
# 编辑 nginx/conf.d/default.conf
server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/nginx/ssl/your-cert.pem;
    ssl_certificate_key /etc/nginx/ssl/your-key.pem;
    
    location / {
        proxy_pass http://smart-exam-system:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

4. 重启Nginx：
```bash
docker-compose restart nginx-proxy
```

### 防火墙配置

```bash
# Ubuntu/Debian
ufw status
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp

# CentOS/RHEL
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload
```

## 🚨 故障排除

### 常见问题

1. **服务无法访问**
   - 检查防火墙是否开放80端口
   - 检查服务是否运行：`pm2 status` 或 `docker-compose ps`
   - 查看错误日志：`pm2 logs` 或 `docker-compose logs`

2. **502 Bad Gateway**
   - 检查后端服务是否正常运行
   - 查看Nginx配置是否正确
   - 重启相关服务

3. **内存占用过高**
   - 检查是否有内存泄漏
   - 调整PM2内存限制：`pm2 set pm2:max_memory_restart 512M`
   - 或调整Docker内存限制

### 日志分析

```bash
# 查看错误日志
tail -f /opt/smart-exam-system/logs/error.log

# 搜索错误信息
grep -i error /opt/smart-exam-system/logs/*.log

# Docker日志
docker-compose logs --tail=100 | grep -i error
```

## 📈 性能优化

### 系统优化

1. **Node.js优化**：
```bash
# 增加Node.js内存限制
pm2 start production-server.js --name smart-exam-system --node-args="--max-old-space-size=512"
```

2. **Nginx优化**：
```bash
# 启用Gzip压缩
gzip on;
gzip_comp_level 6;
gzip_types text/plain text/css application/json application/javascript;
```

3. **缓存优化**：
```bash
# 调整缓存大小
# 编辑 production-config.js
cache: {
    maxSize: 200 * 1024 * 1024  // 200MB
}
```

## 📝 更新日志

### v2.0.0 (2024-12-12)
- ✨ 新增远程部署脚本
- ✨ 支持Docker容器化部署
- ✨ 完善的监控和自动恢复
- ✨ 安全防护和防火墙配置
- ✨ HTTPS支持和SSL配置
- ✨ 自动备份和日志管理

## 🤝 技术支持

如需技术支持，请提供以下信息：

1. 部署方式（直接部署/Docker）
2. 服务器环境（操作系统、版本）
3. 错误日志片段
4. 服务状态截图

## 📄 许可证

MIT License - 详见LICENSE文件