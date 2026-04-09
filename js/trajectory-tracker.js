/**
 * 用户行为轨迹跟踪器
 * 专门记录 mousemove, mousedown, scroll 事件
 * 数据结构: [{t: timestamp, x: x, y: y}, ...]
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
        maxRecords: 500,
        
        // 存储键名
        storageKey: 'ks_trajectory_data',
        
        // 自动保存间隔（毫秒）
        saveInterval: 10000,
        
        // 是否记录滚动事件
        trackScroll: true,
        
        // 是否记录点击事件
        trackClicks: true,
        
        // 是否记录移动事件
        trackMovement: true
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
        
        // 从本地存储加载已有数据
        loadFromStorage();
        
        // 绑定事件监听器
        if (TRACKER_CONFIG.trackMovement) {
            document.addEventListener('mousemove', handleMouseMove, { passive: true });
        }
        
        if (TRACKER_CONFIG.trackClicks) {
            document.addEventListener('mousedown', handleMouseDown, { passive: true });
        }
        
        if (TRACKER_CONFIG.trackScroll) {
            document.addEventListener('scroll', handleScroll, { passive: true });
        }
        
        // 定期保存数据
        saveTimer = setInterval(saveToStorage, TRACKER_CONFIG.saveInterval);
        
        // 页面卸载时保存数据
        window.addEventListener('beforeunload', saveToStorage);
        
        console.log('轨迹跟踪器已初始化，采样间隔:', TRACKER_CONFIG.sampleInterval + 'ms');
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
            t: now - performance.timing.navigationStart, // 相对时间戳
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
        const now = Date.now();
        
        const record = {
            t: now - performance.timing.navigationStart,
            x: event.clientX,
            y: event.clientY,
            type: 'mousedown',
            button: event.button,
            target: getTargetInfo(event.target)
        };
        
        addRecord(record);
    }
    
    /**
     * 处理滚动事件
     */
    function handleScroll() {
        const now = Date.now();
        
        // 采样控制
        if (now - lastSampleTime < TRACKER_CONFIG.sampleInterval) {
            return;
        }
        
        lastSampleTime = now;
        
        const record = {
            t: now - performance.timing.navigationStart,
            type: 'scroll',
            scrollX: window.scrollX,
            scrollY: window.scrollY,
            innerWidth: window.innerWidth,
            innerHeight: window.innerHeight
        };
        
        addRecord(record);
    }
    
    /**
     * 添加记录到数据存储
     */
    function addRecord(record) {
        // 添加页面信息
        record.page = window.location.pathname;
        record.timestamp = new Date().toISOString();
        
        trajectoryData.push(record);
        
        // 限制数据大小
        if (trajectoryData.length > TRACKER_CONFIG.maxRecords) {
            trajectoryData = trajectoryData.slice(-TRACKER_CONFIG.maxRecords);
        }
        
        // 实时分析可疑行为
        analyzeSuspiciousBehavior(record);
    }
    
    /**
     * 获取目标元素信息
     */
    function getTargetInfo(element) {
        if (!element) return null;
        
        return {
            tagName: element.tagName,
            id: element.id || null,
            className: element.className || null,
            href: element.href || null
        };
    }
    
    /**
     * 分析可疑行为
     */
    function analyzeSuspiciousBehavior(record) {
        // 检查快速连续点击（机器人特征）
        if (record.type === 'mousedown') {
            const recentClicks = trajectoryData.filter(r => 
                r.type === 'mousedown' && 
                (record.t - r.t) < 1000 // 1秒内
            );
            
            if (recentClicks.length > 8) {
                console.warn('检测到可疑行为：快速连续点击', recentClicks.length);
                addSuspiciousRecord('rapid_clicks', recentClicks.length);
            }
        }
        
        // 检查直线移动（机器人特征）
        if (record.type === 'mousemove' && trajectoryData.length > 10) {
            const recentMoves = trajectoryData
                .filter(r => r.type === 'mousemove')
                .slice(-10);
            
            if (recentMoves.length >= 10) {
                const isLinear = checkLinearMovement(recentMoves);
                if (isLinear) {
                    console.warn('检测到可疑行为：直线移动');
                    addSuspiciousRecord('linear_movement', recentMoves.length);
                }
            }
        }
    }
    
    /**
     * 检查是否为直线移动
     */
    function checkLinearMovement(moves) {
        if (moves.length < 3) return false;
        
        // 计算移动方向的一致性
        let directionChanges = 0;
        for (let i = 2; i < moves.length; i++) {
            const dx1 = moves[i].x - moves[i-1].x;
            const dy1 = moves[i].y - moves[i-1].y;
            const dx2 = moves[i-1].x - moves[i-2].x;
            const dy2 = moves[i-1].y - moves[i-2].y;
            
            // 计算方向角度变化
            const angle1 = Math.atan2(dy1, dx1);
            const angle2 = Math.atan2(dy2, dx2);
            const angleDiff = Math.abs(angle1 - angle2);
            
            if (angleDiff > 0.2) { // 角度变化阈值
                directionChanges++;
            }
        }
        
        // 如果方向变化很少，可能是直线移动
        return directionChanges < 2;
    }
    
    /**
     * 添加可疑行为记录
     */
    function addSuspiciousRecord(type, count) {
        const suspiciousRecord = {
            t: Date.now() - performance.timing.navigationStart,
            type: 'suspicious',
            subtype: type,
            count: count,
            page: window.location.pathname,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent.substring(0, 50) // 截断处理
        };
        
        trajectoryData.push(suspiciousRecord);
    }
    
    /**
     * 保存数据到本地存储
     */
    function saveToStorage() {
        try {
            // 只保存最近的数据
            const dataToSave = trajectoryData.slice(-200);
            localStorage.setItem(TRACKER_CONFIG.storageKey, JSON.stringify(dataToSave));
            
            // 可选：发送到服务器
            // sendToServer(dataToSave);
            
        } catch (error) {
            console.error('保存轨迹数据失败:', error);
        }
    }
    
    /**
     * 从本地存储加载数据
     */
    function loadFromStorage() {
        try {
            const stored = localStorage.getItem(TRACKER_CONFIG.storageKey);
            if (stored) {
                trajectoryData = JSON.parse(stored);
                console.log('从存储加载了', trajectoryData.length, '条轨迹记录');
            }
        } catch (error) {
            console.error('加载轨迹数据失败:', error);
            trajectoryData = [];
        }
    }
    
    /**
     * 发送数据到服务器
     */
    function sendToServer(data) {
        // 这里需要你的后端API端点
        const endpoint = '/api/trajectory/logs';
        
        if (!endpoint || data.length === 0) {
            return;
        }
        
        const payload = {
            logs: data,
            page: window.location.href,
            collectedAt: new Date().toISOString(),
            sessionId: getSessionId()
        };
        
        // 使用sendBeacon确保数据发送
        if (navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            navigator.sendBeacon(endpoint, blob);
        }
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
     * 获取轨迹数据
     * @returns {Array} 轨迹流数据
     */
    function getTrajectoryStream() {
        return trajectoryData
            .filter(record => record.type === 'mousemove' || record.type === 'mousedown')
            .map(record => ({
                t: record.t,
                x: record.x,
                y: record.y,
                type: record.type
            }));
    }
    
    /**
     * 获取统计数据
     */
    function getStats() {
        const now = Date.now();
        const sessionStart = performance.timing.navigationStart;
        const sessionDuration = now - sessionStart;
        
        const moves = trajectoryData.filter(r => r.type === 'mousemove');
        const clicks = trajectoryData.filter(r => r.type === 'mousedown');
        const scrolls = trajectoryData.filter(r => r.type === 'scroll');
        const suspicious = trajectoryData.filter(r => r.type === 'suspicious');
        
        return {
            totalRecords: trajectoryData.length,
            moves: moves.length,
            clicks: clicks.length,
            scrolls: scrolls.length,
            suspicious: suspicious.length,
            sessionDuration: Math.round(sessionDuration / 1000) + 's',
            currentPage: window.location.pathname
        };
    }
    
    /**
     * 清空数据
     */
    function clearData() {
        trajectoryData = [];
        localStorage.removeItem(TRACKER_CONFIG.storageKey);
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
                stats: getStats()
            },
            trajectory: getTrajectoryStream()
        }, null, 2);
    }
    
    // 导出公共API
    window.TrajectoryTracker = {
        init: initTracker,
        getStream: getTrajectoryStream,
        getStats: getStats,
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