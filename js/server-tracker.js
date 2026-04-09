/**
 * 服务器端轨迹跟踪器
 * 将轨迹数据发送到服务器，实现跨设备记录
 */

(function() {
    'use strict';
    
    // 配置
    const SERVER_TRACKER_CONFIG = {
        // 是否启用服务器端跟踪
        enabled: true,
        
        // 服务器API端点
        // 注意：GitHub Pages是静态托管，不能运行服务器端代码
        // 我们需要使用其他服务或GitHub API
        apiEndpoint: 'https://api.github.com/repos/helloliying/knowledge-planet-test/issues',
        
        // 采样间隔（毫秒）
        sampleInterval: 1000, // 降低频率，避免API限制
        
        // 批量发送大小
        batchSize: 10,
        
        // GitHub Token（需要用户授权）
        // 注意：实际应用中应该使用OAuth或后端代理
        useGitHubAPI: false, // 暂时禁用，需要用户授权
        
        // 备用方案：使用localStorage + 定期同步
        fallbackToLocalStorage: true,
        
        // 用户标识
        userId: null,
        deviceId: null
    };
    
    // 本地数据缓存
    let localTrajectoryData = [];
    let lastSampleTime = 0;
    let syncTimer = null;
    
    /**
     * 初始化服务器端跟踪器
     */
    function initServerTracker() {
        if (!SERVER_TRACKER_CONFIG.enabled) {
            console.log('服务器端跟踪器已禁用');
            return;
        }
        
        console.log('🌐 初始化服务器端轨迹跟踪器');
        
        // 生成用户和设备标识
        generateUserAndDeviceId();
        
        // 加载本地缓存
        loadLocalCache();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动定期同步
        startSyncTimer();
        
        console.log('✅ 服务器端跟踪器已启动');
        console.log('用户ID:', SERVER_TRACKER_CONFIG.userId);
        console.log('设备ID:', SERVER_TRACKER_CONFIG.deviceId);
    }
    
    /**
     * 生成用户和设备标识
     */
    function generateUserAndDeviceId() {
        // 生成用户ID（基于浏览器指纹）
        if (!SERVER_TRACKER_CONFIG.userId) {
            const fingerprint = generateFingerprint();
            SERVER_TRACKER_CONFIG.userId = 'user_' + fingerprint.hash.substring(0, 8);
        }
        
        // 生成设备ID（基于会话）
        if (!SERVER_TRACKER_CONFIG.deviceId) {
            let deviceId = sessionStorage.getItem('ks_device_id');
            if (!deviceId) {
                deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                sessionStorage.setItem('ks_device_id', deviceId);
            }
            SERVER_TRACKER_CONFIG.deviceId = deviceId;
        }
    }
    
    /**
     * 生成简单指纹
     */
    function generateFingerprint() {
        const fingerprintStr = JSON.stringify({
            ua: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            screen: screen.width + 'x' + screen.height,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        });
        
        let hash = 0;
        for (let i = 0; i < fingerprintStr.length; i++) {
            const char = fingerprintStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return {
            hash: Math.abs(hash).toString(16),
            userAgent: navigator.userAgent,
            screen: { width: screen.width, height: screen.height }
        };
    }
    
    /**
     * 加载本地缓存
     */
    function loadLocalCache() {
        try {
            const cached = localStorage.getItem('ks_server_tracker_cache');
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
     * 设置事件监听器
     */
    function setupEventListeners() {
        // 监听鼠标移动
        document.addEventListener('mousemove', handleMouseMove, { passive: true });
        
        // 监听鼠标点击
        document.addEventListener('mousedown', handleMouseDown, { passive: true });
        
        // 监听页面卸载
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    /**
     * 处理鼠标移动事件
     */
    function handleMouseMove(event) {
        const now = Date.now();
        
        if (now - lastSampleTime < SERVER_TRACKER_CONFIG.sampleInterval) {
            return;
        }
        
        lastSampleTime = now;
        
        const record = {
            t: now,
            x: event.clientX,
            y: event.clientY,
            type: 'mousemove',
            pageX: event.pageX,
            pageY: event.pageY,
            userId: SERVER_TRACKER_CONFIG.userId,
            deviceId: SERVER_TRACKER_CONFIG.deviceId,
            pageUrl: window.location.href,
            userAgent: navigator.userAgent.substring(0, 100)
        };
        
        addRecord(record);
    }
    
    /**
     * 处理鼠标点击事件
     */
    function handleMouseDown(event) {
        const record = {
            t: Date.now(),
            x: event.clientX,
            y: event.clientY,
            type: 'mousedown',
            button: event.button,
            userId: SERVER_TRACKER_CONFIG.userId,
            deviceId: SERVER_TRACKER_CONFIG.deviceId,
            pageUrl: window.location.href
        };
        
        addRecord(record);
    }
    
    /**
     * 添加记录
     */
    function addRecord(record) {
        localTrajectoryData.push(record);
        
        // 保存到本地缓存
        saveLocalCache();
        
        // 检查是否需要同步到服务器
        if (localTrajectoryData.length >= SERVER_TRACKER_CONFIG.batchSize) {
            syncToServer();
        }
    }
    
    /**
     * 保存本地缓存
     */
    function saveLocalCache() {
        try {
            // 只保留最近1000条记录
            if (localTrajectoryData.length > 1000) {
                localTrajectoryData = localTrajectoryData.slice(-1000);
            }
            
            localStorage.setItem('ks_server_tracker_cache', JSON.stringify(localTrajectoryData));
        } catch (error) {
            console.error('保存本地缓存失败:', error);
        }
    }
    
    /**
     * 启动同步定时器
     */
    function startSyncTimer() {
        if (syncTimer) {
            clearInterval(syncTimer);
        }
        
        // 每30秒尝试同步一次
        syncTimer = setInterval(() => {
            if (localTrajectoryData.length > 0) {
                syncToServer();
            }
        }, 30000);
    }
    
    /**
     * 同步到服务器
     */
    function syncToServer() {
        if (localTrajectoryData.length === 0) {
            return;
        }
        
        console.log(`🔄 尝试同步 ${localTrajectoryData.length} 条数据到服务器`);
        
        // 由于GitHub Pages的限制，我们使用模拟的服务器同步
        // 实际应用中应该替换为真实的API调用
        
        // 模拟同步成功
        setTimeout(() => {
            console.log('✅ 数据同步完成（模拟）');
            
            // 在实际应用中，成功同步后应该清空已同步的数据
            // localTrajectoryData = [];
            // saveLocalCache();
        }, 1000);
    }
    
    /**
     * 处理页面卸载
     */
    function handleBeforeUnload() {
        // 尝试同步剩余数据
        if (localTrajectoryData.length > 0) {
            syncToServer();
        }
    }
    
    /**
     * 处理页面可见性变化
     */
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // 页面重新可见时，尝试同步
            if (localTrajectoryData.length > 0) {
                syncToServer();
            }
        }
    }
    
    /**
     * 获取统计数据
     */
    function getStats() {
        const now = Date.now();
        const moves = localTrajectoryData.filter(r => r.type === 'mousemove');
        const clicks = localTrajectoryData.filter(r => r.type === 'mousedown');
        
        return {
            totalRecords: localTrajectoryData.length,
            moves: moves.length,
            clicks: clicks.length,
            userId: SERVER_TRACKER_CONFIG.userId,
            deviceId: SERVER_TRACKER_CONFIG.deviceId,
            lastUpdate: new Date().toISOString(),
            unsyncedRecords: localTrajectoryData.length
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
        console.log('🗑️ 服务器端跟踪数据已清空');
    }
    
    // 导出公共API
    window.ServerTracker = {
        init: initServerTracker,
        getStats: getStats,
        getData: getTrajectoryData,
        clearData: clearData,
        config: SERVER_TRACKER_CONFIG,
        
        // 诊断函数
        diagnose: function() {
            return {
                enabled: SERVER_TRACKER_CONFIG.enabled,
                userId: SERVER_TRACKER_CONFIG.userId,
                deviceId: SERVER_TRACKER_CONFIG.deviceId,
                dataCount: localTrajectoryData.length,
                lastSync: '模拟同步'
            };
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initServerTracker);
    } else {
        initServerTracker();
    }
})();