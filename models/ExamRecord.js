const mongoose = require('mongoose');
const { Schema } = mongoose;

const examRecordSchema = new Schema({
  // 用户信息
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 考试基本信息
  title: {
    type: String,
    default: '智能刷题考试'
  },
  
  description: {
    type: String,
    default: ''
  },
  
  // 考试配置
  config: {
    totalQuestions: {
      type: Number,
      required: [true, '题目总数不能为空']
    },
    questionTypes: {
      single: { type: Number, default: 0 },
      multiple: { type: Number, default: 0 },
      judge: { type: Number, default: 0 },
      fill: { type: Number, default: 0 },
      essay: { type: Number, default: 0 }
    },
    duration: {
      type: Number, // 单位：分钟
      default: 60
    },
    passingScore: {
      type: Number,
      default: 60
    },
    isRandom: {
      type: Boolean,
      default: true
    }
  },
  
  // 考试结果
  result: {
    score: {
      type: Number,
      required: [true, '考试分数不能为空'],
      min: 0,
      max: 100
    },
    grade: {
      type: String,
      enum: ['优秀', '良好', '及格', '不及格'],
      default: '不及格'
    },
    correctCount: {
      type: Number,
      required: [true, '正确题数不能为空'],
      min: 0
    },
    wrongCount: {
      type: Number,
      required: [true, '错误题数不能为空'],
      min: 0
    },
    unansweredCount: {
      type: Number,
      default: 0,
      min: 0
    },
    accuracy: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    isPassed: {
      type: Boolean,
      default: false
    }
  },
  
  // 题目详情
  questions: {
    type: [{
      questionId: {
        type: Schema.Types.ObjectId,
        ref: 'Question',
        required: true
      },
      type: {
        type: String,
        enum: ['single', 'multiple', 'judge', 'fill', 'essay'],
        required: true
      },
      content: {
        type: String,
        required: true
      },
      options: {
        type: [String],
        default: []
      },
      userAnswer: {
        type: Schema.Types.Mixed
      },
      correctAnswer: {
        type: Schema.Types.Mixed,
        required: true
      },
      isCorrect: {
        type: Boolean,
        required: true
      },
      isMarked: {
        type: Boolean,
        default: false
      },
      timeSpent: {
        type: Number, // 单位：秒
        default: 0
      }
    }],
    default: []
  },
  
  // 时间信息
  startTime: {
    type: Date,
    required: true,
    default: Date.now
  },
  
  endTime: {
    type: Date,
    required: true
  },
  
  actualDuration: {
    type: Number, // 单位：秒
    required: true
  },
  
  // 考试状态
  status: {
    type: String,
    enum: ['completed', 'incomplete', 'abandoned'],
    default: 'completed'
  },
  
  // 设备信息
  deviceInfo: {
    userAgent: {
      type: String,
      default: ''
    },
    ipAddress: {
      type: String,
      default: ''
    },
    screenSize: {
      type: String,
      default: ''
    },
    browser: {
      type: String,
      default: ''
    },
    os: {
      type: String,
      default: ''
    }
  },
  
  // 附加信息
  metadata: {
    isPractice: {
      type: Boolean,
      default: false
    },
    source: {
      type: String,
      enum: ['normal', 'mistake_review', 'custom'],
      default: 'normal'
    },
    tags: {
      type: [String],
      default: []
    },
    notes: {
      type: String,
      default: ''
    }
  },
  
  // 统计分析
  analysis: {
    difficultyDistribution: {
      easy: { type: Number, default: 0 },
      medium: { type: Number, default: 0 },
      hard: { type: Number, default: 0 }
    },
    typePerformance: {
      single: { correct: 0, total: 0, rate: 0 },
      multiple: { correct: 0, total: 0, rate: 0 },
      judge: { correct: 0, total: 0, rate: 0 },
      fill: { correct: 0, total: 0, rate: 0 },
      essay: { correct: 0, total: 0, rate: 0 }
    },
    timeAnalysis: {
      avgTimePerQuestion: { type: Number, default: 0 },
      fastestQuestion: { type: Number, default: 0 },
      slowestQuestion: { type: Number, default: 0 }
    },
    weakAreas: {
      type: [String],
      default: []
    },
    strongAreas: {
      type: [String],
      default: []
    }
  },
  
  // 复习信息
  review: {
    isReviewed: {
      type: Boolean,
      default: false
    },
    reviewedAt: {
      type: Date
    },
    reviewNotes: {
      type: String,
      default: ''
    },
    reviewCount: {
      type: Number,
      default: 0
    }
  },
  
  // 分享信息
  sharing: {
    isPublic: {
      type: Boolean,
      default: false
    },
    shareCode: {
      type: String,
      unique: true
    },
    viewCount: {
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
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // 计算一些额外的统计信息
      if (ret.result) {
        ret.result.accuracy = Math.round((ret.result.correctCount / ret.config.totalQuestions) * 100);
      }
      return ret;
    }
  }
});

