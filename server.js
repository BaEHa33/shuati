const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');
const { connectDB, disconnectDB } = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimit');

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API路由
app.use('/api/auth', require('./routes/auth'));
app.use('/api/questions', require('./routes/questions'));
app.use('/api/mistakes', require('./routes/mistakes'));
app.use('/api/stats', require('./routes/stats'));

// 根路径响应
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '智能刷题系统 API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      questions: '/api/questions',
      mistakes: '/api/mistakes',
      stats: '/api/stats'
    }
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error('全局错误:', err);
  res.status(500).json({
    success: false,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    // 连接数据库
    await connectDB();
    
    // 创建uploads目录
    const uploadsDir = path.join(__dirname, 'uploads');
    const fs = require('fs');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    // 启动服务器并返回server实例
    const server = app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log(`API文档: http://localhost:${PORT}/`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
    });

    return server;

  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
};

// 优雅关闭
const gracefulShutdown = async (server) => {
  console.log('正在关闭服务器...');
  try {
    // 断开数据库连接
    await disconnectDB();
    console.log('数据库连接已断开');
    
    // 关闭服务器
    server.close(() => {
      console.log('服务器已关闭');
      process.exit(0);
    });
  } catch (error) {
    console.error('关闭服务器时出错:', error);
    process.exit(1);
  }
};

// 启动服务器
startServer().then(server => {
  // 监听信号
  process.on('SIGINT', () => gracefulShutdown(server));
  process.on('SIGTERM', () => gracefulShutdown(server));
});

module.exports = app;