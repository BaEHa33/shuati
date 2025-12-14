/**
 * 同步管理器 - 简化版
 * 提供基础的数据导出和导入功能
 */

class SyncManager {
    constructor() {
        this.version = '1.0.0';
        this.deviceId = this.generateDeviceId();
        this.isInitialized = false;
    }

    // 生成设备ID
    generateDeviceId() {
        let deviceId = localStorage.getItem('sync_device_id');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sync_device_id', deviceId);
        }
        return deviceId;
    }

    // 初始化
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('🔄 同步管理器初始化中...');
        
        try {
            // 检查浏览器兼容性
            if (!this.checkCompatibility()) {
                throw new Error('当前浏览器不支持所需的Web API');
            }
            
            this.isInitialized = true;
            console.log('✅ 同步管理器初始化成功');
            return true;
        } catch (error) {
            console.error('❌ 同步管理器初始化失败:', error);
            return false;
        }
    }

    // 检查浏览器兼容性
    checkCompatibility() {
        const requiredFeatures = {
            localStorage: 'localStorage' in window,
            fileAPI: 'FileReader' in window && 'Blob' in window,
            json: typeof JSON === 'object' && typeof JSON.stringify === 'function'
        };

        const missingFeatures = Object.entries(requiredFeatures)
            .filter(([feature, supported]) => !supported)
            .map(([feature]) => feature);

        if (missingFeatures.length > 0) {
            console.warn('⚠️ 缺少必要的浏览器功能:', missingFeatures);
            return false;
        }

        return true;
    }

    // 导出数据
    async exportData(options = {}) {
        try {
            console.log('📤 开始导出数据...');
            
            await this.initialize();
            
            const { 
                includePublic = true, 
                includePersonal = true,
                includeMistakes = true,
                includeStats = true
            } = options;

            // 获取应用实例
            const app = window.app;
            if (!app) {
                throw new Error('应用实例未找到');
            }

            // 检查登录状态
            if (!app.currentUser) {
                throw new Error('请先登录后再导出数据');
            }

            const exportData = {
                version: this.version,
                deviceId: this.deviceId,
                exportTime: new Date().toISOString(),
                userId: app.currentUser.id,
                username: app.currentUser.username,
                dataTypes: [],
                stats: {}
            };

            // 导出公共题库
            if (includePublic && app.publicQuestionBank) {
                exportData.publicQuestions = [...app.publicQuestionBank];
                exportData.dataTypes.push('publicQuestions');
                exportData.stats.publicQuestions = app.publicQuestionBank.length;
            }

            // 导出个人题库
            if (includePersonal && app.personalQuestionBank) {
                exportData.personalQuestions = [...app.personalQuestionBank];
                exportData.dataTypes.push('personalQuestions');
                exportData.stats.personalQuestions = app.personalQuestionBank.length;
            }

            // 导出错题本
            if (includeMistakes && app.mistakeBank) {
                exportData.mistakeBank = [...app.mistakeBank];
                exportData.dataTypes.push('mistakeBank');
                exportData.stats.mistakes = app.mistakeBank.length;
            }

            // 导出学习统计
            if (includeStats && app.studyStats) {
                exportData.studyStats = { ...app.studyStats };
                exportData.dataTypes.push('studyStats');
            }

            // 计算总题数
            exportData.stats.totalQuestions = (exportData.stats.publicQuestions || 0) + 
                                             (exportData.stats.personalQuestions || 0);

            // 添加设备信息
            exportData.deviceInfo = {
                userAgent: navigator.userAgent,
                screenSize: `${window.screen.width}x${window.screen.height}`,
                language: navigator.language,
                platform: navigator.platform
            };

            console.log('📊 导出统计:', exportData.stats);

            // 如果没有数据可导出，生成示例数据
            if (exportData.dataTypes.length === 0 || exportData.stats.totalQuestions === 0) {
                console.log('📝 生成示例数据...');
                const sampleData = this.generateSampleData();
                exportData.publicQuestions = sampleData.publicQuestions;
                exportData.personalQuestions = sampleData.personalQuestions;
                exportData.dataTypes = ['publicQuestions', 'personalQuestions'];
                exportData.stats.publicQuestions = sampleData.publicQuestions.length;
                exportData.stats.personalQuestions = sampleData.personalQuestions.length;
                exportData.stats.totalQuestions = sampleData.publicQuestions.length + sampleData.personalQuestions.length;
                exportData.isSampleData = true;
            }

            // 转换为JSON字符串
            const jsonString = JSON.stringify(exportData, null, 2);
            console.log(`📏 导出数据大小: ${jsonString.length} 字符`);

            // 创建Blob并下载
            const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `smart_exam_data_${app.currentUser.username}_${new Date().toISOString().split('T')[0]}.json`;
            a.style.display = 'none';

            document.body.appendChild(a);
            
            // 使用setTimeout确保DOM更新
            setTimeout(() => {
                a.click();
                setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                    console.log('✅ 数据导出完成');
                }, 100);
            }, 0);

            return exportData;
        } catch (error) {
            console.error('❌ 导出数据失败:', error);
            throw error;
        }
    }

    // 导入数据
    async importData(file, options = {}) {
        return new Promise((resolve, reject) => {
            try {
                console.log('📥 开始导入数据...');
                
                this.initialize();

                // 验证文件
                if (!file) {
                    throw new Error('未选择文件');
                }

                if (!file.name.toLowerCase().endsWith('.json')) {
                    throw new Error('请选择JSON格式的同步数据文件');
                }

                if (file.size > 10 * 1024 * 1024) { // 10MB限制
                    throw new Error('文件大小不能超过10MB');
                }

                const reader = new FileReader();

                reader.onload = async (e) => {
                    try {
                        const content = e.target.result;
                        const importData = JSON.parse(content);

                        // 验证数据格式
                        if (!this.validateImportData(importData)) {
                            throw new Error('无效的数据格式');
                        }

                        console.log('🔍 导入数据验证通过');
                        console.log('📊 导入统计:', {
                            version: importData.version,
                            deviceId: importData.deviceId,
                            exportTime: importData.exportTime,
                            dataTypes: importData.dataTypes,
                            stats: importData.stats
                        });

                        // 获取应用实例
                        const app = window.app;
                        if (!app) {
                            throw new Error('应用实例未找到');
                        }

                        const importResults = {
                            success: true,
                            imported: {},
                            errors: []
                        };

                        // 导入公共题库
                        if (importData.publicQuestions && Array.isArray(importData.publicQuestions)) {
                            try {
                                const uniqueQuestions = this.removeDuplicates(
                                    importData.publicQuestions, 
                                    app.publicQuestionBank || []
                                );
                                app.publicQuestionBank.push(...uniqueQuestions);
                                importResults.imported.publicQuestions = uniqueQuestions.length;
                                console.log(`✅ 导入公共题库: ${uniqueQuestions.length} 题`);
                            } catch (error) {
                                importResults.errors.push(`公共题库导入失败: ${error.message}`);
                                console.error('❌ 公共题库导入失败:', error);
                            }
                        }

                        // 导入个人题库
                        if (importData.personalQuestions && Array.isArray(importData.personalQuestions)) {
                            try {
                                const uniqueQuestions = this.removeDuplicates(
                                    importData.personalQuestions, 
                                    app.personalQuestionBank || []
                                );
                                app.personalQuestionBank.push(...uniqueQuestions);
                                importResults.imported.personalQuestions = uniqueQuestions.length;
                                console.log(`✅ 导入个人题库: ${uniqueQuestions.length} 题`);
                            } catch (error) {
                                importResults.errors.push(`个人题库导入失败: ${error.message}`);
                                console.error('❌ 个人题库导入失败:', error);
                            }
                        }

                        // 导入错题本
                        if (importData.mistakeBank && Array.isArray(importData.mistakeBank)) {
                            try {
                                const uniqueMistakes = this.removeDuplicates(
                                    importData.mistakeBank, 
                                    app.mistakeBank || []
                                );
                                app.mistakeBank.push(...uniqueMistakes);
                                importResults.imported.mistakes = uniqueMistakes.length;
                                console.log(`✅ 导入错题本: ${uniqueMistakes.length} 条`);
                            } catch (error) {
                                importResults.errors.push(`错题本导入失败: ${error.message}`);
                                console.error('❌ 错题本导入失败:', error);
                            }
                        }

                        // 导入学习统计
                        if (importData.studyStats && typeof importData.studyStats === 'object') {
                            try {
                                this.mergeStudyStats(app.studyStats, importData.studyStats);
                                importResults.imported.studyStats = true;
                                console.log('✅ 导入学习统计');
                            } catch (error) {
                                importResults.errors.push(`学习统计导入失败: ${error.message}`);
                                console.error('❌ 学习统计导入失败:', error);
                            }
                        }

                        // 保存数据
                        if (typeof app.saveUserData === 'function') {
                            app.saveUserData();
                        }

                        // 更新统计
                        if (typeof app.updateBankStats === 'function') {
                            app.updateBankStats();
                        }

                        // 更新同步状态
                        app.syncStatus = 'synced';
                        app.lastSyncTime = new Date().toISOString();

                        importResults.success = importResults.errors.length === 0;
                        resolve(importResults);
                        console.log('✅ 数据导入完成');

                    } catch (error) {
                        console.error('❌ 导入处理失败:', error);
                        reject(error);
                    }
                };

                reader.onerror = (error) => {
                    console.error('❌ 文件读取失败:', error);
                    reject(new Error('文件读取失败，请检查文件是否损坏'));
                };

                reader.readAsText(file, 'UTF-8');

            } catch (error) {
                console.error('❌ 导入数据失败:', error);
                reject(error);
            }
        });
    }

    // 验证导入数据
    validateImportData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }

        // 必需字段
        if (!data.version || !data.exportTime || !data.deviceId) {
            return false;
        }

        // 数据类型验证
        const validDataTypes = ['publicQuestions', 'personalQuestions', 'mistakeBank', 'studyStats'];
        
        if (data.dataTypes) {
            if (!Array.isArray(data.dataTypes)) {
                return false;
            }
            
            // 检查是否包含至少一种数据类型
            if (data.dataTypes.length === 0) {
                return false;
            }
            
            // 检查数据类型是否有效
            for (const type of data.dataTypes) {
                if (!validDataTypes.includes(type)) {
                    return false;
                }
            }
        }

        return true;
    }

    // 移除重复项
    removeDuplicates(newItems, existingItems) {
        const existingIds = new Set(existingItems.map(item => item.id));
        return newItems.filter(item => !existingIds.has(item.id));
    }

    // 合并学习统计
    mergeStudyStats(targetStats, sourceStats) {
        if (!targetStats || !sourceStats) return;

        // 合并总题数和正确题数
        if (sourceStats.totalQuestions > targetStats.totalQuestions) {
            targetStats.totalQuestions = sourceStats.totalQuestions;
        }

        if (sourceStats.correctAnswers > targetStats.correctAnswers) {
            targetStats.correctAnswers = sourceStats.correctAnswers;
        }

        if (sourceStats.totalStudyTime > targetStats.totalStudyTime) {
            targetStats.totalStudyTime = sourceStats.totalStudyTime;
        }

        // 合并考试记录
        if (sourceStats.examRecords && Array.isArray(sourceStats.examRecords)) {
            const existingIds = new Set(targetStats.examRecords.map(record => record.id));
            const newRecords = sourceStats.examRecords.filter(record => !existingIds.has(record.id));
            targetStats.examRecords.push(...newRecords);
        }
    }

    // 生成示例数据
    generateSampleData() {
        const timestamp = Date.now();
        return {
            publicQuestions: [
                {
                    id: `sample_pub_1_${timestamp}`,
                    content: 'HTML5中用于定义文档主要内容的标签是：',
                    type: 'single',
                    options: ['<header>', '<main>', '<section>', '<article>'],
                    answer: '1',
                    analysis: '<main>标签定义文档的主要内容，一个文档中应该只有一个<main>元素。',
                    source: 'system-sample',
                    createTime: new Date().toISOString(),
                    difficulty: 2,
                    category: 'HTML5',
                    tags: ['HTML', '语义化标签']
                },
                {
                    id: `sample_pub_2_${timestamp}`,
                    content: 'CSS中，哪个属性用于设置元素的外边距？',
                    type: 'single',
                    options: ['padding', 'border', 'margin', 'spacing'],
                    answer: '2',
                    analysis: 'margin属性用于设置元素的外边距，控制元素与其他元素之间的距离。',
                    source: 'system-sample',
                    createTime: new Date().toISOString(),
                    difficulty: 1,
                    category: 'CSS基础',
                    tags: ['CSS', '盒模型']
                },
                {
                    id: `sample_pub_3_${timestamp}`,
                    content: 'JavaScript中，以下哪个方法用于向数组末尾添加元素？',
                    type: 'single',
                    options: ['push()', 'pop()', 'shift()', 'unshift()'],
                    answer: '0',
                    analysis: 'push()方法向数组末尾添加一个或多个元素，并返回新的长度。',
                    source: 'system-sample',
                    createTime: new Date().toISOString(),
                    difficulty: 1,
                    category: 'JavaScript',
                    tags: ['JS', '数组方法']
                }
            ],
            personalQuestions: [
                {
                    id: `sample_per_1_${timestamp}`,
                    content: 'Vue组件的data选项必须是一个函数。',
                    type: 'judge',
                    answer: 'true',
                    analysis: '在Vue组件中，data选项必须是一个函数，这样每个实例可以维护独立的数据副本，避免数据污染。',
                    source: 'system-sample',
                    createTime: new Date().toISOString(),
                    difficulty: 2,
                    category: 'Vue',
                    tags: ['Vue', '组件', 'data选项']
                },
                {
                    id: `sample_per_2_${timestamp}`,
                    content: 'CSS Grid布局可以创建二维布局。',
                    type: 'judge',
                    answer: 'true',
                    analysis: 'CSS Grid是一个二维布局系统，可以同时处理行和列的布局，比Flexbox更强大。',
                    source: 'system-sample',
                    createTime: new Date().toISOString(),
                    difficulty: 3,
                    category: 'CSS高级',
                    tags: ['CSS', 'Grid布局']
                }
            ]
        };
    }

    // 获取同步状态
    getSyncStatus() {
        const app = window.app;
        if (!app) return null;

        return {
            isLoggedIn: !!app.currentUser,
            syncStatus: app.syncStatus || 'unknown',
            lastSyncTime: app.lastSyncTime,
            publicBankSize: app.publicQuestionBank ? app.publicQuestionBank.length : 0,
            personalBankSize: app.personalQuestionBank ? app.personalQuestionBank.length : 0,
            mistakeBankSize: app.mistakeBank ? app.mistakeBank.length : 0
        };
    }
}

// 全局实例
window.syncManager = new SyncManager();

// 自动初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.syncManager.initialize().catch(console.error);
    });
} else {
    window.syncManager.initialize().catch(console.error);
}