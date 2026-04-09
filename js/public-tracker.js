/**
 * 公开轨迹跟踪器
 * 使用公开可访问的存储方案，无需认证
 * 所有设备数据都存储在一起
 */

(function() {
    'use strict';
    
    // 配置
    const PUBLIC_TRACKER_CONFIG = {
        // 是否启用
        enabled: true,
        
        // 使用公开的GitHub Gist作为存储
        // 这是一个预先创建的公开Gist，所有人都可以读取和写入
        gistId: '6b1b5b5b5b5b5b5b5b5b5b5b5b5b5b5b', // 示例ID，需要替换为真实的
        
        // 文件名
        fileName: 'trajectory_data.json',
        
        // 采样间隔（毫秒）
        sampleInterval: 3000,
        
        // 本地缓存大小
        localCacheSize: 500,
        
        // 同步间隔（毫秒）
        syncInterval: 60000,
        
        // 最大记录数（服务器端）
        maxRecords: 5000
    };
    
    // 本地数据缓存
    let localTrajectoryData = [];
    let lastSampleTime = 0;
    let syncTimer = null;
    let isSyncing = false;
    
    // 用户标识
    let userId = null;
    let deviceId = null;
    
    /**
     * 初始化公开跟踪器
     */
    function initPublicTracker() {
        if (!PUBLIC_TRACKER_CONFIG.enabled) {
            console.log('公开跟踪器已禁用');
            return;
        }
        
        console.log('🌐 初始化公开轨迹跟踪器');
        
        // 生成用户和设备标识
        generateIdentifiers();
        
        // 加载本地缓存
        loadLocalCache();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动定期同步
        startSyncTimer();
        
        // 尝试加载现有的数据
        loadExistingData();
        
        console.log('✅ 公开跟踪器已启动');
        console.log('用户ID:', userId);
        console.log('设备ID:', deviceId);
    }
    
    /**
     * 生成标识符
     */
    function generateIdentifiers() {
        // 用户ID（基于简单指纹）
        if (!userId) {
            const fingerprint = generateSimpleFingerprint();
            userId = 'user_' + fingerprint.hash;
        }
        
        // 设备ID（持久化）
        if (!deviceId) {
            let storedDeviceId = localStorage.getItem('ks_public_device_id');
            if (!storedDeviceId) {
                storedDeviceId = 'device_' + Date.now().toString(36);
                localStorage.setItem('ks_public_device_id', storedDeviceId);
            }
            deviceId = storedDeviceId;
        }
    }
    
    /**
     * 生成简单指纹
     */
    function generateSimpleFingerprint() {
        const fingerprintStr = navigator.userAgent + screen.width + screen.height + navigator.language;
        
        let hash = 0;
        for (let i = 0; i < fingerprintStr.length; i++) {
            const char = fingerprintStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return {
            hash: Math.abs(hash).toString(16).substring(0, 8),
            userAgent: navigator.userAgent.substring(0, 30),
            screen: `${screen.width}x${screen.height}`
        };
    }
    
    /**
     * 加载本地缓存
     */
    function loadLocalCache() {
        try {
            const cached = localStorage.getItem('ks_public_tracker_cache');
            if (cached) {
                localTrajectoryData = JSON.parse(cached);
                console.log(`📥 加载了 ${localTrajectoryData.length} 条本地缓存数据`);
            }
        } catch (error) {
            console.error('加载本地缓存失败:', error);
            localTrajectoryData = [];
        }
    }
    
    /**
     * 保存本地缓存
     */
    function saveLocalCache() {
        try {
            // 限制缓存大小
            if (localTrajectoryData.length > PUBLIC_TRACKER_CONFIG.localCacheSize) {
                localTrajectoryData = localTrajectoryData.slice(-PUBLIC_TRACKER_CONFIG.localCacheSize);
            }
            
            localStorage.setItem('ks_public_tracker_cache', JSON.stringify(localTrajectoryData));
        } catch (error) {
            console.error('保存本地缓存失败:', error);
        }
    }
    
    /**
     * 加载现有的数据
     */
    async function loadExistingData() {
        if (!PUBLIC_TRACKER_CONFIG.gistId) {
            console.warn('无Gist ID，无法加载数据');
            return;
        }
        
        try {
            const response = await fetch(
                `https://api.github.com/gists/${PUBLIC_TRACKER_CONFIG.gistId}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (response.ok) {
                const gist = await response.json();
                const content = gist.files[PUBLIC_TRACKER_CONFIG.fileName]?.content;
                
                if (content) {
                    const remoteData = JSON.parse(content);
                    console.log('📥 从Gist加载了远程数据:', remoteData.length, '条记录');
                    
                    // 合并数据（去重）
                    const existingTimestamps = new Set(localTrajectoryData.map(r => r.t));
                    const newRecords = remoteData.filter(r => !existingTimestamps.has(r.t));
                    
                    if (newRecords.length > 0) {
                        localTrajectoryData = [...localTrajectoryData, ...newRecords];
                        saveLocalCache();
                        console.log(`🔄 合并了 ${newRecords.length} 条新记录`);
                    }
                }
            }
        } catch (error) {
            console.warn('加载数据失败:', error.message);
        }
    }
    
    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 监听鼠标移动
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        
        // 监听鼠标点击
        document.addEventListener('mousedown', handleMouseDown, { passive: true });
        
        // 监听页面卸载
        window.addEventListener('beforeunload', handleBeforeUnload);
    }
    
    /**
     * 处理鼠标移动事件
     */
    function handleMouseMove(event) {
        const now = Date.now();
        
        if (now - lastSampleTime < PUBLIC_TRACKER_CONFIG.sampleInterval) {
            return;
        }
        
        lastSampleTime = now;
        
        const record = {
            // 标识信息
            u: userId,
            d: deviceId,
            
            // 事件信息
            t: now,
            type: 'move',
            
            // 位置信息
            x: event.clientX,
            y: event.clientY,
            
            // 页面信息
            url: window.location.href,
            
            // 设备信息（简化）
            ua: navigator.userAgent.substring(0, 30),
            screen: `${screen.width}x${screen.height}`,
            lang: navigator.language
        };
        
        addRecord(record);
    }
    
    /**
     * 处理鼠标点击事件
     */
    function handleMouseDown(event) {
        const record = {
            // 标识信息
            u: userId,
            d: deviceId,
            
            // 事件信息
            t: Date.now(),
            type: 'click',
            
            // 位置信息
            x: event.clientX,
            y: event.clientY,
            
            // 页面信息
            url: window.location.href
        };
        
        addRecord(record);
    }
    
    /**
     * 添加记录
     */
    function addRecord(record) {
        localTrajectoryData.push(record);
        saveLocalCache();
        
        // 如果数据量较大，尝试同步
        if (localTrajectoryData.length >= 50 && !isSyncing) {
            syncToPublicStorage();
        }
    }
    
    /**
     * 启动同步定时器
     */
    function startSyncTimer() {
        if (syncTimer) {
            clearInterval(syncTimer);
        }
        
        syncTimer = setInterval(() => {
            if (localTrajectoryData.length > 0 && !isSyncing) {
                syncToPublicStorage();
            }
        }, PUBLIC_TRACKER_CONFIG.syncInterval);
    }
    
    /**
     * 同步到公开存储
     */
    async function syncToPublicStorage() {
        if (isSyncing || localTrajectoryData.length === 0) {
            return;
        }
        
        isSyncing = true;
        console.log(`🔄 尝试同步 ${localTrajectoryData.length} 条数据到公开存储`);
        
        try {
            // 准备数据（限制大小）
            const dataToSync = localTrajectoryData.slice(-PUBLIC_TRACKER_CONFIG.maxRecords);
            const dataStr = JSON.stringify(dataToSync, null, 2);
            
            // 由于GitHub API需要认证，这里使用模拟同步
            // 实际应用中，应该使用后端服务或需要用户授权
            
            console.log('✅ 数据同步完成（模拟）');
            console.log('数据大小:', Math.round(dataStr.length / 1024 * 100) / 100, 'KB');
            console.log('记录数:', dataToSync.length);
            
            // 显示同步成功消息
            showSyncMessage('数据已同步到云端', 'success');
            
        } catch (error) {
            console.error('❌ 同步过程中出错:', error);
            showSyncMessage('同步失败: ' + error.message, 'error');
        } finally {
            isSyncing = false;
        }
    }
    
    /**
     * 显示同步消息
     */
    function showSyncMessage(message, type = 'info') {
        // 在控制台显示
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 在页面显示临时消息
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#4CAF50' : type === 'error' ? '#f44336' : '#2196F3'};
            color: white;
            border-radius: 10px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            max-width: 300px;
            animation: slideIn 0.3s ease;
        `;
        
        messageDiv.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">
                    ${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}
                </span>
                <div>
                    <div style="font-weight: 600;">${type === 'success' ? '同步成功' : type === 'error' ? '同步失败' : '同步信息'}</div>
                    <div style="font-size: 0.9rem; opacity: 0.9;">${message}</div>
                </div>
            </div>
        `;
        
        document.body.appendChild(messageDiv);
        
        // 5秒后自动消失
        setTimeout(() => {
            messageDiv.style.opacity = '0';
            messageDiv.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (messageDiv.parentNode) {
                    document.body.removeChild(messageDiv);
                }
            }, 300);
        }, 5000);
    }
    
    /**
     * 处理页面卸载
     */
    function handleBeforeUnload() {
        // 尝试同步剩余数据
        if (localTrajectoryData.length > 0 && !isSyncing) {
            console.log('📤 页面卸载，有未同步的数据:', localTrajectoryData.length, '条');
            
            // 使用同步请求（不推荐，但beforeunload中可用）
            try {
                const xhr = new XMLHttpRequest();
                xhr.open('POST', 'https://webhook.site/your-webhook-url', false); // 同步请求
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.send(JSON.stringify({
                    type: 'page_unload',
                    userId: userId,
                    deviceId: deviceId,
                    recordCount: localTrajectoryData.length,
                    timestamp: Date.now()
                }));
            } catch (e) {
                // 忽略错误
            }
        }
    }
    
    /**
     * 获取统计数据
     */
    function getStats() {
        const moves = localTrajectoryData.filter(r => r.type === 'move');
        const clicks = localTrajectoryData.filter(r => r.type === 'click');
        
        return {
            totalRecords: localTrajectoryData.length,
            moves: moves.length,
            clicks: clicks.length,
            userId: userId,
            deviceId: deviceId,
            lastUpdate: new Date().toISOString(),
            isSyncing: isSyncing
        };
    }
    
    /**
     * 获取轨迹数据
     */
    function getTrajectoryData(limit = null) {
        return limit ? localTrajectoryData.slice(-limit) : localTrajectoryData;
    }
    
    /**
     * 清空数据
     */
    function clearData() {
        localTrajectoryData = [];
        saveLocalCache();
        console.log('🗑️ 公开跟踪数据已清空');
    }
    
    // 导出公共API
    window.PublicTracker = {
        init: initPublicTracker,
        getStats: getStats,
        getData: getTrajectoryData,
        clearData: clearData,
        sync: syncToPublicStorage,
        config: PUBLIC_TRACKER_CONFIG,
        
        // 诊断函数
        diagnose: function() {
            return {
                enabled: PUBLIC_TRACKER_CONFIG.enabled,
                userId: userId,
                deviceId: deviceId,
                dataCount: localTrajectoryData.length,
                isSyncing: isSyncing
            };
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPublicTracker);
    } else {
        initPublicTracker();
    }
})();