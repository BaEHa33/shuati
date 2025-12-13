const express = require('express');
const router = express.Router();
const Question = require('../models/Question');
const UserData = require('../models/UserData');
const { protect, authorize } = require('../middleware/auth');
const { apiLimiter, uploadLimiter } = require('../middleware/rateLimit');

// @route   GET /api/questions/public
// @desc    获取共享题库
// @access  Public
router.get('/public', apiLimiter, async (req, res) => {
  try {
    const { type, difficulty, tags, search, page = 1, limit = 20 } = req.query;

    const query = { 
      isPublic: true,
      approved: true
    };

    // 按题型筛选
    if (type) {
      query.type = type;
    }

    // 按难度筛选
    if (difficulty) {
      query.difficulty = parseInt(difficulty);
    }

    // 按标签筛选
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      query.tags = { $in: tagArray };
    }

    // 搜索题目内容
    if (search) {
      query.content = { $regex: search, $options: 'i' };
    }

    // 分页
    const skip = (page - 1) * limit;

    // 查询题目
    const questions = await Question.find(query)
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 })
      .populate('createdBy', 'username email');

    // 获取总数
    const total = await Question.countDocuments(query);

    res.json({
      success: true,
      data: questions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取共享题库错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/questions/public/:id
// @desc    获取特定共享题目
// @access  Public
router.get('/public/:id', apiLimiter, async (req, res) => {
  try {
    const question = await Question.findOne({
      id: req.params.id,
      isPublic: true,
      approved: true
    }).populate('createdBy', 'username email');

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 增加使用次数
    question.incrementUsage();

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('获取题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/questions/public
// @desc    提交新题目到共享题库
// @access  Private
router.post('/public', protect, apiLimiter, async (req, res) => {
  try {
    const { id, type, content, options, answer, analysis, difficulty, tags } = req.body;

    // 验证输入
    if (!type || !content || answer === undefined) {
      return res.status(400).json({
        success: false,
        message: '请填写必要的题目信息'
      });
    }

    // 验证选择题必须有选项
    if (['single', 'multiple', 'judge'].includes(type)) {
      if (!options || options.length === 0) {
        return res.status(400).json({
          success: false,
          message: '选择题必须有选项'
        });
      }
    }

    // 创建题目
    const question = await Question.create({
      id: id || `public_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      options: options || [],
      answer,
      analysis: analysis || '',
      difficulty: difficulty || 2,
      tags: tags || [],
      createdBy: req.userId,
      isPublic: true,
      approved: req.userRole === 'admin' // 管理员直接通过审核
    });

    res.status(201).json({
      success: true,
      message: req.userRole === 'admin' ? '题目发布成功' : '题目提交成功，等待审核',
      data: question
    });
  } catch (error) {
    console.error('提交题目错误:', error);
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

// @route   PUT /api/questions/public/:id
// @desc    更新共享题目
// @access  Private (仅创建者或管理员)
router.put('/public/:id', protect, apiLimiter, async (req, res) => {
  try {
    const { type, content, options, answer, analysis, difficulty, tags } = req.body;

    const question = await Question.findOne({
      id: req.params.id,
      isPublic: true
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 检查权限
    if (question.createdBy.toString() !== req.userId.toString() && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权修改此题目'
      });
    }

    // 更新题目
    const updates = {
      type,
      content,
      options: options || [],
      answer,
      analysis: analysis || '',
      difficulty: difficulty || 2,
      tags: tags || []
    };

    // 如果不是管理员修改，需要重新审核
    if (req.userRole !== 'admin' && question.approved) {
      updates.approved = false;
      updates.approvedBy = null;
      updates.approvedAt = null;
    }

    const updatedQuestion = await Question.findOneAndUpdate(
      { id: req.params.id },
      updates,
      { new: true, runValidators: true }
    );

    res.json({
      success: true,
      message: req.userRole !== 'admin' && question.approved ? '题目已更新，等待重新审核' : '题目更新成功',
      data: updatedQuestion
    });
  } catch (error) {
    console.error('更新题目错误:', error);
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

// @route   DELETE /api/questions/public/:id
// @desc    删除共享题目
// @access  Private (仅创建者或管理员)
router.delete('/public/:id', protect, apiLimiter, async (req, res) => {
  try {
    const question = await Question.findOne({
      id: req.params.id,
      isPublic: true
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 检查权限
    if (question.createdBy.toString() !== req.userId.toString() && req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '无权删除此题目'
      });
    }

    await Question.deleteOne({ id: req.params.id });

    res.json({
      success: true,
      message: '题目删除成功'
    });
  } catch (error) {
    console.error('删除题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/questions/public/:id/approve
// @desc    审核题目
// @access  Private (仅管理员)
router.post('/public/:id/approve', protect, authorize('admin'), apiLimiter, async (req, res) => {
  try {
    const { approved } = req.body;

    const question = await Question.findOne({
      id: req.params.id,
      isPublic: true
    });

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    if (question.approved === approved) {
      return res.status(400).json({
        success: false,
        message: `题目已经${approved ? '通过' : '拒绝'}审核`
      });
    }

    question.approved = approved;
    question.approvedBy = req.userId;
    question.approvedAt = Date.now();

    await question.save();

    res.json({
      success: true,
      message: `题目${approved ? '通过' : '拒绝'}审核成功`,
      data: question
    });
  } catch (error) {
    console.error('审核题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/questions/personal
// @desc    获取个人题库
// @access  Private
router.get('/personal', protect, apiLimiter, async (req, res) => {
  try {
    const { type, difficulty, tags, search, page = 1, limit = 20 } = req.query;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    let questions = userData.personalQuestions;

    // 按题型筛选
    if (type) {
      questions = questions.filter(q => q.type === type);
    }

    // 按难度筛选
    if (difficulty) {
      questions = questions.filter(q => q.difficulty === parseInt(difficulty));
    }

    // 按标签筛选
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      questions = questions.filter(q => 
        q.tags.some(tag => tagArray.includes(tag))
      );
    }

    // 搜索题目内容
    if (search) {
      questions = questions.filter(q => 
        q.content.toLowerCase().includes(search.toLowerCase())
      );
    }

    // 分页
    const total = questions.length;
    const skip = (page - 1) * limit;
    const paginatedQuestions = questions.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginatedQuestions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取个人题库错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/questions/personal/:id
// @desc    获取特定个人题目
// @access  Private
router.get('/personal/:id', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const question = userData.personalQuestions.find(q => q.id === req.params.id);

    if (!question) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 增加使用次数
    question.usageCount += 1;
    await userData.save();

    res.json({
      success: true,
      data: question
    });
  } catch (error) {
    console.error('获取个人题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/questions/personal
// @desc    添加个人题目
// @access  Private
router.post('/personal', protect, apiLimiter, async (req, res) => {
  try {
    const { id, type, content, options, answer, analysis, difficulty, tags } = req.body;

    // 验证输入
    if (!type || !content || answer === undefined) {
      return res.status(400).json({
        success: false,
        message: '请填写必要的题目信息'
      });
    }

    // 验证选择题必须有选项
    if (['single', 'multiple', 'judge'].includes(type)) {
      if (!options || options.length === 0) {
        return res.status(400).json({
          success: false,
          message: '选择题必须有选项'
        });
      }
    }

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    // 创建题目
    const newQuestion = {
      id: id || `personal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      content,
      options: options || [],
      answer,
      analysis: analysis || '',
      difficulty: difficulty || 2,
      tags: tags || [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      usageCount: 0
    };

    userData.personalQuestions.push(newQuestion);
    await userData.save();

    res.status(201).json({
      success: true,
      message: '题目添加成功',
      data: newQuestion
    });
  } catch (error) {
    console.error('添加个人题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   PUT /api/questions/personal/:id
// @desc    更新个人题目
// @access  Private
router.put('/personal/:id', protect, apiLimiter, async (req, res) => {
  try {
    const { type, content, options, answer, analysis, difficulty, tags } = req.body;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const questionIndex = userData.personalQuestions.findIndex(q => q.id === req.params.id);

    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    // 更新题目
    const question = userData.personalQuestions[questionIndex];
    question.type = type;
    question.content = content;
    question.options = options || [];
    question.answer = answer;
    question.analysis = analysis || '';
    question.difficulty = difficulty || 2;
    question.tags = tags || [];
    question.updatedAt = Date.now();

    await userData.save();

    res.json({
      success: true,
      message: '题目更新成功',
      data: question
    });
  } catch (error) {
    console.error('更新个人题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   DELETE /api/questions/personal/:id
// @desc    删除个人题目
// @access  Private
router.delete('/personal/:id', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const questionIndex = userData.personalQuestions.findIndex(q => q.id === req.params.id);

    if (questionIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '题目不存在'
      });
    }

    userData.personalQuestions.splice(questionIndex, 1);
    await userData.save();

    res.json({
      success: true,
      message: '题目删除成功'
    });
  } catch (error) {
    console.error('删除个人题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/questions/batch/personal
// @desc    批量添加个人题目
// @access  Private
router.post('/batch/personal', protect, uploadLimiter, async (req, res) => {
  try {
    const { questions } = req.body;

    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供有效的题目数组'
      });
    }

    // 限制批量添加数量
    if (questions.length > 100) {
      return res.status(400).json({
        success: false,
        message: '一次最多添加100道题目'
      });
    }

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const validQuestions = [];
    const errors = [];

    // 验证每道题目
    questions.forEach((q, index) => {
      try {
        if (!q.type || !q.content || q.answer === undefined) {
          errors.push(`第${index + 1}题：缺少必要信息`);
          return;
        }

        if (['single', 'multiple', 'judge'].includes(q.type)) {
          if (!q.options || q.options.length === 0) {
            errors.push(`第${index + 1}题：选择题必须有选项`);
            return;
          }
        }

        const newQuestion = {
          id: `personal_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 6)}`,
          type: q.type,
          content: q.content,
          options: q.options || [],
          answer: q.answer,
          analysis: q.analysis || '',
          difficulty: q.difficulty || 2,
          tags: q.tags || [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          usageCount: 0
        };

        validQuestions.push(newQuestion);
      } catch (error) {
        errors.push(`第${index + 1}题：格式错误 - ${error.message}`);
      }
    });

    // 添加有效题目
    if (validQuestions.length > 0) {
      userData.personalQuestions.push(...validQuestions);
      await userData.save();
    }

    res.json({
      success: true,
      message: `成功添加${validQuestions.length}道题目，${errors.length}道题目添加失败`,
      data: {
        addedCount: validQuestions.length,
        errorCount: errors.length,
        errors: errors
      }
    });
  } catch (error) {
    console.error('批量添加个人题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

module.exports = router;