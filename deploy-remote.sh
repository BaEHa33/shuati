#!/bin/bash

# 智能刷题系统 - 远程服务器部署脚本
# 适用于云服务器、VPS等远程环境部署

set -e  # 遇到错误立即退出

echo "🚀 智能刷题系统 - 远程服务器部署脚本"
echo "====================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 检查是否以root用户运行
if [ "$(id -u)" != "0" ]; then
    echo -e "${RED}❌ 请以root用户运行此脚本${NC}"
    echo -e "${YELLOW}提示: 使用 sudo ./deploy-remote.sh${NC}"
    exit 1
fi

# 系统信息
echo -e "${BLUE}📊 系统信息${NC}"
echo "-------------------------------------"
echo "操作系统: $(cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'"' -f2 || uname -a)"
echo "主机名: $(hostname)"
echo "IP地址: $(curl -s ifconfig.me 2>/dev/null || echo "无法获取公网IP")"
echo "内存: $(free -h | grep Mem | awk '{print $2}')"
echo "磁盘: $(df -h | grep '^/dev/' | head -1 | awk '{print $2}')"
echo ""

# 安装必要的系统依赖
echo -e "${BLUE}📦 安装系统依赖${NC}"
echo "-------------------------------------"

# 检测系统类型
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
    VER=$VERSION_ID
else
    OS=$(uname -s)
    VER=$(uname -r)
fi

echo -e "${YELLOW}检测到系统: $OS $VER${NC}"

# 根据不同系统安装依赖
case "$OS" in
    ubuntu|debian)
        echo -e "${GREEN}🔄 更新软件包列表...${NC}"
        apt-get update -y
        
        echo -e "${GREEN}🔄 安装必要依赖...${NC}"
        apt-get install -y \
            curl wget git build-essential \
            software-properties-common \
            apt-transport-https ca-certificates \
            ufw fail2ban
        
        # 安装Node.js 18
        echo -e "${GREEN}🔄 安装Node.js 18...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
        apt-get install -y nodejs
        
        # 安装PM2
        echo -e "${GREEN}🔄 安装PM2进程管理器...${NC}"
        npm install -g pm2
        ;;
        
    centos|rhel|fedora)
        echo -e "${GREEN}🔄 安装EPEL仓库...${NC}"
        yum install -y epel-release
        
        echo -e "${GREEN}🔄 安装必要依赖...${NC}"
        yum install -y \
            curl wget git gcc-c++ make \
            openssl-devel perl \
            firewalld
        
        # 安装Node.js 18
        echo -e "${GREEN}🔄 安装Node.js 18...${NC}"
        curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
        yum install -y nodejs
        
        # 安装PM2
        echo -e "${GREEN}🔄 安装PM2进程管理器...${NC}"
        npm install -g pm2
        ;;
        
    *)
        echo -e "${RED}❌ 不支持的操作系统: $OS${NC}"
        echo -e "${YELLOW}请手动安装Node.js 18+ 和 PM2${NC}"
        exit 1
        ;;
esac

# 验证安装
echo -e "${GREEN}✅ 系统依赖安装完成${NC}"
echo "Node.js版本: $(node -v)"
echo "npm版本: $(npm -v)"
echo "PM2版本: $(pm2 -v)"
echo ""

# 创建应用目录
APP_DIR="/opt/smart-exam-system"
echo -e "${BLUE}📁 创建应用目录${NC}"
echo "-------------------------------------"

if [ -d "$APP_DIR" ]; then
    echo -e "${YELLOW}⚠️  应用目录已存在，正在备份...${NC}"
    BACKUP_DIR="${APP_DIR}_backup_$(date +%Y%m%d_%H%M%S)"
    mv "$APP_DIR" "$BACKUP_DIR"
    echo -e "${GREEN}✅ 已备份到: $BACKUP_DIR${NC}"
fi

mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/logs"
mkdir -p "$APP_DIR/public"

# 创建应用用户
echo -e "${BLUE}👤 创建应用用户${NC}"
echo "-------------------------------------"

if ! id "smartexam" &>/dev/null; then
    useradd -m -s /bin/bash smartexam
    echo -e "${GREEN}✅ 创建用户: smartexam${NC}"
