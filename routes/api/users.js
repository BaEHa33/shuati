const express = require('express');
const router = express.Router();
const User = require('../../models/User');
const authMiddleware = require('../../middleware/auth');
const logger = require('../../utils/logger');

// 用户认证相关路由
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    // 验证输入
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: '请填写所有必填字段',
        code: 'MISSING_FIELDS'
      });
    }
    
    // 检查用户名是否已存在
    const usernameExists = await User.isUsernameExists(username);
    if (usernameExists) {
      return res.status(409).json({
        success: false,
        message: '用户名已存在',
        code: 'USERNAME_EXISTS'
      });
    }
    
    // 检查邮箱是否已存在
    const emailExists = await User.isEmailExists(email);
    if (emailExists) {
      return res.status(409).json({
        success: false,
        message: '邮箱已存在',
        code: 'EMAIL_EXISTS'
      });
    }
    
    // 创建新用户
    const user = new User({
      username,
      email,
      password
    });
    
    await user.save();
    
    // 生成JWT令牌
    const token = user.generateToken();
    
    logger.auth('register', user._id, true, {
      username,
      email
    });
    
    res.status(201).json({
      success: true,
      message: '注册成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          createdAt: user.createdAt
        },
        token
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'users.register', {
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: '注册失败',
      code: 'REGISTRATION_FAILED'
    });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    
    // 验证输入
    if (!identifier || !password) {
      return res.status(400).json({
        success: false,
        message: '请填写用户名/邮箱和密码',
        code: 'MISSING_CREDENTIALS'
      });
    }
    
    // 查找用户
    const user = await User.findByUsernameOrEmail(identifier);
    
    if (!user) {
      logger.auth('login', null, false, {
        identifier,
        reason: 'user_not_found'
      });
      
      return res.status(401).json({
        success: false,
        message: '用户名/邮箱或密码错误',
        code: 'INVALID_CREDENTIALS'
      });
    }
    
    // 检查账户状态
    if (user.status !== 'active') {
      logger.auth('login', user._id, false, {
        username: user.username,
        reason: 'account_disabled'
      });
      
      return res.status(403).json({
        success: false,
        message: '账户已被禁用',
        code: 'ACCOUNT_DISABLED'
      });
    }
    
    // 检查账户是否被锁定
    if (user.isLocked()) {
      logger.auth('login', user._id, false, {
        username: user.username,
        reason: 'account_locked'
      });
      
      return res.status(403).json({
        success: false,
        message: '账户已被锁定，请稍后再试',
        code: 'ACCOUNT_LOCKED',
        lockedUntil: user.security.lockedUntil
      });
    }
    
    // 验证密码
    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      // 增加登录失败次数
      user.incrementLoginAttempts();
      await user.save();
      
      logger.auth('login', user._id, false, {
        username: user.username,
        reason: 'invalid_password',
        loginAttempts: user.security.loginAttempts
      });
      
      return res.status(401).json({
        success: false,
        message: '用户名/邮箱或密码错误',
        code: 'INVALID_CREDENTIALS',
        loginAttempts: user.security.loginAttempts
      });
    }
    
    // 重置登录失败次数
    user.resetLoginAttempts();
    
    // 更新最后登录信息
    user.updateLastLogin(req.ip, req.headers['user-agent']);
    
    await user.save();
    
    // 生成JWT令牌
    const token = user.generateToken();
    
    logger.auth('login', user._id, true, {
      username: user.username,
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    res.json({
      success: true,
      message: '登录成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          nickname: user.nickname,
          preferences: user.preferences,
          stats: user.stats,
          lastLogin: user.lastLogin
        },
        token
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'users.login', {
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: '登录失败',
      code: 'LOGIN_FAILED'
    });
  }
});

// 需要认证的路由
router.use(authMiddleware.verifyToken);
router.use(authMiddleware.verifyUser);

router.get('/profile', async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }
    
    res.json({
      success: true,
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatar: user.avatar,
          nickname: user.nickname,
          bio: user.bio,
          preferences: user.preferences,
          stats: user.stats,
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'users.getProfile', {
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: '获取用户信息失败',
      code: 'GET_PROFILE_FAILED'
    });
  }
});

router.put('/profile', async (req, res) => {
  try {
    const { nickname, bio, preferences } = req.body;
    
    const user = await User.findById(req.user.id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // 更新用户信息
    if (nickname !== undefined) user.nickname = nickname;
    if (bio !== undefined) user.bio = bio;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    
    await user.save();
    
    logger.info('User profile updated', {
      userId: user._id,
      username: user.username
    });
    
    res.json({
      success: true,
      message: '个人信息更新成功',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          nickname: user.nickname,
          bio: user.bio,
          preferences: user.preferences,
          updatedAt: user.updatedAt
        }
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'users.updateProfile', {
      userId: req.user.id,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      message: '更新个人信息失败',
      code: 'UPDATE_PROFILE_FAILED'
    });
  }
});

router.put('/password', async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请提供当前密码和新密码',
        code: 'MISSING_PASSWORD_FIELDS'
      });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码至少需要6个字符',
        code: 'PASSWORD_TOO_SHORT'
      });
    }
    
    const user = await User.findById(req.user.id).select('+password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在',
        code: 'USER_NOT_FOUND'
      });
    }
    
    // 验证当前密码
    const isPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: '当前密码错误',
        code: 'INVALID_CURRENT_PASSWORD'
      });
    }
    
    // 更新密码
    user.password = newPassword;
    await user.save();
    
    logger.info('User password changed', {
      userId: user._id,
      username: user.username
    });
    
    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    logger.errorWithDetails(error, 'users.changePassword', {
      userId: req.user.id
    });
    
    res.status(500).json({
      success: false,
      message: '修改密码失败',
      code: 'CHANGE_PASSWORD_FAILED'
    });
  }
});

router.post('/logout', (req, res) => {
  // JWT是无状态的，客户端删除token即可
  // 这里可以实现token黑名单功能
  res.json({
    success: true,
    message: '退出登录成功'
  });
});

// 管理员路由
router.get('/admin/users', authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, search = '', role = '' } = req.query;
    
    const result = await User.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      role
    });
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.errorWithDetails(error, 'users.getUsers', {
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      message: '获取用户列表失败',
      code: 'GET_USERS_FAILED'
    });
  }
});

module.exports = router;