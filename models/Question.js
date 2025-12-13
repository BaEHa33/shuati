const mongoose = require('mongoose');
const { Schema } = mongoose;

const questionSchema = new Schema({
  // 题目基本信息
  title: {
    type: String,
    required: [true, '题目标题不能为空'],
    trim: true,
    maxlength: [500, '题目标题最多500个字符']
  },
  
  content: {
    type: String,
    required: [true, '题目内容不能为空'],
    trim: true
  },
  
  // 题目类型
  type: {
    type: String,
    required: [true, '题目类型不能为空'],
    enum: ['single', 'multiple', 'judge', 'fill', 'essay'],
    default: 'single'
  },
  
  // 选项（单选题、多选题、判断题）
  options: {
    type: [String],
    default: []
  },
  
  // 正确答案
  answer: {
    type: Schema.Types.Mixed,
    required: [true, '正确答案不能为空']
  },
  
  // 解析
  analysis: {
    type: String,
    trim: true,
    default: ''
  },
  
  // 难度等级（1-5）
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 2
  },
  
  // 分值
  score: {
    type: Number,
    min: 0,
    default: 1
  },
  
  // 标签
  tags: {
    type: [String],
    default: []
  },
  
  // 分类
  category: {
    type: String,
    trim: true,
    default: 'general'
  },
  
  // 来源
  source: {
    type: String,
    trim: true,
    default: ''
  },
  
  // 创建者信息
  creator: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // 题目状态
  status: {
    type: String,
    enum: ['draft', 'published', 'archived'],
    default: 'published'
  },
  
  // 公开状态
  isPublic: {
    type: Boolean,
    default: true
  },
  
  // 使用统计
  usage: {
    totalAttempts: {
      type: Number,
      default: 0
    },
    correctAttempts: {
      type: Number,
      default: 0
    },
    correctRate: {
      type: Number,
      default: 0
    },
    lastUsed: {
      type: Date
    }
  },
  
  // 审核信息
  moderation: {
    isApproved: {
      type: Boolean,
      default: true
    },
    approvedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    rejectionReason: {
      type: String,
      trim: true
    }
  },
  
  // 版本控制
  version: {
    type: Number,
    default: 1
  },
  
  // 历史版本
  history: {
    type: [{
      version: Number,
      content: Schema.Types.Mixed,
      modifiedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      modifiedAt: Date
    }],
    default: []
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
  
  // 元数据
  metadata: {
    viewCount: {
      type: Number,
      default: 0
    },
    likeCount: {
      type: Number,
      default: 0
    },
    dislikeCount: {
      type: Number,
      default: 0
    },
    reportCount: {
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
      // 计算正确率
      if (ret.usage && ret.usage.totalAttempts > 0) {
        ret.usage.correctRate = Math.round((ret.usage.correctAttempts / ret.usage.totalAttempts) * 100);
      }
      return ret;
    }
  }
});

// 虚拟属性：正确率
questionSchema.virtual('correctRate').get(function() {
  if (this.usage && this.usage.totalAttempts > 0) {
    return Math.round((this.usage.correctAttempts / this.usage.totalAttempts) * 100);
  }
  return 0;
});

// 索引
questionSchema.index({ type: 1 });
questionSchema.index({ difficulty: 1 });
questionSchema.index({ category: 1 });
questionSchema.index({ tags: 1 });
questionSchema.index({ creator: 1 });
questionSchema.index({ status: 1 });
questionSchema.index({ isPublic: 1 });
questionSchema.index({ createdAt: -1 });
questionSchema.index({ 'usage.totalAttempts': -1 });
questionSchema.index({ 'usage.correctRate': 1 });

// 保存前的中间件
questionSchema.pre('save', function(next) {
  // 更新修改时间
  this.updatedAt = Date.now();
  
  // 如果是更新操作，创建历史记录
  if (this.isModified() && this._id) {
    this.version += 1;
    this.history.push({
      version: this.version,
      content: this.toObject(),
      modifiedBy: this.modifiedBy || this.creator,
      modifiedAt: Date.now()
    });
    
    // 限制历史记录数量
    if (this.history.length > 10) {
      this.history = this.history.slice(-10);
    }
  }
  
  next();
});

// 静态方法：创建新题目
questionSchema.statics.createQuestion = async function(questionData, creatorId) {
  try {
    const question = new this({
      ...questionData,
      creator: creatorId,
      modifiedBy: creatorId
    });
    
    await question.save();
    return question;
  } catch (error) {
    throw new Error('创建题目失败: ' + error.message);
  }
};

