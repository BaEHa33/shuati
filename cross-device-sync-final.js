/**
 * 跨设备同步系统 - 最终修复版本
 * 专注于稳定可靠的文件导入导出功能
 */

class CrossDeviceSync {
    constructor() {
        this.deviceId = this.getDeviceId();
        this.supportedMethods = this.detectSyncMethods();
        this.lastSyncTime = null;
    }

    // 获取设备唯一标识
    getDeviceId() {
        try {
            let deviceId = localStorage.getItem('crossDeviceId');
            if (!deviceId) {
                deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('crossDeviceId', deviceId);
            }
            return deviceId;
        } catch (error) {
            console.warn('Failed to get device ID, using temporary ID:', error);
            return 'temp_device_' + Date.now();
        }
    }

    // 检测可用的同步方法
    detectSyncMethods() {
        const methods = {
            fileAPI: false,
            localStorage: false
        };

        // 检测 File API
        if ('FileReader' in window && 'Blob' in window && 'URL' in window) {
            methods.fileAPI = true;
        }

        // 检测 localStorage
        if ('localStorage' in window) {
            try {
                localStorage.setItem('test_sync', 'test');
                localStorage.removeItem('test_sync');
                methods.localStorage = true;
            } catch (e) {
                console.warn('localStorage not available:', e);
            }
        }

        return methods;
    }

    // 导出同步数据 - 最终修复版本
    async exportSyncData() {
        try {
            console.log('📤 开始导出同步数据...');
            
            // 验证File API支持
            if (!this.supportedMethods.fileAPI) {
                throw new Error('当前浏览器不支持文件导出功能');
            }
            
            // 获取应用实例
            if (!window.app) {
                throw new Error('应用未初始化');
            }
            
            // 获取现有题目（添加空数组检查）
            const publicQuestions = Array.isArray(window.app.publicQuestionBank) ? [...window.app.publicQuestionBank] : [];
            const personalQuestions = Array.isArray(window.app.personalQuestionBank) ? [...window.app.personalQuestionBank] : [];
            const mistakeBank = Array.isArray(window.app.mistakeBank) ? [...window.app.mistakeBank] : [];
            const studyStats = window.app.studyStats || {
                totalQuestions: 0,
                correctAnswers: 0,
                totalStudyTime: 0,
                examRecords: []
            };
            
            console.log(`📚 当前公共题库有 ${publicQuestions.length} 道题`);
            console.log(`📝 当前个人题库有 ${personalQuestions.length} 道题`);
            console.log(`❌ 当前错题本有 ${mistakeBank.length} 条记录`);
            
            // 数据去重
            const uniquePublicQuestions = this.removeDuplicateQuestions(publicQuestions);
            const uniquePersonalQuestions = this.removeDuplicateQuestions(personalQuestions);
            const uniqueMistakes = this.removeDuplicateQuestions(mistakeBank);
            
            // 构建导出数据
            const exportData = {
                version: '1.0.0',
                deviceId: this.deviceId,
                exportTime: new Date().toISOString(),
                appName: 'SmartExamSystem',
                data: {
                    publicQuestions: uniquePublicQuestions,
                    personalQuestions: uniquePersonalQuestions,
                    mistakeBank: uniqueMistakes,
                    studyStats: studyStats
                },
                metadata: {
                    publicQuestionCount: uniquePublicQuestions.length,
                    personalQuestionCount: uniquePersonalQuestions.length,
                    mistakeCount: uniqueMistakes.length,
                    deviceType: this.getDeviceType(),
                    browser: navigator.userAgent,
                    screenSize: `${window.screen.width}x${window.screen.height}`
                }
            };
            
            console.log('🔍 导出数据验证:');
            console.log('   - 公共题目数量:', exportData.metadata.publicQuestionCount);
            console.log('   - 个人题目数量:', exportData.metadata.personalQuestionCount);
            console.log('   - 错题数量:', exportData.metadata.mistakeCount);
            console.log('   - 数据版本:', exportData.version);
            
            try {
                // 转换为JSON字符串
                const dataStr = JSON.stringify(exportData, null, 2);
                console.log(`📏 导出数据大小: ${(dataStr.length / 1024).toFixed(2)} KB`);
                
                // 检查数据大小限制
                if (dataStr.length > 20 * 1024 * 1024) { // 20MB限制
                    throw new Error('导出数据过大，请减少题目数量后重试');
                }
                
                // 创建Blob并下载
                const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                
                const a = document.createElement('a');
                a.href = url;
                a.download = `smart_exam_sync_${this.deviceId}_${new Date().toISOString().split('T')[0]}.json`;
                a.style.display = 'none';
                document.body.appendChild(a);
                
                // 触发下载
                setTimeout(() => {
                    try {
                        a.click();
                        setTimeout(() => {
                            document.body.removeChild(a);
                            URL.revokeObjectURL(url);
                            console.log('✅ 同步数据导出完成');
                            
                            // 更新同步状态
                            this.updateSyncStatus('export', true);
                            
                            // 显示成功提示
                            this.showNotification('数据导出成功！', 'success');
                        }, 100);
                    } catch (error) {
                        console.error('❌ 触发下载失败:', error);
                        throw new Error('触发文件下载失败');
                    }
                }, 0);
                
            } catch (jsonError) {
                console.error('❌ JSON序列化失败:', jsonError);
                throw new Error(`数据序列化失败: ${jsonError.message}`);
            }
            
        } catch (error) {
            console.error('❌ 导出同步数据失败:', error);
            console.error('❌ 错误详情:', error.message, error.stack);
            
            // 更新失败状态
            this.updateSyncStatus('export', false, error.message);
            
            // 显示错误提示
            this.showNotification(`导出失败: ${error.message}`, 'error');
            throw error;
        }
    }

