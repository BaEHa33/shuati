const express = require('express');
const router = express.Router();
const Question = require('../../models/Question');
const authMiddleware = require('../../middleware/auth');
const logger = require('../../utils/logger');
const mongoose = require('mongoose');

// 题目管理相关路由

// 获取公开题目列表（无需认证）
router.get('/public', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = '',
      difficulty = [],
      category = '',
      tags = [],
      search = '',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await Question.getQuestions({
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      difficulty: difficulty.length > 0 ? difficulty.split(',').map(d => parseInt(d)) : [],
      category,
      tags: tags.length > 0 ? tags.split(',') : [],
      search,
      status: 'published',
      isPublic: true,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.getPublic', {
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: '获取题目列表失败',
      code: 'GET_QUESTIONS_FAILED'
    });
  }
});

// 获取题目详情（无需认证）
router.get('/public/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目ID',
        code: 'INVALID_QUESTION_ID'
      });
    }

    const question = await Question.getQuestionById(id);

    res.json({
      success: true,
      data: {
        question
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.getPublicById', {
      questionId: req.params.id
    });

    if (error.message.includes('题目不存在')) {
      return res.status(404).json({
        success: false,
        message: '题目不存在',
        code: 'QUESTION_NOT_FOUND'
      });
    }

    res.status(500).json({
      success: false,
      message: '获取题目详情失败',
      code: 'GET_QUESTION_FAILED'
    });
  }
});

// 获取随机题目（无需认证）
router.get('/random', async (req, res) => {
  try {
    const {
      count = 10,
      type = '',
      difficulty = [],
      category = '',
      tags = [],
      excludeIds = []
    } = req.query;

    const questions = await Question.getRandomQuestions({
      count: parseInt(count),
      type,
      difficulty: difficulty.length > 0 ? difficulty.split(',').map(d => parseInt(d)) : [],
      category,
      tags: tags.length > 0 ? tags.split(',') : [],
      excludeIds: excludeIds.length > 0 ? excludeIds.split(',') : []
    });

    res.json({
      success: true,
      data: {
        questions
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.getRandom', {
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: '获取随机题目失败',
      code: 'GET_RANDOM_QUESTIONS_FAILED'
    });
  }
});

// 获取题目统计信息（无需认证）
router.get('/stats', async (req, res) => {
  try {
    const stats = await Question.getQuestionStats();

    res.json({
      success: true,
      data: {
        stats
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.getStats');

    res.status(500).json({
      success: false,
      message: '获取题目统计失败',
      code: 'GET_QUESTION_STATS_FAILED'
    });
  }
});

// 需要认证的路由
router.use(authMiddleware.verifyToken);
router.use(authMiddleware.verifyUser);

// 获取用户自己的题目列表
router.get('/my', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = '',
      difficulty = [],
      category = '',
      tags = [],
      search = '',
      status = 'published',
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await Question.getQuestions({
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      difficulty: difficulty.length > 0 ? difficulty.split(',').map(d => parseInt(d)) : [],
      category,
      tags: tags.length > 0 ? tags.split(',') : [],
      search,
      creator: req.user.id,
      status,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.getMy', {
      query: req.query,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: '获取题目列表失败',
      code: 'GET_MY_QUESTIONS_FAILED'
    });
  }
});

// 创建新题目
router.post('/', async (req, res) => {
  try {
    const questionData = req.body;

    // 验证必填字段
    if (!questionData.title || !questionData.content || !questionData.type || questionData.answer === undefined) {
      return res.status(400).json({
        success: false,
        message: '缺少必填字段',
        code: 'MISSING_REQUIRED_FIELDS'
      });
    }

    // 验证题目类型
    const validTypes = ['single', 'multiple', 'judge', 'fill', 'essay'];
    if (!validTypes.includes(questionData.type)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目类型',
        code: 'INVALID_QUESTION_TYPE'
      });
    }

    // 验证选项（选择题和判断题）
    if (['single', 'multiple', 'judge'].includes(questionData.type)) {
      if (!questionData.options || !Array.isArray(questionData.options) || questionData.options.length === 0) {
        return res.status(400).json({
          success: false,
          message: '选择题和判断题必须包含选项',
          code: 'MISSING_OPTIONS'
        });
      }
    }

    // 验证答案格式
    if (questionData.type === 'multiple') {
      if (!Array.isArray(questionData.answer)) {
        return res.status(400).json({
          success: false,
          message: '多选题答案必须是数组格式',
          code: 'INVALID_ANSWER_FORMAT'
        });
      }
    } else if (['single', 'judge'].includes(questionData.type)) {
      if (typeof questionData.answer !== 'number') {
        return res.status(400).json({
          success: false,
          message: '单选题和判断题答案必须是数字格式',
          code: 'INVALID_ANSWER_FORMAT'
        });
      }
    }

    const question = await Question.createQuestion(questionData, req.user.id);

    logger.info('Question created', {
      questionId: question._id,
      userId: req.user.id,
      questionType: question.type
    });

    res.status(201).json({
      success: true,
      message: '题目创建成功',
      data: {
        question
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.create', {
      body: req.body,
      userId: req.user.id
    });

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        code: 'VALIDATION_ERROR',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: '创建题目失败',
      code: 'CREATE_QUESTION_FAILED'
    });
  }
});