else
    echo -e "${YELLOW}⚠️ 用户 smartexam 已存在${NC}"
fi

# 设置目录权限
chown -R smartexam:smartexam "$APP_DIR"
chmod -R 755 "$APP_DIR"
echo -e "${GREEN}✅ 设置目录权限完成${NC}"
echo ""

# 配置防火墙
echo -e "${BLUE}🔒 配置防火墙${NC}"
echo "-------------------------------------"

case "$OS" in
    ubuntu|debian)
        # 配置UFW
        ufw allow 80/tcp
        ufw allow 443/tcp
        ufw allow 22/tcp
        
        # 启用UFW
        ufw --force enable
        echo -e "${GREEN}✅ UFW防火墙配置完成${NC}"
        ufw status
        ;;
        
    centos|rhel|fedora)
        # 配置FirewallD
        systemctl start firewalld
        systemctl enable firewalld
        
        firewall-cmd --permanent --add-service=http
        firewall-cmd --permanent --add-service=https
        firewall-cmd --permanent --add-service=ssh
        firewall-cmd --reload
        
        echo -e "${GREEN}✅ FirewallD配置完成${NC}"
        firewall-cmd --list-all
        ;;
esac
echo ""

# 配置fail2ban (仅Ubuntu/Debian)
if [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    echo -e "${BLUE}🛡️  配置Fail2ban防护${NC}"
    echo "-------------------------------------"
    
    cat > /etc/fail2ban/jail.local << 'EOF'
[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
bantime = 3600

[http-flood]
enabled = true
port = http,https
filter = http-flood
logpath = /var/log/nginx/access.log
maxretry = 200
bantime = 3600
EOF

    systemctl restart fail2ban
    systemctl enable fail2ban
    echo -e "${GREEN}✅ Fail2ban配置完成${NC}"
    echo ""
fi

# 创建生产配置文件
echo -e "${BLUE}⚙️  创建生产配置${NC}"
echo "-------------------------------------"

cat > "$APP_DIR/production-config.js" << 'EOF'
/**
 * 智能刷题系统 - 生产环境配置
 */

module.exports = {
    // 服务器配置
    server: {
        port: 80,
        host: '0.0.0.0',
        maxConnections: 1000,
        timeout: 60000
    },
    
    // 静态文件配置
    static: {
        directory: './public',
        maxAge: 86400000, // 24小时缓存
        index: 'index.html'
    },
    
    // 日志配置
    logging: {
        level: 'info',
        accessLog: './logs/access.log',
        errorLog: './logs/error.log',
        maxFileSize: 50 * 1024 * 1024, // 50MB
        maxFiles: 5
    },
    
    // 安全配置
    security: {
        cors: {
            enabled: true,
            allowOrigins: ['*'],
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization']
        },
        rateLimit: {
            enabled: true,
            maxRequests: 100,
            windowMs: 60000 // 1分钟
        },
        xssProtection: true,
        frameGuard: true
    },
    
    // 缓存配置
    cache: {
        enabled: true,
        maxSize: 100 * 1024 * 1024, // 100MB
        ttl: 3600000 // 1小时
    },
    
    // 监控配置
    monitoring: {
        enabled: true,
        interval: 3600000, // 1小时
        memoryThreshold: 80, // 内存使用阈值
        cpuThreshold: 90 // CPU使用阈值
    }
};
EOF

echo -e "${GREEN}✅ 生产配置文件创建完成${NC}"
echo ""

# 创建监控脚本
echo -e "${BLUE}📈 创建监控脚本${NC}"
echo "-------------------------------------"

cat > "$APP_DIR/monitor.sh" << 'EOF'
#!/bin/bash

# 智能刷题系统监控脚本
APP_DIR="/opt/smart-exam-system"
LOG_FILE="$APP_DIR/logs/monitor.log"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 启动系统监控..."

while true; do
    # 检查PM2进程状态
    PM2_STATUS=$(pm2 status smart-exam-system 2>/dev/null)
    
    if [[ $PM2_STATUS == *"online"* ]]; then
        # 获取系统资源使用情况
        CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | sed "s/.*, *\([0-9.]*\)%* id.*/\1/" | awk '{print 100 - $1}')
        MEM_USAGE=$(free -m | awk '/Mem/{print int($3/$2 * 100)}')
        DISK_USAGE=$(df -h | grep '^/dev/' | head -1 | awk '{print $5}' | sed 's/%//')
        NETWORK_IN=$(ifconfig eth0 | grep "RX packets" | awk '{print $5}')
        NETWORK_OUT=$(ifconfig eth0 | grep "TX packets" | awk '{print $5}')
        
        # 检查服务响应
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:80 || echo "000")
        
        log "📊 系统状态 - CPU: ${CPU_USAGE}% | 内存: ${MEM_USAGE}% | 磁盘: ${DISK_USAGE}% | 网络: ${NETWORK_IN}/${NETWORK_OUT} | HTTP: ${HTTP_STATUS}"
        
        # 资源使用告警
        if (( $(echo "$CPU_USAGE > 90" | bc -l) )); then
            log "⚠️  CPU使用率过高: ${CPU_USAGE}%"
        fi
        
        if [ $MEM_USAGE -gt 90 ]; then
            log "⚠️  内存使用率过高: ${MEM_USAGE}%"
        fi
        
        if [ $DISK_USAGE -gt 90 ]; then
            log "⚠️  磁盘使用率过高: ${DISK_USAGE}%"
        fi
        
        if [ "$HTTP_STATUS" != "200" ]; then
            log "❌ HTTP服务异常: ${HTTP_STATUS}"
            # 尝试重启服务
            pm2 restart smart-exam-system
            log "🔄 已尝试重启服务"
        fi
        
    else
        log "❌ 服务未运行，正在启动..."
        cd "$APP_DIR" && pm2 start production-server.js --name smart-exam-system
    fi
    
    # 清理日志文件
    find "$APP_DIR/logs" -name "*.log" -size +100M -exec gzip {} \;
    
    sleep 300  # 5分钟检查一次
