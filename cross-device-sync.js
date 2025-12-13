/**
 * 跨设备同步系统
 * 实现电脑和手机之间的题库数据共享
 */

class CrossDeviceSync {
    constructor() {
        this.syncServer = 'https://sync.smart-exam-system.com'; // 同步服务器地址
        this.syncInterval = 60000; // 同步间隔（毫秒）
        this.syncTimer = null;
        this.isSyncing = false;
        this.pendingChanges = [];
        this.deviceId = this.getDeviceId();
        this.supportedMethods = this.detectSyncMethods();
    }

    // 获取设备唯一标识
    getDeviceId() {
        let deviceId = localStorage.getItem('crossDeviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('crossDeviceId', deviceId);
        }
        return deviceId;
    }

    // 检测可用的同步方法
    detectSyncMethods() {
        const methods = {
            indexedDB: false,
            serviceWorker: false,
            sharedWorker: false,
            serverSync: false
        };

        // 检测 IndexedDB
        if ('indexedDB' in window) {
            methods.indexedDB = true;
        }

        // 检测 Service Worker
        if ('serviceWorker' in navigator) {
            methods.serviceWorker = true;
        }

        // 检测 Shared Worker
        if ('SharedWorker' in window) {
            methods.sharedWorker = true;
        }

        // 检测网络连接
        if (navigator.onLine) {
            methods.serverSync = true;
        }

        return methods;
    }

    // 初始化IndexedDB存储
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            if (!this.supportedMethods.indexedDB) {
                reject(new Error('IndexedDB not supported'));
                return;
            }

            const request = indexedDB.open('SmartExamSync', 1);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建公共题库存储
                if (!db.objectStoreNames.contains('publicQuestions')) {
                    db.createObjectStore('publicQuestions', { keyPath: 'id' });
                }

                // 创建同步记录存储
                if (!db.objectStoreNames.contains('syncRecords')) {
                    const syncStore = db.createObjectStore('syncRecords', { keyPath: 'timestamp' });
                    syncStore.createIndex('by_type', 'type', { unique: false });
                    syncStore.createIndex('by_device', 'deviceId', { unique: false });
                }