// 获取题目详情
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目ID',
        code: 'INVALID_QUESTION_ID'
      });
    }

    const question = await Question.getQuestionById(id, req.user.id);

    // 检查权限（如果不是公开题目且不是创建者）
    if (!question.isPublic && question.creator.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: '没有权限查看此题目',
        code: 'ACCESS_DENIED'
      });
    }

    res.json({
      success: true,
      data: {
        question
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.getById', {
      questionId: req.params.id,
      userId: req.user.id
    });

    if (error.message.includes('题目不存在')) {
      return res.status(404).json({
        success: false,
        message: '题目不存在',
        code: 'QUESTION_NOT_FOUND'
      });
    }

    res.status(500).json({
      success: false,
      message: '获取题目详情失败',
      code: 'GET_QUESTION_FAILED'
    });
  }
});

// 更新题目
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目ID',
        code: 'INVALID_QUESTION_ID'
      });
    }

    const question = await Question.updateQuestion(id, updateData, req.user.id);

    logger.info('Question updated', {
      questionId: question._id,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: '题目更新成功',
      data: {
        question
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.update', {
      questionId: req.params.id,
      body: req.body,
      userId: req.user.id
    });

    if (error.message.includes('题目不存在')) {
      return res.status(404).json({
        success: false,
        message: '题目不存在',
        code: 'QUESTION_NOT_FOUND'
      });
    }

    if (error.message.includes('没有权限')) {
      return res.status(403).json({
        success: false,
        message: '没有权限修改此题目',
        code: 'ACCESS_DENIED'
      });
    }

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: '数据验证失败',
        code: 'VALIDATION_ERROR',
        errors: Object.values(error.errors).map(e => e.message)
      });
    }

    res.status(500).json({
      success: false,
      message: '更新题目失败',
      code: 'UPDATE_QUESTION_FAILED'
    });
  }
});

// 删除题目
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目ID',
        code: 'INVALID_QUESTION_ID'
      });
    }

    const result = await Question.deleteQuestion(id, req.user.id);

    logger.info('Question deleted', {
      questionId: id,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: '题目删除成功'
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.delete', {
      questionId: req.params.id,
      userId: req.user.id
    });

    if (error.message.includes('题目不存在')) {
      return res.status(404).json({
        success: false,
        message: '题目不存在',
        code: 'QUESTION_NOT_FOUND'
      });
    }

    if (error.message.includes('没有权限')) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除此题目',
        code: 'ACCESS_DENIED'
      });
    }

    res.status(500).json({
      success: false,
      message: '删除题目失败',
      code: 'DELETE_QUESTION_FAILED'
    });
  }
});

// 批量删除题目
router.post('/batch/delete', async (req, res) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要删除的题目ID列表',
        code: 'MISSING_QUESTION_IDS'
      });
    }

    const result = await Question.deleteQuestions(ids, req.user.id);

    logger.info('Questions batch deleted', {
      questionIds: ids,
      userId: req.user.id,
      count: ids.length
    });

    res.json({
      success: true,
      message: `成功删除 ${ids.length} 道题目`
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.batchDelete', {
      body: req.body,
      userId: req.user.id
    });

    if (error.message.includes('没有权限')) {
      return res.status(403).json({
        success: false,
        message: '没有权限删除部分题目',
        code: 'ACCESS_DENIED'
      });
    }

    res.status(500).json({
      success: false,
      message: '批量删除题目失败',
      code: 'BATCH_DELETE_FAILED'
    });
  }
});

// 批量更新题目状态
router.post('/batch/status', async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要更新的题目ID列表',
        code: 'MISSING_QUESTION_IDS'
      });
    }

    if (!status || !['draft', 'published', 'archived'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值',
        code: 'INVALID_STATUS'
      });
    }

    const result = await Question.updateMany(
      { _id: { $in: ids }, creator: req.user.id },
      { $set: { status } }
    );

    logger.info('Questions batch status updated', {
      questionIds: ids,
      userId: req.user.id,
      status,
      updatedCount: result.modifiedCount
    });

    res.json({
      success: true,
      message: `成功更新 ${result.modifiedCount} 道题目的状态`,
      data: {
        updatedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.batchUpdateStatus', {
      body: req.body,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: '批量更新题目状态失败',
      code: 'BATCH_UPDATE_STATUS_FAILED'
    });
  }
});