done
EOF

chmod +x "$APP_DIR/monitor.sh"
echo -e "${GREEN}✅ 监控脚本创建完成${NC}"
echo ""

# 创建自动更新脚本
echo -e "${BLUE}🔄 创建自动更新脚本${NC}"
echo "-------------------------------------"

cat > "$APP_DIR/update.sh" << 'EOF'
#!/bin/bash

# 智能刷题系统自动更新脚本
APP_DIR="/opt/smart-exam-system"
BACKUP_DIR="/opt/backups"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "🚀 开始系统更新..."

# 创建备份
BACKUP_NAME="smart-exam-system_$(date +%Y%m%d_%H%M%S)"
log "📁 创建备份: $BACKUP_NAME"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/$BACKUP_NAME.tar.gz" "$APP_DIR"

# 停止服务
log "🛑 停止服务..."
pm2 stop smart-exam-system

# 清理旧文件
rm -rf "$APP_DIR/public"
mkdir -p "$APP_DIR/public"

# 下载最新版本（这里需要替换为实际的下载地址）
log "📥 下载最新版本..."
# wget -O "$APP_DIR/latest.zip" "https://your-download-url.com/latest.zip"
# unzip "$APP_DIR/latest.zip" -d "$APP_DIR"

# 更新依赖
log "📦 更新依赖..."
cd "$APP_DIR" && npm install --production

# 启动服务
log "🚀 启动服务..."
pm2 start smart-exam-system

# 清理备份（保留最近7天的备份）
log "🧹 清理旧备份..."
find "$BACKUP_DIR" -name "smart-exam-system_*.tar.gz" -mtime +7 -delete

log "✅ 更新完成！"
EOF

chmod +x "$APP_DIR/update.sh"
echo -e "${GREEN}✅ 自动更新脚本创建完成${NC}"
echo ""

# 复制必要的文件到应用目录
echo -e "${BLUE}📋 复制应用文件${NC}"
echo "-------------------------------------"

