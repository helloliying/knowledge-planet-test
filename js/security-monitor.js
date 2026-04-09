/**
 * 知识星球网站安全监控脚本
 * 用于检测异常用户行为，防止黑产攻击
 * 注意：需要用户同意才能启用完整监控
 */

(function() {
    'use strict';
    
    // 配置
    const CONFIG = {
        // 是否启用完整监控（需要用户同意）
        enabled: false,
        
        // 采样率（0-1），1表示记录所有事件
        samplingRate: 0.1,
        
        // 最大记录数
        maxRecords: 1000,
        
        // 事件类型
        eventTypes: ['mousemove', 'mousedown', 'scroll', 'keydown'],
        
        // 数据发送端点（需要后端支持）
        endpoint: null, // '/api/security/logs'
        
        // 本地存储键名
        storageKey: 'ks_security_logs',
        
        // 清理间隔（毫秒）
        cleanupInterval: 30000
    };
    
    // 数据存储
    let securityLogs = [];
    let lastCleanup = Date.now();
    
    /**
     * 初始化安全监控
     */
    function initSecurityMonitor() {
        // 检查是否应该启用
        if (!shouldEnableMonitoring()) {
            console.log('安全监控：用户未同意或配置禁用');
            return;
        }
        
        // 绑定事件监听器
        bindEventListeners();
        
        // 定期清理旧数据
        setInterval(cleanupOldData, CONFIG.cleanupInterval);
        
        // 页面卸载时保存数据
        window.addEventListener('beforeunload', saveLogsToStorage);
        
        console.log('安全监控已初始化（采样率：' + CONFIG.samplingRate + '）');
    }
    
    /**
     * 检查是否应该启用监控
     */
    function shouldEnableMonitoring() {
        // 检查本地存储的用户偏好
        const userPref = localStorage.getItem('ks_security_consent');
        
        // 如果用户明确同意，启用完整监控
        if (userPref === 'granted') {
            CONFIG.enabled = true;
            CONFIG.samplingRate = 1.0; // 完整记录
            return true;
        }
        
        // 如果用户拒绝，禁用监控
        if (userPref === 'denied') {
            return false;
        }
        
        // 默认只启用基础监控（低采样率）
        return CONFIG.enabled;
    }
    
    /**
     * 绑定事件监听器
     */
    function bindEventListeners() {
        CONFIG.eventTypes.forEach(eventType => {
            document.addEventListener(eventType, handleSecurityEvent, {
                passive: true,
                capture: true
            });
        });
        
        // 额外监听可疑行为
        document.addEventListener('click', handleSuspiciousClick, {
            passive: true,
            capture: true
        });
        
        // 监听表单提交
        document.addEventListener('submit', handleFormSubmit, {
            passive: true,
            capture: true
        });
    }
    
    /**
     * 处理安全事件
     */
    function handleSecurityEvent(event) {
        // 采样控制
        if (Math.random() > CONFIG.samplingRate) {
            return;
        }
        
        // 防止数据过多
        if (securityLogs.length >= CONFIG.maxRecords) {
            cleanupOldData();
        }
        
        const record = {
            t: Date.now() - performance.timing.navigationStart,
            type: event.type,
            page: window.location.pathname
        };
        
        // 根据事件类型添加特定数据
        switch (event.type) {
            case 'mousemove':
            case 'mousedown':
                record.x = event.clientX;
                record.y = event.clientY;
                record.screenX = event.screenX;
                record.screenY = event.screenY;
                break;
                
            case 'scroll':
                record.scrollX = window.scrollX;
                record.scrollY = window.scrollY;
                break;
                
            case 'keydown':
                // 不记录具体按键内容，只记录事件
                record.key = '***'; // 模糊化处理
                break;
        }
        
        // 添加用户代理信息（匿名化）
        record.ua = anonymizeUserAgent(navigator.userAgent);
        
        securityLogs.push(record);
        
        // 定期发送数据到服务器
        if (securityLogs.length >= 50 && CONFIG.endpoint) {
            sendLogsToServer();
        }
    }
    
    /**
     * 处理可疑点击（快速连续点击）
     */
    function handleSuspiciousClick(event) {
        const now = Date.now();
        const recentClicks = securityLogs.filter(log => 
            log.type === 'mousedown' && 
            (now - (log.t + performance.timing.navigationStart)) < 1000
        );
        
        // 如果1秒内点击超过10次，可能是机器人
        if (recentClicks.length > 10) {
            const suspiciousRecord = {
                t: now - performance.timing.navigationStart,
                type: 'suspicious_behavior',
                subtype: 'rapid_clicks',
                count: recentClicks.length,
                x: event.clientX,
                y: event.clientY,
                page: window.location.pathname
            };
            
            securityLogs.push(suspiciousRecord);
            console.warn('检测到可疑行为：快速连续点击');
        }
    }
    
    /**
     * 处理表单提交
     */
    function handleFormSubmit(event) {
        const form = event.target;
        const record = {
            t: Date.now() - performance.timing.navigationStart,
            type: 'form_submit',
            formId: form.id || form.name || 'unknown',
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        };
        
        securityLogs.push(record);
    }
    
    /**
     * 匿名化用户代理
     */
    function anonymizeUserAgent(ua) {
        // 只保留浏览器和主要版本信息
        const matches = ua.match(/(Chrome|Firefox|Safari|Edge)\/(\d+)/);
        if (matches) {
            return matches[1] + '/' + matches[2];
        }
        return 'unknown';
    }
    
    /**
     * 清理旧数据
     */
    function cleanupOldData() {
        const now = Date.now();
        const cutoff = now - 3600000; // 1小时前
        
        securityLogs = securityLogs.filter(log => {
            const logTime = performance.timing.navigationStart + log.t;
            return logTime > cutoff;
        });
        
        lastCleanup = now;
    }
    
    /**
     * 保存日志到本地存储
     */
    function saveLogsToStorage() {
        try {
            const existing = JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]');
            const combined = [...existing, ...securityLogs].slice(-CONFIG.maxRecords);
            localStorage.setItem(CONFIG.storageKey, JSON.stringify(combined));
        } catch (e) {
            console.error('保存安全日志失败:', e);
        }
    }
    
    /**
     * 发送日志到服务器
     */
    function sendLogsToServer() {
        if (!CONFIG.endpoint || securityLogs.length === 0) {
            return;
        }
        
        const logsToSend = [...securityLogs];
        securityLogs = [];
        
        // 使用navigator.sendBeacon确保数据发送
        const blob = new Blob([JSON.stringify({
            logs: logsToSend,
            page: window.location.href,
            timestamp: new Date().toISOString()
        })], { type: 'application/json' });
        
        if (navigator.sendBeacon) {
            navigator.sendBeacon(CONFIG.endpoint, blob);
        } else {
            // 回退方案
            fetch(CONFIG.endpoint, {
                method: 'POST',
                body: blob,
                keepalive: true
            }).catch(console.error);
        }
    }
    
    /**
     * 获取当前轨迹数据
     * @returns {Array} 轨迹流数据
     */
    function getTrajectoryData() {
        return securityLogs.filter(log => 
            log.type === 'mousemove' || log.type === 'mousedown'
        ).map(log => ({
            t: log.t,
            x: log.x || 0,
            y: log.y || 0,
            type: log.type
        }));
    }
    
    /**
     * 获取安全统计数据
     */
    function getSecurityStats() {
        const now = Date.now();
        const hourAgo = now - 3600000;
        
        const recentLogs = securityLogs.filter(log => 
            (performance.timing.navigationStart + log.t) > hourAgo
        );
        
        return {
            totalRecords: securityLogs.length,
            recentRecords: recentLogs.length,
            eventTypes: countBy(recentLogs, 'type'),
            suspiciousEvents: recentLogs.filter(log => log.type.includes('suspicious')).length,
            samplingRate: CONFIG.samplingRate
        };
    }
    
    /**
     * 按属性计数
     */
    function countBy(array, key) {
        return array.reduce((acc, item) => {
            acc[item[key]] = (acc[item[key]] || 0) + 1;
            return acc;
        }, {});
    }
    
    /**
     * 显示隐私通知（如果需要用户同意）
     */
    function showPrivacyNotice() {
        // 检查是否已经显示过
        if (localStorage.getItem('ks_security_notice_shown')) {
            return;
        }
        
        const notice = document.createElement('div');
        notice.id = 'security-privacy-notice';
        notice.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #f8f9fa;
            border: 1px solid #dee2e6;
            border-radius: 8px;
            padding: 16px;
            max-width: 300px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            z-index: 10000;
            font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        
        notice.innerHTML = `
            <h4 style="margin-top: 0; color: #343a40;">安全监控通知</h4>
            <p style="margin-bottom: 12px; color: #6c757d; font-size: 14px;">
                为保护网站安全，我们监控异常用户行为。您的交互数据会被匿名记录。
            </p>
            <div style="display: flex; gap: 8px;">
                <button id="security-accept" style="
                    flex: 1;
                    background: #2563eb;
                    color: white;
                    border: none;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">同意</button>
                <button id="security-deny" style="
                    flex: 1;
                    background: #f1f5f9;
                    color: #475569;
                    border: 1px solid #cbd5e1;
                    padding: 8px 12px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 14px;
                ">拒绝</button>
            </div>
        `;
        
        document.body.appendChild(notice);
        
        // 绑定按钮事件
        document.getElementById('security-accept').addEventListener('click', () => {
            localStorage.setItem('ks_security_consent', 'granted');
            localStorage.setItem('ks_security_notice_shown', 'true');
            notice.remove();
            location.reload(); // 重新加载以启用完整监控
        });
        
        document.getElementById('security-deny').addEventListener('click', () => {
            localStorage.setItem('ks_security_consent', 'denied');
            localStorage.setItem('ks_security_notice_shown', 'true');
            notice.remove();
        });
    }
    
    // 导出公共API
    window.KnowledgePlanetSecurity = {
        init: initSecurityMonitor,
        getTrajectoryData: getTrajectoryData,
        getSecurityStats: getSecurityStats,
        showPrivacyNotice: showPrivacyNotice,
        config: CONFIG
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSecurityMonitor);
    } else {
        initSecurityMonitor();
    }
    
    // 显示隐私通知（首次访问时）
    if (!localStorage.getItem('ks_security_notice_shown')) {
        setTimeout(showPrivacyNotice, 2000);
    }
    
})();