// 虚拟属性：考试时长（分钟）
examRecordSchema.virtual('durationMinutes').get(function() {
  return Math.round(this.actualDuration / 60);
});

// 虚拟属性：考试时长（格式化）
examRecordSchema.virtual('formattedDuration').get(function() {
  const minutes = Math.floor(this.actualDuration / 60);
  const seconds = this.actualDuration % 60;
  return `${minutes}分${seconds}秒`;
});

// 虚拟属性：开始时间（格式化）
examRecordSchema.virtual('formattedStartTime').get(function() {
  return this.startTime.toLocaleString('zh-CN');
});

// 虚拟属性：结束时间（格式化）
examRecordSchema.virtual('formattedEndTime').get(function() {
  return this.endTime.toLocaleString('zh-CN');
});

// 索引
examRecordSchema.index({ user: 1 });
examRecordSchema.index({ 'result.score': 1 });
examRecordSchema.index({ 'result.grade': 1 });
examRecordSchema.index({ startTime: -1 });
examRecordSchema.index({ 'sharing.shareCode': 1 });
examRecordSchema.index({ 'metadata.source': 1 });
examRecordSchema.index({ 'config.questionTypes': 1 });

// 保存前的中间件
examRecordSchema.pre('save', function(next) {
  // 计算成绩等级
  if (this.result.score >= 90) {
    this.result.grade = '优秀';
  } else if (this.result.score >= 80) {
    this.result.grade = '良好';
  } else if (this.result.score >= 60) {
    this.result.grade = '及格';
  } else {
    this.result.grade = '不及格';
  }
  
  // 检查是否通过
  this.result.isPassed = this.result.score >= this.config.passingScore;
  
  // 计算正确率
  if (this.config.totalQuestions > 0) {
    this.result.accuracy = Math.round((this.result.correctCount / this.config.totalQuestions) * 100);
  }
  
  // 生成分享码（如果是公开的）
  if (this.sharing.isPublic && !this.sharing.shareCode) {
    this.sharing.shareCode = this.generateShareCode();
  }
  
  // 计算题型性能统计
  this.calculateTypePerformance();
  
  // 计算时间分析
  this.calculateTimeAnalysis();
  
  next();
});

// 生成分享码
examRecordSchema.methods.generateShareCode = function() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// 计算题型性能统计
examRecordSchema.methods.calculateTypePerformance = function() {
  const typeStats = {
    single: { correct: 0, total: 0 },
    multiple: { correct: 0, total: 0 },
    judge: { correct: 0, total: 0 },
    fill: { correct: 0, total: 0 },
    essay: { correct: 0, total: 0 }
  };
  
  this.questions.forEach(q => {
    if (typeStats[q.type]) {
      typeStats[q.type].total += 1;
      if (q.isCorrect) {
        typeStats[q.type].correct += 1;
      }
    }
  });
  
  // 计算各题型正确率
  Object.keys(typeStats).forEach(type => {
    const stats = typeStats[type];
    this.analysis.typePerformance[type] = {
      correct: stats.correct,
      total: stats.total,
      rate: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
    };
  });
};

