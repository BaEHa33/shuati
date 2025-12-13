const express = require('express');
const router = express.Router();
const UserData = require('../models/UserData');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

// @route   GET /api/mistakes
// @desc    获取错题本
// @access  Private
router.get('/', protect, apiLimiter, async (req, res) => {
  try {
    const { type, isImportant, timeRange, tags, search, page = 1, limit = 20 } = req.query;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    let mistakes = userData.mistakeBank;

    // 按题型筛选
    if (type) {
      mistakes = mistakes.filter(m => m.type === type);
    }

    // 按重要性筛选
    if (isImportant === 'true') {
      mistakes = mistakes.filter(m => m.isImportant);
    }

    // 按时间范围筛选
    if (timeRange) {
      const now = new Date();
      const filterDate = new Date();
      
      switch (timeRange) {
        case 'today':
          filterDate.setDate(now.getDate() - 1);
          break;
        case 'week':
          filterDate.setDate(now.getDate() - 7);
          break;
        case 'month':
          filterDate.setMonth(now.getMonth() - 1);
          break;
        case 'year':
          filterDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      
      mistakes = mistakes.filter(m => new Date(m.mistakeTime) >= filterDate);
    }

    // 按标签筛选
    if (tags) {
      const tagArray = tags.split(',').map(tag => tag.trim());
      mistakes = mistakes.filter(m => 
        m.tags.some(tag => tagArray.includes(tag))
      );
    }

    // 搜索内容
    if (search) {
      mistakes = mistakes.filter(m => 
        m.content.toLowerCase().includes(search.toLowerCase()) ||
        (m.analysis && m.analysis.toLowerCase().includes(search.toLowerCase()))
      );
    }

    // 按错误时间倒序排序
    mistakes.sort((a, b) => new Date(b.mistakeTime) - new Date(a.mistakeTime));

    // 分页
    const total = mistakes.length;
    const skip = (page - 1) * limit;
    const paginatedMistakes = mistakes.slice(skip, skip + parseInt(limit));

    // 获取错题统计
    const stats = userData.getMistakeStats();

    res.json({
      success: true,
      data: paginatedMistakes,
      stats: stats,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取错题本错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/mistakes/:id
// @desc    获取特定错题
// @access  Private
router.get('/:id', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const mistake = userData.mistakeBank.find(m => m.id === req.params.id);

    if (!mistake) {
      return res.status(404).json({
        success: false,
        message: '错题不存在'
      });
    }

    res.json({
      success: true,
      data: mistake
    });
  } catch (error) {
    console.error('获取错题错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/mistakes
// @desc    添加错题
// @access  Private
router.post('/', protect, apiLimiter, async (req, res) => {
  try {
    const { 
      questionId, 
      isPublic, 
      content, 
      type, 
      options, 
      answer, 
      wrongAnswer, 
      analysis, 
      tags 
    } = req.body;

    // 验证输入
    if (!content || !type || answer === undefined || wrongAnswer === undefined) {
      return res.status(400).json({
        success: false,
        message: '请填写必要的错题信息'
      });
    }

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    // 检查是否已经存在相同的错题
    const existingMistake = userData.mistakeBank.find(m => 
      m.questionId === questionId && 
      JSON.stringify(m.wrongAnswer) === JSON.stringify(wrongAnswer)
    );

    if (existingMistake) {
      return res.status(400).json({
        success: false,
        message: '该错题已存在'
      });
    }

    // 创建错题
    const newMistake = {
      id: `mistake_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      questionId: questionId || `custom_${Date.now()}`,
      isPublic: isPublic || false,
      content,
      type,
      options: options || [],
      answer,
      wrongAnswer,
      analysis: analysis || '',
      mistakeTime: new Date(),
      isImportant: false,
      reviewCount: 0,
      lastReviewTime: null,
      tags: tags || []
    };

    userData.mistakeBank.push(newMistake);
    await userData.save();

    res.status(201).json({
      success: true,
      message: '错题添加成功',
      data: newMistake
    });
  } catch (error) {
    console.error('添加错题错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   PUT /api/mistakes/:id
// @desc    更新错题
// @access  Private
router.put('/:id', protect, apiLimiter, async (req, res) => {
  try {
    const { 
      content, 
      type, 
      options, 
      answer, 
      wrongAnswer, 
      analysis, 
      isImportant, 
      tags 
    } = req.body;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const mistakeIndex = userData.mistakeBank.findIndex(m => m.id === req.params.id);

    if (mistakeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '错题不存在'
      });
    }

    // 更新错题
    const mistake = userData.mistakeBank[mistakeIndex];
    
    if (content !== undefined) mistake.content = content;
    if (type !== undefined) mistake.type = type;
    if (options !== undefined) mistake.options = options;
    if (answer !== undefined) mistake.answer = answer;
    if (wrongAnswer !== undefined) mistake.wrongAnswer = wrongAnswer;
    if (analysis !== undefined) mistake.analysis = analysis;
    if (isImportant !== undefined) mistake.isImportant = isImportant;
    if (tags !== undefined) mistake.tags = tags;

    await userData.save();

    res.json({
      success: true,
      message: '错题更新成功',
      data: mistake
    });
  } catch (error) {
    console.error('更新错题错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   DELETE /api/mistakes/:id
// @desc    删除错题
// @access  Private
router.delete('/:id', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const mistakeIndex = userData.mistakeBank.findIndex(m => m.id === req.params.id);

    if (mistakeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '错题不存在'
      });
    }

    userData.mistakeBank.splice(mistakeIndex, 1);
    await userData.save();

    res.json({
      success: true,
      message: '错题删除成功'
    });
  } catch (error) {
    console.error('删除错题错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/mistakes/:id/review
// @desc    标记错题已复习
// @access  Private
router.post('/:id/review', protect, apiLimiter, async (req, res) => {
  try {
    const { isCorrect } = req.body;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const mistakeIndex = userData.mistakeBank.findIndex(m => m.id === req.params.id);

    if (mistakeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '错题不存在'
      });
    }

    const mistake = userData.mistakeBank[mistakeIndex];
    mistake.reviewCount += 1;
    mistake.lastReviewTime = new Date();

    // 如果复习正确，可以考虑从错题本中移除
    if (isCorrect === true && mistake.reviewCount >= 3) {
      userData.mistakeBank.splice(mistakeIndex, 1);
      await userData.save();
      
      return res.json({
        success: true,
        message: '恭喜！这道题已经掌握，已从错题本中移除',
        data: {
          removed: true,
          reviewCount: mistake.reviewCount
        }
      });
    }

    await userData.save();

    res.json({
      success: true,
      message: '复习记录已更新',
      data: {
        removed: false,
        reviewCount: mistake.reviewCount,
        lastReviewTime: mistake.lastReviewTime
      }
    });
  } catch (error) {
    console.error('标记错题复习错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   PUT /api/mistakes/:id/important
// @desc    标记/取消标记重点错题
// @access  Private
router.put('/:id/important', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const mistakeIndex = userData.mistakeBank.findIndex(m => m.id === req.params.id);

    if (mistakeIndex === -1) {
      return res.status(404).json({
        success: false,
        message: '错题不存在'
      });
    }

    const mistake = userData.mistakeBank[mistakeIndex];
    mistake.isImportant = !mistake.isImportant;

    await userData.save();

    res.json({
      success: true,
      message: mistake.isImportant ? '已标记为重点错题' : '已取消重点标记',
      data: {
        isImportant: mistake.isImportant
      }
    });
  } catch (error) {
    console.error('标记重点错题错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   DELETE /api/mistakes
// @desc    批量删除错题
// @access  Private
router.delete('/', protect, apiLimiter, async (req, res) => {
  try {
    const { ids } = req.body;

    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的错题ID数组'
      });
    }

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const idSet = new Set(ids);
    const initialLength = userData.mistakeBank.length;

    // 过滤掉要删除的错题
    userData.mistakeBank = userData.mistakeBank.filter(m => !idSet.has(m.id));

    const deletedCount = initialLength - userData.mistakeBank.length;

    await userData.save();

    res.json({
      success: true,
      message: `成功删除${deletedCount}道错题`,
      data: {
        deletedCount,
        remainingCount: userData.mistakeBank.length
      }
    });
  } catch (error) {
    console.error('批量删除错题错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/mistakes/practice
// @desc    获取错题练习题目
// @access  Private
router.post('/practice', protect, apiLimiter, async (req, res) => {
  try {
    const { count = 10, type, isImportant, tags } = req.body;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    let mistakes = userData.mistakeBank;

    // 按题型筛选
    if (type) {
      mistakes = mistakes.filter(m => m.type === type);
    }

    // 按重要性筛选
    if (isImportant === true) {
      mistakes = mistakes.filter(m => m.isImportant);
    }

    // 按标签筛选
    if (tags && Array.isArray(tags) && tags.length > 0) {
      mistakes = mistakes.filter(m => 
        m.tags.some(tag => tags.includes(tag))
      );
    }

    if (mistakes.length === 0) {
      return res.status(404).json({
        success: false,
        message: '没有符合条件的错题'
      });
    }

    // 优先选择复习次数少的错题
    mistakes.sort((a, b) => a.reviewCount - b.reviewCount);

    // 限制数量
    const practiceMistakes = mistakes.slice(0, Math.min(count, mistakes.length));

    // 打乱顺序
    const shuffledMistakes = practiceMistakes.sort(() => Math.random() - 0.5);

    res.json({
      success: true,
      message: `成功获取${shuffledMistakes.length}道错题用于练习`,
      data: shuffledMistakes
    });
  } catch (error) {
    console.error('获取错题练习题目错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/mistakes/stats/summary
// @desc    获取错题统计摘要
// @access  Private
router.get('/stats/summary', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const stats = userData.getMistakeStats();

    // 获取最近7天的错题趋势
    const last7Days = [];
    const mistakes = userData.mistakeBank;
    
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayMistakes = mistakes.filter(m => 
        m.mistakeTime.toISOString().split('T')[0] === dateStr
      );
      
      last7Days.push({
        date: dateStr,
        count: dayMistakes.length
      });
    }

    // 获取各题型错题分布
    const typeDistribution = {};
    mistakes.forEach(m => {
      typeDistribution[m.type] = (typeDistribution[m.type] || 0) + 1;
    });

    // 获取复习情况统计
    const reviewStats = {
      total: mistakes.length,
      reviewed: mistakes.filter(m => m.reviewCount > 0).length,
      unreviewed: mistakes.filter(m => m.reviewCount === 0).length,
      mastered: mistakes.filter(m => m.reviewCount >= 3).length
    };

    res.json({
      success: true,
      data: {
        summary: stats,
        last7Days,
        typeDistribution,
        reviewStats
      }
    });
  } catch (error) {
    console.error('获取错题统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

module.exports = router;