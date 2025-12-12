const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config/config');

const userSchema = new mongoose.Schema({
  // 基本信息
  username: {
    type: String,
    required: [true, '用户名不能为空'],
    unique: true,
    trim: true,
    minlength: [3, '用户名至少3个字符'],
    maxlength: [20, '用户名最多20个字符'],
    match: [/^[a-zA-Z0-9_\u4e00-\u9fa5]+$/, '用户名只能包含字母、数字、下划线和中文']
  },
  
  email: {
    type: String,
    required: [true, '邮箱不能为空'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, '邮箱格式不正确']
  },
  
  password: {
    type: String,
    required: [true, '密码不能为空'],
    minlength: [6, '密码至少6个字符'],
    maxlength: [128, '密码最多128个字符'],
    select: false // 查询时不返回密码
  },
  
  // 用户角色
  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  
  // 个人信息
  avatar: {
    type: String,
    default: ''
  },
  
  nickname: {
    type: String,
    default: ''
  },
  
  bio: {
    type: String,
    maxlength: [500, '个人简介最多500个字符'],
    default: ''
  },
  
  // 学习偏好
  preferences: {
    theme: {
      type: String,
      enum: ['light', 'dark', 'auto'],
      default: 'light'
    },
    language: {
      type: String,
      enum: ['zh-CN', 'en-US'],
      default: 'zh-CN'
    },
    notifications: {
      type: Boolean,
      default: true
    }
  },
  
  // 安全设置
  security: {
    twoFactorEnabled: {
      type: Boolean,
      default: false
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lastLoginAttempt: {
      type: Date
    },
    lockedUntil: {
      type: Date
    }
  },
  
  // 统计信息
  stats: {
    totalExams: {
      type: Number,
      default: 0
    },
    totalStudyTime: {
      type: Number,
      default: 0 // 单位：秒
    },
    bestScore: {
      type: Number,
      default: 0
    },
    averageScore: {
      type: Number,
      default: 0
    }
  },
  
  // 时间戳
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // 最后登录信息
  lastLogin: {
    date: {
      type: Date
    },
    ip: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  
  // 账户状态
  status: {
    type: String,
    enum: ['active', 'inactive', 'banned', 'deleted'],
    default: 'active'
  },
  
  // 验证状态
  isVerified: {
    type: Boolean,
    default: false
  },
  
  verificationToken: {
    type: String
  },
  
  verificationExpires: {
    type: Date
  },
  
  // 密码重置
  resetPasswordToken: {
    type: String
  },
  
  resetPasswordExpires: {
    type: Date
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    transform: function(doc, ret) {
      // 删除敏感信息
      delete ret.password;
      delete ret.verificationToken;
      delete ret.verificationExpires;
      delete ret.resetPasswordToken;
      delete ret.resetPasswordExpires;
      return ret;
    }
  }
});

// 密码加密中间件
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    return next();
  }
  
  try {
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// 密码验证方法
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw new Error('密码验证失败');
  }
};

// 生成JWT令牌
userSchema.methods.generateToken = function() {
  const payload = {
    id: this._id,
    username: this.username,
    email: this.email,
    role: this.role
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

// 生成刷新令牌
userSchema.methods.generateRefreshToken = function() {
  const payload = {
    id: this._id
  };
  
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

// 检查账户是否被锁定
userSchema.methods.isLocked = function() {
  if (this.security.lockedUntil && this.security.lockedUntil > Date.now()) {
    return true;
  }
  
  // 如果锁定时间已过，重置登录尝试次数
  if (this.security.lockedUntil && this.security.lockedUntil <= Date.now()) {
    this.security.loginAttempts = 0;
    this.security.lockedUntil = null;
    this.markModified('security');
  }
  
  return false;
};

// 增加登录失败次数
userSchema.methods.incrementLoginAttempts = function() {
  this.security.loginAttempts += 1;
  this.security.lastLoginAttempt = Date.now();
  
  // 如果达到最大尝试次数，锁定账户
  if (this.security.loginAttempts >= config.security.maxLoginAttempts) {
    this.security.lockedUntil = Date.now() + config.security.lockoutDuration;
  }
  
  this.markModified('security');
};

// 重置登录失败次数
userSchema.methods.resetLoginAttempts = function() {
  this.security.loginAttempts = 0;
  this.security.lockedUntil = null;
  this.markModified('security');
};

// 更新最后登录信息
userSchema.methods.updateLastLogin = function(ip, userAgent) {
  this.lastLogin = {
    date: Date.now(),
    ip: ip,
    userAgent: userAgent
  };
};

// 更新统计信息
userSchema.methods.updateStats = function(examResult) {
  this.stats.totalExams += 1;
  this.stats.totalStudyTime += examResult.duration;
  
  // 更新最高分
  if (examResult.score > this.stats.bestScore) {
    this.stats.bestScore = examResult.score;
  }
  
  // 更新平均分
  const oldTotalScore = this.stats.averageScore * (this.stats.totalExams - 1);
  this.stats.averageScore = Math.round((oldTotalScore + examResult.score) / this.stats.totalExams);
  
  this.markModified('stats');
};

// 静态方法：根据用户名或邮箱查找用户
userSchema.statics.findByUsernameOrEmail = async function(identifier) {
  return this.findOne({
    $or: [
      { username: identifier },
      { email: identifier.toLowerCase() }
    ]
  }).select('+password');
};

// 静态方法：检查用户名是否存在
userSchema.statics.isUsernameExists = async function(username) {
  const user = await this.findOne({ username });
  return !!user;
};

// 静态方法：检查邮箱是否存在
userSchema.statics.isEmailExists = async function(email) {
  const user = await this.findOne({ email: email.toLowerCase() });
  return !!user;
};

// 静态方法：根据ID查找用户
userSchema.statics.findById = async function(id) {
  return this.findById(id).select('-password');
};

// 静态方法：获取用户列表
userSchema.statics.getUsers = async function({ page = 1, limit = 10, search = '', role = '' }) {
  const query = {
    status: { $ne: 'deleted' }
  };
  
  if (search) {
    query.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }
  
  if (role) {
    query.role = role;
  }
  
  const users = await this.find(query)
    .select('-password')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort({ createdAt: -1 });
  
  const total = await this.countDocuments(query);
  
  return {
    users,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

const User = mongoose.model('User', userSchema);

module.exports = User;