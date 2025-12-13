const express = require('express');
const cors = require('cors');
const path = require('path');

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 模拟数据
const mockData = {
  questions: [
    {
      id: 'q1',
      type: 'single',
      content: '以下哪个不是JavaScript的基本数据类型？',
      options: ['String', 'Number', 'Boolean', 'Array', 'Undefined'],
      answer: 3,
      analysis: 'Array是引用数据类型，不是基本数据类型。JavaScript的基本数据类型有：String、Number、Boolean、Undefined、Null、Symbol、BigInt。',
      difficulty: 2,
      tags: ['JavaScript', '基础']
    },
    {
      id: 'q2',
      type: 'multiple',
      content: '以下哪些是React的核心特性？',
      options: ['组件化', '单向数据流', '双向数据绑定', '虚拟DOM', '服务端渲染'],
      answer: [0, 1, 3],
      analysis: 'React的核心特性包括组件化、单向数据流和虚拟DOM。双向数据绑定是Angular的特性，服务端渲染是Next.js等框架提供的功能。',
      difficulty: 3,
      tags: ['React', '前端框架']
    },
    {
      id: 'q3',
      type: 'judge',
      content: 'CSS中的flex布局可以让子元素在主轴上居中对齐。',
      options: ['正确', '错误'],
      answer: true,
      analysis: '使用justify-content: center可以让flex容器中的子元素在主轴上居中对齐。',
      difficulty: 1,
      tags: ['CSS', '布局']
    }
  ],
  
  users: [
    {
      id: 'user1',
      username: 'demo',
      email: 'demo@example.com',
      role: 'user',
      settings: {
        theme: 'light',
        fontSize: 16
      }
    }
  ],
  
  studyStats: {
    totalQuestions: 1250,
    correctAnswers: 980,
    totalStudyTime: 72000,
    correctRate: 78,
    averageScore: 85,
    bestScore: 98,
    examRecords: [
      {
        date: new Date(Date.now() - 86400000).toISOString(),
        score: 85,
        grade: '良好',
        correctCount: 17,
        wrongCount: 3,
        totalQuestions: 20,
        duration: 1200,
        type: 'normal'
      },
      {
        date: new Date(Date.now() - 172800000).toISOString(),
        score: 92,
        grade: '优秀',
        correctCount: 23,
        wrongCount: 2,
        totalQuestions: 25,
        duration: 1500,
        type: 'practice'
      }
    ]
  }
};

// API路由
app.get('/api/auth/user', (req, res) => {
  res.json({
    success: true,
    user: mockData.users[0]
  });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  if (username === 'demo' && password === 'demo123') {
    res.json({
      success: true,
      message: '登录成功',
      token: 'mock-jwt-token',
      user: mockData.users[0]
    });
  } else {
    res.status(401).json({
      success: false,
      message: '用户名或密码错误'
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, password, email } = req.body;
  
  res.status(201).json({
    success: true,
    message: '注册成功',
    token: 'mock-jwt-token',
    user: {
      id: 'newuser_' + Date.now(),
      username,
      email,
      role: 'user',
      settings: {
        theme: 'light',
        fontSize: 16
      }
    }
  });
});

app.get('/api/questions/public', (req, res) => {
  res.json({
    success: true,
    data: mockData.questions,
    pagination: {
      total: mockData.questions.length,
      page: 1,
      limit: 20,
      pages: 1
    }
  });
});

app.get('/api/questions/public/:id', (req, res) => {
  const question = mockData.questions.find(q => q.id === req.params.id);
  
  if (question) {
    res.json({
      success: true,
      data: question
    });
  } else {
    res.status(404).json({
      success: false,
      message: '题目不存在'
    });
  }
});

app.get('/api/stats', (req, res) => {
  res.json({
    success: true,
    data: {
      ...mockData.studyStats,
      totalExams: mockData.studyStats.examRecords.length,
      averageDuration: 1350,
      averageQuestions: 22,
      recentExams: mockData.studyStats.examRecords
    }
  });
});

app.get('/api/stats/trends', (req, res) => {
  const trends = [
    {
      date: new Date(Date.now() - 6 * 86400000).toISOString().split('T')[0],
      score: 82,
      examCount: 1,
      questionCount: 20
    },
    {
      date: new Date(Date.now() - 5 * 86400000).toISOString().split('T')[0],
      score: null,
      examCount: 0,
      questionCount: 0
    },
    {
      date: new Date(Date.now() - 4 * 86400000).toISOString().split('T')[0],
      score: 78,
      examCount: 1,
      questionCount: 25
    },
    {
      date: new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0],
      score: null,
      examCount: 0,
      questionCount: 0
    },
    {
      date: new Date(Date.now() - 2 * 86400000).toISOString().split('T')[0],
      score: 92,
      examCount: 1,
      questionCount: 25
    },
    {
      date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      score: 85,
      examCount: 1,
      questionCount: 20
    },
    {
      date: new Date().toISOString().split('T')[0],
      score: null,
      examCount: 0,
      questionCount: 0
    }
  ];
  
  res.json({
    success: true,
    data: trends,
    period: 'week'
  });
});

app.get('/api/mistakes', (req, res) => {
  res.json({
    success: true,
    data: [],
    stats: {
      total: 0,
      byType: {},
      byMonth: {},
      important: 0,
      unreviewed: 0
    },
    pagination: {
      total: 0,
      page: 1,
      limit: 20,
      pages: 0
    }
  });
});

// 根路径响应
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '智能刷题系统 API (简化版)',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      questions: '/api/questions',
      mistakes: '/api/mistakes',
      stats: '/api/stats'
    },
    note: '这是一个简化版的API服务，包含基本功能'
  });
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      api: 'running',
      database: 'mock'
    }
  });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '接口不存在'
  });
});

// 启动服务器
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`🚀 服务器运行在 http://localhost:${PORT}`);
  console.log(`📖 API文档: http://localhost:${PORT}/`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log(`🔧 这是一个简化版的API服务，包含基本功能`);
  console.log(`👤 测试账号: demo / demo123`);
});

module.exports = app;