// 静态方法：获取题目列表
questionSchema.statics.getQuestions = async function({
  page = 1,
  limit = 20,
  type = '',
  difficulty = [],
  category = '',
  tags = [],
  search = '',
  creator = '',
  status = 'published',
  isPublic = true,
  sortBy = 'createdAt',
  sortOrder = 'desc'
}) {
  const query = {
    status: status
  };
  
  // 按类型筛选
  if (type) {
    query.type = type;
  }
  
  // 按难度筛选
  if (difficulty && difficulty.length > 0) {
    query.difficulty = { $in: difficulty };
  }
  
  // 按分类筛选
  if (category) {
    query.category = category;
  }
  
  // 按标签筛选
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  
  // 按创建者筛选
  if (creator) {
    query.creator = creator;
  }
  
  // 按公开状态筛选
  if (isPublic !== undefined) {
    query.isPublic = isPublic;
  }
  
  // 搜索功能
  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { content: { $regex: search, $options: 'i' } },
      { analysis: { $regex: search, $options: 'i' } }
    ];
  }
  
  // 排序
  const sort = {};
  sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
  
  // 查询
  const questions = await this.find(query)
    .populate('creator', 'username email avatar')
    .populate('moderation.approvedBy', 'username')
    .skip((page - 1) * limit)
    .limit(limit)
    .sort(sort);
  
  const total = await this.countDocuments(query);
  
  return {
    questions,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

// 静态方法：获取题目详情
questionSchema.statics.getQuestionById = async function(id, userId = null) {
  try {
    const query = { _id: id };
    
    // 如果不是管理员或创建者，只显示已发布和公开的题目
    if (!userId) {
      query.status = 'published';
      query.isPublic = true;
    }
    
    const question = await this.findOne(query)
      .populate('creator', 'username email avatar')
      .populate('moderation.approvedBy', 'username');
    
    if (!question) {
      throw new Error('题目不存在');
    }
    
    // 增加浏览次数
    question.metadata.viewCount += 1;
    await question.save();
    
    return question;
  } catch (error) {
    throw new Error('获取题目失败: ' + error.message);
  }
};

// 静态方法：更新题目
questionSchema.statics.updateQuestion = async function(id, updateData, userId) {
  try {
    const question = await this.findById(id);
    
    if (!question) {
      throw new Error('题目不存在');
    }
    
    // 检查权限
    if (question.creator.toString() !== userId && question.role !== 'admin') {
      throw new Error('没有权限修改此题目');
    }
    
    // 更新题目数据
    Object.assign(question, updateData, {
      modifiedBy: userId
    });
    
    await question.save();
    return question;
  } catch (error) {
    throw new Error('更新题目失败: ' + error.message);
  }
};

// 静态方法：删除题目（软删除）
questionSchema.statics.deleteQuestion = async function(id, userId) {
  try {
    const question = await this.findById(id);
    
    if (!question) {
      throw new Error('题目不存在');
    }
    
    // 检查权限
    if (question.creator.toString() !== userId && question.role !== 'admin') {
      throw new Error('没有权限删除此题目');
    }
    
    // 软删除
    question.status = 'archived';
    await question.save();
    
    return { success: true, message: '题目已删除' };
  } catch (error) {
    throw new Error('删除题目失败: ' + error.message);
  }
};

// 静态方法：批量删除题目
questionSchema.statics.deleteQuestions = async function(ids, userId) {
  try {
    const questions = await this.find({ _id: { $in: ids } });
    
    // 检查权限
    const unauthorizedQuestions = questions.filter(q => 
      q.creator.toString() !== userId && q.role !== 'admin'
    );
    
    if (unauthorizedQuestions.length > 0) {
      throw new Error('没有权限删除部分题目');
    }
    
    // 批量软删除
    await this.updateMany(
      { _id: { $in: ids } },
      { $set: { status: 'archived' } }
    );
    
    return { success: true, message: `已删除 ${ids.length} 道题目` };
  } catch (error) {
    throw new Error('批量删除题目失败: ' + error.message);
  }
};

// 静态方法：更新题目使用统计
questionSchema.statics.updateUsageStats = async function(id, isCorrect) {
  try {
    const update = {
      $inc: {
        'usage.totalAttempts': 1
      },
      $set: {
        'usage.lastUsed': Date.now()
      }
    };
    
    if (isCorrect) {
      update.$inc['usage.correctAttempts'] = 1;
    }
    
    await this.findByIdAndUpdate(id, update);
  } catch (error) {
    console.error('更新题目使用统计失败:', error);
  }
};

// 静态方法：获取随机题目
questionSchema.statics.getRandomQuestions = async function({
  count = 10,
  type = '',
  difficulty = [],
  category = '',
  tags = [],
  excludeIds = []
}) {
  const query = {
    status: 'published',
    isPublic: true
  };
  
  // 排除已做过的题目
  if (excludeIds && excludeIds.length > 0) {
    query._id = { $nin: excludeIds };
  }
  
  // 按类型筛选
  if (type) {
    query.type = type;
  }
  
  // 按难度筛选
  if (difficulty && difficulty.length > 0) {
    query.difficulty = { $in: difficulty };
  }
  
  // 按分类筛选
  if (category) {
    query.category = category;
  }
  
  // 按标签筛选
  if (tags && tags.length > 0) {
    query.tags = { $in: tags };
  }
  
  // 使用聚合管道随机获取题目
  const questions = await this.aggregate([
    { $match: query },
    { $sample: { size: count } }
  ]);
  
  return questions;
};

// 静态方法：获取题目统计信息
questionSchema.statics.getQuestionStats = async function(userId = null) {
  const query = {
    status: 'published',
    isPublic: true
  };
  
  // 如果指定了用户，只统计该用户的题目
  if (userId) {
    query.creator = userId;
  }
  
  const stats = await this.aggregate([
    { $match: query },
    {
      $group: {
        _id: '$type',
        count: { $sum: 1 },
        avgDifficulty: { $avg: '$difficulty' },
        avgCorrectRate: {
          $avg: {
            $cond: [{ $gt: ['$usage.totalAttempts', 0] }, 
                    { $divide: ['$usage.correctAttempts', '$usage.totalAttempts'] }, 
                    0]
          }
        }
      }
    }
  ]);
  
  return stats;
};

const Question = mongoose.model('Question', questionSchema);

module.exports = Question;