// 计算时间分析
examRecordSchema.methods.calculateTimeAnalysis = function() {
  const timeSpentArray = this.questions
    .filter(q => q.timeSpent > 0)
    .map(q => q.timeSpent);
  
  if (timeSpentArray.length > 0) {
    const totalTime = timeSpentArray.reduce((sum, time) => sum + time, 0);
    this.analysis.timeAnalysis = {
      avgTimePerQuestion: Math.round(totalTime / timeSpentArray.length),
      fastestQuestion: Math.min(...timeSpentArray),
      slowestQuestion: Math.max(...timeSpentArray)
    };
  }
};

// 静态方法：创建考试记录
examRecordSchema.statics.createExamRecord = async function(recordData) {
  try {
    const record = new this(recordData);
    await record.save();
    
    // 填充关联数据
    await record.populate('user', 'username email avatar');
    await record.populate('questions.questionId', 'title content type difficulty tags');
    
    return record;
  } catch (error) {
    throw new Error('创建考试记录失败: ' + error.message);
  }
};

// 静态方法：获取用户的考试记录
examRecordSchema.statics.getUserExamRecords = async function(userId, {
  page = 1,
  limit = 10,
  search = '',
  status = '',
  source = '',
  minScore = 0,
  maxScore = 100,
  startDate = null,
  endDate = null,
  sortBy = 'startTime',
  sortOrder = 'desc'
}) {
  const query = { user: userId };
  
  // 按状态筛选
  if (status) {
    query.status = status;
  }
  
  // 按来源筛选
  if (source) {
    query['metadata.source'] = source;
  }
  
  // 按分数范围筛选
  query['result.score'] = {
    $gte: minScore,
    $lte: maxScore
  };
  
  // 按时间范围筛选
  if (startDate) {
    query.startTime = { $gte: new Date(startDate) };
  }
  
  if (endDate) {
    if (query.startTime) {
      query.startTime.$lte = new Date(endDate);
    } else {
      query.startTime = { $lte: new Date(endDate) };
    }
  }
  
  // 搜索功能
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } }
    ];
  }
  
  // 排序
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  // 查询
  const records = await this.find(query)
    .skip((page - 1) * limit)
    .limit(limit)
    .sort(sort);
  
  const total = await this.countDocuments(query);
  
  // 计算统计信息
  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: null,
        totalExams: { $sum: 1 },
        avgScore: { $avg: '$result.score' },
        bestScore: { $max: '$result.score' },
        totalStudyTime: { $sum: '$actualDuration' },
        passRate: {
          $avg: { $cond: [{ $eq: ['$result.isPassed', true] }, 1, 0] }
        }
      }
    }
  ]);
  
  return {
    records,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    },
    stats: stats[0] || {
      totalExams: 0,
      avgScore: 0,
      bestScore: 0,
      totalStudyTime: 0,
      passRate: 0
    }
  };
};

// 静态方法：获取考试记录详情
examRecordSchema.statics.getExamRecordById = async function(recordId, userId = null) {
  try {
    const query = { _id: recordId };
    
    // 如果不是管理员，只允许查看自己的记录或公开的记录
    if (userId) {
      query.$or = [
        { user: userId },
        { 'sharing.isPublic': true }
      ];
    } else {
      // 未登录用户只能查看公开的记录
      query['sharing.isPublic'] = true;
    }
    
    const record = await this.findOne(query)
      .populate('user', 'username email avatar')
      .populate('questions.questionId', 'title content type difficulty tags analysis');
    
    if (!record) {
      throw new Error('考试记录不存在');
    }
    
    // 增加查看次数（如果是通过分享码查看）
    if (userId && userId.toString() !== record.user._id.toString()) {
      record.sharing.viewCount += 1;
      await record.save();
    }
    
    return record;
  } catch (error) {
    throw new Error('获取考试记录失败: ' + error.message);
  }
};

