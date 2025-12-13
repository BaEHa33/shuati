/**
 * 移动端兼容性修复脚本
 * 解决移动端题目不显示的问题
 */

// 移动端兼容性检测
const isMobile = {
    Android: function() {
        return /Android/i.test(navigator.userAgent);
    },
    BlackBerry: function() {
        return /BlackBerry/i.test(navigator.userAgent);
    },
    iOS: function() {
        return /iPhone|iPad|iPod/i.test(navigator.userAgent);
    },
    Opera: function() {
        return /Opera Mini/i.test(navigator.userAgent);
    },
    Windows: function() {
        return /IEMobile/i.test(navigator.userAgent);
    },
    any: function() {
        return (isMobile.Android() || isMobile.BlackBerry() || isMobile.iOS() || isMobile.Opera() || isMobile.Windows());
    }
};

// 修复localStorage在某些移动端浏览器的问题
const safeLocalStorage = {
    // 分片存储配置
    maxChunkSize: 2000000, // 2MB per chunk
    chunkPrefix: '__chunk_',
    
    // 检测存储限制
    checkStorageLimit: function() {
        try {
            const testKey = '__storage_test__';
            const testValue = 'x'.repeat(1024);
            localStorage.setItem(testKey, testValue);
            localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            return false;
        }
    },
    
    // 分片存储大数据
    setItem: function(key, value) {
        try {
            // 先尝试直接存储
            if (value.length < this.maxChunkSize) {
                localStorage.setItem(key, value);
                return true;
            }
            
            // 如果数据太大，进行分片存储
            const chunks = [];
            for (let i = 0; i < value.length; i += this.maxChunkSize) {
                chunks.push(value.substring(i, i + this.maxChunkSize));
            }
            
            // 存储分片信息
            const chunkInfo = {
                totalChunks: chunks.length,
                originalKey: key,
                timestamp: Date.now()
            };
            
            localStorage.setItem(key, JSON.stringify(chunkInfo));
            
            // 存储各个分片
            for (let i = 0; i < chunks.length; i++) {
                const chunkKey = `${this.chunkPrefix}${key}_${i}`;
                localStorage.setItem(chunkKey, chunks[i]);
            }
            
            return true;
        } catch (e) {
            console.warn('localStorage setItem failed:', e);
            
            // 尝试清理旧数据
            this.cleanupOldData();
            
            // 再次尝试
            try {
                localStorage.setItem(key, value.substring(0, this.maxChunkSize));
                return true;
            } catch (e2) {
                console.error('localStorage setItem failed after cleanup:', e2);
                return false;
            }
        }
    },
    
    // 获取分片存储的数据
    getItem: function(key) {
        try {
            const value = localStorage.getItem(key);
            
            // 检查是否是分片数据
            if (value && value.startsWith('{') && value.includes('totalChunks')) {
                try {
                    const chunkInfo = JSON.parse(value);
                    
                    if (chunkInfo.totalChunks && chunkInfo.totalChunks > 1) {
                        // 读取所有分片
                        let fullData = '';
                        for (let i = 0; i < chunkInfo.totalChunks; i++) {
                            const chunkKey = `${this.chunkPrefix}${key}_${i}`;
                            const chunk = localStorage.getItem(chunkKey);
                            
                            if (chunk) {
                                fullData += chunk;
                            } else {
                                console.warn(`Chunk ${i} not found for key ${key}`);
                                break;
                            }
                        }
                        
                        return fullData;
                    }
                } catch (e) {
                    // 如果解析失败，返回原始值
                    return value;
                }
            }
            
            return value;
        } catch (e) {
            console.warn('localStorage getItem failed:', e);
            return null;
        }
    },
    
    // 删除分片存储的数据
    removeItem: function(key) {
        try {
            const value = localStorage.getItem(key);
            
            // 检查是否是分片数据
            if (value && value.startsWith('{') && value.includes('totalChunks')) {
                try {
                    const chunkInfo = JSON.parse(value);
                    
                    if (chunkInfo.totalChunks && chunkInfo.totalChunks > 1) {
                        // 删除所有分片
                        for (let i = 0; i < chunkInfo.totalChunks; i++) {
                            const chunkKey = `${this.chunkPrefix}${key}_${i}`;
                            localStorage.removeItem(chunkKey);
                        }
                    }
                } catch (e) {
                    console.warn('Failed to parse chunk info:', e);
                }
            }
            
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage removeItem failed:', e);
            return false;
        }
    },
    
    // 清理存储
    clear: function() {
        try {
            localStorage.clear();
            return true;
        } catch (e) {
            console.warn('localStorage clear failed:', e);
            
            // 尝试逐个删除
            try {
                const keys = Object.keys(localStorage);
                keys.forEach(key => {
                    localStorage.removeItem(key);
                });
                return true;
            } catch (e2) {
                console.error('Failed to clear localStorage:', e2);
                return false;
            }
        }
    },
    
    // 清理旧数据
    cleanupOldData: function() {
        try {
            const keys = Object.keys(localStorage);
            const oldKeys = [];
            
            // 找出旧的分片数据
            keys.forEach(key => {
                if (key.startsWith(this.chunkPrefix)) {
                    oldKeys.push(key);
                }
            });
            
            // 删除旧数据
            oldKeys.forEach(key => {
                localStorage.removeItem(key);
            });
            
            console.log(`Cleaned up ${oldKeys.length} old chunk files`);
        } catch (e) {
            console.warn('Failed to cleanup old data:', e);
        }
    },
    
    // 获取存储使用情况
    getStorageInfo: function() {
        try {
            let totalSize = 0;
            const keys = Object.keys(localStorage);
            
            keys.forEach(key => {
                const value = localStorage.getItem(key);
                if (value) {
                    totalSize += key.length + value.length;
                }
            });
            
            return {
                itemCount: keys.length,
                totalSize: totalSize,
                totalSizeMB: (totalSize / 1024 / 1024).toFixed(2)
            };
        } catch (e) {
            console.warn('Failed to get storage info:', e);
            return { itemCount: 0, totalSize: 0, totalSizeMB: '0.00' };
        }
    }
};

