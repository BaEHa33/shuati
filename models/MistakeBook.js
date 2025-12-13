const mongoose = require('mongoose');
const { Schema } = mongoose;

const mistakeBookSchema = new Schema({
  // 用户信息
  user: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 题目信息
  question: {
    type: Schema.Types.ObjectId,
    ref: 'Question',
    required: true
  },
  
  // 题目快照（保存题目的当前状态，防止题目被修改后影响错题记录）
  questionSnapshot: {
    title: {
      type: String,
      required: true
    },
    content: {
      type: String,
      required: true
    },
    type: {
      type: String,
      required: true,
      enum: ['single', 'multiple', 'judge', 'fill', 'essay']
    },
    options: {
      type: [String],
      default: []
    },
    correctAnswer: {
      type: Schema.Types.Mixed,
      required: true
    },
    analysis: {
      type: String,
      default: ''
    },
    difficulty: {
      type: Number,
      min: 1,
      max: 5,
      default: 2
    },
    tags: {
      type: [String],
      default: []
    },
    category: {
      type: String,
      default: 'general'
    }
  },
  
  // 用户作答信息
  userAnswer: {
    type: Schema.Types.Mixed,
    required: true
  },
  
  // 错误原因
  mistakeReason: {
    type: String,
    trim: true,
    default: ''
  },
  
  // 错题标签
  tags: {
    type: [String],
    default: []
  },
  
  // 重要程度
  importance: {
    type: Number,
    min: 1,
    max: 5,
    default: 3
  },
  
  // 掌握程度
  masteryLevel: {
    type: Number,
    min: 1,
    max: 5,
    default: 1
  },
  
  // 复习状态
  reviewStatus: {
    type: String,
    enum: ['unreviewed', 'reviewing', 'mastered'],
    default: 'unreviewed'
  },
  
  // 复习信息
  reviewInfo: {
    reviewCount: {
      type: Number,
      default: 0
    },
    lastReviewDate: {
      type: Date
    },
    nextReviewDate: {
      type: Date,
      default: Date.now
    },
    reviewIntervals: {
      type: [Number], // 单位：天
      default: []
    },
    consecutiveCorrect: {
      type: Number,
      default: 0
    }
  },
  
  // 错误统计
  errorStats: {
    totalAttempts: {
      type: Number,
      default: 1
    },
    correctAttempts: {
      type: Number,
      default: 0
    },
    errorRate: {
      type: Number,
      default: 100
    }
  },
  
  // 来源信息
  source: {
    type: String,
    enum: ['exam', 'practice', 'review'],
    default: 'exam'
  },
  
  examRecord: {
    type: Schema.Types.ObjectId,
    ref: 'ExamRecord'
  },
  
  // 时间信息
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // 元数据
  metadata: {
    isArchived: {
      type: Boolean,
      default: false
    },
    archiveDate: {
      type: Date
    },
    isPublic: {
      type: Boolean,
      default: false
    },
    viewCount: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  versionKey: false,
  toJSON: {
    virtuals: true,
    transform: function(doc, ret) {
      // 计算错误率
      if (ret.errorStats && ret.errorStats.totalAttempts > 0) {
        ret.errorStats.errorRate = Math.round(((ret.errorStats.totalAttempts - ret.errorStats.correctAttempts) / ret.errorStats.totalAttempts) * 100);
      }
      
      // 计算下次复习时间是否已到
      if (ret.reviewInfo && ret.reviewInfo.nextReviewDate) {
        ret.isDueForReview = ret.reviewInfo.nextReviewDate <= Date.now();
      }
      
      return ret;
    }
  }
});

// 虚拟属性：是否需要复习
mistakeBookSchema.virtual('isDueForReview').get(function() {
  return this.reviewInfo && this.reviewInfo.nextReviewDate && this.reviewInfo.nextReviewDate <= Date.now();
});

// 虚拟属性：正确率
mistakeBookSchema.virtual('correctRate').get(function() {
  if (this.errorStats && this.errorStats.totalAttempts > 0) {
    return Math.round((this.errorStats.correctAttempts / this.errorStats.totalAttempts) * 100);
  }
  return 0;
});

// 虚拟属性：复习间隔（天）
mistakeBookSchema.virtual('reviewIntervalDays').get(function() {
  if (this.reviewInfo && this.reviewInfo.nextReviewDate) {
    const now = new Date();
    const nextReview = new Date(this.reviewInfo.nextReviewDate);
    const diffTime = nextReview - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
  return 0;
});

// 索引
mistakeBookSchema.index({ user: 1 });
mistakeBookSchema.index({ question: 1 });
mistakeBookSchema.index({ 'reviewStatus': 1 });
mistakeBookSchema.index({ 'reviewInfo.nextReviewDate': 1 });
mistakeBookSchema.index({ 'importance': 1 });
mistakeBookSchema.index({ 'masteryLevel': 1 });
mistakeBookSchema.index({ 'tags': 1 });
mistakeBookSchema.index({ 'metadata.isArchived': 1 });
mistakeBookSchema.index({ 'questionSnapshot.type': 1 });
mistakeBookSchema.index({ 'questionSnapshot.difficulty': 1 });
mistakeBookSchema.index({ 'questionSnapshot.category': 1 });

// 保存前的中间件
mistakeBookSchema.pre('save', function(next) {
  // 更新修改时间
  this.updatedAt = Date.now();
  
  // 计算错误率
  if (this.errorStats && this.errorStats.totalAttempts > 0) {
    this.errorStats.errorRate = Math.round(((this.errorStats.totalAttempts - this.errorStats.correctAttempts) / this.errorStats.totalAttempts) * 100);
  }
  
  // 根据复习情况更新掌握程度
  if (this.reviewInfo && this.reviewInfo.consecutiveCorrect >= 3) {
    this.masteryLevel = Math.min(5, this.masteryLevel + 1);
    this.reviewInfo.consecutiveCorrect = 0;
  }
  
  // 如果掌握程度达到5，自动标记为已掌握
  if (this.masteryLevel >= 5 && this.reviewStatus !== 'mastered') {
    this.reviewStatus = 'mastered';
    this.metadata.isArchived = true;
    this.metadata.archiveDate = Date.now();
  }
  
  next();
});

// 静态方法：创建错题记录
mistakeBookSchema.statics.createMistakeRecord = async function(mistakeData) {
  try {
    // 检查是否已经存在相同的错题记录
    const existingMistake = await this.findOne({
      user: mistakeData.user,
      question: mistakeData.question,
      'metadata.isArchived': false
    });
    
    if (existingMistake) {
      // 更新现有错题记录
      existingMistake.errorStats.totalAttempts += 1;
      existingMistake.userAnswer = mistakeData.userAnswer;
      existingMistake.mistakeReason = mistakeData.mistakeReason || existingMistake.mistakeReason;
      existingMistake.importance = mistakeData.importance || existingMistake.importance;
      existingMistake.tags = [...new Set([...existingMistake.tags, ...(mistakeData.tags || [])])];
      existingMistake.source = mistakeData.source || existingMistake.source;
      existingMistake.examRecord = mistakeData.examRecord || existingMistake.examRecord;
      
      await existingMistake.save();
      return existingMistake;
    }
    
    // 创建新的错题记录
    const mistake = new this(mistakeData);
    await mistake.save();
    
    // 填充关联数据
    await mistake.populate('user', 'username email avatar');
    await mistake.populate('question', 'title content type difficulty tags');
    await mistake.populate('examRecord', 'title result.score');
    
    return mistake;
  } catch (error) {
    throw new Error('创建错题记录失败: ' + error.message);
  }
};

// 静态方法：获取用户的错题列表
mistakeBookSchema.statics.getUserMistakes = async function(userId, {
  page = 1,
  limit = 20,
  search = '',
  type = '',
  difficulty = [],
  category = '',
  tags = [],
  importance = [],
  masteryLevel = [],
  reviewStatus = '',
  isArchived = false,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const query = {
    user: userId,
    'metadata.isArchived': isArchived
  };
  
  // 按题型筛选
  if (type) {
    query['questionSnapshot.type'] = type;
  }
  
  // 按难度筛选
  if (difficulty && difficulty.length > 0) {
    query['questionSnapshot.difficulty'] = { $in: difficulty };
  }
  
  // 按分类筛选
  if (category) {
    query['questionSnapshot.category'] = category;
  }
  
  // 按标签筛选
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  
  // 按重要程度筛选
  if (importance && importance.length > 0) {
    query.importance = { $in: importance };
  }
  
  // 按掌握程度筛选
  if (masteryLevel && masteryLevel.length > 0) {
    query.masteryLevel = { $in: masteryLevel };
  }
  
  // 按复习状态筛选
  if (reviewStatus) {
    query.reviewStatus = reviewStatus;
  }
  
  // 搜索功能
  if (search) {
    query.$or = [
      { 'questionSnapshot.title': { $regex: search, $options: 'i' } },
      { 'questionSnapshot.content': { $regex: search, $options: 'i' } },
      { 'questionSnapshot.analysis': { $regex: search, $options: 'i' } },
      { mistakeReason: { $regex: search, $options: 'i' } }
    ];
  }
  
  // 排序
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  // 查询
  const mistakes = await this.find(query)
    .populate('question', 'title content type difficulty tags')
    .populate('examRecord', 'title result.score startTime')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort(sort);
  
  const total = await this.countDocuments(query);
  
  return {
    mistakes,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// 静态方法：获取错题详情
mistakeBookSchema.statics.getMistakeById = async function(mistakeId, userId) {
  try {
    const mistake = await this.findOne({
      _id: mistakeId,
      user: userId
    })
      .populate('question', 'title content type difficulty tags analysis')
      .populate('examRecord', 'title result.score startTime');
    
    if (!mistake) {
      throw new Error('错题记录不存在');
    }
    
    // 增加查看次数
    mistake.metadata.viewCount += 1;
    await mistake.save();
    
    return mistake;
  } catch (error) {
    throw new Error('获取错题详情失败: ' + error.message);
  }
};

// 静态方法：更新错题记录
mistakeBookSchema.statics.updateMistake = async function(mistakeId, updateData, userId) {
  try {
    const mistake = await this.findOne({
      _id: mistakeId,
      user: userId
    });
    
    if (!mistake) {
      throw new Error('错题记录不存在');
    }
    
    // 更新错题数据
    Object.assign(mistake, updateData);
    
    await mistake.save();
    return mistake;
  } catch (error) {
    throw new Error('更新错题记录失败: ' + error.message);
  }
};

// 静态方法：删除错题记录
mistakeBookSchema.statics.deleteMistake = async function(mistakeId, userId) {
  try {
    const mistake = await this.findOne({
      _id: mistakeId,
      user: userId
    });
    
    if (!mistake) {
      throw new Error('错题记录不存在');
    }
    
    await mistake.deleteOne();
    return { success: true, message: '错题记录已删除' };
  } catch (error) {
    throw new Error('删除错题记录失败: ' + error.message);
  }
};

// 静态方法：批量删除错题记录
mistakeBookSchema.statics.deleteMistakes = async function(mistakeIds, userId) {
  try {
    const result = await this.deleteMany({
      _id: { $in: mistakeIds },
      user: userId
    });
    
    return { 
      success: true, 
      message: `已删除 ${result.deletedCount} 条错题记录` 
    };
  } catch (error) {
    throw new Error('批量删除错题记录失败: ' + error.message);
  }
};

// 静态方法：归档错题
mistakeBookSchema.statics.archiveMistake = async function(mistakeId, userId) {
  try {
    const mistake = await this.findOne({
      _id: mistakeId,
      user: userId
    });
    
    if (!mistake) {
      throw new Error('错题记录不存在');
    }
    
    mistake.metadata.isArchived = true;
    mistake.metadata.archiveDate = Date.now();
    mistake.reviewStatus = 'mastered';
    
    await mistake.save();
    return { success: true, message: '错题已归档' };
  } catch (error) {
    throw new Error('归档错题失败: ' + error.message);
  }
};

// 静态方法：批量归档错题
mistakeBookSchema.statics.archiveMistakes = async function(mistakeIds, userId) {
  try {
    const result = await this.updateMany(
      {
        _id: { $in: mistakeIds },
        user: userId
      },
      {
        $set: {
          'metadata.isArchived': true,
          'metadata.archiveDate': Date.now(),
          'reviewStatus': 'mastered'
        }
      }
    );
    
    return { 
      success: true, 
      message: `已归档 ${result.modifiedCount} 条错题记录` 
    };
  } catch (error) {
    throw new Error('批量归档错题失败: ' + error.message);
  }
};

// 静态方法：记录复习情况
mistakeBookSchema.statics.recordReview = async function(mistakeId, userId, isCorrect) {
  try {
    const mistake = await this.findOne({
      _id: mistakeId,
      user: userId
    });
    
    if (!mistake) {
      throw new Error('错题记录不存在');
    }
    
    // 更新复习信息
    mistake.reviewInfo.reviewCount += 1;
    mistake.reviewInfo.lastReviewDate = Date.now();
    
    if (isCorrect) {
      mistake.reviewInfo.consecutiveCorrect += 1;
      mistake.errorStats.correctAttempts += 1;
      
      // 根据艾宾浩斯遗忘曲线计算下次复习时间
      const intervals = [1, 2, 4, 7, 15, 30, 60, 90];
      const intervalIndex = Math.min(mistake.reviewInfo.consecutiveCorrect - 1, intervals.length - 1);
      const nextReviewDays = intervals[intervalIndex];
      
      const nextReviewDate = new Date();
      nextReviewDate.setDate(nextReviewDate.getDate() + nextReviewDays);
      mistake.reviewInfo.nextReviewDate = nextReviewDate;
      
      // 更新掌握程度
      if (mistake.reviewInfo.consecutiveCorrect >= 3) {
        mistake.masteryLevel = Math.min(5, mistake.masteryLevel + 1);
        mistake.reviewInfo.consecutiveCorrect = 0;
      }
    } else {
      mistake.reviewInfo.consecutiveCorrect = 0;
      mistake.reviewInfo.nextReviewDate = Date.now(); // 立即复习
      
      // 降低掌握程度
      mistake.masteryLevel = Math.max(1, mistake.masteryLevel - 1);
    }
    
    mistake.errorStats.totalAttempts += 1;
    
    await mistake.save();
    return mistake;
  } catch (error) {
    throw new Error('记录复习情况失败: ' + error.message);
  }
};

// 静态方法：获取待复习的错题
mistakeBookSchema.statics.getDueForReview = async function(userId, limit = 20) {
  try {
    const mistakes = await this.find({
      user: userId,
      'metadata.isArchived': false,
      'reviewInfo.nextReviewDate': { $lte: Date.now() }
    })
      .populate('question', 'title content type difficulty tags')
      .sort({
        'importance': -1,
        'reviewInfo.nextReviewDate': 1
      })
      .limit(limit);
    
    return mistakes;
  } catch (error) {
    throw new Error('获取待复习错题失败: ' + error.message);
  }
};

// 静态方法：获取错题统计信息
mistakeBookSchema.statics.getMistakeStats = async function(userId) {
  try {
    const stats = await this.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId)
        }
      },
      {
        $group: {
          _id: {
            type: '$questionSnapshot.type',
            isArchived: '$metadata.isArchived'
          },
          count: { $sum: 1 },
          avgImportance: { $avg: '$importance' },
          avgMasteryLevel: { $avg: '$masteryLevel' },
          avgErrorRate: { $avg: '$errorStats.errorRate' }
        }
      }
    ]);
    
    // 计算待复习数量
    const dueForReviewCount = await this.countDocuments({
      user: userId,
      'metadata.isArchived': false,
      'reviewInfo.nextReviewDate': { $lte: Date.now() }
    });
    
    // 计算总错题数
    const totalCount = await this.countDocuments({
      user: userId,
      'metadata.isArchived': false
    });
    
    // 计算已掌握数量
    const masteredCount = await this.countDocuments({
      user: userId,
      'metadata.isArchived': true
    });
    
    return {
      typeStats: stats,
      dueForReviewCount,
      totalCount,
      masteredCount,
      masteryRate: totalCount > 0 ? Math.round((masteredCount / (totalCount + masteredCount)) * 100) : 0
    };
  } catch (error) {
    throw new Error('获取错题统计失败: ' + error.message);
  }
};

// 静态方法：获取推荐的复习题目
mistakeBookSchema.statics.getRecommendedForReview = async function(userId, count = 10) {
  try {
    // 优先选择：重要程度高、掌握程度低、到期未复习的题目
    const recommended = await this.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          'metadata.isArchived': false
        }
      },
      {
        $addFields: {
          isOverdue: { $lt: ['$reviewInfo.nextReviewDate', new Date()] },
          reviewScore: {
            $add: [
              { $multiply: ['$importance', 20] }, // 重要程度权重
              { $multiply: [{ $subtract: [6, '$masteryLevel'] }, 15] }, // 掌握程度权重（反向）
              { $cond: ['$isOverdue', 50, 0] }, // 逾期未复习的额外权重
              { $multiply: ['$errorStats.errorRate', 0.5] } // 错误率权重
            ]
          }
        }
      },
      { $sort: { reviewScore: -1 } },
      { $limit: count }
    ]);
    
    return recommended;
  } catch (error) {
    throw new Error('获取推荐复习题目失败: ' + error.message);
  }
};

const MistakeBook = mongoose.model('MistakeBook', mistakeBookSchema);

module.exports = MistakeBook;