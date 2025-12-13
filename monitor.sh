#!/bin/bash

# 智能刷题系统 - Docker环境监控脚本

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 配置参数
MONITOR_TARGET="${MONITOR_TARGET:-smart-exam-system}"
CHECK_INTERVAL="${CHECK_INTERVAL:-300}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://smart-exam-system:80}"
MAX_RETRIES="${MAX_RETRIES:-3}"
ALERT_EMAIL="${ALERT_EMAIL:-admin@example.com}"
LOG_FILE="/app/logs/monitor.log"

log() {
    local level=$1
    local message=$2
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        "INFO")
            echo -e "${BLUE}[${timestamp}] [INFO] ${message}${NC}"
            ;;
        "SUCCESS")
            echo -e "${GREEN}[${timestamp}] [SUCCESS] ${message}${NC}"
            ;;
        "WARNING")
            echo -e "${YELLOW}[${timestamp}] [WARNING] ${message}${NC}"
            ;;
        "ERROR")
            echo -e "${RED}[${timestamp}] [ERROR] ${message}${NC}"
            ;;
        *)
            echo -e "[${timestamp}] [${level}] ${message}"
            ;;
    esac
    
    echo "[$timestamp] [${level}] ${message}" >> "$LOG_FILE"
}

send_alert() {
    local subject=$1
    local message=$2
    
    log "WARNING" "发送告警: $subject"
    log "WARNING" "告警内容: $message"
    
    # 这里可以添加邮件发送逻辑
    # mail -s "$subject" "$ALERT_EMAIL" << EOF
    # $message
    # EOF
}

check_docker_container() {
    local container_name=$1
    
    if docker ps -q -f name="$container_name" > /dev/null; then
        local status=$(docker inspect --format '{{.State.Status}}' "$container_name")
        if [ "$status" == "running" ]; then
            return 0
        else
            return 1
        fi
    else
        return 2
    fi
}

check_health() {
    local url=$1
    local retries=$2
    
    for ((i=1; i<=$retries; i++)); do
        log "INFO" "健康检查 (尝试 $i/$retries): $url"
        
        local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" || echo "000")
        
        if [ "$response" == "200" ]; then
            log "SUCCESS" "健康检查通过: HTTP $response"
            return 0
        else
            log "WARNING" "健康检查失败: HTTP $response"
            sleep 5
        fi
    done
    
    log "ERROR" "健康检查失败 (${retries}次尝试): $url"
    return 1
}

get_container_stats() {
    local container_name=$1
    
    if docker stats --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}" "$container_name" > /dev/null 2>&1; then
        local stats=$(docker stats --no-stream --format "{{.CPUPerc}},{{.MemPerc}},{{.NetIO}},{{.BlockIO}}" "$container_name")
        echo "$stats"
    else
        echo "N/A,N/A,N/A,N/A"
    fi
}

cleanup_logs() {
    local log_dir="/app/logs"
    
    log "INFO" "清理旧日志文件..."
    
    # 压缩超过100MB的日志文件
    find "$log_dir" -name "*.log" -size +100M -exec gzip {} \;
    
    # 删除超过7天的日志文件
    find "$log_dir" -name "*.log*" -mtime +7 -delete
    
    log "SUCCESS" "日志清理完成"
}

main() {
    log "INFO" "🚀 启动智能刷题系统监控"
    log "INFO" "监控目标: $MONITOR_TARGET"
    log "INFO" "检查间隔: $CHECK_INTERVAL 秒"
    log "INFO" "健康检查URL: $HEALTH_CHECK_URL"
    log "INFO" "最大重试次数: $MAX_RETRIES"
    log "INFO" "告警邮箱: $ALERT_EMAIL"
    
    while true; do
        log "INFO" "========================================="
        log "INFO" "开始监控检查周期"
        
        # 检查Docker容器状态
        if check_docker_container "$MONITOR_TARGET"; then
            log "SUCCESS" "容器状态: 运行中"
            
            # 获取容器统计信息
            IFS=',' read -r cpu_usage mem_usage network_io block_io <<< $(get_container_stats "$MONITOR_TARGET")
            
            log "INFO" "系统资源使用情况:"
            log "INFO" "  CPU使用率: $cpu_usage"
            log "INFO" "  内存使用率: $mem_usage"
            log "INFO" "  网络IO: $network_io"
            log "INFO" "  磁盘IO: $block_io"
            
            # 检查健康状态
            if check_health "$HEALTH_CHECK_URL" "$MAX_RETRIES"; then
                log "SUCCESS" "服务运行正常"
            else
                log "ERROR" "服务健康检查失败，尝试重启..."
                
                # 重启容器
                docker restart "$MONITOR_TARGET"
                
                if [ $? -eq 0 ]; then
                    log "SUCCESS" "容器重启成功"
                    send_alert "服务重启成功" "智能刷题系统服务已自动重启，请检查服务状态。"
                else
                    log "ERROR" "容器重启失败"
                    send_alert "服务重启失败" "智能刷题系统服务重启失败，请立即检查服务器状态！"
                fi
                
                # 等待服务恢复
                sleep 30
            fi
            
        else
            local container_status=$?
            
            if [ $container_status -eq 1 ]; then
                log "ERROR" "容器状态异常: 存在但未运行"
            else
                log "ERROR" "容器不存在: $MONITOR_TARGET"
            fi
            
            log "ERROR" "尝试启动容器..."
            
            # 启动容器
            if docker start "$MONITOR_TARGET" > /dev/null 2>&1; then
                log "SUCCESS" "容器启动成功"
                send_alert "容器启动成功" "智能刷题系统容器已自动启动，请检查服务状态。"
            else
                log "ERROR" "容器启动失败，尝试使用docker-compose启动..."
                
                # 尝试使用docker-compose启动
                if docker-compose -f /app/docker-compose.yml up -d > /dev/null 2>&1; then
                    log "SUCCESS" "使用docker-compose启动成功"
                    send_alert "服务启动成功" "智能刷题系统已通过docker-compose自动启动，请检查服务状态。"
                else
                    log "ERROR" "所有启动尝试失败"
                    send_alert "服务启动失败" "智能刷题系统无法启动，请立即检查服务器状态！"
                fi
            fi
            
            # 等待服务启动
            sleep 60
        fi
        
        # 定期清理日志
        if [ $(( $(date +%s) % 3600 )) -lt $CHECK_INTERVAL ]; then
            cleanup_logs
        fi
        
        log "INFO" "监控检查周期完成"
        log "INFO" "========================================="
        
        # 等待下一个检查周期
        sleep "$CHECK_INTERVAL"
    done
}

# 启动监控
main