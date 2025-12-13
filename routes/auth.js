const express = require('express');
const router = express.Router();
const User = require('../models/User');
const UserData = require('../models/UserData');
const { generateToken } = require('../config/jwt');
const { protect } = require('../middleware/auth');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimit');

// @route   POST /api/auth/register
// @desc    用户注册
// @access  Public
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { username, password, email } = req.body;

    // 验证输入
    if (!username || !password || !email) {
      return res.status(400).json({
        success: false,
        message: '请填写所有必填字段'
      });
    }

    // 检查用户名是否已存在
    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: '用户名已存在'
      });
    }

    // 检查邮箱是否已存在
    const existingEmail = await User.findOne({ email });
    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: '邮箱已被注册'
      });
    }

    // 创建新用户
    const user = await User.create({
      username,
      password,
      email
    });

    // 创建用户数据
    const userData = await UserData.create({
      userId: user._id
    });

    // 生成token
    const token = generateToken(user._id, user.role);

    // 更新最后登录时间
    user.lastLogin = Date.now();
    await user.save();

    res.status(201).json({
      success: true,
      message: '注册成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('注册错误:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/auth/login
// @desc    用户登录
// @access  Public
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { username, password } = req.body;

    // 验证输入
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: '请填写用户名和密码'
      });
    }

    // 查找用户
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 检查用户是否被禁用
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: '账号已被禁用'
      });
    }

    // 验证密码
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '用户名或密码错误'
      });
    }

    // 生成token
    const token = generateToken(user._id, user.role);

    // 更新最后登录时间
    user.lastLogin = Date.now();
    await user.save();

    res.json({
      success: true,
      message: '登录成功',
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    用户登出
// @access  Private
router.post('/logout', protect, (req, res) => {
  try {
    // 清除cookie（如果使用cookie存储token）
    res.clearCookie('token');
    
    res.json({
      success: true,
      message: '登出成功'
    });
  } catch (error) {
    console.error('登出错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/auth/user
// @desc    获取当前用户信息
// @access  Private
router.get('/user', protect, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        settings: user.settings,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('获取用户信息错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   PUT /api/auth/user
// @desc    更新用户信息
// @access  Private
router.put('/user', protect, async (req, res) => {
  try {
    const { email, settings } = req.body;

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 更新邮箱
    if (email && email !== user.email) {
      // 检查邮箱是否已被使用
      const existingEmail = await User.findOne({ email, _id: { $ne: req.userId } });
      if (existingEmail) {
        return res.status(400).json({
          success: false,
          message: '邮箱已被其他用户使用'
        });
      }
      user.email = email;
    }

    // 更新设置
    if (settings) {
      user.settings = {
        ...user.settings,
        ...settings
      };
    }

    await user.save();

    res.json({
      success: true,
      message: '用户信息更新成功',
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        settings: user.settings
      }
    });
  } catch (error) {
    console.error('更新用户信息错误:', error);
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    修改密码
// @access  Private
router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: '请填写当前密码和新密码'
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: '新密码至少6个字符'
      });
    }

    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: '用户不存在'
      });
    }

    // 验证当前密码
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: '当前密码错误'
      });
    }

    // 更新密码
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功'
    });
  } catch (error) {
    console.error('修改密码错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

module.exports = router;