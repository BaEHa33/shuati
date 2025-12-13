const dotenv = require('dotenv');
const path = require('path');

// 加载环境变量
dotenv.config({
  path: path.resolve(process.cwd(), '.env')
});

const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },
  
  // 数据库配置
  database: {
    url: process.env.DATABASE_URL || 'mongodb://localhost:27017/exam-system',
    options: {
      useNewUrlParser: true,
      useUnifiedTopology: true
    }
  },
  
  // JWT配置
  jwt: {
    secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
  },
  
  // 安全配置
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS) || 10,
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: parseInt(process.env.LOCKOUT_DURATION) || 300000 // 5分钟
  },
  
  // 文件上传配置
  upload: {
    directory: process.env.UPLOAD_DIR || 'uploads',
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
  },
  
  // 速率限制配置
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    standardHeaders: true,
    legacyHeaders: false
  },
  
  // 日志配置
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || 'app.log'
  },
  
  // 邮件配置
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    secure: process.env.EMAIL_SECURE === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    },
    from: process.env.EMAIL_FROM || 'noreply@example.com'
  },
  
  // 跨域配置
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : ['*'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'Content-Type', 'Accept', 'Authorization']
  }
};

// 开发环境特定配置
if (config.server.env === 'development') {
  config.database.url = process.env.DEV_DATABASE_URL || 'mongodb://localhost:27017/exam-system-dev';
}

// 生产环境特定配置
if (config.server.env === 'production') {
  config.logger.level = 'warn';
  config.cors.origin = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : [];
}

module.exports = config;