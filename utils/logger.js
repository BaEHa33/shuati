const winston = require('winston');
const path = require('path');
const config = require('../config/config');

// 创建日志目录
const logDir = path.join(process.cwd(), 'logs');
const fs = require('fs');

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// 日志格式
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    const metaString = Object.keys(meta).length > 0 
      ? ` ${JSON.stringify(meta)}` 
      : '';
    
    return `${timestamp} [${level.toUpperCase()}] ${stack || message}${metaString}`;
  })
);

// 控制台日志格式（彩色）
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, stack }) => {
    return `${timestamp} ${level}: ${stack || message}`;
  })
);

// 创建logger实例
const logger = winston.createLogger({
  level: config.logger.level,
  format: logFormat,
  defaultMeta: { service: 'exam-system' },
  transports: [
    // 错误日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // 所有日志文件
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      maxsize: 20 * 1024 * 1024, // 20MB
      maxFiles: 10,
      tailable: true
    }),
    
    // 控制台输出
    new winston.transports.Console({
      format: consoleFormat,
      level: 'info'
    })
  ],
  
  // 异常处理
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'exceptions.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ],
  
  // 未捕获的Promise拒绝
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logDir, 'rejections.log'),
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    new winston.transports.Console({
      format: consoleFormat
    })
  ]
});

// 开发环境下添加debug日志
if (config.server.env === 'development') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// 生产环境下添加HTTP请求日志
if (config.server.env === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(logDir, 'http.log'),
    level: 'info',
    maxsize: 30 * 1024 * 1024,
    maxFiles: 15,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

// 日志包装函数
const logWrapper = {
  debug: (message, meta) => logger.debug(message, meta),
  info: (message, meta) => logger.info(message, meta),
  warn: (message, meta) => logger.warn(message, meta),
  error: (message, meta) => logger.error(message, meta),
  fatal: (message, meta) => logger.error(message, { ...meta, fatal: true }),
  
  // 带上下文的日志
  withContext: (context) => ({
    debug: (message, meta) => logger.debug(message, { ...meta, context }),
    info: (message, meta) => logger.info(message, { ...meta, context }),
    warn: (message, meta) => logger.warn(message, { ...meta, context }),
    error: (message, meta) => logger.error(message, { ...meta, context }),
    fatal: (message, meta) => logger.error(message, { ...meta, context, fatal: true })
  }),
  
  // HTTP请求日志
  http: (req, res, meta) => {
    const logData = {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      responseTime: Date.now() - (req.startTime || Date.now()),
      ...meta
    };
    
    if (res.statusCode >= 500) {
      logger.error('HTTP Request', logData);
    } else if (res.statusCode >= 400) {
      logger.warn('HTTP Request', logData);
    } else {
      logger.info('HTTP Request', logData);
    }
  },
  
  // 数据库操作日志
  db: (operation, model, duration, meta) => {
    const logData = {
      operation,
      model,
      duration,
      ...meta
    };
    
    if (duration > 1000) { // 慢查询警告
      logger.warn('Database Operation', logData);
    } else {
      logger.debug('Database Operation', logData);
    }
  },
  
  // 认证日志
  auth: (action, userId, success, meta) => {
    const logData = {
      action,
      userId,
      success,
      timestamp: new Date().toISOString(),
      ...meta
    };
    
    if (!success) {
      logger.warn('Authentication', logData);
    } else {
      logger.info('Authentication', logData);
    }
  },
  
  // 错误日志增强
  errorWithDetails: (error, context, meta) => {
    const errorData = {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code,
      status: error.status,
      context,
      ...meta
    };
    
    logger.error('Error', errorData);
  }
};

// 导出logger
module.exports = logWrapper;

// 替换console.log
if (config.server.env !== 'development') {
  console.log = (...args) => logger.info(args.join(' '));
  console.warn = (...args) => logger.warn(args.join(' '));
  console.error = (...args) => logger.error(args.join(' '));
  console.debug = (...args) => logger.debug(args.join(' '));
}