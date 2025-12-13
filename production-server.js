#!/usr/bin/env node

/**
 * 智能刷题系统 - 生产环境服务器
 * 提供稳定的静态文件服务，支持长期运行
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 配置信息
const CONFIG = {
    PORT: 80,
    HOST: '0.0.0.0',
    PUBLIC_DIR: path.join(__dirname, 'public'),
    MAX_AGE: 86400000, // 24小时缓存
    LOG_FILE: path.join(__dirname, 'logs', 'access.log'),
    ERROR_LOG_FILE: path.join(__dirname, 'logs', 'error.log'),
    CORS: {
        allowOrigins: ['*'],
        allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowHeaders: ['Content-Type', 'Authorization']
    }
};

// MIME类型映射
const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.eot': 'application/vnd.ms-fontobject',
    '.mp4': 'video/mp4',
    '.mp3': 'audio/mpeg',
    '.pdf': 'application/pdf'
};

// 创建日志目录
function createLogDirectory() {
    const logDir = path.dirname(CONFIG.LOG_FILE);
    if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
    }
}

// 日志记录器
class Logger {
    constructor() {
        this.logStream = null;
        this.errorStream = null;
        this.init();
    }

    init() {
        createLogDirectory();
        this.logStream = fs.createWriteStream(CONFIG.LOG_FILE, { flags: 'a' });
        this.errorStream = fs.createWriteStream(CONFIG.ERROR_LOG_FILE, { flags: 'a' });
    }

    log(message) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] ${message}\n`;
        
        console.log(logMessage.trim());
        if (this.logStream) {
            this.logStream.write(logMessage);
        }
    }

    error(message, error = null) {
        const timestamp = new Date().toISOString();
        let logMessage = `[${timestamp}] ERROR: ${message}`;
        
        if (error) {
            logMessage += `\n${error.stack || error.message || error}`;
        }
        logMessage += '\n';
        
        console.error(logMessage.trim());
        if (this.errorStream) {
            this.errorStream.write(logMessage);
        }
    }

    close() {
        if (this.logStream) {
            this.logStream.end();
        }
        if (this.errorStream) {
            this.errorStream.end();
        }
    }
}

const logger = new Logger();

// 文件服务类
class FileServer {
    constructor() {
        this.cache = new Map();
        this.cacheSize = 0;
        this.maxCacheSize = 100 * 1024 * 1024; // 100MB缓存
    }

    // 获取MIME类型
    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        return MIME_TYPES[ext] || 'application/octet-stream';
    }

    // 从缓存获取文件
    getFromCache(filePath) {
        const cached = this.cache.get(filePath);
        if (cached && Date.now() - cached.timestamp < CONFIG.MAX_AGE) {
            return cached.content;
        }
        // 缓存过期或不存在
        if (cached) {
            this.cache.delete(filePath);
            this.cacheSize -= cached.content.length;
        }
        return null;
    }

    // 添加到缓存
    addToCache(filePath, content) {
        const contentLength = content.length;
        
        // 如果缓存过大，清理一些旧的缓存
        while (this.cacheSize + contentLength > this.maxCacheSize && this.cache.size > 0) {
            const oldest = Array.from(this.cache.entries()).reduce((a, b) => 
                a[1].timestamp < b[1].timestamp ? a : b
            );
            this.cache.delete(oldest[0]);
            this.cacheSize -= oldest[1].content.length;
        }
        
        this.cache.set(filePath, {
            content,
            timestamp: Date.now()
        });
        this.cacheSize += contentLength;
    }

    // 发送文件
    async sendFile(req, res, filePath) {
        try {
            // 安全检查：防止路径遍历攻击
            const normalizedPath = path.normalize(filePath);
            if (!normalizedPath.startsWith(CONFIG.PUBLIC_DIR)) {
                throw new Error('Access denied');
            }

            // 检查文件是否存在
            if (!fs.existsSync(normalizedPath)) {
                throw new Error('File not found');
            }

            // 检查是否为目录
            const stats = fs.statSync(normalizedPath);
            if (stats.isDirectory()) {
                // 如果是目录，尝试返回index.html
                const indexPath = path.join(normalizedPath, 'index.html');
                if (fs.existsSync(indexPath)) {
                    return this.sendFile(req, res, indexPath);
                }
                throw new Error('Directory listing not allowed');
            }

            // 从缓存获取
            let content = this.getFromCache(normalizedPath);
            if (!content) {
                // 读取文件
                content = fs.readFileSync(normalizedPath);
                // 添加到缓存
                this.addToCache(normalizedPath, content);
            }

            // 设置响应头
            const mimeType = this.getMimeType(normalizedPath);
            res.writeHead(200, {
                'Content-Type': mimeType,
                'Content-Length': content.length,
                'Cache-Control': `max-age=${CONFIG.MAX_AGE / 1000}`,
                'Last-Modified': stats.mtime.toUTCString(),
                'Server': 'SmartExamSystem/2.0'
            });

            // 发送文件内容
            res.end(content);
            
            // 记录访问日志
            logger.log(`${req.method} ${req.url} 200 ${content.length} ${req.headers['user-agent'] || 'Unknown'}`);
            
        } catch (error) {
            this.handleError(req, res, error);
        }
    }

    // 处理错误
    handleError(req, res, error) {
        let statusCode = 500;
        let message = 'Internal Server Error';

        if (error.message === 'File not found') {
            statusCode = 404;
            message = 'File not found';
        } else if (error.message === 'Access denied') {
            statusCode = 403;
            message = 'Access denied';
        }

        // 记录错误日志
        logger.error(`${req.method} ${req.url} ${statusCode}`, error);

        // 发送错误响应
        res.writeHead(statusCode, {
            'Content-Type': 'text/plain; charset=utf-8',
            'Server': 'SmartExamSystem/2.0'
        });
        res.end(message);
    }
}

const fileServer = new FileServer();

// CORS中间件
function corsMiddleware(req, res, next) {
    const origin = req.headers.origin;
    
    if (CONFIG.CORS.allowOrigins.includes('*') || CONFIG.CORS.allowOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', CONFIG.CORS.allowMethods.join(','));
    res.setHeader('Access-Control-Allow-Headers', CONFIG.CORS.allowHeaders.join(','));
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    next();
}

// 请求处理器
function handleRequest(req, res) {
    // 添加CORS支持
    corsMiddleware(req, res, () => {
        try {
            const parsedUrl = url.parse(req.url);
            let filePath = path.join(CONFIG.PUBLIC_DIR, parsedUrl.pathname);
            
            // 如果路径以/结尾，添加index.html
            if (parsedUrl.pathname.endsWith('/')) {
                filePath = path.join(filePath, 'index.html');
            }

            // 发送文件
            fileServer.sendFile(req, res, filePath);
            
        } catch (error) {
            logger.error('Request handling error', error);
            res.writeHead(500, { 'Content-Type': 'text/plain' });
            res.end('Internal Server Error');
        }
    });
}

// 创建HTTP服务器
const server = http.createServer(handleRequest);

// 服务器状态监控
class ServerMonitor {
    constructor(server) {
        this.server = server;
        this.startTime = Date.now();
        this.requestCount = 0;
        this.errorCount = 0;
        this.uptimeInterval = null;
    }

    start() {
        // 监控服务器状态
        this.server.on('request', () => {
            this.requestCount++;
        });

        this.server.on('error', () => {
            this.errorCount++;
        });

        // 定期输出服务器状态
        this.uptimeInterval = setInterval(() => {
            const uptime = Math.floor((Date.now() - this.startTime) / 1000);
            const hours = Math.floor(uptime / 3600);
            const minutes = Math.floor((uptime % 3600) / 60);
            const seconds = uptime % 60;
            
            logger.log(`🖥️  Server Status - Uptime: ${hours}h ${minutes}m ${seconds}s | Requests: ${this.requestCount} | Errors: ${this.errorCount} | Cache: ${Math.round(fileServer.cacheSize / 1024 / 1024)}MB`);
        }, 3600000); // 每小时输出一次状态
    }

    stop() {
        if (this.uptimeInterval) {
            clearInterval(this.uptimeInterval);
        }
    }
}

const monitor = new ServerMonitor(server);

// 优雅关闭
function gracefulShutdown(signal) {
    logger.log(`🛑 Received ${signal}. Shutting down gracefully...`);
    
    // 停止监控
    monitor.stop();
    
    // 停止接受新连接
    server.close(() => {
        logger.log('✅ HTTP server closed');
        
        // 关闭日志流
        logger.close();
        
        logger.log('👋 All services stopped. Goodbye!');
        process.exit(0);
    });

    // 5秒后强制关闭
    setTimeout(() => {
        logger.error('⚠️  Forcing shutdown after timeout');
        process.exit(1);
    }, 5000);
}

// 监听信号
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// 启动服务器
function startServer() {
    try {
        server.listen(CONFIG.PORT, CONFIG.HOST, () => {
            logger.log('🚀 Smart Exam System Production Server Started');
            logger.log(`📡 Server running at http://${CONFIG.HOST}:${CONFIG.PORT}`);
            logger.log(`📁 Serving files from: ${CONFIG.PUBLIC_DIR}`);
            logger.log(`🔒 CORS enabled for: ${CONFIG.CORS.allowOrigins.join(', ')}`);
            logger.log(`💾 Log files: ${CONFIG.LOG_FILE}, ${CONFIG.ERROR_LOG_FILE}`);
            logger.log(`⚡ Cache size: ${CONFIG.MAX_CACHE_SIZE / 1024 / 1024}MB`);
            logger.log('🔄 Server will auto-restart on crashes');
            logger.log('✨ Production server is ready!');
            
            // 启动监控
            monitor.start();
        });

        // 处理服务器错误
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`❌ Port ${CONFIG.PORT} is already in use. Please choose another port.`);
                process.exit(1);
            } else {
                logger.error('❌ Server error', error);
                process.exit(1);
            }
        });

    } catch (error) {
        logger.error('❌ Failed to start server', error);
        process.exit(1);
    }
}

// 检查public目录是否存在
if (!fs.existsSync(CONFIG.PUBLIC_DIR)) {
    logger.error(`❌ Public directory not found: ${CONFIG.PUBLIC_DIR}`);
    logger.error('Please create the public directory and add your files.');
    process.exit(1);
}

// 检查index.html是否存在
const indexPath = path.join(CONFIG.PUBLIC_DIR, 'index.html');
if (!fs.existsSync(indexPath)) {
    logger.error(`❌ index.html not found in public directory: ${indexPath}`);
    logger.error('Please add index.html to the public directory.');
    process.exit(1);
}

// 启动服务器
startServer();

// 确保进程不会意外退出
process.on('uncaughtException', (error) => {
    logger.error('💥 Uncaught Exception', error);
    // 继续运行，不退出进程
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('💥 Unhandled Promise Rejection', reason);
    // 继续运行，不退出进程
});

// 输出进程信息
logger.log(`📦 Process ID: ${process.pid}`);
logger.log(`🟢 Node.js version: ${process.version}`);
logger.log(`💻 Platform: ${process.platform} ${process.arch}`);
logger.log(`📊 Memory usage: ${Math.round(process.memoryUsage().rss / 1024 / 1024)}MB`);