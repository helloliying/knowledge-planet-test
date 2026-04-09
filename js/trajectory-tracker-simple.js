/**
 * 简化版用户行为轨迹跟踪器
 * 专门记录 mousemove, mousedown, scroll 事件
 * 数据存储在localStorage中，可供其他页面访问
 * 注意：没有清空数据检测机制
 */

(function() {
    'use strict';
    
    // 配置
    const TRACKER_CONFIG = {
        // 是否启用跟踪
        enabled: true,
        
        // 采样间隔（毫秒），避免过于频繁
        sampleInterval: 50,
        
        // 最大记录数
        maxRecords: 1000,
        
        // 存储键名
        storageKey: 'ks_trajectory_data',
        
        // 共享数据键名（供其他页面访问）
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
        dataRetentionTime: 24 * 60 * 60 * 1000
    };
    
    // 轨迹数据存储
    let trajectoryData = [];
    let lastSampleTime = 0;
    let saveTimer = null;
    
    /**
     * 初始化轨迹跟踪器
     */
    function initTracker() {
        if (!TRACKER_CONFIG.enabled) {
            console.log('轨迹跟踪器已禁用');
            return;
        }
        
        console.log('🚀 简化版轨迹跟踪器初始化');
        
        // 加载之前保存的数据
        loadSavedData();
        
        // 清理过期数据
        cleanupOldData();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动自动保存
        startAutoSave();
        
        console.log('✅ 简化版轨迹跟踪器已启动');
    }
    
    /**
     * 加载之前保存的数据
     */
    function loadSavedData() {
        try {
            const saved = localStorage.getItem(TRACKER_CONFIG.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                // 只保留未过期的数据
                const now = Date.now();
                trajectoryData = parsed.filter(record => 
                    now - record.t < TRACKER_CONFIG.dataRetentionTime
                );
                console.log(`📥 加载了 ${trajectoryData.length} 条轨迹数据`);
                
                // 更新共享数据
                updateSharedData();
            }
        } catch (error) {
            console.error('加载轨迹数据失败:', error);
            trajectoryData = [];
        }
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
        
        // 页面卸载前保存数据
        window.addEventListener('beforeunload', handleBeforeUnload);
        
        // 定期清理
        setInterval(cleanupOldData, TRACKER_CONFIG.dataRetentionTime / 2);
    }
    
    /**
     * 处理鼠标移动事件
     */
    function handleMouseMove(event) {
        const now = Date.now();
        
        // 采样控制
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
        
        // 限制最大记录数
        if (trajectoryData.length > TRACKER_CONFIG.maxRecords) {
            trajectoryData = trajectoryData.slice(-TRACKER_CONFIG.maxRecords);
        }
        
        // 更新共享数据
        updateSharedData();
    }
    
    /**
     * 更新共享数据（供其他页面访问）
     */
    function updateSharedData() {
        try {
            const sharedData = {
                // 基本统计
                stats: getStats(),
                
                // 最近100个轨迹点（用于实时显示）
                recentPoints: getTrajectoryStream().slice(-100),
                
                // 完整数据摘要
                summary: {
                    totalPoints: trajectoryData.length,
                    lastUpdated: new Date().toISOString(),
                    sessionId: getSessionId(),
                    pageUrl: window.location.href
                },
                
                // 时间戳
                timestamp: Date.now()
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
            // 同时更新共享数据
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
     * @param {number} limit - 限制返回的记录数
     * @returns {Array} 轨迹流数据
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
            lastUpdate: new Date().toISOString()
        };
    }
    
    /**
     * 清空数据
     */
    function clearData() {
        trajectoryData = [];
        localStorage.removeItem(TRACKER_CONFIG.storageKey);
        localStorage.removeItem(TRACKER_CONFIG.sharedDataKey);
        console.log('轨迹数据已清空');
    }
    
    /**
     * 导出数据为JSON
     */
    function exportData() {
        return JSON.stringify({
            metadata: {
                exportedAt: new Date().toISOString(),
                page: window.location.href,
                stats: getStats(),
                sessionId: getSessionId()
            },
            trajectory: getTrajectoryStream()
        }, null, 2);
    }
    
    /**
     * 获取共享数据（供其他页面调用）
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
    window.TrajectoryTrackerSimple = {
        init: initTracker,
        getStream: getTrajectoryStream,
        getStats: getStats,
        getSharedData: getSharedData,
        exportData: exportData,
        clearData: clearData,
        config: TRACKER_CONFIG
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();