                // 创建用户数据存储
                if (!db.objectStoreNames.contains('userData')) {
                    db.createObjectStore('userData', { keyPath: 'userId' });
                }
            };

            request.onsuccess = (event) => {
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 保存公共题库到IndexedDB
    async savePublicQuestionsToIndexedDB(questions) {
        if (!this.db) {
            await this.initIndexedDB();
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('publicQuestions', 'readwrite');
            const store = transaction.objectStore('publicQuestions');

            const clearRequest = store.clear();
            clearRequest.onsuccess = () => {
                let completed = 0;
                const total = questions.length;

                questions.forEach(question => {
                    const request = store.put(question);
                    request.onsuccess = () => {
                        completed++;
                        if (completed === total) {
                            resolve();
                        }
                    };
                    request.onerror = (event) => {
                        reject(event.target.error);
                    };
                });
            };

            clearRequest.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 从IndexedDB加载公共题库
    async loadPublicQuestionsFromIndexedDB() {
        if (!this.db) {
            try {
                await this.initIndexedDB();
            } catch (error) {
                console.warn('Failed to initialize IndexedDB:', error);
                return [];
            }
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('publicQuestions', 'readonly');
            const store = transaction.objectStore('publicQuestions');
            const request = store.getAll();

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 创建同步记录
    async createSyncRecord(type, data) {
        if (!this.db) return;

        const record = {
            timestamp: Date.now(),
            type: type,
            deviceId: this.deviceId,
            data: data,
            status: 'pending'
        };

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('syncRecords', 'readwrite');
            const store = transaction.objectStore('syncRecords');
            const request = store.add(record);

            request.onsuccess = () => {
                resolve(record);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 获取待同步记录
    async getPendingSyncRecords() {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('syncRecords', 'readonly');
            const store = transaction.objectStore('syncRecords');
            const index = store.index('by_type');
            const request = index.getAll('pending');

            request.onsuccess = (event) => {
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 标记同步记录为已完成
    async markSyncRecordComplete(timestamp) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction('syncRecords', 'readwrite');
            const store = transaction.objectStore('syncRecords');
            const request = store.get(timestamp);

            request.onsuccess = (event) => {
                const record = event.target.result;
                if (record) {
                    record.status = 'completed';
                    record.completedAt = Date.now();
                    store.put(record);
                }
                resolve();
            };

            request.onerror = (event) => {
                reject(event.target.error);
            };
        });
    }

    // 生成同步二维码数据
    generateSyncQRData() {
        const syncData = {
            deviceId: this.deviceId,
            timestamp: Date.now(),
            publicQuestionCount: window.app ? window.app.publicQuestionBank.length : 0,
            personalQuestionCount: window.app ? window.app.personalQuestionBank.length : 0
        };

        return btoa(JSON.stringify(syncData));
    }

    // 解析同步二维码数据
    parseSyncQRData(qrData) {
        try {
            return JSON.parse(atob(qrData));
        } catch (error) {
            console.error('Failed to parse QR data:', error);
            return null;
        }
    }

    // 发起同步请求到服务器
    async syncWithServer(data) {
        if (!navigator.onLine || !this.supportedMethods.serverSync) {
            console.warn('Server sync not available');
            return false;
        }

        try {
            const response = await fetch(`${this.syncServer}/sync`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    deviceId: this.deviceId,
                    timestamp: Date.now(),
                    data: data
                })
            });

            if (response.ok) {
                const result = await response.json();
                return result;
            } else {
                console.error('Server sync failed:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Server sync error:', error);
            return false;
        }
    }

    // 从服务器获取同步数据
    async getSyncDataFromServer() {
        if (!navigator.onLine || !this.supportedMethods.serverSync) {
            return null;
        }

        try {
            const response = await fetch(`${this.syncServer}/sync/${this.deviceId}`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                return data;
            } else {
                console.error('Failed to get sync data:', response.status);
                return null;
            }
        } catch (error) {
            console.error('Error getting sync data:', error);
            return null;
        }
    }

    // 执行完整同步
    async performSync() {
        if (this.isSyncing) return;

        this.isSyncing = true;
        console.log('🔄 Starting cross-device sync...');

        try {
            // 1. 保存当前公共题库到IndexedDB
            if (window.app && window.app.publicQuestionBank.length > 0) {
                await this.savePublicQuestionsToIndexedDB(window.app.publicQuestionBank);
                console.log('✅ Public questions saved to IndexedDB');
            }

            // 2. 尝试服务器同步
            if (navigator.onLine) {
                const syncResult = await this.syncWithServer({
                    publicQuestions: window.app ? window.app.publicQuestionBank : [],
                    deviceInfo: {
                        type: this.getDeviceType(),
                        browser: this.getBrowserInfo(),
                        timestamp: Date.now()
                    }
                });

                if (syncResult && syncResult.success) {
                    console.log('✅ Server sync completed successfully');
                    
                    // 处理服务器返回的更新数据
                    if (syncResult.updatedData && syncResult.updatedData.publicQuestions) {
                        await this.mergePublicQuestions(syncResult.updatedData.publicQuestions);
                    }
                }
            }

            // 3. 处理待同步记录
            const pendingRecords = await this.getPendingSyncRecords();
            for (const record of pendingRecords) {
                await this.processSyncRecord(record);
                await this.markSyncRecordComplete(record.timestamp);
            }

            console.log('✅ Cross-device sync completed');

        } catch (error) {
            console.error('❌ Cross-device sync failed:', error);
        } finally {
            this.isSyncing = false;
        }
    }

    // 合并公共题库数据
    async mergePublicQuestions(newQuestions) {
        if (!window.app) return;

        const currentQuestions = window.app.publicQuestionBank;
        const currentIds = new Set(currentQuestions.map(q => q.id));
        const newQuestionsToAdd = newQuestions.filter(q => !currentIds.has(q.id));

        if (newQuestionsToAdd.length > 0) {
            console.log(`📥 Adding ${newQuestionsToAdd.length} new public questions`);
            
            // 添加新题目
            window.app.publicQuestionBank.push(...newQuestionsToAdd);
            
            // 更新本地存储
            window.app.saveUserData();
            
            // 显示通知
            this.showSyncNotification(`成功同步 ${newQuestionsToAdd.length} 道新题目`);
        }
    }

    // 处理同步记录
    async processSyncRecord(record) {
        console.log('Processing sync record:', record.type);
        
        switch (record.type) {
            case 'public_questions_update':
                await this.mergePublicQuestions(record.data);
                break;
            case 'user_data_update':
                if (window.app) {
                    // 合并用户数据
                    this.mergeUserData(record.data);
                }
                break;
        }
    }

    // 合并用户数据
    mergeUserData(newUserData) {
        if (!window.app) return;

        // 合并错题本
        if (newUserData.mistakeBank) {
            const currentIds = new Set(window.app.mistakeBank.map(m => m.id));
            const newMistakes = newUserData.mistakeBank.filter(m => !currentIds.has(m.id));
            
            if (newMistakes.length > 0) {
                window.app.mistakeBank.push(...newMistakes);
            }
        }

        // 合并学习统计
        if (newUserData.studyStats && newUserData.studyStats.examRecords) {
            const currentRecords = window.app.studyStats.examRecords;
            const newRecords = newUserData.studyStats.examRecords.filter(
                r => !currentRecords.some(cr => cr.date === r.date)
            );
            
            if (newRecords.length > 0) {
                window.app.studyStats.examRecords.push(...newRecords);
            }
        }
    }

    // 获取设备类型
    getDeviceType() {
        const ua = navigator.userAgent;
        if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
            return 'mobile';
        }
        return 'desktop';
    }

    // 获取浏览器信息
    getBrowserInfo() {
        return {
            name: navigator.appName,
            version: navigator.appVersion,
            userAgent: navigator.userAgent
        };
    }

    // 显示同步通知
    showSyncNotification(message) {
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('智能刷题系统', {
                body: message,
                icon: '/favicon.ico'
            });
        }

        // 也可以在页面上显示通知
        const notification = document.createElement('div');
        notification.className = 'sync-notification';
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #07c160;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 9999;
            font-size: 14px;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }

    // 请求通知权限
    async requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }

    // 启动自动同步
    startAutoSync() {
        this.stopAutoSync(); // 先停止之前的定时器
        
        this.syncTimer = setInterval(() => {
            if (navigator.onLine && window.app && window.app.currentUser) {
                this.performSync();
            }
        }, this.syncInterval);

        console.log(`🔄 Auto sync started (interval: ${this.syncInterval}ms)`);
    }

    // 停止自动同步
    stopAutoSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
            this.syncTimer = null;
            console.log('🛑 Auto sync stopped');
        }
    }

    // 导出同步数据
    async exportSyncData() {
        const data = {
            deviceId: this.deviceId,
            exportTime: new Date().toISOString(),
            publicQuestions: window.app ? window.app.publicQuestionBank : [],
            personalQuestions: window.app ? window.app.personalQuestionBank : [],
            mistakeBank: window.app ? window.app.mistakeBank : [],
            studyStats: window.app ? window.app.studyStats : null
        };

        const dataStr = JSON.stringify(data, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `sync_data_${this.deviceId}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // 导入同步数据
    async importSyncData(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    if (data.publicQuestions && data.publicQuestions.length > 0) {
                        await this.mergePublicQuestions(data.publicQuestions);
                        console.log(`✅ Imported ${data.publicQuestions.length} public questions`);
                    }

                    if (data.personalQuestions && data.personalQuestions.length > 0 && window.app) {
                        window.app.personalQuestionBank.push(...data.personalQuestions);
                        console.log(`✅ Imported ${data.personalQuestions.length} personal questions`);
                    }

                    if (data.mistakeBank && data.mistakeBank.length > 0 && window.app) {
                        window.app.mistakeBank.push(...data.mistakeBank);
                        console.log(`✅ Imported ${data.mistakeBank.length} mistakes`);
                    }

                    if (window.app) {
                        window.app.saveUserData();
                        window.app.updateBankStats();
                    }

                    this.showSyncNotification('数据导入成功！');
                    resolve(data);
                } catch (error) {
                    console.error('Failed to import sync data:', error);
                    reject(error);
                }
            };
            reader.onerror = (error) => {
                reject(error);
            };
            reader.readAsText(file);
        });
    }

    // 获取同步状态
    async getSyncStatus() {
        const status = {
            deviceId: this.deviceId,
            supportedMethods: this.supportedMethods,
            lastSyncTime: localStorage.getItem('lastSyncTime'),
            isOnline: navigator.onLine,
            pendingChanges: this.pendingChanges.length
        };

        if (this.db) {
            try {
                const pendingRecords = await this.getPendingSyncRecords();
                status.pendingSyncRecords = pendingRecords.length;
            } catch (error) {
                console.warn('Failed to get pending records:', error);
            }
        }

        return status;
    }

    // 初始化跨设备同步
    async init() {
        console.log('🚀 Initializing cross-device sync system...');
        
        try {
            // 尝试初始化IndexedDB
            if (this.supportedMethods.indexedDB) {
                await this.initIndexedDB();
                console.log('✅ IndexedDB initialized');
            }

            // 请求通知权限
            await this.requestNotificationPermission();

            // 监听网络状态变化
            window.addEventListener('online', () => {
                console.log('🌐 Network connected, starting sync...');
                this.performSync();
            });

            window.addEventListener('offline', () => {
                console.log('🌐 Network disconnected');
            });

            // 监听页面卸载，保存同步状态
            window.addEventListener('beforeunload', () => {
                localStorage.setItem('lastSyncTime', new Date().toISOString());
            });

            console.log('✅ Cross-device sync initialized successfully');
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

// 导出类供其他脚本使用
export default CrossDeviceSync;