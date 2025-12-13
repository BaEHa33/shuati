const mongoose = require('mongoose');
const config = require('./config');
const logger = require('../utils/logger');

// MongoDB连接配置
const mongoConfig = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  ...config.database.options
};

// 连接状态
let isConnected = false;
let connectionRetryCount = 0;
const MAX_RETRIES = 5;
const RETRY_DELAY = 5000; // 5秒

// 连接数据库
async function connectDB() {
  try {
    if (isConnected) {
      logger.info('数据库已连接');
      return;
    }

    logger.info(`正在连接数据库: ${maskDatabaseUrl(config.database.url)}`);
    
    const connection = await mongoose.connect(config.database.url, mongoConfig);
    
    // 监听连接事件
    connection.connection.on('connected', () => {
      isConnected = true;
      connectionRetryCount = 0;
      logger.info('数据库连接成功');
    });

    connection.connection.on('error', (error) => {
      isConnected = false;
      logger.error('数据库连接错误:', error);
      handleConnectionError();
    });

    connection.connection.on('disconnected', () => {
      isConnected = false;
      logger.warn('数据库连接断开');
      handleConnectionError();
    });

    // 监听进程信号，确保在进程退出前关闭数据库连接
    process.on('SIGINT', disconnectDB);
    process.on('SIGTERM', disconnectDB);

    return connection;

  } catch (error) {
    logger.error('数据库连接失败:', error);
    handleConnectionError();
    throw error;
  }
}

// 断开数据库连接
async function disconnectDB() {
  try {
    if (isConnected) {
      await mongoose.disconnect();
      isConnected = false;
      logger.info('数据库连接已断开');
    }
  } catch (error) {
    logger.error('断开数据库连接失败:', error);
  }
}

// 处理连接错误和重连
function handleConnectionError() {
  if (connectionRetryCount < MAX_RETRIES) {
    connectionRetryCount++;
    logger.warn(`尝试重新连接数据库 (${connectionRetryCount}/${MAX_RETRIES})...`);
    
    setTimeout(async () => {
      try {
        await connectDB();
      } catch (error) {
        logger.error('重连数据库失败:', error);
      }
    }, RETRY_DELAY);
  } else {
    logger.error('达到最大重连次数，数据库连接失败');
    process.exit(1);
  }
}

// 获取数据库连接状态
function getConnectionStatus() {
  return {
    isConnected,
    connectionRetryCount,
    maxRetries: MAX_RETRIES,
    dbName: mongoose.connection.name,
    host: mongoose.connection.host,
    port: mongoose.connection.port
  };
}

// 验证数据库连接
async function validateConnection() {
  try {
    if (!isConnected) {
      throw new Error('数据库未连接');
    }
    
    // 执行一个简单的查询来验证连接
    await mongoose.connection.db.admin().ping();
    return true;
  } catch (error) {
    logger.error('数据库连接验证失败:', error);
    isConnected = false;
    return false;
  }
}

// 掩盖数据库URL中的敏感信息
function maskDatabaseUrl(url) {
  if (!url) return '';
  
  // 掩盖密码部分
  return url.replace(/:\w+@/, ':****@');
}

// 获取数据库统计信息
async function getDatabaseStats() {
  try {
    if (!isConnected) {
      throw new Error('数据库未连接');
    }
    
    const stats = await mongoose.connection.db.stats();
    return {
      database: stats.db,
      collections: stats.collections,
      objects: stats.objects,
      avgObjSize: stats.avgObjSize,
      dataSize: stats.dataSize,
      storageSize: stats.storageSize,
      indexes: stats.indexes,
      indexSize: stats.indexSize
    };
  } catch (error) {
    logger.error('获取数据库统计信息失败:', error);
    throw error;
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus,
  validateConnection,
  getDatabaseStats,
  mongoose
};