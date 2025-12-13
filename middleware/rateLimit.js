const rateLimit = require('express-rate-limit');

// 通用API限制
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 每个IP限制请求数
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '请求过于频繁，请稍后再试'
  },
  skipSuccessfulRequests: false
});

// 登录限制
const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 5, // 最多5次登录尝试
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '登录失败次数过多，请1小时后再试'
  }
});

// 注册限制
const registerLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24小时
  max: 3, // 每个IP最多3个注册
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '注册次数过多，请24小时后再试'
  }
});

// 重置密码限制
const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 3, // 最多3次重置密码
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '重置密码次数过多，请1小时后再试'
  }
});

// 文件上传限制
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1小时
  max: 10, // 最多10次上传
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: '文件上传次数过多，请1小时后再试'
  }
});

module.exports = {
  apiLimiter,
  loginLimiter,
  registerLimiter,
  resetPasswordLimiter,
  uploadLimiter
};