// 修复移动端滚动问题
function fixMobileScroll() {
    if (isMobile.any()) {
        // 防止iOS橡皮筋效果
        document.addEventListener('touchmove', function(e) {
            const target = e.target;
            const parent = target.closest('.overflow-auto, .overflow-y-auto, .overflow-x-auto');
            
            if (parent) {
                const scrollTop = parent.scrollTop;
                const scrollHeight = parent.scrollHeight;
                const clientHeight = parent.clientHeight;
                
                if ((scrollTop === 0 && e.touches[0].clientY > e.changedTouches[0].clientY) || 
                    (scrollTop + clientHeight >= scrollHeight && e.touches[0].clientY < e.changedTouches[0].clientY)) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
        
        // 修复iOS点击延迟
        document.addEventListener('touchstart', function() {}, { passive: true });
    }
}

// 修复移动端输入框问题
function fixMobileInput() {
    if (isMobile.any()) {
        // 修复iOS输入框自动大写
        const inputs = document.querySelectorAll('input[type="text"], textarea');
        inputs.forEach(input => {
            input.setAttribute('autocapitalize', 'none');
            input.setAttribute('autocorrect', 'off');
            input.setAttribute('autocomplete', 'off');
        });
        
        // 修复iOS输入框焦点问题
        document.addEventListener('focusin', function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
        });
    }
}

// 修复移动端点击事件问题
function fixMobileClick() {
    if (isMobile.any()) {
        // 修复移动端点击事件延迟
        const fastClick = function(element, callback) {
            let startTime = 0;
            let startX = 0;
            let startY = 0;
            
            element.addEventListener('touchstart', function(e) {
                startTime = Date.now();
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }, { passive: true });
            
            element.addEventListener('touchend', function(e) {
                const endTime = Date.now();
                const endX = e.changedTouches[0].clientX;
                const endY = e.changedTouches[0].clientY;
                
                const timeDiff = endTime - startTime;
                const xDiff = Math.abs(endX - startX);
                const yDiff = Math.abs(endY - startY);
                
                if (timeDiff < 300 && xDiff < 10 && yDiff < 10) {
                    e.preventDefault();
                    callback(e);
                }
            }, { passive: false });
        };
        
        // 应用快速点击到所有按钮
        document.addEventListener('DOMContentLoaded', function() {
            const buttons = document.querySelectorAll('button, .btn-primary, .btn-secondary, .btn-danger, .question-option, .nav-tab');
            buttons.forEach(button => {
                const originalOnClick = button.onclick;
                if (originalOnClick) {
                    button.onclick = null;
                    fastClick(button, originalOnClick);
                }
            });
        });
    }
}

// 修复移动端CSS问题
function fixMobileCSS() {
    if (isMobile.any()) {
        const style = document.createElement('style');
        style.textContent = `
            /* 修复移动端字体大小 */
            @media (max-width: 768px) {
                html {
                    font-size: 14px !important;
                }
                
                /* 修复移动端按钮点击效果 */
                button, .btn-primary, .btn-secondary, .btn-danger {
                    -webkit-tap-highlight-color: transparent;
                    user-select: none;
                    touch-action: manipulation;
                }
                
                /* 修复移动端输入框样式 */
                input, textarea {
                    -webkit-appearance: none;
                    border-radius: 8px;
                }
                
                /* 修复移动端滚动条 */
                ::-webkit-scrollbar {
                    width: 6px;
                    height: 6px;
                }
                
                ::-webkit-scrollbar-track {
                    background: #f1f1f1;
                }
                
                ::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 3px;
                }
                
                /* 修复移动端选择文本问题 */
                .question-option, .nav-tab {
                    user-select: none;
                    -webkit-user-select: none;
                }
                
                /* 修复移动端底部导航 */
                .bottom-nav {
                    position: fixed !important;
                    bottom: 0 !important;
                    left: 0 !important;
                    right: 0 !important;
                    z-index: 1000 !important;
                    background: white !important;
                    box-shadow: 0 -2px 10px rgba(0,0,0,0.1) !important;
                }
                
                /* 修复移动端内容区域 */
                body {
                    padding-bottom: 80px !important;
                    overflow-x: hidden !important;
                }
                
                /* 修复移动端题目选项 */
                .question-option {
                    min-height: 44px !important;
                    padding: 16px !important;
                    margin: 12px 0 !important;
                }
                
                /* 修复移动端答案卡片 */
                .answer-card {
                    gap: 6px !important;
                }
                
                .answer-card-item {
                    min-height: 36px !important;
                    font-size: 14px !important;
                }
                
                /* 修复移动端对话框 */
                .mobile-dialog {
                    margin: 16px !important;
                    max-height: calc(100vh - 32px) !important;
                    overflow-y: auto !important;
                }
                
                /* 修复移动端表格 */
                table {
                    font-size: 12px !important;
                }
                
                /* 修复移动端统计卡片 */
                .stats-card {
                    padding: 16px !important;
                }
                
                .stats-number {
                    font-size: 2rem !important;
                }
                
                /* 修复移动端考试结果 */
                .result-score {
                    font-size: 3rem !important;
                }
                
                .result-stats {
                    gap: 12px !important;
                }
                
                /* 修复移动端填空题输入框 */
                .fill-input {
                    min-height: 44px !important;
                    padding: 12px 16px !important;
                }
                
                /* 修复移动端简答题文本域 */
                .essay-textarea {
                    min-height: 150px !important;
                    padding: 12px 16px !important;
                }
                
                /* 修复移动端实时答案显示 */
                .real-time-answer {
                    bottom: 90px !important;
                    right: 8px !important;
                    left: 8px !important;
                    padding: 12px !important;
                    font-size: 14px !important;
                }
                
                /* 修复移动端文件上传区域 */
                .file-upload-area {
                    padding: 32px 16px !important;
                }
                
                /* 修复移动端进度条 */
                .progress-bar {
                    height: 6px !important;
                }
                
                /* 修复移动端标签页 */
                .nav-tab {
                    padding: 10px 16px !important;
                    font-size: 14px !important;
                }
                
                /* 修复移动端源标签 */
                .source-badge {
                    font-size: 11px !important;
                    padding: 1px 6px !important;
                }
            }
            
            /* 修复iOS特定问题 */
            @media screen and (max-width: 768px) and (-webkit-min-device-pixel-ratio: 2) {
                /* 修复iOS按钮渲染 */
                button {
                    border: none;
                    outline: none;
                }
                
                /* 修复iOS输入框光标 */
                input, textarea {
                    caret-color: #07c160;
                }
                
                /* 修复iOS滚动性能 */
                .overflow-auto, .overflow-y-auto {
                    -webkit-overflow-scrolling: touch;
                }
            }
        `;
        document.head.appendChild(style);
    }
}

// 修复移动端数据加载问题
function fixMobileDataLoading() {
    if (isMobile.any()) {
        // 延迟加载数据，避免移动端性能问题
        window.addEventListener('load', function() {
            setTimeout(() => {
                // 尝试重新加载localStorage数据
                const reloadUserData = function() {
                    try {
                        const event = new CustomEvent('reloadUserData');
                        window.dispatchEvent(event);
                    } catch (e) {
                        console.warn('Failed to dispatch reloadUserData event:', e);
                    }
                };
                
                reloadUserData();
            }, 1000);
        });
        
        // 监听数据重新加载事件
        window.addEventListener('reloadUserData', function() {
            console.log('Reloading user data for mobile device...');
            
            // 尝试重新加载题库数据
            try {
                const currentUser = JSON.parse(safeLocalStorage.getItem('currentUser'));
                if (currentUser) {
                    // 重新加载公共题库
                    const publicData = safeLocalStorage.getItem('publicQuestionBank');
                    if (publicData) {
                        console.log('Found public question bank with size:', publicData.length);
                    }
                    
                    // 重新加载用户个人数据
                    const userData = safeLocalStorage.getItem(`examAppData_${currentUser.id}`);
                    if (userData) {
                        console.log('Found user data with size:', userData.length);
                    }
                }
            } catch (e) {
                console.warn('Error reloading user data:', e);
            }
        });
    }
}

// 修复移动端内存管理问题
function fixMobileMemory() {
    if (isMobile.any()) {
        // 限制同时加载的题目数量
        let questionLoadLimit = 50;
        
        // 监控内存使用
        const checkMemory = function() {
            if (performance && performance.memory) {
                const memory = performance.memory;
                const usedMemory = memory.usedJSHeapSize / 1024 / 1024; // MB
                
                if (usedMemory > 100) { // 如果使用内存超过100MB
                    questionLoadLimit = 30;
                } else if (usedMemory > 50) { // 如果使用内存超过50MB
                    questionLoadLimit = 40;
                } else {
                    questionLoadLimit = 50;
                }
            }
        };
        
        // 定期检查内存
        setInterval(checkMemory, 30000); // 每30秒检查一次
        
        // 提供获取当前加载限制的方法
        window.getQuestionLoadLimit = function() {
            return questionLoadLimit;
        };
    }
}

// 修复移动端网络问题
function fixMobileNetwork() {
    if (isMobile.any()) {
        // 监听网络状态变化
        window.addEventListener('online', function() {
            console.log('网络已连接');
            // 尝试重新同步数据
            try {
                const event = new CustomEvent('networkOnline');
                window.dispatchEvent(event);
            } catch (e) {
                console.warn('Failed to dispatch networkOnline event:', e);
            }
        });
        
        window.addEventListener('offline', function() {
            console.log('网络已断开');
            // 切换到离线模式
            try {
                const event = new CustomEvent('networkOffline');
                window.dispatchEvent(event);
            } catch (e) {
                console.warn('Failed to dispatch networkOffline event:', e);
            }
        });
    }
}

// 初始化所有修复
function initMobileFixes() {
    console.log('Initializing mobile fixes...');
    
    // 检测是否为移动端
    if (isMobile.any()) {
        console.log('Mobile device detected, applying fixes...');
        
        // 应用各种修复
        fixMobileScroll();
        fixMobileInput();
        fixMobileClick();
        fixMobileCSS();
        fixMobileDataLoading();
        fixMobileMemory();
        fixMobileNetwork();
        
        // 替换全局localStorage为安全版本
        window.safeLocalStorage = safeLocalStorage;
        
        console.log('Mobile fixes applied successfully!');
    } else {
        console.log('Not a mobile device, skipping mobile fixes.');
    }
}

// 当DOM加载完成后初始化修复
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileFixes);
} else {
    initMobileFixes();
}

// 导出修复函数供其他脚本使用
window.mobileFixes = {
    isMobile: isMobile,
    safeLocalStorage: safeLocalStorage,
    initMobileFixes: initMobileFixes
};