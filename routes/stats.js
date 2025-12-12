const express = require('express');
const router = express.Router();
const UserData = require('../models/UserData');
const { protect } = require('../middleware/auth');
const { apiLimiter } = require('../middleware/rateLimit');

// @route   GET /api/stats
// @desc    获取学习统计
// @access  Private
router.get('/', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const stats = userData.studyStats;

    // 计算额外的统计数据
    const examRecords = stats.examRecords;
    const totalExams = examRecords.length;
    
    let totalScore = 0;
    let totalDuration = 0;
    let totalQuestions = 0;
    let totalCorrect = 0;
    
    examRecords.forEach(record => {
      totalScore += record.score;
      totalDuration += record.duration;
      totalQuestions += record.totalQuestions;
      totalCorrect += record.correctCount;
    });

    const averageScore = totalExams > 0 ? Math.round(totalScore / totalExams) : 0;
    const averageDuration = totalExams > 0 ? Math.round(totalDuration / totalExams) : 0;
    const averageQuestions = totalExams > 0 ? Math.round(totalQuestions / totalExams) : 0;
    
    const recentExams = examRecords.slice(-5).reverse();

    res.json({
      success: true,
      data: {
        ...stats.toObject(),
        averageScore,
        averageDuration,
        averageQuestions,
        totalExams,
        recentExams
      }
    });
  } catch (error) {
    console.error('获取学习统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   POST /api/stats/exam
// @desc    添加考试记录
// @access  Private
router.post('/exam', protect, apiLimiter, async (req, res) => {
  try {
    const { 
      score, 
      grade, 
      correctCount, 
      wrongCount, 
      totalQuestions, 
      duration, 
      questions,
      type = 'normal'
    } = req.body;

    // 验证输入
    if (
      score === undefined || 
      !grade || 
      correctCount === undefined || 
      wrongCount === undefined || 
      totalQuestions === undefined || 
      duration === undefined
    ) {
      return res.status(400).json({
        success: false,
        message: '请填写必要的考试记录信息'
      });
    }

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    // 创建考试记录
    const examRecord = {
      date: new Date(),
      score,
      grade,
      correctCount,
      wrongCount,
      totalQuestions,
      duration,
      questions: questions || [],
      type
    };

    // 添加考试记录并更新统计
    userData.addExamRecord(examRecord);
    
    // 更新学习统计
    userData.updateStudyStats(correctCount, totalQuestions, duration);
    
    await userData.save();

    res.status(201).json({
      success: true,
      message: '考试记录添加成功',
      data: {
        examRecord,
        updatedStats: userData.studyStats
      }
    });
  } catch (error) {
    console.error('添加考试记录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/stats/exams
// @desc    获取考试记录列表
// @access  Private
router.get('/exams', protect, apiLimiter, async (req, res) => {
  try {
    const { page = 1, limit = 10, type } = req.query;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    let examRecords = userData.studyStats.examRecords;

    // 按类型筛选
    if (type) {
      examRecords = examRecords.filter(record => record.type === type);
    }

    // 按日期倒序排序
    examRecords.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 分页
    const total = examRecords.length;
    const skip = (page - 1) * limit;
    const paginatedExams = examRecords.slice(skip, skip + parseInt(limit));

    res.json({
      success: true,
      data: paginatedExams,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取考试记录列表错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/stats/exams/:index
// @desc    获取特定考试记录
// @access  Private
router.get('/exams/:index', protect, apiLimiter, async (req, res) => {
  try {
    const index = parseInt(req.params.index);

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const examRecords = userData.studyStats.examRecords;

    if (index < 0 || index >= examRecords.length) {
      return res.status(404).json({
        success: false,
        message: '考试记录不存在'
      });
    }

    const examRecord = examRecords[index];

    res.json({
      success: true,
      data: examRecord
    });
  } catch (error) {
    console.error('获取考试记录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   DELETE /api/stats/exams/:index
// @desc    删除考试记录
// @access  Private
router.delete('/exams/:index', protect, apiLimiter, async (req, res) => {
  try {
    const index = parseInt(req.params.index);

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const examRecords = userData.studyStats.examRecords;

    if (index < 0 || index >= examRecords.length) {
      return res.status(404).json({
        success: false,
        message: '考试记录不存在'
      });
    }

    // 移除考试记录
    const removedRecord = examRecords.splice(index, 1)[0];

    // 重新计算统计数据
    userData.studyStats.totalQuestions -= removedRecord.totalQuestions;
    userData.studyStats.correctAnswers -= removedRecord.correctCount;
    userData.studyStats.totalStudyTime -= removedRecord.duration;

    // 重新计算正确率
    if (userData.studyStats.totalQuestions > 0) {
      userData.studyStats.correctRate = Math.round(
        (userData.studyStats.correctAnswers / userData.studyStats.totalQuestions) * 100
      );
    } else {
      userData.studyStats.correctRate = 0;
    }

    // 重新计算平均分和最高分
    if (examRecords.length > 0) {
      const scores = examRecords.map(r => r.score);
      userData.studyStats.averageScore = Math.round(
        scores.reduce((sum, score) => sum + score, 0) / scores.length
      );
      userData.studyStats.bestScore = Math.max(...scores);
    } else {
      userData.studyStats.averageScore = 0;
      userData.studyStats.bestScore = 0;
    }

    await userData.save();

    res.json({
      success: true,
      message: '考试记录删除成功',
      data: {
        removedRecord,
        updatedStats: userData.studyStats
      }
    });
  } catch (error) {
    console.error('删除考试记录错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/stats/trends
// @desc    获取学习趋势数据
// @access  Private
router.get('/trends', protect, apiLimiter, async (req, res) => {
  try {
    const { period = 'month' } = req.query;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const examRecords = userData.studyStats.examRecords;

    // 根据时间周期生成趋势数据
    const trends = [];
    const now = new Date();
    
    if (period === 'week') {
      // 最近7天
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        
        const dayExams = examRecords.filter(record => 
          record.date.toISOString().split('T')[0] === dateStr
        );
        
        const dayScore = dayExams.length > 0 
          ? Math.round(dayExams.reduce((sum, exam) => sum + exam.score, 0) / dayExams.length)
          : null;
        
        trends.push({
          date: dateStr,
          score: dayScore,
          examCount: dayExams.length,
          questionCount: dayExams.reduce((sum, exam) => sum + exam.totalQuestions, 0)
        });
      }
    } else if (period === 'month') {
      // 最近30天，按周统计
      for (let i = 3; i >= 0; i--) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (i + 1) * 7);
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - i * 7);
        
        const weekExams = examRecords.filter(record => {
          const recordDate = new Date(record.date);
          return recordDate >= startDate && recordDate < endDate;
        });
        
        const weekScore = weekExams.length > 0
          ? Math.round(weekExams.reduce((sum, exam) => sum + exam.score, 0) / weekExams.length)
          : null;
        
        trends.push({
          period: `第${4-i}周`,
          score: weekScore,
          examCount: weekExams.length,
          questionCount: weekExams.reduce((sum, exam) => sum + exam.totalQuestions, 0)
        });
      }
    } else if (period === 'year') {
      // 最近12个月
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = date.toISOString().slice(0, 7);
        
        const monthExams = examRecords.filter(record => 
          record.date.toISOString().slice(0, 7) === monthStr
        );
        
        const monthScore = monthExams.length > 0
          ? Math.round(monthExams.reduce((sum, exam) => sum + exam.score, 0) / monthExams.length)
          : null;
        
        trends.push({
          period: monthStr,
          score: monthScore,
          examCount: monthExams.length,
          questionCount: monthExams.reduce((sum, exam) => sum + exam.totalQuestions, 0)
        });
      }
    }

    res.json({
      success: true,
      data: trends,
      period
    });
  } catch (error) {
    console.error('获取学习趋势错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   GET /api/stats/overview
// @desc    获取学习概览
// @access  Private
router.get('/overview', protect, apiLimiter, async (req, res) => {
  try {
    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    const stats = userData.studyStats;
    const examRecords = stats.examRecords;
    const mistakes = userData.mistakeBank;
    const personalQuestions = userData.personalQuestions;

    // 计算今日学习数据
    const today = new Date().toISOString().split('T')[0];
    const todayExams = examRecords.filter(record => 
      record.date.toISOString().split('T')[0] === today
    );
    
    const todayStats = {
      examCount: todayExams.length,
      questionCount: todayExams.reduce((sum, exam) => sum + exam.totalQuestions, 0),
      studyTime: todayExams.reduce((sum, exam) => sum + exam.duration, 0),
      averageScore: todayExams.length > 0
        ? Math.round(todayExams.reduce((sum, exam) => sum + exam.score, 0) / todayExams.length)
        : 0
    };

    // 计算本周学习数据
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    weekStart.setHours(0, 0, 0, 0);
    
    const weekExams = examRecords.filter(record => 
      new Date(record.date) >= weekStart
    );
    
    const weekStats = {
      examCount: weekExams.length,
      questionCount: weekExams.reduce((sum, exam) => sum + exam.totalQuestions, 0),
      studyTime: weekExams.reduce((sum, exam) => sum + exam.duration, 0),
      averageScore: weekExams.length > 0
        ? Math.round(weekExams.reduce((sum, exam) => sum + exam.score, 0) / weekExams.length)
        : 0
    };

    // 计算各题型统计
    const typeStats = {};
    examRecords.forEach(record => {
      record.questions.forEach(question => {
        if (!typeStats[question.type]) {
          typeStats[question.type] = { total: 0, correct: 0 };
        }
        typeStats[question.type].total++;
        if (question.isCorrect) {
          typeStats[question.type].correct++;
        }
      });
    });

    // 计算题型正确率
    Object.keys(typeStats).forEach(type => {
      typeStats[type].rate = Math.round(
        (typeStats[type].correct / typeStats[type].total) * 100
      );
    });

    const overview = {
      totalExams: examRecords.length,
      totalQuestions: stats.totalQuestions,
      totalStudyTime: stats.totalStudyTime,
      averageScore: stats.averageScore,
      bestScore: stats.bestScore,
      correctRate: stats.correctRate,
      mistakeCount: mistakes.length,
      personalQuestionCount: personalQuestions.length,
      todayStats,
      weekStats,
      typeStats
    };

    res.json({
      success: true,
      data: overview
    });
  } catch (error) {
    console.error('获取学习概览错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   PUT /api/stats
// @desc    更新学习统计
// @access  Private
router.put('/', protect, apiLimiter, async (req, res) => {
  try {
    const { totalQuestions, correctAnswers, totalStudyTime } = req.body;

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    // 更新统计数据
    if (totalQuestions !== undefined) {
      userData.studyStats.totalQuestions = totalQuestions;
    }
    
    if (correctAnswers !== undefined) {
      userData.studyStats.correctAnswers = correctAnswers;
    }
    
    if (totalStudyTime !== undefined) {
      userData.studyStats.totalStudyTime = totalStudyTime;
    }

    // 重新计算正确率
    if (userData.studyStats.totalQuestions > 0) {
      userData.studyStats.correctRate = Math.round(
        (userData.studyStats.correctAnswers / userData.studyStats.totalQuestions) * 100
      );
    }

    await userData.save();

    res.json({
      success: true,
      message: '学习统计更新成功',
      data: userData.studyStats
    });
  } catch (error) {
    console.error('更新学习统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

// @route   DELETE /api/stats
// @desc    重置学习统计
// @access  Private
router.delete('/', protect, apiLimiter, async (req, res) => {
  try {
    const { confirm } = req.body;

    if (confirm !== true) {
      return res.status(400).json({
        success: false,
        message: '请确认重置学习统计'
      });
    }

    const userData = await UserData.findOne({ userId: req.userId });

    if (!userData) {
      return res.status(404).json({
        success: false,
        message: '用户数据不存在'
      });
    }

    // 保存旧数据用于返回
    const oldStats = { ...userData.studyStats.toObject() };

    // 重置统计数据
    userData.studyStats = {
      totalQuestions: 0,
      correctAnswers: 0,
      totalStudyTime: 0,
      examRecords: [],
      correctRate: 0,
      averageScore: 0,
      bestScore: 0
    };

    await userData.save();

    res.json({
      success: true,
      message: '学习统计重置成功',
      data: {
        oldStats,
        newStats: userData.studyStats
      }
    });
  } catch (error) {
    console.error('重置学习统计错误:', error);
    res.status(500).json({
      success: false,
      message: '服务器错误'
    });
  }
});

module.exports = router;