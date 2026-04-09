/**
 * 增强版用户行为轨迹跟踪器
 * 专门记录 mousemove, mousedown, scroll 事件
 * 数据存储在localStorage中，可供其他页面访问
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
        
        console.log('🚀 增强版轨迹跟踪器初始化');
        
        // 检查是否有清空标记
        checkClearFlag();
        
        // 加载之前保存的数据
        loadSavedData();
        
        // 清理过期数据
        cleanupOldData();
        
        // 设置事件监听器
        setupEventListeners();
        
        // 启动自动保存
        startAutoSave();
        
        // 启动定期清空标记检查
        startClearFlagMonitor();
        
        console.log('✅ 增强版轨迹跟踪器已启动');
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
     * 检查清空标记
     */
    function checkClearFlag() {
        // 检查所有可能的清空标记
        const clearMarkers = [
            'ks_data_cleared',
            'ks_stop_tracking',
            'ks_clear_all'
        ];
        
        let shouldClear = false;
        let clearReason = '';
        
        for (const marker of clearMarkers) {
            const markerValue = localStorage.getItem(marker);
            if (markerValue) {
                shouldClear = true;
                clearReason = `${marker}: ${markerValue}`;
                
                // 如果是ks_data_cleared，检查是否过期
                if (marker === 'ks_data_cleared') {
                    try {
                        const command = JSON.parse(markerValue);
                        if (command.expires && Date.now() > command.expires) {
                            console.log('清空标记已过期，清除标记');
                            localStorage.removeItem(marker);
                            shouldClear = false;
                            continue;
                        }
                    } catch (error) {
                        // 如果不是JSON格式，直接使用
                    }
                }
                
                console.log(`检测到清空标记: ${clearReason}`);
                break;
            }
        }
        
        if (shouldClear) {
            console.log('执行数据清空操作...');
            
            // 1. 停止事件监听（临时）
            stopEventListeners();
            
            // 2. 清除所有数据
            clearData();
            
            // 3. 清除所有清空标记
            clearMarkers.forEach(marker => {
                localStorage.removeItem(marker);
            });
            
            // 4. 设置已响应标记
            localStorage.setItem('ks_cleared_ack', Date.now().toString());
            
            // 5. 显示状态（如果页面有状态显示）
            showClearStatus();
            
            console.log('数据清空操作完成');
            
            // 6. 暂停跟踪5秒，防止立即重新生成数据
            pauseTracking(5000);
        }
    }
    
    /**
     * 停止事件监听器
     */
    function stopEventListeners() {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mousedown', handleMouseDown);
        document.removeEventListener('scroll', handleScroll);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        
        if (saveTimer) {
            clearInterval(saveTimer);
            saveTimer = null;
        }
        
        console.log('事件监听器已停止');
    }
    
    /**
     * 显示清空状态
     */
    function showClearStatus() {
        // 可以在页面上添加状态显示
        const statusElement = document.getElementById('tracker-status') || 
                             document.createElement('div');
        
        if (!statusElement.id) {
            statusElement.id = 'tracker-status';
            statusElement.style.cssText = `
                position: fixed;
                bottom: 10px;
                right: 10px;
                background: #f0f0f0;
                padding: 5px 10px;
                border-radius: 3px;
                font-size: 12px;
                z-index: 9999;
                border: 1px solid #ccc;
            `;
            document.body.appendChild(statusElement);
        }
        
        statusElement.textContent = `跟踪已暂停 (${new Date().toLocaleTimeString()})`;
        
        // 5秒后移除
        setTimeout(() => {
            if (statusElement.parentNode) {
                statusElement.parentNode.removeChild(statusElement);
            }
        }, 5000);
    }
    
    /**
     * 暂停跟踪
     */
    function pauseTracking(duration) {
        console.log(`跟踪暂停 ${duration}ms`);
        
        // 设置暂停标记
        TRACKER_CONFIG.enabled = false;
        
        // 恢复跟踪
        setTimeout(() => {
            TRACKER_CONFIG.enabled = true;
            console.log('跟踪已恢复');
        }, duration);
    }
    
    /**
     * 启动清空标记监控
     */
    function startClearFlagMonitor() {
        // 每2秒检查一次清空标记
        setInterval(checkClearFlag, 2000);
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
    window.TrajectoryTrackerEnhanced = {
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