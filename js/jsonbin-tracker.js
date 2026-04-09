/**
 * JSONBin.io 轨迹跟踪器
 * 使用 jsonbin.io 免费API存储跨设备轨迹数据
 * 无需认证，完全公开访问
 */

(function() {
    'use strict';
    
    // 配置
    const JSONBIN_TRACKER_CONFIG = {
        // 是否启用
        enabled: true,
        
        // JSONBin.io API端点
        // 使用公开的bin，无需API密钥
        jsonbinUrl: 'https://api.jsonbin.io/v3/b',
        
        // Bin ID（自动创建）
        binId: null,
        
        // 采样间隔（毫秒）
        sampleInterval: 3000, // 降低频率，避免API限制
        
        // 本地缓存大小
        localCacheSize: 500,
        
        // 同步间隔（毫秒）
        syncInterval: 60000, // 每分钟同步一次
        
        // 最大记录数（服务器端）
        maxRecords: 10000
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
     * 初始化JSONBin跟踪器
     */
    function initJsonBinTracker() {
        if (!JSONBIN_TRACKER_CONFIG.enabled) {
            console.log('JSONBin跟踪器已禁用');
            return;
        }
        
        console.log('🌐 初始化JSONBin.io轨迹跟踪器');
        
        // 生成用户和设备标识
        generateIdentifiers();
        
        // 加载本地缓存
        loadLocalCache();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动定期同步
        startSyncTimer();
        
        // 尝试加载现有的bin
        loadExistingBin();
        
        console.log('✅ JSONBin.io跟踪器已启动');
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
            let storedDeviceId = localStorage.getItem('ks_jsonbin_device_id');
            if (!storedDeviceId) {
                storedDeviceId = 'device_' + Date.now().toString(36);
                localStorage.setItem('ks_jsonbin_device_id', storedDeviceId);
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
            const cached = localStorage.getItem('ks_jsonbin_cache');
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
            if (localTrajectoryData.length > JSONBIN_TRACKER_CONFIG.localCacheSize) {
                localTrajectoryData = localTrajectoryData.slice(-JSONBIN_TRACKER_CONFIG.localCacheSize);
            }
            
            localStorage.setItem('ks_jsonbin_cache', JSON.stringify(localTrajectoryData));
        } catch (error) {
            console.error('保存本地缓存失败:', error);
        }
    }
    
    /**
     * 加载现有的bin
     */
    async function loadExistingBin() {
        // 如果没有bin ID，尝试从localStorage加载
        if (!JSONBIN_TRACKER_CONFIG.binId) {
            const savedBinId = localStorage.getItem('ks_jsonbin_bin_id');
            if (savedBinId) {
                JSONBIN_TRACKER_CONFIG.binId = savedBinId;
                console.log('📥 加载了已保存的Bin ID:', savedBinId);
            }
        }
        
        // 如果有bin ID，尝试加载数据
        if (JSONBIN_TRACKER_CONFIG.binId) {
            try {
                const response = await fetch(
                    `${JSONBIN_TRACKER_CONFIG.jsonbinUrl}/${JSONBIN_TRACKER_CONFIG.binId}/latest`,
                    {
                        headers: {
                            'X-Master-Key': '$2a$10$wLWZc.7jB6sFc6oD5J8QnO', // 公开的只读密钥
                            'X-Bin-Meta': 'false'
                        }
                    }
                );
                
                if (response.ok) {
                    const remoteData = await response.json();
                    console.log('📥 从JSONBin加载了远程数据:', remoteData.length, '条记录');
                    
                    // 合并数据（去重）
                    const existingTimestamps = new Set(localTrajectoryData.map(r => r.t));
                    const newRecords = remoteData.filter(r => !existingTimestamps.has(r.t));
                    
                    if (newRecords.length > 0) {
                        localTrajectoryData = [...localTrajectoryData, ...newRecords];
                        saveLocalCache();
                        console.log(`🔄 合并了 ${newRecords.length} 条新记录`);
                    }
                }
            } catch (error) {
                console.warn('加载JSONBin数据失败:', error.message);
            }
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
        
        if (now - lastSampleTime < JSONBIN_TRACKER_CONFIG.sampleInterval) {
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
            screen: `${screen.width}x${screen.height}`
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
                syncToJsonBin();
            }
        }, JSONBIN_TRACKER_CONFIG.syncInterval);
    }
    
    /**
     * 同步到JSONBin.io
     */
    async function syncToJsonBin() {
        if (isSyncing || localTrajectoryData.length === 0) {
            return;
        }
        
        isSyncing = true;
        console.log(`🔄 尝试同步 ${localTrajectoryData.length} 条数据到JSONBin.io`);
        
        try {
            // 准备数据（限制大小）
            const dataToSync = localTrajectoryData.slice(-JSONBIN_TRACKER_CONFIG.maxRecords);
            const dataStr = JSON.stringify(dataToSync);
            
            let response;
            
            if (JSONBIN_TRACKER_CONFIG.binId) {
                // 更新现有的bin
                response = await fetch(
                    `${JSONBIN_TRACKER_CONFIG.jsonbinUrl}/${JSONBIN_TRACKER_CONFIG.binId}`,
                    {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Master-Key': '$2a$10$wLWZc.7jB6sFc6oD5J8QnO',
                            'X-Bin-Private': 'false'
                        },
                        body: dataStr
                    }
                );
            } else {
                // 创建新的bin
                response = await fetch(JSONBIN_TRACKER_CONFIG.jsonbinUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Master-Key': '$2a$10$wLWZc.7jB6sFc6oD5J8QnO',
                        'X-Bin-Private': 'false',
                        'X-Bin-Name': '轨迹数据存储'
                    },
                    body: dataStr
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                
                if (!JSONBIN_TRACKER_CONFIG.binId) {
                    JSONBIN_TRACKER_CONFIG.binId = result.metadata.id;
                    localStorage.setItem('ks_jsonbin_bin_id', result.metadata.id);
                    console.log('✅ 创建了新的JSONBin:', result.metadata.id);
                }
                
                console.log('✅ 数据同步成功');
                console.log('Bin URL:', `https://jsonbin.io/${JSONBIN_TRACKER_CONFIG.binId}`);
                
            } else {
                const errorText = await response.text();
                console.error('❌ 同步失败:', response.status, errorText);
            }
            
        } catch (error) {
            console.error('❌ 同步过程中出错:', error);
        } finally {
            isSyncing = false;
        }
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
            binId: JSONBIN_TRACKER_CONFIG.binId,
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
     * 获取所有用户的数据（从服务器）
     */
    async function getAllData() {
        if (!JSONBIN_TRACKER_CONFIG.binId) {
            console.warn('无bin ID，无法获取数据');
            return [];
        }
        
        try {
            const response = await fetch(
                `${JSONBIN_TRACKER_CONFIG.jsonbinUrl}/${JSONBIN_TRACKER_CONFIG.binId}/latest`,
                {
                    headers: {
                        'X-Master-Key': '$2a$10$wLWZc.7jB6sFc6oD5J8QnO',
                        'X-Bin-Meta': 'false'
                    }
                }
            );
            
            if (response.ok) {
                return await response.json();
            }
        } catch (error) {
            console.error('获取所有数据失败:', error);
        }
        
        return [];
    }
    
    /**
     * 清空数据
     */
    function clearData() {
        localTrajectoryData = [];
        saveLocalCache();
        console.log('🗑️ JSONBin跟踪数据已清空');
    }
    
    // 导出公共API
    window.JsonBinTracker = {
        init: initJsonBinTracker,
        getStats: getStats,
        getData: getTrajectoryData,
        getAllData: getAllData,
        clearData: clearData,
        sync: syncToJsonBin,
        config: JSONBIN_TRACKER_CONFIG,
        
        // 诊断函数
        diagnose: function() {
            return {
                enabled: JSONBIN_TRACKER_CONFIG.enabled,
                userId: userId,
                deviceId: deviceId,
                binId: JSONBIN_TRACKER_CONFIG.binId,
                dataCount: localTrajectoryData.length,
                isSyncing: isSyncing
            };
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initJsonBinTracker);
    } else {
        initJsonBinTracker();
    }
})();