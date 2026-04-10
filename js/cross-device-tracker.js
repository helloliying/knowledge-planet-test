/**
 * 跨设备鼠标轨迹收集器
 * 为 https://helloliying.github.io/knowledge-planet-test/ 网站设计
 * 数据存储到GitHub Gist，支持多设备同步
 */

(function() {
    'use strict';
    
    // 配置
    const CROSS_DEVICE_CONFIG = {
        // 是否启用
        enabled: true,
        
        // GitHub Gist ID（需要替换为真实的）
        gistId: '', // 留空，将从URL参数或localStorage获取
        
        // Gist文件名
        fileName: 'cross-device-mouse-data.json',
        
        // 采样间隔（毫秒）
        sampleInterval: 2000,
        
        // 本地缓存大小
        localCacheSize: 300,
        
        // 同步间隔（毫秒）
        syncInterval: 30000, // 30秒
        
        // 最大记录数（服务器端）
        maxRecords: 10000,
        
        // 数据格式版本
        version: '1.0'
    };
    
    // 本地数据缓存
    let localTrajectoryData = [];
    let lastSampleTime = 0;
    let syncTimer = null;
    let isSyncing = false;
    
    // 用户和设备标识
    let userId = null;
    let deviceId = null;
    let sessionId = null;
    
    // 页面信息
    const pageInfo = {
        url: window.location.href,
        title: document.title,
        referrer: document.referrer,
        timestamp: Date.now()
    };
    
    /**
     * 初始化跨设备跟踪器
     */
    function initCrossDeviceTracker() {
        if (!CROSS_DEVICE_CONFIG.enabled) {
            console.log('跨设备跟踪器已禁用');
            return;
        }
        
        console.log('🚀 初始化跨设备鼠标轨迹收集器');
        
        // 从URL参数获取Gist ID
        loadGistIdFromUrl();
        
        // 生成标识符
        generateIdentifiers();
        
        // 加载本地缓存
        loadLocalCache();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动定期同步
        startSyncTimer();
        
        // 尝试加载现有的共享数据
        loadSharedData();
        
        console.log('✅ 跨设备跟踪器已启动');
        console.log('用户ID:', userId);
        console.log('设备ID:', deviceId);
        console.log('会话ID:', sessionId);
        console.log('Gist ID:', CROSS_DEVICE_CONFIG.gistId || '未设置');
    }
    
    /**
     * 从URL参数加载Gist ID
     */
    function loadGistIdFromUrl() {
        const urlParams = new URLSearchParams(window.location.search);
        const gistIdFromUrl = urlParams.get('gist');
        
        if (gistIdFromUrl) {
            CROSS_DEVICE_CONFIG.gistId = gistIdFromUrl;
            localStorage.setItem('ks_cross_device_gist_id', gistIdFromUrl);
            console.log('从URL获取Gist ID:', gistIdFromUrl);
        } else {
            // 尝试从localStorage加载
            const savedGistId = localStorage.getItem('ks_cross_device_gist_id');
            if (savedGistId) {
                CROSS_DEVICE_CONFIG.gistId = savedGistId;
                console.log('从localStorage加载Gist ID:', savedGistId);
            }
        }
    }
    
    /**
     * 生成标识符
     */
    function generateIdentifiers() {
        // 用户ID（基于持久化存储）
        if (!userId) {
            let storedUserId = localStorage.getItem('ks_cross_device_user_id');
            if (!storedUserId) {
                storedUserId = 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
                localStorage.setItem('ks_cross_device_user_id', storedUserId);
            }
            userId = storedUserId;
        }
        
        // 设备ID（基于浏览器指纹）
        if (!deviceId) {
            let storedDeviceId = localStorage.getItem('ks_cross_device_device_id');
            if (!storedDeviceId) {
                const fingerprint = generateDeviceFingerprint();
                storedDeviceId = 'device_' + fingerprint.hash;
                localStorage.setItem('ks_cross_device_device_id', storedDeviceId);
            }
            deviceId = storedDeviceId;
        }
        
        // 会话ID（每次页面加载生成）
        if (!sessionId) {
            sessionId = 'session_' + Date.now().toString(36);
        }
    }
    
    /**
     * 生成设备指纹
     */
    function generateDeviceFingerprint() {
        const fingerprintStr = [
            navigator.userAgent,
            navigator.platform,
            navigator.language,
            screen.width,
            screen.height,
            screen.colorDepth,
            (navigator.hardwareConcurrency || 'unknown'),
            (navigator.deviceMemory || 'unknown'),
            Intl.DateTimeFormat().resolvedOptions().timeZone
        ].join('|');
        
        // 简单哈希函数
        let hash = 0;
        for (let i = 0; i < fingerprintStr.length; i++) {
            const char = fingerprintStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return {
            hash: Math.abs(hash).toString(16).substring(0, 12),
            userAgent: navigator.userAgent.substring(0, 50),
            screen: `${screen.width}x${screen.height}`,
            platform: navigator.platform,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
        };
    }
    
    /**
     * 加载本地缓存
     */
    function loadLocalCache() {
        try {
            const cached = localStorage.getItem('ks_cross_device_cache');
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
            if (localTrajectoryData.length > CROSS_DEVICE_CONFIG.localCacheSize) {
                localTrajectoryData = localTrajectoryData.slice(-CROSS_DEVICE_CONFIG.localCacheSize);
            }
            
            localStorage.setItem('ks_cross_device_cache', JSON.stringify(localTrajectoryData));
        } catch (error) {
            console.error('保存本地缓存失败:', error);
        }
    }
    
    /**
     * 加载共享数据
     */
    async function loadSharedData() {
        if (!CROSS_DEVICE_CONFIG.gistId) {
            console.warn('无Gist ID，无法加载共享数据');
            return;
        }
        
        try {
            console.log(`🔄 从Gist加载共享数据: ${CROSS_DEVICE_CONFIG.gistId}`);
            
            const response = await fetch(
                `https://api.github.com/gists/${CROSS_DEVICE_CONFIG.gistId}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (response.ok) {
                const gist = await response.json();
                const content = gist.files[CROSS_DEVICE_CONFIG.fileName]?.content;
                
                if (content) {
                    const sharedData = JSON.parse(content);
                    console.log('📥 从Gist加载了共享数据:', sharedData.length, '条记录');
                    
                    // 合并数据（去重）
                    const existingTimestamps = new Set(localTrajectoryData.map(r => r.timestamp));
                    const newRecords = sharedData.filter(r => !existingTimestamps.has(r.timestamp));
                    
                    if (newRecords.length > 0) {
                        localTrajectoryData = [...localTrajectoryData, ...newRecords];
                        saveLocalCache();
                        console.log(`🔄 合并了 ${newRecords.length} 条新记录`);
                    }
                } else {
                    console.log('Gist中没有找到数据文件');
                }
            } else {
                console.warn('加载共享数据失败，HTTP状态:', response.status);
            }
        } catch (error) {
            console.warn('加载共享数据失败:', error.message);
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
        
        if (now - lastSampleTime < CROSS_DEVICE_CONFIG.sampleInterval) {
            return;
        }
        
        lastSampleTime = now;
        
        const record = {
            // 标识信息
            userId: userId,
            deviceId: deviceId,
            sessionId: sessionId,
            
            // 事件信息
            type: 'mouse_move',
            timestamp: now,
            
            // 位置信息
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            
            // 页面信息
            url: pageInfo.url,
            title: pageInfo.title,
            
            // 设备信息
            userAgent: navigator.userAgent.substring(0, 100),
            screenWidth: screen.width,
            screenHeight: screen.height,
            language: navigator.language,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            
            // 元数据
            version: CROSS_DEVICE_CONFIG.version,
            collectedAt: new Date().toISOString()
        };
        
        addRecord(record);
    }
    
    /**
     * 处理鼠标点击事件
     */
    function handleMouseDown(event) {
        const record = {
            // 标识信息
            userId: userId,
            deviceId: deviceId,
            sessionId: sessionId,
            
            // 事件信息
            type: 'mouse_click',
            timestamp: Date.now(),
            button: event.button,
            
            // 位置信息
            x: event.clientX,
            y: event.clientY,
            target: event.target.tagName.toLowerCase(),
            
            // 页面信息
            url: pageInfo.url,
            
            // 元数据
            version: CROSS_DEVICE_CONFIG.version,
            collectedAt: new Date().toISOString()
        };
        
        addRecord(record);
    }
    
    /**
     * 处理页面可见性变化
     */
    function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            // 页面隐藏时保存数据
            saveLocalCache();
        }
    }
    
    /**
     * 处理页面卸载
     */
    function handleBeforeUnload() {
        // 页面关闭前同步数据
        if (localTrajectoryData.length > 0 && !isSyncing) {
            syncToGist();
        }
    }
    
    /**
     * 添加记录
     */
    function addRecord(record) {
        localTrajectoryData.push(record);
        saveLocalCache();
        
        // 如果数据量较大，尝试同步
        if (localTrajectoryData.length >= 100 && !isSyncing) {
            syncToGist();
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
                syncToGist();
            }
        }, CROSS_DEVICE_CONFIG.syncInterval);
    }
    
    /**
     * 同步到GitHub Gist
     */
    async function syncToGist() {
        if (isSyncing || localTrajectoryData.length === 0 || !CROSS_DEVICE_CONFIG.gistId) {
            return;
        }
        
        isSyncing = true;
        console.log(`🔄 开始同步数据到Gist: ${CROSS_DEVICE_CONFIG.gistId}`);
        
        try {
            // 1. 获取现有的Gist数据
            const gistResponse = await fetch(
                `https://api.github.com/gists/${CROSS_DEVICE_CONFIG.gistId}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (!gistResponse.ok) {
                throw new Error(`获取Gist失败: ${gistResponse.status}`);
            }
            
            const gist = await gistResponse.json();
            const existingContent = gist.files[CROSS_DEVICE_CONFIG.fileName]?.content;
            let existingData = [];
            
            if (existingContent) {
                try {
                    existingData = JSON.parse(existingContent);
                } catch (parseError) {
                    console.warn('解析现有数据失败，创建新数据:', parseError.message);
                }
            }
            
            // 2. 合并数据（去重）
            const existingTimestamps = new Set(existingData.map(r => r.timestamp));
            const newRecords = localTrajectoryData.filter(r => !existingTimestamps.has(r.timestamp));
            
            if (newRecords.length === 0) {
                console.log('🔄 没有新数据需要同步');
                isSyncing = false;
                return;
            }
            
            const mergedData = [...existingData, ...newRecords];
            
            // 3. 限制数据量
            if (mergedData.length > CROSS_DEVICE_CONFIG.maxRecords) {
                mergedData = mergedData.slice(-CROSS_DEVICE_CONFIG.maxRecords);
            }
            
            // 4. 更新Gist
            const updateResponse = await fetch(
                `https://api.github.com/gists/${CROSS_DEVICE_CONFIG.gistId}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        description: `跨设备鼠标轨迹数据 - 最后更新: ${new Date().toLocaleString()}`,
                        files: {
                            [CROSS_DEVICE_CONFIG.fileName]: {
                                content: JSON.stringify(mergedData, null, 2)
                            }
                        }
                    })
                }
            );
            
            if (updateResponse.ok) {
                console.log(`✅ 同步成功！上传了 ${newRecords.length} 条新记录`);
                console.log(`📊 总记录数: ${mergedData.length}`);
                
                // 清空本地缓存（数据已成功同步）
                localTrajectoryData = [];
                saveLocalCache();
            } else {
                throw new Error(`更新Gist失败: ${updateResponse.status}`);
            }
            
        } catch (error) {
            console.error('❌ 同步失败:', error.message);
            console.log('数据保留在本地缓存中，下次尝试同步');
        } finally {
            isSyncing = false;
        }
    }
    
    /**
     * 获取统计数据
     */
    function getStats() {
        return {
            localRecords: localTrajectoryData.length,
            userId: userId,
            deviceId: deviceId,
            sessionId: sessionId,
            gistId: CROSS_DEVICE_CONFIG.gistId,
            lastSync: lastSampleTime,
            pageInfo: pageInfo
        };
    }
    
    /**
     * 导出本地数据
     */
    function exportLocalData() {
        const dataStr = JSON.stringify(localTrajectoryData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const url = URL.createObjectURL(dataBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cross-device-mouse-data-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log(`📥 导出了 ${localTrajectoryData.length} 条本地数据`);
    }
    
    /**
     * 设置Gist ID
     */
    function setGistId(newGistId) {
        if (newGistId && newGistId.trim().length > 10) {
            CROSS_DEVICE_CONFIG.gistId = newGistId.trim();
            localStorage.setItem('ks_cross_device_gist_id', newGistId.trim());
            console.log('✅ Gist ID已设置:', newGistId);
            return true;
        }
        return false;
    }
    
    /**
     * 获取Gist信息
     */
    async function getGistInfo() {
        if (!CROSS_DEVICE_CONFIG.gistId) {
            return { error: '未设置Gist ID' };
        }
        
        try {
            const response = await fetch(
                `https://api.github.com/gists/${CROSS_DEVICE_CONFIG.gistId}`,
                {
                    headers: {
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (response.ok) {
                const gist = await response.json();
                return {
                    id: gist.id,
                    description: gist.description,
                    html_url: gist.html_url,
                    updated_at: gist.updated_at,
                    files: Object.keys(gist.files)
                };
            } else {
                return { error: `HTTP ${response.status}` };
            }
        } catch (error) {
            return { error: error.message };
        }
    }
    
    // 公开API
    window.CrossDeviceTracker = {
        init: initCrossDeviceTracker,
        getStats: getStats,
        exportData: exportLocalData,
        setGistId: setGistId,
        getGistInfo: getGistInfo,
        syncNow: syncToGist
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initCrossDeviceTracker);
    } else {
        initCrossDeviceTracker();
    }
    
})();