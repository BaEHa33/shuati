const jwt = require('jsonwebtoken');
const config = require('../config/config');
const logger = require('../utils/logger');
const User = require('../models/User');

// JWT认证中间件
const authMiddleware = {
  // 验证JWT令牌
  verifyToken: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
          success: false,
          message: '缺少认证令牌',
          code: 'MISSING_TOKEN'
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      try {
        const decoded = jwt.verify(token, config.jwt.secret);
        req.user = decoded;
        next();
      } catch (error) {
        if (error.name === 'TokenExpiredError') {
          return res.status(401).json({
            success: false,
            message: '令牌已过期',
            code: 'TOKEN_EXPIRED'
          });
        } else if (error.name === 'JsonWebTokenError') {
          return res.status(401).json({
            success: false,
            message: '无效的令牌',
            code: 'INVALID_TOKEN'
          });
        } else {
          throw error;
        }
      }
    } catch (error) {
      logger.errorWithDetails(error, 'auth.verifyToken', {
        method: req.method,
        url: req.url,
        ip: req.ip
      });
      
      return res.status(500).json({
        success: false,
        message: '认证失败',
        code: 'AUTHENTICATION_FAILED'
      });
    }
  },
  
  // 验证用户是否存在
  verifyUser: async (req, res, next) => {
    try {
      const user = await User.findById(req.user.id);
      
      if (!user) {
        return res.status(404).json({
          success: false,
          message: '用户不存在',
          code: 'USER_NOT_FOUND'
        });
      }
      
      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: '账户已被禁用',
          code: 'ACCOUNT_DISABLED'
        });
      }
      
      req.user = {
        ...req.user,
        role: user.role,
        status: user.status
      };
      
      next();
    } catch (error) {
      logger.errorWithDetails(error, 'auth.verifyUser', {
        userId: req.user.id
      });
      
      return res.status(500).json({
        success: false,
        message: '验证用户失败',
        code: 'USER_VERIFICATION_FAILED'
      });
    }
  },
  
  // 验证管理员权限
  verifyAdmin: (req, res, next) => {
    try {
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: '需要管理员权限',
          code: 'ADMIN_ACCESS_REQUIRED'
        });
      }
      
      next();
    } catch (error) {
      logger.errorWithDetails(error, 'auth.verifyAdmin', {
        userId: req.user.id,
        userRole: req.user.role
      });
      
      return res.status(500).json({
        success: false,
        message: '权限验证失败',
        code: 'PERMISSION_VERIFICATION_FAILED'
      });
    }
  },
  
  // 可选的认证中间件（不强制要求登录）
  optionalAuth: async (req, res, next) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.split(' ')[1];
        
        try {
          const decoded = jwt.verify(token, config.jwt.secret);
          const user = await User.findById(decoded.id);
          
          if (user && user.status === 'active') {
            req.user = {
              ...decoded,
              role: user.role,
              status: user.status
            };
          }
        } catch (error) {
          // 令牌无效时不影响请求继续
          logger.debug('Optional auth token invalid', {
            error: error.message,
            url: req.url
          });
        }
      }
      
      next();
    } catch (error) {
      logger.errorWithDetails(error, 'auth.optionalAuth', {
        url: req.url
      });
      
      // 即使出错也继续处理请求
      next();
    }
  },
  
  // 限流中间件
  rateLimit: (limit = 100, windowMs = 15 * 60 * 1000) => {
    const requests = new Map();
    
    return (req, res, next) => {
      const ip = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // 清理过期的请求记录
      if (requests.has(ip)) {
        const userRequests = requests.get(ip).filter(time => time > windowStart);
        requests.set(ip, userRequests);
      }
      
      // 检查请求次数
      const userRequests = requests.get(ip) || [];
      if (userRequests.length >= limit) {
        return res.status(429).json({
          success: false,
          message: '请求过于频繁，请稍后再试',
          code: 'RATE_LIMIT_EXCEEDED'
        });
      }
      
      // 记录新请求
      userRequests.push(now);
      requests.set(ip, userRequests);
      
      // 设置响应头
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', limit - userRequests.length);
      res.setHeader('X-RateLimit-Reset', windowStart + windowMs);
      
      next();
    };
  },
  
  // CORS中间件
  cors: (req, res, next) => {
    const origin = req.headers.origin;
    
    if (config.cors.origin.includes('*') || config.cors.origin.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin || '*');
    }
    
    res.setHeader('Access-Control-Allow-Methods', config.cors.methods.join(','));
    res.setHeader('Access-Control-Allow-Headers', config.cors.allowedHeaders.join(','));
    res.setHeader('Access-Control-Allow-Credentials', config.cors.credentials.toString());
    res.setHeader('Access-Control-Max-Age', '86400'); // 24小时
    
    if (req.method === 'OPTIONS') {
      return res.status(204).end();
    }
    
    next();
  },
  
  // 安全头中间件
  securityHeaders: (req, res, next) => {
    // 防止XSS攻击
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // 防止点击劫持
    res.setHeader('X-Frame-Options', 'DENY');
    
    // 防止MIME类型嗅探
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // 内容安全策略
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https://cdn.jsdelivr.net; font-src 'self' https://cdn.jsdelivr.net; connect-src 'self'");
    
    // 严格传输安全
    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    
    next();
  },
  
  // 请求日志中间件
  requestLogger: (req, res, next) => {
    // 记录请求开始时间
    req.startTime = Date.now();
    
    // 拦截响应
    const originalSend = res.send;
    res.send = function(body) {
      // 记录HTTP请求日志
      logger.http(req, res, {
        responseBody: typeof body === 'string' ? body : JSON.stringify(body)
      });
      
      return originalSend.call(this, body);
    };
    
    next();
  },
  
  // 错误处理中间件
  errorHandler: (err, req, res, next) => {
    logger.errorWithDetails(err, 'middleware.errorHandler', {
      method: req.method,
      url: req.url,
      userId: req.user?.id
    });
    
    // 处理不同类型的错误
    if (err.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        code: 'VALIDATION_ERROR',
        errors: Object.values(err.errors).map(e => e.message)
      });
    }
    
    if (err.name === 'MongoError' && err.code === 11000) {
      return res.status(409).json({
        success: false,
        message: '资源已存在',
        code: 'RESOURCE_CONFLICT',
        field: Object.keys(err.keyValue)[0]
      });
    }
    
    if (err.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: '无效的ID格式',
        code: 'INVALID_ID_FORMAT'
      });
    }
    
    if (err.status) {
      return res.status(err.status).json({
        success: false,
        message: err.message || '请求失败',
        code: err.code || 'REQUEST_FAILED'
      });
    }
    
    // 默认500错误
    return res.status(500).json({
      success: false,
      message: '服务器内部错误',
      code: 'INTERNAL_SERVER_ERROR'
    });
  },
  
  // 404处理中间件
  notFound: (req, res, next) => {
    return res.status(404).json({
      success: false,
      message: '请求的资源不存在',
      code: 'RESOURCE_NOT_FOUND',
      path: req.url
    });
  }
};

module.exports = authMiddleware;