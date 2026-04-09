/**
 * 浏览器指纹采集器
 * 收集用户浏览器和设备特征信息
 * 注意：仅用于安全监控和数据分析，需遵守隐私政策
 */

(function() {
    'use strict';
    
    // 配置
    const FINGERPRINT_CONFIG = {
        // 是否启用指纹采集
        enabled: true,
        
        // 存储键名
        storageKey: 'ks_fingerprint_data',
        
        // 数据保留时间（毫秒，7天）
        dataRetentionTime: 7 * 24 * 60 * 60 * 1000,
        
        // 是否收集详细指纹
        collectDetailedFingerprint: true,
        
        // 是否收集Canvas指纹
        collectCanvasFingerprint: true,
        
        // 是否收集WebGL指纹
        collectWebGLFingerprint: true,
        
        // 是否收集音频指纹
        collectAudioFingerprint: false, // 可能被浏览器阻止
    };
    
    // 指纹数据
    let fingerprintData = null;
    
    /**
     * 初始化指纹采集器
     */
    function initFingerprintCollector() {
        if (!FINGERPRINT_CONFIG.enabled) {
            console.log('指纹采集器已禁用');
            return;
        }
        
        console.log('🔍 初始化浏览器指纹采集器');
        
        // 加载之前保存的指纹数据
        loadSavedFingerprint();
        
        // 如果已有指纹数据，检查是否需要更新
        if (fingerprintData && fingerprintData.timestamp) {
            const now = Date.now();
            const age = now - fingerprintData.timestamp;
            
            if (age < FINGERPRINT_CONFIG.dataRetentionTime) {
                console.log('使用缓存的指纹数据（年龄:', Math.round(age/1000/60), '分钟）');
                return;
            }
        }
        
        // 收集指纹数据
        collectFingerprintData();
        
        console.log('✅ 指纹采集器已启动');
    }
    
    /**
     * 加载之前保存的指纹数据
     */
    function loadSavedFingerprint() {
        try {
            const saved = localStorage.getItem(FINGERPRINT_CONFIG.storageKey);
            if (saved) {
                const parsed = JSON.parse(saved);
                
                // 检查数据是否过期
                const now = Date.now();
                if (parsed.timestamp && now - parsed.timestamp < FINGERPRINT_CONFIG.dataRetentionTime) {
                    fingerprintData = parsed;
                    console.log('📥 加载了缓存的指纹数据');
                } else {
                    console.log('缓存指纹数据已过期，重新收集');
                }
            }
        } catch (error) {
            console.error('加载指纹数据失败:', error);
        }
    }
    
    /**
     * 收集指纹数据
     */
    function collectFingerprintData() {
        try {
            const fingerprint = {
                // 基本信息
                basic: collectBasicFingerprint(),
                
                // 屏幕信息
                screen: collectScreenInfo(),
                
                // 浏览器信息
                browser: collectBrowserInfo(),
                
                // 网络信息
                network: collectNetworkInfo(),
                
                // 时间和位置信息
                timeLocation: collectTimeLocationInfo(),
                
                // 可选：详细指纹（可能需要用户同意）
                detailed: FINGERPRINT_CONFIG.collectDetailedFingerprint ? collectDetailedFingerprint() : null,
                
                // 元数据
                metadata: {
                    collectedAt: new Date().toISOString(),
                    pageUrl: window.location.href,
                    sessionId: getSessionId(),
                    fingerprintVersion: '1.0'
                },
                
                // 时间戳
                timestamp: Date.now()
            };
            
            // 计算指纹哈希
            fingerprint.hash = calculateFingerprintHash(fingerprint);
            
            fingerprintData = fingerprint;
            
            // 保存到localStorage
            saveFingerprintData();
            
            console.log('指纹数据收集完成，哈希:', fingerprint.hash.substring(0, 16) + '...');
            
        } catch (error) {
            console.error('收集指纹数据失败:', error);
            fingerprintData = {
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * 收集基本指纹信息
     */
    function collectBasicFingerprint() {
        return {
            // User Agent
            userAgent: navigator.userAgent,
            
            // 平台
            platform: navigator.platform,
            
            // 语言
            language: navigator.language,
            languages: navigator.languages,
            
            // Cookie是否启用
            cookieEnabled: navigator.cookieEnabled,
            
            // 是否在线
            onLine: navigator.onLine,
            
            // 硬件并发数
            hardwareConcurrency: navigator.hardwareConcurrency || 'unknown',
            
            // 设备内存
            deviceMemory: navigator.deviceMemory || 'unknown',
            
            // 最大触点数
            maxTouchPoints: navigator.maxTouchPoints || 0
        };
    }
    
    /**
     * 收集屏幕信息
     */
    function collectScreenInfo() {
        return {
            // 屏幕尺寸
            width: screen.width,
            height: screen.height,
            
            // 可用屏幕尺寸
            availWidth: screen.availWidth,
            availHeight: screen.availHeight,
            
            // 颜色深度
            colorDepth: screen.colorDepth,
            pixelDepth: screen.pixelDepth,
            
            // 方向
            orientation: screen.orientation ? screen.orientation.type : 'unknown',
            
            // 设备像素比
            devicePixelRatio: window.devicePixelRatio || 1
        };
    }
    
    /**
     * 收集浏览器信息
     */
    function collectBrowserInfo() {
        const info = {
            // User Agent解析
            parsedUA: parseUserAgent(navigator.userAgent),
            
            // 浏览器特性检测
            features: {
                localStorage: !!window.localStorage,
                sessionStorage: !!window.sessionStorage,
                indexedDB: !!window.indexedDB,
                webWorker: !!window.Worker,
                serviceWorker: 'serviceWorker' in navigator,
                webSocket: !!window.WebSocket,
                geolocation: 'geolocation' in navigator,
                notification: 'Notification' in window,
                pushManager: 'PushManager' in window,
                webRTC: !!window.RTCPeerConnection,
                webAudio: !!window.AudioContext || !!window.webkitAudioContext,
                webGL: !!window.WebGLRenderingContext
            },
            
            // 插件信息
            plugins: collectPluginInfo(),
            
            // MIME类型
            mimeTypes: collectMimeTypeInfo()
        };
        
        return info;
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
            device: 'unknown',
            isMobile: false,
            isTablet: false,
            isDesktop: false
        };
        
        // 简单解析（实际应用中可以使用更复杂的库如ua-parser-js）
        const uaLower = ua.toLowerCase();
        
        // 检测浏览器
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
        
        // 检测操作系统
        if (uaLower.includes('windows')) {
            result.os = 'windows';
            result.isDesktop = true;
        } else if (uaLower.includes('mac os')) {
            result.os = 'macos';
            result.isDesktop = true;
        } else if (uaLower.includes('linux')) {
            result.os = 'linux';
            result.isDesktop = true;
        } else if (uaLower.includes('android')) {
            result.os = 'android';
            result.isMobile = true;
        } else if (uaLower.includes('iphone') || uaLower.includes('ipad')) {
            result.os = 'ios';
            if (uaLower.includes('ipad')) {
                result.isTablet = true;
            } else {
                result.isMobile = true;
            }
        }
        
        // 提取版本号（简化版）
        const versionMatch = ua.match(/(chrome|firefox|safari|edge|opera)\/?\s*(\d+)/i);
        if (versionMatch) {
            result.browserVersion = versionMatch[2];
        }
        
        return result;
    }
    
    /**
     * 收集插件信息
     */
    function collectPluginInfo() {
        const plugins = [];
        
        if (navigator.plugins) {
            for (let i = 0; i < navigator.plugins.length; i++) {
                const plugin = navigator.plugins[i];
                plugins.push({
                    name: plugin.name,
                    description: plugin.description,
                    filename: plugin.filename,
                    length: plugin.length
                });
            }
        }
        
        return plugins;
    }
    
    /**
     * 收集MIME类型信息
     */
    function collectMimeTypeInfo() {
        const mimeTypes = [];
        
        if (navigator.mimeTypes) {
            for (let i = 0; i < navigator.mimeTypes.length; i++) {
                const mimeType = navigator.mimeTypes[i];
                mimeTypes.push({
                    type: mimeType.type,
                    description: mimeType.description,
                    suffixes: mimeType.suffixes
                });
            }
        }
        
        return mimeTypes;
    }
    
    /**
     * 收集网络信息
     */
    function collectNetworkInfo() {
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        
        return {
            // 网络连接信息
            connection: connection ? {
                effectiveType: connection.effectiveType,
                downlink: connection.downlink,
                rtt: connection.rtt,
                saveData: connection.saveData
            } : null,
            
            // 时区偏移
            timezoneOffset: new Date().getTimezoneOffset(),
            
            // 地理位置（需要用户授权）
            geolocation: 'geolocation' in navigator
        };
    }
    
    /**
     * 收集时间和位置信息
     */
    function collectTimeLocationInfo() {
        return {
            // 时区
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            
            // 本地时间
            localTime: new Date().toString(),
            
            // 本地时间戳
            localTimestamp: Date.now(),
            
            // UTC时间
            utcTime: new Date().toUTCString(),
            
            // 国际化信息
            intl: {
                locale: Intl.DateTimeFormat().resolvedOptions().locale,
                calendar: Intl.DateTimeFormat().resolvedOptions().calendar,
                numberingSystem: Intl.DateTimeFormat().resolvedOptions().numberingSystem
            }
        };
    }
    
    /**
     * 收集详细指纹（Canvas, WebGL等）
     */
    function collectDetailedFingerprint() {
        const detailed = {};
        
        try {
            // Canvas指纹
            if (FINGERPRINT_CONFIG.collectCanvasFingerprint) {
                detailed.canvas = getCanvasFingerprint();
            }
            
            // WebGL指纹
            if (FINGERPRINT_CONFIG.collectWebGLFingerprint) {
                detailed.webgl = getWebGLFingerprint();
            }
            
            // 字体指纹（简化版）
            detailed.fonts = getFontFingerprint();
            
        } catch (error) {
            console.warn('收集详细指纹失败:', error);
            detailed.error = error.message;
        }
        
        return detailed;
    }
    
    /**
     * 获取Canvas指纹
     */
    function getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            canvas.width = 200;
            canvas.height = 50;
            
            // 绘制文本
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillStyle = '#f60';
            ctx.fillRect(125, 1, 62, 20);
            
            ctx.fillStyle = '#069';
            ctx.fillText('Browser Fingerprint', 2, 15);
            
            ctx.fillStyle = 'rgba(102, 204, 0, 0.7)';
            ctx.fillText('Browser Fingerprint', 4, 17);
            
            // 获取数据URL
            const dataUrl = canvas.toDataURL();
            
            // 计算简单哈希
            let hash = 0;
            for (let i = 0; i < dataUrl.length; i++) {
                hash = ((hash << 5) - hash) + dataUrl.charCodeAt(i);
                hash |= 0;
            }
            
            return {
                dataUrl: dataUrl.substring(0, 100) + '...', // 只存储部分
                hash: hash.toString(16),
                width: canvas.width,
                height: canvas.height
            };
            
        } catch (error) {
            return { error: error.message };
        }
    }
    
    /**
     * 获取WebGL指纹
     */
    function getWebGLFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            
            if (!gl) {
                return { supported: false };
            }
            
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            const vendor = debugInfo ? gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR);
            const renderer = debugInfo ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
            
            // 获取扩展列表
            const extensions = gl.getSupportedExtensions();
            
            return {
                supported: true,
                vendor: vendor,
                renderer: renderer,
                extensions: extensions ? extensions.slice(0, 10) : [], // 只取前10个
                extensionCount: extensions ? extensions.length : 0
            };
            
        } catch (error) {
            return { supported: false, error: error.message };
        }
    }
    
    /**
     * 获取字体指纹（简化版）
     */
    function getFontFingerprint() {
        // 常见字体列表
        const commonFonts = [
            'Arial', 'Arial Black', 'Arial Narrow', 'Calibri', 'Cambria',
            'Comic Sans MS', 'Courier New', 'Georgia', 'Impact',
            'Lucida Console', 'Lucida Sans Unicode', 'Microsoft Sans Serif',
            'Palatino Linotype', 'Segoe UI', 'Tahoma', 'Times New Roman',
            'Trebuchet MS', 'Verdana', 'Webdings', 'Wingdings',
            'MS Sans Serif', 'MS Serif', 'Symbol'
        ];
        
        const availableFonts = [];
        
        // 使用Canvas检测字体可用性
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = 100;
        canvas.height = 20;
        
        // 基础字体（应该总是可用）
        const baseFont = 'monospace';
        ctx.font = '72px ' + baseFont;
        const baseText = ctx.measureText('mmmmmmmmmmlli').width;
        
        // 检测每个字体
        for (const font of commonFonts) {
            ctx.font = '72px ' + font + ',' + baseFont;
            const width = ctx.measureText('mmmmmmmmmmlli').width;
            
            if (width !== baseText) {
                availableFonts.push(font);
            }
        }
        
        return {
            availableFonts: availableFonts,
            totalAvailable: availableFonts.length
        };
    }
    
    /**
     * 计算指纹哈希
     */
    function calculateFingerprintHash(fingerprint) {
        try {
            // 创建指纹字符串
            const fingerprintStr = JSON.stringify({
                ua: fingerprint.basic.userAgent,
                platform: fingerprint.basic.platform,
                language: fingerprint.basic.language,
                screen: fingerprint.screen.width + 'x' + fingerprint.screen.height,
                colorDepth: fingerprint.screen.colorDepth,
                timezone: fingerprint.timeLocation.timezone,
                hardwareConcurrency: fingerprint.basic.hardwareConcurrency
            });
            
            // 简单哈希函数
            let hash = 0;
            for (let i = 0; i < fingerprintStr.length; i++) {
                const char = fingerprintStr.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // 转换为32位整数
            }
            
            return Math.abs(hash).toString(16);
            
        } catch (error) {
            return 'hash_error_' + Date.now();
        }
    }
    
    /**
     * 获取会话ID
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
     * 保存指纹数据
     */
    function saveFingerprintData() {
        try {
            localStorage.setItem(FINGERPRINT_CONFIG.storageKey, JSON.stringify(fingerprintData));
            console.log('指纹数据已保存');
        } catch (error) {
            console.error('保存指纹数据失败:', error);
        }
    }
    
    /**
     * 获取指纹数据
     */
    function getFingerprintData() {
        return fingerprintData;
    }
    
    /**
     * 清空指纹数据
     */
    function clearFingerprintData() {
        fingerprintData = null;
        localStorage.removeItem(FINGERPRINT_CONFIG.storageKey);
        console.log('指纹数据已清空');
    }
    
    // 导出公共API
    window.FingerprintCollector = {
        init: initFingerprintCollector,
        getData: getFingerprintData,
        clearData: clearFingerprintData,
        config: FINGERPRINT_CONFIG,
        // 诊断函数

        diagnose: function() {
            return {
                enabled: FINGERPRINT_CONFIG.enabled,
                hasData: !!fingerprintData,
                dataAge: fingerprintData ? Date.now() - fingerprintData.timestamp : null,
                storageKey: FINGERPRINT_CONFIG.storageKey
            };
        }
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initFingerprintCollector);
    } else {
        initFingerprintCollector();
    }
})();