    // 导入同步数据
    async importSyncData(file) {
        return new Promise((resolve, reject) => {
            try {
                console.log('📥 开始导入同步数据...');
                
                // 验证File API支持
                if (!this.supportedMethods.fileAPI) {
                    throw new Error('当前浏览器不支持文件导入功能');
                }
                
                // 验证应用实例
                if (!window.app) {
                    throw new Error('应用未初始化');
                }
                
                // 验证文件类型
                if (!file.name.toLowerCase().endsWith('.json')) {
                    throw new Error('请选择正确的同步数据文件（.json格式）');
                }
                
                // 验证文件大小（限制20MB）
                if (file.size > 20 * 1024 * 1024) {
                    throw new Error('文件过大，请选择小于20MB的同步数据文件');
                }
                
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const content = e.target.result;
                        if (!content || typeof content !== 'string') {
                            throw new Error('文件内容读取失败');
                        }
                        
                        const importData = JSON.parse(content);
                        
                        // 验证数据格式
                        if (!this.validateSyncData(importData)) {
                            throw new Error('同步数据格式不正确或已损坏');
                        }
                        
                        console.log('🔍 导入数据验证通过:');
                        console.log('   - 数据版本:', importData.version || '未知');
                        console.log('   - 导出设备:', importData.deviceId);
                        console.log('   - 导出时间:', importData.exportTime);
                        
                        // 准备导入统计
                        const importStats = {
                            publicQuestions: 0,
                            personalQuestions: 0,
                            mistakes: 0,
                            studyStats: false
                        };
                        
                        // 导入公共题库
                        if (importData.data?.publicQuestions && Array.isArray(importData.data.publicQuestions)) {
                            const mergedCount = await this.mergePublicQuestions(importData.data.publicQuestions);
                            importStats.publicQuestions = mergedCount;
                            console.log(`✅ 导入 ${mergedCount} 道公共题目`);
                        }

                        // 导入个人题库
                        if (importData.data?.personalQuestions && Array.isArray(importData.data.personalQuestions)) {
                            const mergedCount = await this.mergePersonalQuestions(importData.data.personalQuestions);
                            importStats.personalQuestions = mergedCount;
                            console.log(`✅ 导入 ${mergedCount} 道个人题目`);
                        }

                        // 导入错题本
                        if (importData.data?.mistakeBank && Array.isArray(importData.data.mistakeBank)) {
                            const mergedCount = await this.mergeMistakeBank(importData.data.mistakeBank);
                            importStats.mistakes = mergedCount;
                            console.log(`✅ 导入 ${mergedCount} 条错题记录`);
                        }
                        
                        // 导入学习统计
                        if (importData.data?.studyStats) {
                            this.mergeStudyStats(importData.data.studyStats);
                            importStats.studyStats = true;
                            console.log('✅ 导入学习统计数据');
                        }

                        // 保存数据并更新状态
                        if (window.app) {
                            if (typeof window.app.saveUserData === 'function') {
                                window.app.saveUserData();
                            }
                            if (typeof window.app.updateBankStats === 'function') {
                                window.app.updateBankStats();
                            }
                        }
                        
                        // 更新同步状态
                        this.updateSyncStatus('import', true, null, importStats);
                        
                        // 显示成功提示
                        const message = `数据导入成功！\n` +
                            `公共题目: ${importStats.publicQuestions} 道\n` +
                            `个人题目: ${importStats.personalQuestions} 道\n` +
                            `错题记录: ${importStats.mistakes} 条\n` +
                            `学习统计: ${importStats.studyStats ? '已更新' : '无更新'}`;
                        
                        this.showNotification(message, 'success');
                        resolve({ data: importData, importStats });
                        
                    } catch (error) {
                        console.error('❌ 导入同步数据失败:', error);
                        console.error('❌ 错误详情:', error.message, error.stack);
                        
                        // 更新失败状态
                        this.updateSyncStatus('import', false, error.message);
                        
                        // 显示错误提示
                        this.showNotification(`导入失败: ${error.message}`, 'error');
                        reject(error);
                    }
                };
                
                reader.onerror = (error) => {
                    console.error('❌ 文件读取失败:', error);
                    const errorMsg = '文件读取失败，请检查文件是否损坏';
                    this.updateSyncStatus('import', false, errorMsg);
                    this.showNotification(errorMsg, 'error');
                    reject(new Error(errorMsg));
                };
                
                reader.onabort = () => {
                    console.warn('⚠️ 文件读取被中止');
                    this.showNotification('文件读取被中止', 'warning');
                    reject(new Error('文件读取被中止'));
                };
                
                reader.readAsText(file, 'UTF-8');
                
            } catch (error) {
                console.error('❌ 导入同步数据失败:', error);
                this.updateSyncStatus('import', false, error.message);
                this.showNotification(`导入失败: ${error.message}`, 'error');
                reject(error);
            }
        });
    }

    // 验证同步数据格式
    validateSyncData(data) {
        if (!data || typeof data !== 'object') {
            return false;
        }
        
        // 基本字段验证
        if (!data.deviceId || !data.exportTime || !data.data) {
            return false;
        }
        
        // 数据结构验证
        if (typeof data.data !== 'object') {
            return false;
        }
        
        // 可选字段类型验证
        const optionalArrays = ['publicQuestions', 'personalQuestions', 'mistakeBank'];
        for (const field of optionalArrays) {
            if (data.data[field] && !Array.isArray(data.data[field])) {
                return false;
            }
        }
        
        return true;
    }

    // 合并公共题库
    async mergePublicQuestions(newQuestions) {
        if (!window.app || !Array.isArray(window.app.publicQuestionBank)) return 0;
        
        const currentQuestions = window.app.publicQuestionBank;
        const currentIds = new Set(currentQuestions.map(q => q.id));
        const newQuestionsToAdd = newQuestions.filter(q => !currentIds.has(q.id));
        
        if (newQuestionsToAdd.length > 0) {
            console.log(`📥 添加 ${newQuestionsToAdd.length} 道新的公共题目`);
            window.app.publicQuestionBank.push(...newQuestionsToAdd);
        }
        
        return newQuestionsToAdd.length;
    }

    // 合并个人题库
    async mergePersonalQuestions(newQuestions) {
        if (!window.app || !Array.isArray(window.app.personalQuestionBank)) return 0;
        
        const currentQuestions = window.app.personalQuestionBank;
        const currentIds = new Set(currentQuestions.map(q => q.id));
        const newQuestionsToAdd = newQuestions.filter(q => !currentIds.has(q.id));
        
        if (newQuestionsToAdd.length > 0) {
            console.log(`📥 添加 ${newQuestionsToAdd.length} 道新的个人题目`);
            window.app.personalQuestionBank.push(...newQuestionsToAdd);
        }
        
        return newQuestionsToAdd.length;
    }

    // 合并错题本
    async mergeMistakeBank(newMistakes) {
        if (!window.app || !Array.isArray(window.app.mistakeBank)) return 0;
        
        const currentMistakes = window.app.mistakeBank;
        const currentIds = new Set(currentMistakes.map(m => m.id));
        const newMistakesToAdd = newMistakes.filter(m => !currentIds.has(m.id));
        
        if (newMistakesToAdd.length > 0) {
            console.log(`📥 添加 ${newMistakesToAdd.length} 条新的错题记录`);
            window.app.mistakeBank.push(...newMistakesToAdd);
        }
        
        return newMistakesToAdd.length;
    }

    // 合并学习统计
    mergeStudyStats(importedStats) {
        if (!window.app || !importedStats || !window.app.studyStats) return;
        
        const appStats = window.app.studyStats;
        
        // 合并总题数和正确题数（取较大值）
        if (importedStats.totalQuestions > appStats.totalQuestions) {
            appStats.totalQuestions = importedStats.totalQuestions;
        }
        
        if (importedStats.correctAnswers > appStats.correctAnswers) {
            appStats.correctAnswers = importedStats.correctAnswers;
        }
        
        if (importedStats.totalStudyTime > appStats.totalStudyTime) {
            appStats.totalStudyTime = importedStats.totalStudyTime;
        }
        
        // 合并考试记录
        if (importedStats.examRecords && Array.isArray(importedStats.examRecords)) {
            const existingDates = new Set(appStats.examRecords.map(record => record.date));
            const newRecords = importedStats.examRecords.filter(
                record => !existingDates.has(record.date)
            );
            
            if (newRecords.length > 0) {
                console.log(`📥 添加 ${newRecords.length} 条新的考试记录`);
                appStats.examRecords.push(...newRecords);
            }
        }
    }

    // 移除重复题目
    removeDuplicateQuestions(questions) {
        if (!Array.isArray(questions)) return [];
        
        const seen = new Set();
        return questions.filter(question => {
            if (!question || !question.id) return false;
            const duplicate = seen.has(question.id);
            seen.add(question.id);
            return !duplicate;
        });
    }

    // 获取设备类型
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    // 更新同步状态
    updateSyncStatus(type, success, errorMessage = null, stats = null) {
        const status = {
            type: type,
            timestamp: Date.now(),
            success: success,
            deviceId: this.deviceId
        };
        
        if (errorMessage) {
            status.error = errorMessage;
        }
        
        if (stats) {
            status.stats = stats;
        }
        
        // 保存到localStorage
        try {
            const history = JSON.parse(localStorage.getItem('syncHistory') || '[]');
            history.unshift(status);
            // 只保留最近10条记录
            const recentHistory = history.slice(0, 10);
            localStorage.setItem('syncHistory', JSON.stringify(recentHistory));
            
            // 更新最后同步时间
            this.lastSyncTime = new Date().toISOString();
            localStorage.setItem('lastSyncTime', this.lastSyncTime);
            
        } catch (error) {
            console.warn('Failed to save sync status:', error);
        }
    }

    // 显示通知
    showNotification(message, type = 'info') {
        // 创建通知元素
        const notification = document.createElement('div');
        notification.className = `fixed top-4 right-4 z-50 max-w-xs p-4 rounded-lg shadow-lg transform transition-all duration-300 ease-in-out`;
        
        // 设置样式
        switch (type) {
            case 'success':
                notification.style.backgroundColor = '#f0fdf4';
                notification.style.borderLeft = '4px solid #22c55e';
                break;
            case 'error':
                notification.style.backgroundColor = '#fef2f2';
                notification.style.borderLeft = '4px solid #ef4444';
                break;
            case 'warning':
                notification.style.backgroundColor = '#fefce8';
                notification.style.borderLeft = '4px solid #f59e0b';
                break;
            default:
                notification.style.backgroundColor = '#f0f9ff';
                notification.style.borderLeft = '4px solid #0ea5e9';
        }
        
        // 设置内容
        notification.innerHTML = `
            <div class="flex items-start">
                <div class="flex-shrink-0 mt-0.5">
                    <i class="fa fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : type === 'warning' ? 'exclamation-triangle' : 'info-circle'} text-${type === 'success' ? 'green' : type === 'error' ? 'red' : type === 'warning' ? 'amber' : 'blue'}-500 text-lg"></i>
                </div>
                <div class="ml-3 flex-1">
                    <p class="text-sm font-medium text-gray-900">${message.replace(/\n/g, '<br>')}</p>
                </div>
                <button class="ml-4 text-gray-400 hover:text-gray-600 focus:outline-none" onclick="this.closest('.fixed').remove()">
                    <i class="fa fa-times"></i>
                </button>
            </div>
        `;
        
        // 添加到页面
        document.body.appendChild(notification);
        
        // 自动移除
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(100%)';
                setTimeout(() => {
                    if (notification.parentNode) {
                        document.body.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    // 获取同步状态
    async getSyncStatus() {
        const status = {
            deviceId: this.deviceId,
            supportedMethods: this.supportedMethods,
            lastSyncTime: localStorage.getItem('lastSyncTime'),
            syncHistory: JSON.parse(localStorage.getItem('syncHistory') || '[]')
        };

        return status;
    }

    // 初始化跨设备同步
    async init() {
        console.log('🚀 Initializing cross-device sync system...');
        
        try {
            // 检查必要的API支持
            if (!this.supportedMethods.fileAPI) {
                console.warn('⚠️ File API not supported, sync功能 limited');
            }
            
            console.log('✅ Cross-device sync initialized successfully');
            console.log('🔧 Supported methods:', this.supportedMethods);
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize cross-device sync:', error);
            return false;
        }
    }
}

// 创建全局实例
window.crossDeviceSync = new CrossDeviceSync();

// 当DOM加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.crossDeviceSync.init();
    });
} else {
    window.crossDeviceSync.init();
}