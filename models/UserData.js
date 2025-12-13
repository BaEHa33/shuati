const mongoose = require('mongoose');

// 错题子文档
const mistakeSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  questionId: {
    type: String,
    required: true
  },
  isPublic: {
    type: Boolean,
    default: false
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  type: {
    type: String,
    required: true,
    enum: ['single', 'multiple', 'judge', 'fill', 'essay']
  },
  options: {
    type: Array,
    default: []
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  wrongAnswer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  analysis: {
    type: String,
    default: '',
    trim: true
  },
  mistakeTime: {
    type: Date,
    default: Date.now
  },
  isImportant: {
    type: Boolean,
    default: false
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  lastReviewTime: {
    type: Date,
    default: null
  },
  tags: {
    type: Array,
    default: []
  }
});

// 考试记录子文档
const examRecordSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  score: {
    type: Number,
    required: true,
    min: 0,
    max: 100
  },
  grade: {
    type: String,
    required: true,
    enum: ['优秀', '良好', '及格', '不及格']
  },
  correctCount: {
    type: Number,
    required: true,
    min: 0
  },
  wrongCount: {
    type: Number,
    required: true,
    min: 0
  },
  totalQuestions: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number,
    required: true,
    min: 1
  },
  questions: {
    type: Array,
    default: []
  },
  type: {
    type: String,
    default: 'normal',
    enum: ['normal', 'practice', 'mock']
  }
});

// 学习统计子文档
const studyStatsSchema = new mongoose.Schema({
  totalQuestions: {
    type: Number,
    default: 0,
    min: 0
  },
  correctAnswers: {
    type: Number,
    default: 0,
    min: 0
  },
  totalStudyTime: {
    type: Number,
    default: 0,
    min: 0
  },
  examRecords: {
    type: [examRecordSchema],
    default: []
  },
  correctRate: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  averageScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  bestScore: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  }
});

// 个人题目子文档
const personalQuestionSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    required: true,
    enum: ['single', 'multiple', 'judge', 'fill', 'essay']
  },
  content: {
    type: String,
    required: true,
    trim: true
  },
  options: {
    type: Array,
    default: []
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  analysis: {
    type: String,
    default: '',
    trim: true
  },
  difficulty: {
    type: Number,
    min: 1,
    max: 5,
    default: 2
  },
  tags: {
    type: Array,
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  usageCount: {
    type: Number,
    default: 0
  }
});

// 用户数据主文档
const userDataSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  personalQuestions: {
    type: [personalQuestionSchema],
    default: []
  },
  mistakeBank: {
    type: [mistakeSchema],
    default: []
  },
  studyStats: {
    type: studyStatsSchema,
    default: () => ({})
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  syncVersion: {
    type: Number,
    default: 1
  },
  preferences: {
    examSettings: {
      autoSubmit: { type: Boolean, default: false },
      showAnswerImmediately: { type: Boolean, default: true },
      showAnalysis: { type: Boolean, default: true }
    },
    displaySettings: {
      fontSize: { type: Number, default: 16 },
      theme: { type: String, default: 'light' }
    }
  }
});

// 更新学习统计
userDataSchema.methods.updateStudyStats = function(correctCount, totalCount, duration) {
  this.studyStats.totalQuestions += totalCount;
  this.studyStats.correctAnswers += correctCount;
  this.studyStats.totalStudyTime += duration;
  
  // 更新正确率
  if (this.studyStats.totalQuestions > 0) {
    this.studyStats.correctRate = Math.round(
      (this.studyStats.correctAnswers / this.studyStats.totalQuestions) * 100
    );
  }
  
  return this.studyStats;
};

// 添加考试记录
userDataSchema.methods.addExamRecord = function(record) {
  this.studyStats.examRecords.push(record);
  
  // 保持最多100条记录
  if (this.studyStats.examRecords.length > 100) {
    this.studyStats.examRecords = this.studyStats.examRecords.slice(-100);
  }
  
  // 更新平均分和最高分
  const scores = this.studyStats.examRecords.map(r => r.score);
  this.studyStats.averageScore = Math.round(
    scores.reduce((sum, score) => sum + score, 0) / scores.length
  );
  this.studyStats.bestScore = Math.max(...scores);
  
  return record;
};

// 获取错题统计
userDataSchema.methods.getMistakeStats = function() {
  const mistakes = this.mistakeBank;
  const stats = {
    total: mistakes.length,
    byType: {},
    byMonth: {},
    important: mistakes.filter(m => m.isImportant).length,
    unreviewed: mistakes.filter(m => m.reviewCount === 0).length
  };
  
  // 按题型统计
  mistakes.forEach(mistake => {
    stats.byType[mistake.type] = (stats.byType[mistake.type] || 0) + 1;
  });
  
  // 按月份统计
  mistakes.forEach(mistake => {
    const month = mistake.mistakeTime.toISOString().slice(0, 7);
    stats.byMonth[month] = (stats.byMonth[month] || 0) + 1;
  });
  
  return stats;
};

const UserData = mongoose.model('UserData', userDataSchema);

module.exports = UserData;