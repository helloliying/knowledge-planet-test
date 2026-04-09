/**
 * GitHub Gists 轨迹跟踪器
 * 使用 GitHub Gists API 存储跨设备轨迹数据
 * 注意：需要用户提供 GitHub Personal Access Token
 */

(function() {
    'use strict';
    
    // 配置
    const GISTS_TRACKER_CONFIG = {
        // 是否启用Gists跟踪
        enabled: true,
        
        // GitHub Gists API端点
        gistsApi: 'https://api.github.com/gists',
        
        // Gist ID（如果已存在）
        gistId: null,
        
        // 文件名
        fileName: 'trajectory_data.json',
        
        // GitHub Personal Access Token
        // 注意：实际应用中应该通过OAuth获取
        githubToken: null,
        
        // 采样间隔（毫秒）
        sampleInterval: 2000, // 降低频率，避免API限制
        
        // 批量大小
        batchSize: 20,
        
        // 最大本地缓存
        maxLocalCache: 1000,
        
        // 同步间隔（毫秒）
        syncInterval: 30000
    };
    
    // 本地数据缓存
    let localTrajectoryData = [];
    let lastSampleTime = 0;
    let syncTimer = null;
    let isSyncing = false;
    
    // 用户标识
    let userId = null;
    let deviceId = null;
    let sessionId = null;
    
    /**
     * 初始化Gists跟踪器
     */
    function initGistsTracker() {
        if (!GISTS_TRACKER_CONFIG.enabled) {
            console.log('GitHub Gists跟踪器已禁用');
            return;
        }
        
        console.log('🌐 初始化GitHub Gists轨迹跟踪器');
        
        // 生成用户、设备和会话标识
        generateIdentifiers();
        
        // 加载本地缓存
        loadLocalCache();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动定期同步
        startSyncTimer();
        
        console.log('✅ GitHub Gists跟踪器已启动');
        console.log('用户ID:', userId);
        console.log('设备ID:', deviceId);
        console.log('会话ID:', sessionId);
        
        // 尝试加载现有的Gist
        loadExistingGist();
    }
    
    /**
     * 生成标识符
     */
    function generateIdentifiers() {
        // 用户ID（基于浏览器指纹）
        if (!userId) {
            const fingerprint = generateFingerprint();
            userId = 'user_' + fingerprint.hash.substring(0, 8);
        }
        
        // 设备ID（基于会话）
        if (!deviceId) {
            let storedDeviceId = localStorage.getItem('ks_device_id');
            if (!storedDeviceId) {
                storedDeviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                localStorage.setItem('ks_device_id', storedDeviceId);
            }
            deviceId = storedDeviceId;
        }
        
        // 会话ID
        if (!sessionId) {
            sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('ks_session_id', sessionId);
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
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown'
        });
        
        let hash = 0;
        for (let i = 0; i < fingerprintStr.length; i++) {
            const char = fingerprintStr.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        
        return {
            hash: Math.abs(hash).toString(16),
            userAgent: navigator.userAgent.substring(0, 50),
            screen: { width: screen.width, height: screen.height },
            platform: navigator.platform,
            language: navigator.language
        };
    }
    
    /**
     * 加载本地缓存
     */
    function loadLocalCache() {
        try {
            const cached = localStorage.getItem('ks_gists_tracker_cache');
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
            if (localTrajectoryData.length > GISTS_TRACKER_CONFIG.maxLocalCache) {
                localTrajectoryData = localTrajectoryData.slice(-GISTS_TRACKER_CONFIG.maxLocalCache);
            }
            
            localStorage.setItem('ks_gists_tracker_cache', JSON.stringify(localTrajectoryData));
        } catch (error) {
            console.error('保存本地缓存失败:', error);
        }
    }
    
    /**
     * 加载现有的Gist
     */
    async function loadExistingGist() {
        // 如果没有Gist ID，尝试从localStorage加载
        if (!GISTS_TRACKER_CONFIG.gistId) {
            const savedGistId = localStorage.getItem('ks_gist_id');
            if (savedGistId) {
                GISTS_TRACKER_CONFIG.gistId = savedGistId;
                console.log('📥 加载了已保存的Gist ID:', savedGistId);
            }
        }
        
        // 如果有Gist ID，尝试加载数据
        if (GISTS_TRACKER_CONFIG.gistId && GISTS_TRACKER_CONFIG.githubToken) {
            try {
                const response = await fetch(
                    `${GISTS_TRACKER_CONFIG.gistsApi}/${GISTS_TRACKER_CONFIG.gistId}`,
                    {
                        headers: {
                            'Authorization': `token ${GISTS_TRACKER_CONFIG.githubToken}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (response.ok) {
                    const gist = await response.json();
                    const content = gist.files[GISTS_TRACKER_CONFIG.fileName]?.content;
                    
                    if (content) {
                        const remoteData = JSON.parse(content);
                        console.log('📥 从Gist加载了远程数据:', remoteData.length, '条记录');
                        
                        // 合并数据（简单实现，实际应用中需要更复杂的合并逻辑）
                        localTrajectoryData = [...remoteData, ...localTrajectoryData];
                        saveLocalCache();
                    }
                }
            } catch (error) {
                console.warn('加载Gist数据失败:', error.message);
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
        
        // 监听页面可见性变化
        document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    
    /**
     * 处理鼠标移动事件
     */
    function handleMouseMove(event) {
        const now = Date.now();
        
        if (now - lastSampleTime < GISTS_TRACKER_CONFIG.sampleInterval) {
            return;
        }
        
        lastSampleTime = now;
        
        const record = {
            // 标识信息
            userId: userId,
            deviceId: deviceId,
            sessionId: sessionId,
            
            // 事件信息
            type: 'mousemove',
            timestamp: now,
            
            // 位置信息
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY,
            
            // 页面信息
            pageUrl: window.location.href,
            pageTitle: document.title,
            
            // 设备信息
            userAgent: navigator.userAgent.substring(0, 100),
            screenWidth: screen.width,
            screenHeight: screen.height,
            colorDepth: screen.colorDepth,
            devicePixelRatio: window.devicePixelRatio || 1,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language
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
            type: 'mousedown',
            timestamp: Date.now(),
            
            // 位置信息
            x: event.clientX,
            y: event.clientY,
            pageX: event.pageX,
            pageY: event.pageY,
            button: event.button,
            
            // 页面信息
            pageUrl: window.location.href,
            pageTitle: document.title,
            
            // 设备信息
            userAgent: navigator.userAgent.substring(0, 50)
        };
        
        addRecord(record);
    }
    
    /**
     * 添加记录
     */
    function addRecord(record) {
        localTrajectoryData.push(record);
        saveLocalCache();
        
        // 检查是否需要同步
        if (localTrajectoryData.length >= GISTS_TRACKER_CONFIG.batchSize && !isSyncing) {
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
        }, GISTS_TRACKER_CONFIG.syncInterval);
    }
    
    /**
     * 同步到GitHub Gist
     */
    async function syncToGist() {
        if (isSyncing || localTrajectoryData.length === 0) {
            return;
        }
        
        isSyncing = true;
        console.log(`🔄 尝试同步 ${localTrajectoryData.length} 条数据到GitHub Gist`);
        
        try {
            // 准备数据
            const dataToSync = [...localTrajectoryData];
            const dataStr = JSON.stringify(dataToSync, null, 2);
            
            let response;
            
            if (GISTS_TRACKER_CONFIG.gistId) {
                // 更新现有的Gist
                response = await fetch(
                    `${GISTS_TRACKER_CONFIG.gistsApi}/${GISTS_TRACKER_CONFIG.gistId}`,
                    {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `token ${GISTS_TRACKER_CONFIG.githubToken}`,
                            'Content-Type': 'application/json',
                            'Accept': 'application/vnd.github.v3+json'
                        },
                        body: JSON.stringify({
                            files: {
                                [GISTS_TRACKER_CONFIG.fileName]: {
                                    content: dataStr
                                }
                            }
                        })
                    }
                );
            } else {
                // 创建新的Gist
                response = await fetch(GISTS_TRACKER_CONFIG.gistsApi, {
                    method: 'POST',
                    headers: {
                        'Authorization': `token ${GISTS_TRACKER_CONFIG.githubToken}`,
                        'Content-Type': 'application/json',
                        'Accept': 'application/vnd.github.v3+json'
                    },
                    body: JSON.stringify({
                        description: '轨迹数据存储',
                        public: false,
                        files: {
                            [GISTS_TRACKER_CONFIG.fileName]: {
                                content: dataStr
                            }
                        }
                    })
                });
            }
            
            if (response.ok) {
                const result = await response.json();
                
                if (!GISTS_TRACKER_CONFIG.gistId) {
                    GISTS_TRACKER_CONFIG.gistId = result.id;
                    localStorage.setItem('ks_gist_id', result.id);
                    console.log('✅ 创建了新的Gist:', result.id);
                }
                
                console.log('✅ 数据同步成功');
                
                // 同步成功后，可以清空本地缓存（可选）
                // localTrajectoryData = [];
                // saveLocalCache();
                
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
            // 注意：beforeunload中不能使用async/await
            // 这里只是记录日志
            console.log('📤 页面卸载，有未同步的数据:', localTrajectoryData.length, '条');
        }
    }
    
    /**
     * 处理页面可见性变化
     */
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible' && localTrajectoryData.length > 0 && !isSyncing) {
            console.log('👀 页面重新可见，尝试同步数据');
            setTimeout(() => syncToGist(), 1000);
        }
    }
    
    /**
     * 获取统计数据
     */
    function getStats() {
        const moves = localTrajectoryData.filter(r => r.type === 'mousemove');
        const clicks = localTrajectoryData.filter(r => r.type === 'mousedown');
        
        return {
            totalRecords: localTrajectoryData.length,
            moves: moves.length,
            clicks: clicks.length,
            userId: userId,
            deviceId: deviceId,
            sessionId: sessionId,
            gistId: GISTS_TRACKER_CONFIG.gistId,
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
     * 设置GitHub Token
     */
    function setGitHubToken(token) {
        GISTS_TRACKER_CONFIG.githubToken = token;
        console.log('🔑 GitHub Token已设置');
        
        // 设置Token后立即尝试同步
        if (localTrajectoryData.length > 0) {
            syncToGist();
        }
    }
    
    /**
     * 清空数据
     */
    function clearData() {
        localTrajectoryData = [];
        saveLocalCache();
        console.log('🗑️ Gists跟踪数据已清空');
    }
    
    // 导出公共API
    window.GistsTracker = {
        init: initGistsTracker,
        getStats: getStats,
        getData: getTrajectoryData,
        setToken: setGitHubToken,
        clearData: clearData,
        config: GISTS_TRACKER_CONFIG,
        
        // 手动同步
        sync: syncToGist,
        
        // 诊断函数
        diagnose: function() {
            return {
                enabled: GISTS_TRACKER_CONFIG.enabled,
                userId: userId,
                deviceId: deviceId,
                sessionId: sessionId,
                gistId: GISTS_TRACKER_CONFIG.gistId,
                dataCount: localTrajectoryData.length,
                hasToken: !!GISTS_TRACKER_CONFIG.githubToken,
                isSyncing: isSyncing
            };
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initGistsTracker);
    } else {
        initGistsTracker();
    }
})();