# 复制生产服务器文件
cp "$(pwd)/production-server.js" "$APP_DIR/"
cp "$(pwd)/package.json" "$APP_DIR/"
cp -r "$(pwd)/public"/* "$APP_DIR/public/"

# 创建.env文件（示例）
cat > "$APP_DIR/.env" << 'EOF'
# 生产环境环境变量
NODE_ENV=production
PORT=80
HOST=0.0.0.0
LOG_LEVEL=info
MAX_MEMORY=1024
EOF

echo -e "${GREEN}✅ 应用文件复制完成${NC}"
echo ""

# 设置PM2启动
echo -e "${BLUE}🚀 配置PM2启动${NC}"
echo "-------------------------------------"

cd "$APP_DIR"

# 安装依赖
npm install --production

# PM2启动配置
pm2 start production-server.js --name smart-exam-system

# 设置PM2开机自启
pm2 save
pm2 startup

echo -e "${GREEN}✅ PM2配置完成${NC}"
echo "服务状态:"
pm2 status smart-exam-system
echo ""

# 设置监控服务
echo -e "${BLUE}👀 设置监控服务${NC}"
echo "-------------------------------------"

# 创建systemd服务文件
cat > /etc/systemd/system/smart-exam-monitor.service << 'EOF'
[Unit]
Description=Smart Exam System Monitor
After=network.target

[Service]
User=smartexam
WorkingDirectory=/opt/smart-exam-system
ExecStart=/bin/bash /opt/smart-exam-system/monitor.sh
Restart=always
RestartSec=5
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=smart-exam-monitor

[Install]
WantedBy=multi-user.target
EOF

# 启用监控服务
systemctl daemon-reload
systemctl start smart-exam-monitor
systemctl enable smart-exam-monitor

echo -e "${GREEN}✅ 监控服务配置完成${NC}"
echo ""

# 设置定时任务
echo -e "${BLUE}⏰ 设置定时任务${NC}"
echo "-------------------------------------"

# 创建定时任务文件
cat > /etc/cron.d/smart-exam-system << 'EOF'
# 智能刷题系统定时任务

# 每天凌晨2点进行日志清理
0 2 * * * root find /opt/smart-exam-system/logs -name "*.log" -mtime +7 -exec rm {} \;

# 每周日凌晨3点进行系统备份
0 3 * * 0 root tar -czf /opt/backups/smart-exam-system_$(date +\%Y\%m\%d).tar.gz /opt/smart-exam-system

# 每月1号凌晨4点进行系统更新检查
0 4 1 * * root /opt/smart-exam-system/update.sh >> /opt/smart-exam-system/logs/update.log 2>&1
EOF

# 重新加载cron
systemctl restart cron
echo -e "${GREEN}✅ 定时任务设置完成${NC}"
echo ""

# 最终状态检查
echo -e "${BLUE}✅ 部署完成检查${NC}"
echo "====================================="

echo -e "${GREEN}🎉 智能刷题系统远程部署完成！${NC}"
echo ""
echo -e "${BLUE}📋 部署信息${NC}"
echo "-------------------------------------"
echo "应用目录: $APP_DIR"
echo "访问地址: http://$(curl -s ifconfig.me 2>/dev/null || echo "服务器IP")"
echo "服务状态: $(pm2 status smart-exam-system | grep -o 'online' || echo 'offline')"
echo "监控状态: $(systemctl is-active smart-exam-monitor)"
echo ""

echo -e "${BLUE}🔧 管理命令${NC}"
echo "-------------------------------------"
echo "启动服务: pm2 start smart-exam-system"
echo "停止服务: pm2 stop smart-exam-system"
echo "重启服务: pm2 restart smart-exam-system"
echo "查看日志: pm2 logs smart-exam-system"
echo "系统监控: systemctl status smart-exam-monitor"
echo "更新系统: /opt/smart-exam-system/update.sh"
echo ""

echo -e "${YELLOW}⚠️  注意事项${NC}"
echo "-------------------------------------"
echo "1. 请确保80端口已在防火墙中开放"
echo "2. 定期检查日志文件，及时清理占用空间"
echo "3. 建议定期备份数据库和配置文件"
echo "4. 如需HTTPS支持，请配置SSL证书"
echo "5. 监控服务会自动检查并重启异常的服务"
echo ""

echo -e "${GREEN}🚀 系统已成功部署并运行！${NC}"
echo "====================================="