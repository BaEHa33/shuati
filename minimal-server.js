const http = require('http');
const url = require('url');
const path = require('path');
const fs = require('fs');

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

// 工具函数
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

function sendResponse(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data, null, 2));
}

// 路由处理
function handleRequest(req, res) {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // 处理OPTIONS请求
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // API路由处理
  if (pathname.startsWith('/api/')) {
    const apiPath = pathname.slice(5);
    
    // 认证相关路由
    if (apiPath.startsWith('auth/')) {
      const authPath = apiPath.slice(5);
      
      if (authPath === 'user' && method === 'GET') {
        // 获取当前用户信息
        sendResponse(res, 200, {
          success: true,
          user: mockData.users[0]
        });
      } else if (authPath === 'login' && method === 'POST') {
        // 用户登录
        parseBody(req).then(body => {
          const { username, password } = body;
          
          if (username === 'demo' && password === 'demo123') {
            sendResponse(res, 200, {
              success: true,
              message: '登录成功',
              token: 'mock-jwt-token',
              user: mockData.users[0]
            });
          } else {
            sendResponse(res, 401, {
              success: false,
              message: '用户名或密码错误'
            });
          }
        });
      } else if (authPath === 'register' && method === 'POST') {
        // 用户注册
        parseBody(req).then(body => {
          const { username, password, email } = body;
          
          sendResponse(res, 201, {
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
      } else {
        sendResponse(res, 404, {
          success: false,
          message: '接口不存在'
        });
      }
      return;
    }

    // 题目相关路由
    if (apiPath.startsWith('questions/')) {
      const questionsPath = apiPath.slice(10);
      
      if (questionsPath === 'public' && method === 'GET') {
        // 获取共享题库
        sendResponse(res, 200, {
          success: true,
          data: mockData.questions,
          pagination: {
            total: mockData.questions.length,
            page: 1,
            limit: 20,
            pages: 1
          }
        });
      } else if (questionsPath.startsWith('public/') && method === 'GET') {
        // 获取特定共享题目
        const questionId = questionsPath.slice(7);
        const question = mockData.questions.find(q => q.id === questionId);
        
        if (question) {
          sendResponse(res, 200, {
            success: true,
            data: question
          });
        } else {
          sendResponse(res, 404, {
            success: false,
            message: '题目不存在'
          });
        }
      } else {
        sendResponse(res, 404, {
          success: false,
          message: '接口不存在'
        });
      }
      return;
    }

    // 统计相关路由
    if (apiPath === 'stats' && method === 'GET') {
      // 获取学习统计
      sendResponse(res, 200, {
        success: true,
        data: {
          ...mockData.studyStats,
          totalExams: mockData.studyStats.examRecords.length,
          averageDuration: 1350,
          averageQuestions: 22,
          recentExams: mockData.studyStats.examRecords
        }
      });
    } else if (apiPath === 'stats/trends' && method === 'GET') {
      // 获取学习趋势
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
      
      sendResponse(res, 200, {
        success: true,
        data: trends,
        period: 'week'
      });
    } else if (apiPath === 'stats/overview' && method === 'GET') {
      // 获取学习概览
      sendResponse(res, 200, {
        success: true,
        data: {
          totalExams: mockData.studyStats.examRecords.length,
          totalQuestions: mockData.studyStats.totalQuestions,
          totalStudyTime: mockData.studyStats.totalStudyTime,
          averageScore: mockData.studyStats.averageScore,
          bestScore: mockData.studyStats.bestScore,
          correctRate: mockData.studyStats.correctRate,
          mistakeCount: 0,
          personalQuestionCount: 0,
          todayStats: {
            examCount: 0,
            questionCount: 0,
            studyTime: 0,
            averageScore: 0
          },
          weekStats: {
            examCount: 2,
            questionCount: 45,
            studyTime: 2700,
            averageScore: 88
          },
          typeStats: {
            single: { total: 150, correct: 120, rate: 80 },
            multiple: { total: 80, correct: 60, rate: 75 },
            judge: { total: 50, correct: 45, rate: 90 }
          }
        }
      });
    } else if (apiPath === 'mistakes' && method === 'GET') {
      // 获取错题本
      sendResponse(res, 200, {
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
    } else {
      sendResponse(res, 404, {
        success: false,
        message: '接口不存在'
      });
    }
    return;
  }

  // 根路径响应
  if (pathname === '/' && method === 'GET') {
    sendResponse(res, 200, {
      success: true,
      message: '智能刷题系统 API (极简版)',
      version: '1.0.0',
      endpoints: {
        auth: '/api/auth',
        questions: '/api/questions',
        mistakes: '/api/mistakes',
        stats: '/api/stats'
      },
      note: '这是一个极简版的API服务，使用Node.js内置模块构建',
      testAccount: {
        username: 'demo',
        password: 'demo123'
      }
    });
    return;
  }

  // 健康检查
  if (pathname === '/health' && method === 'GET') {
    sendResponse(res, 200, {
      success: true,
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        api: 'running',
        database: 'mock'
      }
    });
    return;
  }

  // 404处理
  sendResponse(res, 404, {
    success: false,
    message: '接口不存在'
  });
}

// 创建HTTP服务器
const PORT = process.env.PORT || 3000;
const server = http.createServer(handleRequest);

// 启动服务器
server.listen(PORT, () => {
  console.log('🚀 智能刷题系统 API 服务器启动成功！');
  console.log(`📡 服务地址: http://localhost:${PORT}`);
  console.log(`📖 API文档: http://localhost:${PORT}/`);
  console.log(`🏥 健康检查: http://localhost:${PORT}/health`);
  console.log('🔧 技术栈: Node.js 内置模块 (无外部依赖)');
  console.log('👤 测试账号: demo / demo123');
  console.log('📝 包含功能: 用户认证、题目查询、学习统计、错题本');
  console.log('✨ 服务已就绪，可以开始使用了！');
});

// 处理服务器错误
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ 端口 ${PORT} 已被占用，请使用其他端口`);
    process.exit(1);
  } else {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n🛑 正在关闭服务器...');
  server.close(() => {
    console.log('✅ 服务器已关闭');
    process.exit(0);
  });
});