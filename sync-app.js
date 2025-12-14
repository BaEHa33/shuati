// 云同步功能模块
class CloudSyncManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.syncStatus = 'idle'; // idle, syncing, synced, error, conflict
        this.lastSyncTime = null;
        this.syncVersion = 0;
        this.pendingChanges = [];
        this.deviceId = this.getDeviceId();
        this.syncInterval = null;
        this.listeners = {};
        
        // 监听网络状态变化
        window.addEventListener('online', () => this.handleNetworkChange(true));
        window.addEventListener('offline', () => this.handleNetworkChange(false));
    }
    
    // 获取或生成设备唯一标识
    getDeviceId() {
        let deviceId = localStorage.getItem('sync_deviceId');
        if (!deviceId) {
            deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('sync_deviceId', deviceId);
        }
        return deviceId;
    }
    
    // 处理网络状态变化
    handleNetworkChange(isOnline) {
        this.isOnline = isOnline;
        this.notifyListeners('networkChange', { isOnline });
        
        if (isOnline) {
            // 网络恢复，尝试同步
            this.autoSync();
        } else {
            // 网络断开，停止定时同步
            this.stopAutoSync();
        }
    }
    
    // 设置同步状态
    setSyncStatus(status, error = null) {
        this.syncStatus = status;
        this.notifyListeners('statusChange', { status, error });
    }
    
    // 添加事件监听器
    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }
    
    // 移除事件监听器
    off(event, callback) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        }
    }
    
    // 通知监听器
    notifyListeners(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(callback => {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Error in ${event} listener:`, error);
                }
            });
        }
    }
    
    // 开始自动同步
    startAutoSync(interval = 300000) { // 默认5分钟
        this.stopAutoSync();
        this.syncInterval = setInterval(() => {
            if (this.isOnline) {
                this.autoSync();
            }
        }, interval);
    }
    
    // 停止自动同步
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
    }
    
    // 自动同步
    async autoSync() {
        if (!this.isOnline || this.syncStatus === 'syncing') {
            return;
        }
        
        try {
            this.setSyncStatus('syncing');
            
            // 上传本地待同步的变更
            if (this.pendingChanges.length > 0) {
                await this.uploadChanges(this.pendingChanges);
                this.pendingChanges = [];
                this.savePendingChanges();
            }
            
            // 下载云端最新变更
            const cloudData = await this.downloadData();
            if (cloudData) {
                await this.mergeCloudData(cloudData);
            }
            
            // 更新同步时间和版本
            this.lastSyncTime = new Date().toISOString();
            this.syncVersion++;
            this.saveSyncState();
            
            this.setSyncStatus('synced');
            return true;
        } catch (error) {
            console.error('Auto sync failed:', error);
            this.setSyncStatus('error', error.message);
            return false;
        }
    }
    
    // 手动同步
    async manualSync() {
        return this.autoSync();
    }
    
    // 上传变更
    async uploadChanges(changes) {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 在实际应用中，这里应该调用真实的云服务API
        console.log('Uploading changes:', changes);
        
        // 模拟成功响应
        return {
            success: true,
            syncVersion: this.syncVersion + 1,
            timestamp: new Date().toISOString()
        };
    }
    
    // 下载数据
    async downloadData() {
        // 模拟API调用延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // 在实际应用中，这里应该调用真实的云服务API
        console.log('Downloading data');
        
        // 模拟从云端获取数据
        // 在真实场景中，这里会返回云端的最新数据
        return null; // 暂时返回null，表示没有新数据
    }
    
    // 合并云端数据
    async mergeCloudData(cloudData) {
        if (!cloudData) return;
        
        // 在实际应用中，这里应该实现数据合并逻辑
        console.log('Merging cloud data:', cloudData);
        
        // 触发数据更新事件
        this.notifyListeners('dataUpdated', { data: cloudData });
    }
    
    // 记录数据变更
    recordChange(collection, id, operation, data) {
        const change = {
            id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
            collection,
            itemId: id,
            operation, // 'create', 'update', 'delete'
            data,
            timestamp: new Date().toISOString(),
            deviceId: this.deviceId
        };
        
        this.pendingChanges.push(change);
        this.savePendingChanges();
        
        // 如果在线，尝试实时同步
        if (this.isOnline) {
            this.autoSync();
        }
        
        return change;
    }
    
    // 保存待同步的变更到本地存储
    savePendingChanges() {
        localStorage.setItem('sync_pendingChanges', JSON.stringify(this.pendingChanges));
    }
    
    // 加载待同步的变更
    loadPendingChanges() {
        try {
            const data = localStorage.getItem('sync_pendingChanges');
            this.pendingChanges = data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Failed to load pending changes:', error);
            this.pendingChanges = [];
        }
    }
    
    // 保存同步状态
    saveSyncState() {
        const state = {
            lastSyncTime: this.lastSyncTime,
            syncVersion: this.syncVersion
        };
        localStorage.setItem('sync_state', JSON.stringify(state));
    }
    
    // 加载同步状态
    loadSyncState() {
        try {
            const data = localStorage.getItem('sync_state');
            if (data) {
                const state = JSON.parse(data);
                this.lastSyncTime = state.lastSyncTime;
                this.syncVersion = state.syncVersion || 0;
            }
        } catch (error) {
            console.error('Failed to load sync state:', error);
        }
    }
    
    // 初始化
    init() {
        this.loadSyncState();
        this.loadPendingChanges();
        
        // 启动自动同步
        if (this.isOnline) {
            this.startAutoSync();
        }
        
        return this;
    }
    
    // 清理
    destroy() {
        this.stopAutoSync();
        window.removeEventListener('online', this.handleNetworkChange);
        window.removeEventListener('offline', this.handleNetworkChange);
    }
}

// 创建全局同步管理器实例
const syncManager = new CloudSyncManager().init();