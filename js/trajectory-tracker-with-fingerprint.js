/**
 * 带指纹采集的轨迹跟踪器
 * 结合用户行为轨迹和浏览器指纹信息
 */

(function() {
    'use strict';
    
    // 配置
    const TRACKER_CONFIG = {
        // 是否启用跟踪
        enabled: true,
        
        // 采样间隔（毫秒）
        sampleInterval: 50,
        
        // 最大记录数
        maxRecords: 1000,
        
        // 存储键名
        storageKey: 'ks_trajectory_data_' + window.location.pathname.replace(/\//g, '_'),
        
        // 共享数据键名
        sharedDataKey: 'ks_shared_trajectory_data',
        
        // 自动保存间隔（毫秒）
        saveInterval: 5000,
        
        // 是否记录滚动事件
        trackScroll: true,
        
        // 是否记录点击事件
        trackClicks: true,
        
        // 是否记录移动事件
        trackMovement: true,
        
        // 数据保留时间（毫秒，24小时）
        dataRetentionTime: 24 * 60 * 60 * 1000,
        
        // 是否收集指纹信息
        collectFingerprint: true
    };
    
    // 轨迹数据存储
    let trajectoryData = [];
    let lastSampleTime = 0;
    let saveTimer = null;
    let isInitialized = false;
    let fingerprintData = null;
    
    /**
     * 初始化轨迹跟踪器
     */
    function initTracker() {
        if (isInitialized) {
            console.log('轨迹跟踪器已初始化，跳过');
            return;
        }
        
        if (!TRACKER_CONFIG.enabled) {
            console.log('轨迹跟踪器已禁用');
            return;
        }
        
        console.log('🚀 带指纹采集的轨迹跟踪器初始化');
        
        // 加载之前保存的数据
        loadSavedData();
        
        // 收集指纹信息（如果启用）
        if (TRACKER_CONFIG.collectFingerprint) {
            collectFingerprintInfo();
        }
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动自动保存
        startAutoSave();
        
        // 初始共享数据更新
        updateSharedData();
        
        isInitialized = true;
        console.log('✅ 带指纹采集的轨迹跟踪器已启动');
    }
    
    /**
     * 收集指纹信息
     */
    function collectFingerprintInfo() {
        try {
            fingerprintData = {
                // 基本浏览器信息
                browser: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    languages: navigator.languages,
                    cookieEnabled: navigator.cookieEnabled
                },
                
                // 屏幕信息
                screen: {
                    width: screen.width,
                    height: screen.height,
                    availWidth: screen.availWidth,
                    availHeight: screen.availHeight,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    devicePixelRatio: window.devicePixelRatio || 1
                },
                
                // 设备信息
                device: {
                    hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
                    deviceMemory: navigator.deviceMemory || 'unknown',
                    maxTouchPoints: navigator.maxTouchPoints || 0
                },
                
                // 时间和位置
                timeLocation: {
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    timezoneOffset: new Date().getTimezoneOffset(),
                    locale: Intl.DateTimeFormat().resolvedOptions().locale
                },
                
                // 网络信息
                network: (function() {
                    const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
                    return connection ? {
                        effectiveType: connection.effectiveType,
                        downlink: connection.downlink,
                        rtt: connection.rtt
                    } : null;
                })(),
                
                // 解析的User Agent
                parsedUA: parseUserAgent(navigator.userAgent),
                
                // 时间戳
                collectedAt: new Date().toISOString(),
                timestamp: Date.now()
            };
            
            // 计算指纹哈希
            fingerprintData.hash = calculateFingerprintHash(fingerprintData);
            
            console.log('指纹信息已收集，哈希:', fingerprintData.hash.substring(0, 16) + '...');
            
        } catch (error) {
            console.error('收集指纹信息失败:', error);
            fingerprintData = {
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * 解析User Agent
     */
    function parseUserAgent(ua) {
        const result = {
            browser: 'unknown',
            browserVersion: 'unknown',
            os: 'unknown',
            osVersion: 'unknown',
            deviceType: 'unknown'
        };
        
        const uaLower = ua.toLowerCase();
        
        // 浏览器检测
        if (uaLower.includes('chrome') && !uaLower.includes('edg')) {
            result.browser = 'chrome';
        } else if (uaLower.includes('firefox')) {
            result.browser = 'firefox';
        } else if (uaLower.includes('safari') && !uaLower.includes('chrome')) {
            result.browser = 'safari';
        } else if (uaLower.includes('edge')) {
            result.browser = 'edge';
        } else if (uaLower.includes('opera')) {
            result.browser = 'opera';
        }
        
        // 操作系统检测
        if (uaLower.includes('windows')) {
            result.os = 'windows';
            result.deviceType = 'desktop';
        } else if (uaLower.includes('mac os')) {
            result.os = 'macos';
            result.deviceType = 'desktop';
        } else if (uaLower.includes('linux')) {
            result.os = 'linux';
            result.deviceType = 'desktop';
        } else if (uaLower.includes('android')) {
            result.os = 'android';
            result.deviceType = 'mobile';
        } else if (uaLower.includes('iphone') || uaLower.includes('ipad')) {
            result.os = 'ios';
            result.deviceType = uaLower.includes('ipad') ? 'tablet' : 'mobile';
        }
        
        return result;
    }
    
    /**
     * 计算指纹哈希
     */
    function calculateFingerprintHash(fingerprint) {
        try {
            const fingerprintStr = JSON.stringify({
                ua: fingerprint.browser.userAgent,
                platform: fingerprint.browser.platform,
                language: fingerprint.browser.language,
                screen: fingerprint.screen.width + 'x' + fingerprint.screen.height,
                timezone: fingerprint.timeLocation.timezone,
                hardwareConcurrency: fingerprint.device.hardwareConcurrency
            });
            
            let hash = 0;
            for (let i = 0; i < fingerprintStr.length; i++) {
                const char = fingerprintStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            
            return Math.abs(hash).toString(16);
            
        } catch (error) {
            return 'hash_error_' + Date.now();
        }
    }
    
    /**
     * 加载之前保存的数据
     */
    function loadSavedData() {
        try {
            const saved = localStorage.getItem(TRACKER_CONFIG.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                const now = Date.now();
                trajectoryData = parsed.filter(record => 
                    now - record.t < TRACKER_CONFIG.dataRetentionTime
                );
                console.log(`📥 加载了 ${trajectoryData.length} 条轨迹数据`);
            }
        } catch (error) {
            console.error('加载轨迹数据失败:', error);
            trajectoryData = [];
        }
    }
    
    /**
     * 设置事件监听器
     */
    function setupEventListeners() {
        if (TRACKER_CONFIG.trackMovement) {
            document.addEventListener('mousemove', handleMouseMove, { passive: true });
        }
        
        if (TRACKER_CONFIG.trackClicks) {
            document.addEventListener('mousedown', handleMouseDown, { passive: true });
        }
        
        if (TRACKER_CONFIG.trackScroll) {
            document.addEventListener('scroll', handleScroll, { passive: true });
        }
        
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        setInterval(cleanupOldData, TRACKER_CONFIG.dataRetentionTime / 2);
    }
    
    /**
     * 处理鼠标移动事件
     */
    function handleMouseMove(event) {
        const now = Date.now();
        
        if (now - lastSampleTime < TRACKER_CONFIG.sampleInterval) {
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
            screenX: event.screenX,
            screenY: event.screenY
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
            pageX: event.pageX,
            pageY: event.pageY
        };
        
        addRecord(record);
    }
    
    /**
     * 处理滚动事件
     */
    function handleScroll() {
        const record = {
            t: Date.now(),
            x: window.scrollX,
            y: window.scrollY,
            type: 'scroll'
        };
        
        addRecord(record);
    }
    
    /**
     * 添加记录
     */
    function addRecord(record) {
        trajectoryData.push(record);
        
        if (trajectoryData.length > TRACKER_CONFIG.maxRecords) {
            trajectoryData = trajectoryData.slice(-TRACKER_CONFIG.maxRecords);
        }
        
        updateSharedData();
    }
    
    /**
     * 清理过期数据
     */
    function cleanupOldData() {
        const now = Date.now();
        const oldLength = trajectoryData.length;
        trajectoryData = trajectoryData.filter(record => 
            now - record.t < TRACKER_CONFIG.dataRetentionTime
        );
        
        if (oldLength > trajectoryData.length) {
            console.log(`🧹 清理了 ${oldLength - trajectoryData.length} 条过期数据`);
            saveData();
        }
    }
    
    /**
     * 更新共享数据（包含指纹信息）
     */
    function updateSharedData() {
        try {
            const sharedData = {
                // 轨迹统计信息
                stats: getStats(),
                
                // 最近轨迹点
                recentPoints: getTrajectoryStream().slice(-100),
                
                // 指纹信息
                fingerprint: fingerprintData,
                
                // 会话信息
                session: {
                    sessionId: getSessionId(),
                    pageUrl: window.location.href,
                    startTime: performance.timing ? performance.timing.navigationStart : Date.now(),
                    currentTime: Date.now()
                },
                
                // 数据摘要
                summary: {
                    totalPoints: trajectoryData.length,
                    lastUpdated: new Date().toISOString(),
                    hasFingerprint: !!fingerprintData,
                    fingerprintHash: fingerprintData ? fingerprintData.hash : null
                },
                
                // 时间戳
                timestamp: Date.now(),
                
                // 跟踪器状态
                trackerStatus: {
                    isInitialized: isInitialized,
                    enabled: TRACKER_CONFIG.enabled,
                    dataCount: trajectoryData.length,
                    lastUpdate: new Date().toISOString()
                }
            };
            
            localStorage.setItem(TRACKER_CONFIG.sharedDataKey, JSON.stringify(sharedData));
        } catch (error) {
            console.error('更新共享数据失败:', error);
        }
    }
    
    /**
     * 启动自动保存
     */
    function startAutoSave() {
        if (saveTimer) {
            clearInterval(saveTimer);
        }
        
        saveTimer = setInterval(() => {
            saveData();
        }, TRACKER_CONFIG.saveInterval);
    }
    
    /**
     * 保存数据到localStorage
     */
    function saveData() {
        try {
            localStorage.setItem(TRACKER_CONFIG.storageKey, JSON.stringify(trajectoryData));
            updateSharedData();
        } catch (error) {
            console.error('保存轨迹数据失败:', error);
        }
    }
    
    /**
     * 处理页面卸载
     */
    function handleBeforeUnload() {
        saveData();
    }
    
    /**
     * 生成会话ID
     */
    function getSessionId() {
        let sessionId = sessionStorage.getItem('ks_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            sessionStorage.setItem('ks_session_id', sessionId);
        }
        return sessionId;
    }
    
    /**
     * 获取轨迹数据流
     */
    function getTrajectoryStream(limit = null) {
        const stream = trajectoryData
            .filter(record => record.type === 'mousemove' || record.type === 'mousedown')
            .map(record => ({
                t: record.t,
                x: record.x,
                y: record.y,
                type: record.type
            }));
        
        return limit ? stream.slice(-limit) : stream;
    }
    
    /**
     * 获取统计数据
     */
    function getStats() {
        const now = Date.now();
        const sessionStart = performance.timing ? performance.timing.navigationStart : now;
        const sessionDuration = now - sessionStart;
        
        const moves = trajectoryData.filter(r => r.type === 'mousemove');
        const clicks = trajectoryData.filter(r => r.type === 'mousedown');
        const scrolls = trajectoryData.filter(r => r.type === 'scroll');
        
        return {
            totalRecords: trajectoryData.length,
            moves: moves.length,
            clicks: clicks.length,
            scrolls: scrolls.length,
            sessionDuration: Math.round(sessionDuration / 1000) + 's',
            currentPage: window.location.pathname,
            lastUpdate: new Date().toISOString(),
            trackerStatus: isInitialized ? 'active' : 'inactive',
            hasFingerprint: !!fingerprintData
        };
    }
    
    /**
     * 清空数据
     */
    function clearData() {
        console.log('清空当前页面轨迹数据...');
        
        trajectoryData = [];
        updateSharedData();
        
        console.log('当前页面轨迹数据已清空');
    }
    
    /**
     * 获取共享数据
     */
    function getSharedData() {
        try {
            const data = localStorage.getItem(TRACKER_CONFIG.sharedDataKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('获取共享数据失败:', error);
            return null;
        }
    }
    
    // 导出公共API
    window.TrajectoryTrackerWithFingerprint = {
        init: initTracker,
        getStream: getTrajectoryStream,
        getStats: getStats,
        getSharedData: getSharedData,
        clearData: clearData,
        config: TRACKER_CONFIG,
        
        // 指纹相关函数
        getFingerprint: function() {
            return fingerprintData;
        },
        
        // 诊断函数
        diagnose: function() {
            return {
                isInitialized: isInitialized,
                dataCount: trajectoryData.length,
                hasFingerprint: !!fingerprintData,
                fingerprintHash: fingerprintData ? fingerprintData.hash : null,
                storageKey: TRACKER_CONFIG.storageKey,
                sharedDataKey: TRACKER_CONFIG.sharedDataKey
            };
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();