(function () {
    'use strict';

    const TRACKER_CONFIG = {
        enabled: true,
        sampleInterval: 50,
        maxRecords: 1000,
        storageKey: 'ks_trajectory_data_' + window.location.pathname.replace(/\//g, '_'),
        sharedDataKey: 'ks_shared_trajectory_data',
        saveInterval: 5000,
        trackScroll: true,
        trackClicks: true,
        trackMovement: true,
        dataRetentionTime: 24 * 60 * 60 * 1000,
        collectFingerprint: true,
        cloudSync: {
            enabled: true,
            syncInterval: 10000,
            batchSize: 100,
            maxBuffer: 1000,
            providerStorageKey: 'ks_cloud_provider',
            supabaseUrlStorageKey: 'ks_supabase_url',
            supabaseAnonKeyStorageKey: 'ks_supabase_anon_key',
            latestSyncStorageKey: 'ks_cloud_last_sync',
            tableName: 'trajectory_points'
        }
    };
    const DEFAULT_CLOUD_CONFIG = {
        provider: 'supabase',
        supabaseUrl: 'https://xmphfiybozqlnzbkddsl.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtcGhmaXlib3pxbG56YmtkZHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTI1NzYsImV4cCI6MjA5NDY2ODU3Nn0.ix7ZHCgTvsY6kspFqkSoz3Z4zeWACqis29a5fkJchm8'
    };

    let trajectoryData = [];
    let cloudBuffer = [];
    let lastSampleTime = 0;
    let saveTimer = null;
    let cloudTimer = null;
    let isCloudSyncing = false;
    let lastCloudSyncAttemptAt = 0;
    let isInitialized = false;
    let fingerprintData = null;

    let userId = null;
    let deviceId = null;
    let sessionId = null;

    function initTracker() {
        if (isInitialized || !TRACKER_CONFIG.enabled) {
            return;
        }

        ensureDefaultCloudConfig();
        loadCloudConfigFromUrl();
        loadSavedData();

        if (TRACKER_CONFIG.collectFingerprint) {
            collectFingerprintInfo();
        }

        ensureIdentifiers();
        setupEventListeners();
        startAutoSave();
        startCloudSync();
        updateSharedData();

        isInitialized = true;
        console.log('[TrajectoryTracker] initialized');
    }

    function loadCloudConfigFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const provider = params.get('cloudProvider') || params.get('provider');
            const supabaseUrl = params.get('supabaseUrl');
            const supabaseKey = params.get('supabaseKey') || params.get('supabaseAnonKey');

            if (provider) {
                localStorage.setItem(TRACKER_CONFIG.cloudSync.providerStorageKey, provider.trim().toLowerCase());
            }
            if (supabaseUrl) {
                localStorage.setItem(TRACKER_CONFIG.cloudSync.supabaseUrlStorageKey, normalizeSupabaseBaseUrl(supabaseUrl));
            }
            if (supabaseKey) {
                localStorage.setItem(TRACKER_CONFIG.cloudSync.supabaseAnonKeyStorageKey, supabaseKey.trim());
            }
        } catch (error) {
            console.warn('[TrajectoryTracker] failed to read URL cloud config', error);
        }
    }

    function ensureDefaultCloudConfig() {
        try {
            const currentProvider = (localStorage.getItem(TRACKER_CONFIG.cloudSync.providerStorageKey) || '').trim().toLowerCase();
            if (!currentProvider || currentProvider !== 'supabase') {
                localStorage.setItem(TRACKER_CONFIG.cloudSync.providerStorageKey, DEFAULT_CLOUD_CONFIG.provider);
            }

            const currentUrl = normalizeSupabaseBaseUrl(localStorage.getItem(TRACKER_CONFIG.cloudSync.supabaseUrlStorageKey) || '');
            if (!currentUrl || !/\.supabase\.co$/i.test(currentUrl)) {
                localStorage.setItem(TRACKER_CONFIG.cloudSync.supabaseUrlStorageKey, DEFAULT_CLOUD_CONFIG.supabaseUrl);
            }

            const currentKey = (localStorage.getItem(TRACKER_CONFIG.cloudSync.supabaseAnonKeyStorageKey) || '').trim();
            if (!currentKey || currentKey.length < 40) {
                localStorage.setItem(TRACKER_CONFIG.cloudSync.supabaseAnonKeyStorageKey, DEFAULT_CLOUD_CONFIG.supabaseAnonKey);
            }
        } catch (error) {
            console.warn('[TrajectoryTracker] failed to ensure default cloud config', error);
        }
    }

    function normalizeSupabaseBaseUrl(rawUrl) {
        const value = (rawUrl || '').trim();
        if (!value) {
            return '';
        }

        try {
            const parsed = new URL(value);
            parsed.hash = '';
            parsed.search = '';
            let path = parsed.pathname.replace(/\/+$/, '');
            path = path.replace(/\/rest\/v1$/i, '');
            parsed.pathname = path || '/';
            return parsed.toString().replace(/\/$/, '');
        } catch (_) {
            const noQuery = value.split('?')[0].split('#')[0].replace(/\/+$/, '');
            return noQuery.replace(/\/rest\/v1$/i, '');
        }
    }

    function getCloudConfig() {
        const provider = (localStorage.getItem(TRACKER_CONFIG.cloudSync.providerStorageKey) || DEFAULT_CLOUD_CONFIG.provider).toLowerCase();
        const supabaseUrl = normalizeSupabaseBaseUrl(localStorage.getItem(TRACKER_CONFIG.cloudSync.supabaseUrlStorageKey) || DEFAULT_CLOUD_CONFIG.supabaseUrl || '');
        const supabaseAnonKey = localStorage.getItem(TRACKER_CONFIG.cloudSync.supabaseAnonKeyStorageKey) || DEFAULT_CLOUD_CONFIG.supabaseAnonKey || '';

        return {
            provider,
            supabaseUrl,
            supabaseAnonKey,
            enabled: TRACKER_CONFIG.cloudSync.enabled && provider === 'supabase' && !!supabaseUrl && !!supabaseAnonKey
        };
    }

    function ensureIdentifiers() {
        userId = localStorage.getItem('ks_user_id');
        if (!userId) {
            const hash = fingerprintData && fingerprintData.hash ? fingerprintData.hash : randomToken(10);
            userId = 'user_' + hash;
            localStorage.setItem('ks_user_id', userId);
        }

        deviceId = localStorage.getItem('ks_device_id');
        if (!deviceId) {
            deviceId = 'device_' + randomToken(12);
            localStorage.setItem('ks_device_id', deviceId);
        }

        sessionId = sessionStorage.getItem('ks_session_id');
        if (!sessionId) {
            sessionId = 'sess_' + Date.now().toString(36) + '_' + randomToken(6);
            sessionStorage.setItem('ks_session_id', sessionId);
        }
    }

    function randomToken(length) {
        return Math.random().toString(36).slice(2, 2 + length);
    }

    function collectFingerprintInfo() {
        try {
            fingerprintData = {
                browser: {
                    userAgent: navigator.userAgent,
                    platform: navigator.platform,
                    language: navigator.language,
                    languages: navigator.languages,
                    cookieEnabled: navigator.cookieEnabled
                },
                screen: {
                    width: screen.width,
                    height: screen.height,
                    availWidth: screen.availWidth,
                    availHeight: screen.availHeight,
                    colorDepth: screen.colorDepth,
                    pixelDepth: screen.pixelDepth,
                    devicePixelRatio: window.devicePixelRatio || 1
                },
                device: {
                    hardwareConcurrency: navigator.hardwareConcurrency || null,
                    deviceMemory: navigator.deviceMemory || null,
                    maxTouchPoints: navigator.maxTouchPoints || 0
                },
                timeLocation: {
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    timezoneOffset: new Date().getTimezoneOffset(),
                    locale: Intl.DateTimeFormat().resolvedOptions().locale
                },
                parsedUA: parseUserAgent(navigator.userAgent),
                collectedAt: new Date().toISOString(),
                timestamp: Date.now()
            };

            fingerprintData.hash = calculateFingerprintHash(fingerprintData);
        } catch (error) {
            fingerprintData = {
                error: error.message,
                timestamp: Date.now(),
                hash: 'hash_error_' + Date.now()
            };
        }
    }

    function parseUserAgent(ua) {
        const parsed = {
            browser: 'unknown',
            os: 'unknown',
            deviceType: 'desktop'
        };
        const lower = (ua || '').toLowerCase();

        if (lower.includes('edg')) parsed.browser = 'edge';
        else if (lower.includes('chrome')) parsed.browser = 'chrome';
        else if (lower.includes('firefox')) parsed.browser = 'firefox';
        else if (lower.includes('safari')) parsed.browser = 'safari';

        if (lower.includes('windows')) parsed.os = 'windows';
        else if (lower.includes('mac os')) parsed.os = 'macos';
        else if (lower.includes('linux')) parsed.os = 'linux';
        else if (lower.includes('android')) {
            parsed.os = 'android';
            parsed.deviceType = 'mobile';
        } else if (lower.includes('iphone') || lower.includes('ipad')) {
            parsed.os = 'ios';
            parsed.deviceType = lower.includes('ipad') ? 'tablet' : 'mobile';
        }

        return parsed;
    }

    function calculateFingerprintHash(fingerprint) {
        try {
            const raw = JSON.stringify({
                ua: fingerprint.browser.userAgent,
                platform: fingerprint.browser.platform,
                language: fingerprint.browser.language,
                screen: fingerprint.screen.width + 'x' + fingerprint.screen.height,
                timezone: fingerprint.timeLocation.timezone,
                hardwareConcurrency: fingerprint.device.hardwareConcurrency
            });

            let hash = 0;
            for (let i = 0; i < raw.length; i += 1) {
                hash = ((hash << 5) - hash) + raw.charCodeAt(i);
                hash |= 0;
            }

            return Math.abs(hash).toString(16);
        } catch (_) {
            return 'unknown_hash';
        }
    }

    function loadSavedData() {
        try {
            const saved = localStorage.getItem(TRACKER_CONFIG.storageKey);
            if (!saved) {
                trajectoryData = [];
                return;
            }

            const parsed = JSON.parse(saved);
            const now = Date.now();
            trajectoryData = (Array.isArray(parsed) ? parsed : []).filter((record) => now - record.t < TRACKER_CONFIG.dataRetentionTime);
        } catch (error) {
            console.warn('[TrajectoryTracker] load saved data failed', error);
            trajectoryData = [];
        }
    }

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
        document.addEventListener('visibilitychange', handleVisibilityChange, { passive: true });
        window.addEventListener('pagehide', handlePageHide, { passive: true });
        setInterval(cleanupOldData, TRACKER_CONFIG.dataRetentionTime / 2);
    }

    function handleMouseMove(event) {
        const now = Date.now();
        if (now - lastSampleTime < TRACKER_CONFIG.sampleInterval) {
            return;
        }
        lastSampleTime = now;

        addRecord({
            t: now,
            x: event.clientX,
            y: event.clientY,
            type: 'mousemove',
            pageX: event.pageX,
            pageY: event.pageY,
            screenX: event.screenX,
            screenY: event.screenY
        });
    }

    function handleMouseDown(event) {
        addRecord({
            t: Date.now(),
            x: event.clientX,
            y: event.clientY,
            type: 'mousedown',
            button: event.button,
            pageX: event.pageX,
            pageY: event.pageY
        });
    }

    function handleScroll() {
        addRecord({
            t: Date.now(),
            x: window.scrollX,
            y: window.scrollY,
            type: 'scroll'
        });
    }

    function addRecord(record) {
        const enriched = {
            ...record,
            userId,
            deviceId,
            sessionId,
            pageUrl: window.location.href,
            fingerprintHash: fingerprintData ? fingerprintData.hash : null,
            userAgent: navigator.userAgent,
            screenWidth: screen.width,
            screenHeight: screen.height,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language
        };

        trajectoryData.push(enriched);
        if (trajectoryData.length > TRACKER_CONFIG.maxRecords) {
            trajectoryData = trajectoryData.slice(-TRACKER_CONFIG.maxRecords);
        }

        cloudBuffer.push(enriched);
        if (cloudBuffer.length > TRACKER_CONFIG.cloudSync.maxBuffer) {
            cloudBuffer = cloudBuffer.slice(-TRACKER_CONFIG.cloudSync.maxBuffer);
        }

        updateSharedData();
        maybeFastSync();
    }

    function cleanupOldData() {
        const now = Date.now();
        const oldLen = trajectoryData.length;
        trajectoryData = trajectoryData.filter((record) => now - record.t < TRACKER_CONFIG.dataRetentionTime);

        if (trajectoryData.length !== oldLen) {
            saveData();
        }
    }

    function buildSharedData() {
        const cloud = getCloudConfig();
        return {
            stats: getStats(),
            recentPoints: getTrajectoryStream().slice(-100),
            fingerprint: fingerprintData,
            session: {
                sessionId,
                userId,
                deviceId,
                pageUrl: window.location.href,
                currentTime: Date.now()
            },
            summary: {
                totalPoints: trajectoryData.length,
                lastUpdated: new Date().toISOString(),
                hasFingerprint: !!fingerprintData,
                fingerprintHash: fingerprintData ? fingerprintData.hash : null,
                dataSource: cloud.enabled ? 'supabase' : 'local'
            },
            cloud: {
                provider: cloud.provider,
                enabled: cloud.enabled,
                pendingPoints: cloudBuffer.length,
                lastSync: localStorage.getItem(TRACKER_CONFIG.cloudSync.latestSyncStorageKey)
            },
            timestamp: Date.now(),
            trackerStatus: {
                isInitialized,
                enabled: TRACKER_CONFIG.enabled,
                dataCount: trajectoryData.length,
                isCloudSyncing,
                cloudEnabled: cloud.enabled,
                lastUpdate: new Date().toISOString()
            }
        };
    }

    function updateSharedData() {
        try {
            localStorage.setItem(TRACKER_CONFIG.sharedDataKey, JSON.stringify(buildSharedData()));
        } catch (error) {
            console.warn('[TrajectoryTracker] update shared data failed', error);
        }
    }

    function startAutoSave() {
        if (saveTimer) {
            clearInterval(saveTimer);
        }
        saveTimer = setInterval(saveData, TRACKER_CONFIG.saveInterval);
    }

    function saveData() {
        try {
            localStorage.setItem(TRACKER_CONFIG.storageKey, JSON.stringify(trajectoryData));
            updateSharedData();
        } catch (error) {
            console.warn('[TrajectoryTracker] save data failed', error);
        }
    }

    function startCloudSync() {
        if (cloudTimer) {
            clearInterval(cloudTimer);
        }

        cloudTimer = setInterval(() => {
            syncCloudBuffer();
        }, TRACKER_CONFIG.cloudSync.syncInterval);
    }

    function maybeFastSync() {
        const cloud = getCloudConfig();
        if (!cloud.enabled || isCloudSyncing || cloudBuffer.length === 0) {
            return;
        }

        const now = Date.now();
        const enoughBuffered = cloudBuffer.length >= Math.max(20, Math.floor(TRACKER_CONFIG.cloudSync.batchSize / 2));
        if (!enoughBuffered || now - lastCloudSyncAttemptAt < 2000) {
            return;
        }

        lastCloudSyncAttemptAt = now;
        syncCloudBuffer().catch(() => {
            // Swallow to avoid unhandled rejections from best-effort fast sync.
        });
    }

    async function syncCloudBuffer() {
        const cloud = getCloudConfig();
        if (!cloud.enabled || isCloudSyncing || cloudBuffer.length === 0) {
            return;
        }

        lastCloudSyncAttemptAt = Date.now();
        isCloudSyncing = true;
        const batch = cloudBuffer.slice(0, TRACKER_CONFIG.cloudSync.batchSize);

        const payload = batch.map((record) => ({
            user_id: record.userId,
            device_id: record.deviceId,
            page_url: record.pageUrl,
            event_type: record.type,
            x: toIntOrNull(record.x),
            y: toIntOrNull(record.y),
            page_x: toIntOrNull(record.pageX),
            page_y: toIntOrNull(record.pageY),
            screen_x: toIntOrNull(record.screenX),
            screen_y: toIntOrNull(record.screenY),
            button: toIntOrNull(record.button),
            scroll_x: record.type === 'scroll' ? toIntOrNull(window.scrollX) : null,
            scroll_y: record.type === 'scroll' ? toIntOrNull(window.scrollY) : null,
            user_agent: record.userAgent,
            screen_width: toIntOrNull(record.screenWidth),
            screen_height: toIntOrNull(record.screenHeight),
            color_depth: toIntOrNull(screen.colorDepth),
            timezone: record.timezone,
            language: record.language,
            timestamp: toIntOrNull(record.t)
        }));

        try {
            const endpoint = cloud.supabaseUrl.replace(/\/$/, '') + '/rest/v1/' + TRACKER_CONFIG.cloudSync.tableName;
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': cloud.supabaseAnonKey,
                    'Authorization': 'Bearer ' + cloud.supabaseAnonKey,
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error('Supabase insert failed: ' + response.status);
            }

            cloudBuffer = cloudBuffer.slice(batch.length);
            localStorage.setItem(TRACKER_CONFIG.cloudSync.latestSyncStorageKey, new Date().toISOString());
        } catch (error) {
            console.warn('[TrajectoryTracker] cloud sync failed', error);
        } finally {
            isCloudSyncing = false;
            updateSharedData();
        }
    }

    function toIntOrNull(value) {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return null;
        }
        return Math.round(Number(value));
    }

    function handleBeforeUnload() {
        saveData();
        syncCloudBuffer().catch(() => {
            // Best effort before unload.
        });
    }

    function handleVisibilityChange() {
        if (document.visibilityState === 'hidden') {
            saveData();
            syncCloudBuffer().catch(() => {
                // Best effort on tab hide.
            });
        }
    }

    function handlePageHide() {
        saveData();
        syncCloudBuffer().catch(() => {
            // Best effort on page hide.
        });
    }

    function getTrajectoryStream(limit) {
        const stream = trajectoryData
            .filter((record) => record.type === 'mousemove' || record.type === 'mousedown')
            .map((record) => ({
                t: record.t,
                x: record.x,
                y: record.y,
                type: record.type,
                userId: record.userId,
                deviceId: record.deviceId
            }));

        return limit ? stream.slice(-limit) : stream;
    }

    function getStats() {
        const now = Date.now();
        const sessionStart = performance.timing ? performance.timing.navigationStart : now;
        const sessionDuration = now - sessionStart;

        const moves = trajectoryData.filter((r) => r.type === 'mousemove').length;
        const clicks = trajectoryData.filter((r) => r.type === 'mousedown').length;
        const scrolls = trajectoryData.filter((r) => r.type === 'scroll').length;

        return {
            totalRecords: trajectoryData.length,
            moves,
            clicks,
            scrolls,
            sessionDuration: Math.round(sessionDuration / 1000) + 's',
            currentPage: window.location.pathname,
            currentUser: userId,
            currentDevice: deviceId,
            lastUpdate: new Date().toISOString(),
            trackerStatus: isInitialized ? 'active' : 'inactive',
            hasFingerprint: !!fingerprintData
        };
    }

    function clearData() {
        trajectoryData = [];
        cloudBuffer = [];
        saveData();
    }

    function getSharedData() {
        try {
            const data = localStorage.getItem(TRACKER_CONFIG.sharedDataKey);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.warn('[TrajectoryTracker] read shared data failed', error);
            return null;
        }
    }

    function setCloudConfig(provider, supabaseUrl, supabaseAnonKey) {
        localStorage.setItem(TRACKER_CONFIG.cloudSync.providerStorageKey, (provider || 'supabase').toLowerCase());
        if (supabaseUrl) {
            localStorage.setItem(TRACKER_CONFIG.cloudSync.supabaseUrlStorageKey, normalizeSupabaseBaseUrl(supabaseUrl));
        }
        if (supabaseAnonKey) {
            localStorage.setItem(TRACKER_CONFIG.cloudSync.supabaseAnonKeyStorageKey, supabaseAnonKey.trim());
        }
        updateSharedData();
    }

    window.TrajectoryTrackerWithFingerprint = {
        init: initTracker,
        getStream: getTrajectoryStream,
        getStats,
        getSharedData,
        clearData,
        config: TRACKER_CONFIG,
        getFingerprint: function () {
            return fingerprintData;
        },
        getCloudStatus: function () {
            return {
                ...getCloudConfig(),
                pendingPoints: cloudBuffer.length,
                isCloudSyncing,
                lastSync: localStorage.getItem(TRACKER_CONFIG.cloudSync.latestSyncStorageKey)
            };
        },
        forceCloudSync: syncCloudBuffer,
        setCloudConfig,
        diagnose: function () {
            return {
                isInitialized,
                dataCount: trajectoryData.length,
                hasFingerprint: !!fingerprintData,
                fingerprintHash: fingerprintData ? fingerprintData.hash : null,
                storageKey: TRACKER_CONFIG.storageKey,
                sharedDataKey: TRACKER_CONFIG.sharedDataKey,
                cloud: getCloudConfig()
            };
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTracker);
    } else {
        initTracker();
    }
})();