// 批量更新题目公开状态
router.post('/batch/public', async (req, res) => {
  try {
    const { ids, isPublic } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要更新的题目ID列表',
        code: 'MISSING_QUESTION_IDS'
      });
    }

    if (typeof isPublic !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isPublic必须是布尔值',
        code: 'INVALID_ISPUBLIC'
      });
    }

    const result = await Question.updateMany(
      { _id: { $in: ids }, creator: req.user.id },
      { $set: { isPublic } }
    );

    logger.info('Questions batch public status updated', {
      questionIds: ids,
      userId: req.user.id,
      isPublic,
      updatedCount: result.modifiedCount
    });

    res.json({
      success: true,
      message: `成功更新 ${result.modifiedCount} 道题目的公开状态`,
      data: {
        updatedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.batchUpdatePublic', {
      body: req.body,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: '批量更新题目公开状态失败',
      code: 'BATCH_UPDATE_PUBLIC_FAILED'
    });
  }
});

// 导入题目（支持JSON格式）
router.post('/import', async (req, res) => {
  try {
    const { questions } = req.body;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: '请提供要导入的题目数据',
        code: 'MISSING_QUESTIONS_DATA'
      });
    }

    if (questions.length > 100) {
      return res.status(400).json({
        success: false,
        message: '单次导入题目数量不能超过100道',
        code: 'TOO_MANY_QUESTIONS'
      });
    }

    const importedQuestions = [];
    const errors = [];

    for (let i = 0; i < questions.length; i++) {
      try {
        const questionData = {
          ...questions[i],
          creator: req.user.id,
          status: 'published',
          isPublic: true
        };

        const question = await Question.createQuestion(questionData, req.user.id);
        importedQuestions.push(question);
      } catch (error) {
        errors.push({
          index: i,
          error: error.message
        });
      }
    }

    logger.info('Questions imported', {
      userId: req.user.id,
      totalCount: questions.length,
      successCount: importedQuestions.length,
      errorCount: errors.length
    });

    res.json({
      success: true,
      message: `导入完成：成功 ${importedQuestions.length} 道，失败 ${errors.length} 道`,
      data: {
        importedQuestions,
        errors,
        summary: {
          total: questions.length,
          success: importedQuestions.length,
          failed: errors.length
        }
      }
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.import', {
      body: req.body,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: '导入题目失败',
      code: 'IMPORT_QUESTIONS_FAILED'
    });
  }
});

// 导出题目
router.get('/export/my', async (req, res) => {
  try {
    const { type = '', status = '' } = req.query;

    const query = {
      creator: req.user.id
    };

    if (type) query.type = type;
    if (status) query.status = status;

    const questions = await Question.find(query)
      .select('-__v -createdAt -updatedAt -usage -metadata')
      .sort({ createdAt: -1 });

    const exportData = {
      exportTime: new Date().toISOString(),
      totalQuestions: questions.length,
      questions: questions
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=questions_${req.user.username}_${new Date().toISOString().split('T')[0]}.json`);
    res.json(exportData);

    logger.info('Questions exported', {
      userId: req.user.id,
      count: questions.length,
      type,
      status
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.export', {
      query: req.query,
      userId: req.user.id
    });

    res.status(500).json({
      success: false,
      message: '导出题目失败',
      code: 'EXPORT_QUESTIONS_FAILED'
    });
  }
});

// 管理员路由
router.get('/admin/all', authMiddleware.verifyAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      type = '',
      difficulty = [],
      category = '',
      tags = [],
      search = '',
      creator = '',
      status = '',
      isPublic = undefined,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const result = await Question.getQuestions({
      page: parseInt(page),
      limit: parseInt(limit),
      type,
      difficulty: difficulty.length > 0 ? difficulty.split(',').map(d => parseInt(d)) : [],
      category,
      tags: tags.length > 0 ? tags.split(',') : [],
      search,
      creator,
      status,
      isPublic: isPublic !== undefined ? isPublic === 'true' : undefined,
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.adminGetAll', {
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: '获取所有题目失败',
      code: 'ADMIN_GET_ALL_FAILED'
    });
  }
});

// 更新题目使用统计
router.post('/:id/usage', async (req, res) => {
  try {
    const { id } = req.params;
    const { isCorrect } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的题目ID',
        code: 'INVALID_QUESTION_ID'
      });
    }

    await Question.updateUsageStats(id, isCorrect);

    res.json({
      success: true,
      message: '题目使用统计更新成功'
    });
  } catch (error) {
    logger.errorWithDetails(error, 'questions.updateUsage', {
      questionId: req.params.id,
      body: req.body
    });

    res.status(500).json({
      success: false,
      message: '更新题目使用统计失败',
      code: 'UPDATE_USAGE_FAILED'
    });
  }
});

module.exports = router;