// 静态方法：通过分享码获取考试记录
examRecordSchema.statics.getExamRecordByShareCode = async function(shareCode) {
  try {
    const record = await this.findOne({
      'sharing.shareCode': shareCode,
      'sharing.isPublic': true
    })
      .populate('user', 'username email avatar')
      .populate('questions.questionId', 'title content type difficulty tags analysis');
    
    if (!record) {
      throw new Error('分享的考试记录不存在');
    }
    
    // 增加查看次数
    record.sharing.viewCount += 1;
    await record.save();
    
    return record;
  } catch (error) {
    throw new Error('获取分享的考试记录失败: ' + error.message);
  }
};

// 静态方法：更新考试记录
examRecordSchema.statics.updateExamRecord = async function(recordId, updateData, userId) {
  try {
    const record = await this.findById(recordId);
    
    if (!record) {
      throw new Error('考试记录不存在');
    }
    
    // 检查权限
    if (record.user.toString() !== userId && record.role !== 'admin') {
      throw new Error('没有权限修改此考试记录');
    }
    
    // 只允许更新特定字段
    const allowedFields = [
      'title',
      'description',
      'metadata.notes',
      'metadata.tags',
      'review.reviewedAt',
      'review.reviewNotes',
      'review.reviewCount',
      'sharing.isPublic'
    ];
    
    const update = {};
    allowedFields.forEach(field => {
      const value = this.getNestedValue(updateData, field);
      if (value !== undefined) {
        this.setNestedValue(update, field, value);
      }
    });
    
    // 如果更新了复习信息，增加复习次数
    if (updateData.review && updateData.review.reviewNotes) {
      record.review.reviewCount += 1;
      record.review.reviewedAt = Date.now();
    }
    
    // 如果更改了公开状态，生成或清除分享码
    if (updateData.sharing && updateData.sharing.isPublic !== undefined) {
      if (updateData.sharing.isPublic && !record.sharing.shareCode) {
        record.sharing.shareCode = record.generateShareCode();
      } else if (!updateData.sharing.isPublic) {
        record.sharing.shareCode = null;
      }
    }
    
    await record.save();
    return record;
  } catch (error) {
    throw new Error('更新考试记录失败: ' + error.message);
  }
};

// 辅助方法：获取嵌套对象的值
examRecordSchema.statics.getNestedValue = function(obj, path) {
  return path.split('.').reduce((current, key) => current && current[key], obj);
};

// 辅助方法：设置嵌套对象的值
examRecordSchema.statics.setNestedValue = function(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  const lastObj = keys.reduce((current, key) => {
    if (!current[key]) current[key] = {};
    return current[key];
  }, obj);
  lastObj[lastKey] = value;
};

// 静态方法：删除考试记录
examRecordSchema.statics.deleteExamRecord = async function(recordId, userId) {
  try {
    const record = await this.findById(recordId);
    
    if (!record) {
      throw new Error('考试记录不存在');
    }
    
    // 检查权限
    if (record.user.toString() !== userId && record.role !== 'admin') {
      throw new Error('没有权限删除此考试记录');
    }
    
    await record.deleteOne();
    return { success: true, message: '考试记录已删除' };
  } catch (error) {
    throw new Error('删除考试记录失败: ' + error.message);
  }
};

// 静态方法：获取用户的学习统计
examRecordSchema.statics.getUserStudyStats = async function(userId, days = 30) {
  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const stats = await this.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          startTime: { $gte: startDate },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$startTime' }
          },
          dailyExams: { $sum: 1 },
          dailyScore: { $avg: '$result.score' },
          dailyStudyTime: { $sum: '$actualDuration' },
          dailyCorrectCount: { $sum: '$result.correctCount' },
          dailyTotalQuestions: { $sum: '$config.totalQuestions' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    return stats;
  } catch (error) {
    throw new Error('获取学习统计失败: ' + error.message);
  }
};

const ExamRecord = mongoose.model('ExamRecord', examRecordSchema);

module.exports = ExamRecord;