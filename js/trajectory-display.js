(function () {
    'use strict';

    const DISPLAY_CONFIG = {
        sharedDataKey: 'ks_shared_trajectory_data',
        refreshInterval: 2000,
        maxDisplayPoints: 500,
        cloudQueryLimit: 1200,
        chartConfig: {
            pointRadius: 1,
            backgroundColor: 'rgba(59, 130, 246, 0.12)',
            borderColor: 'rgba(59, 130, 246, 0.55)',
            borderWidth: 1
        },
        cloud: {
            providerStorageKey: 'ks_cloud_provider',
            supabaseUrlStorageKey: 'ks_supabase_url',
            supabaseAnonKeyStorageKey: 'ks_supabase_anon_key'
        }
    };

    const DEFAULT_CLOUD_CONFIG = {
        provider: 'supabase',
        supabaseUrl: 'https://xmphfiybozqlnzbkddsl.supabase.co',
        supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtcGhmaXlib3pxbG56YmtkZHNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwOTI1NzYsImV4cCI6MjA5NDY2ODU3Nn0.ix7ZHCgTvsY6kspFqkSoz3Z4zeWACqis29a5fkJchm8'
    };

    let trajectoryChart = null;
    let refreshTimer = null;
    let lastUpdateTime = 0;
    let lastSource = 'none';
    let isLoading = false;

    function initTrajectoryDisplay() {
        console.log('[TrajectoryDisplay] init');
        ensureDefaultCloudConfig();
        loadCloudConfigFromUrl();
        initChart();
        startRefresh();
        loadAndDisplayData();
    }

    function ensureDefaultCloudConfig() {
        try {
            const currentProvider = (localStorage.getItem(DISPLAY_CONFIG.cloud.providerStorageKey) || '').trim().toLowerCase();
            if (!currentProvider || currentProvider !== 'supabase') {
                localStorage.setItem(DISPLAY_CONFIG.cloud.providerStorageKey, DEFAULT_CLOUD_CONFIG.provider);
            }

            const currentUrl = normalizeSupabaseBaseUrl(localStorage.getItem(DISPLAY_CONFIG.cloud.supabaseUrlStorageKey) || '');
            if (!currentUrl || !/\.supabase\.co$/i.test(currentUrl)) {
                localStorage.setItem(DISPLAY_CONFIG.cloud.supabaseUrlStorageKey, DEFAULT_CLOUD_CONFIG.supabaseUrl);
            }

            const currentKey = (localStorage.getItem(DISPLAY_CONFIG.cloud.supabaseAnonKeyStorageKey) || '').trim();
            if (!currentKey || currentKey.length < 40) {
                localStorage.setItem(DISPLAY_CONFIG.cloud.supabaseAnonKeyStorageKey, DEFAULT_CLOUD_CONFIG.supabaseAnonKey);
            }
        } catch (error) {
            console.warn('[TrajectoryDisplay] ensure default cloud config failed', error);
        }
    }

    function loadCloudConfigFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const provider = params.get('cloudProvider') || params.get('provider');
            const supabaseUrl = params.get('supabaseUrl');
            const supabaseKey = params.get('supabaseKey') || params.get('supabaseAnonKey');

            if (provider) {
                localStorage.setItem(DISPLAY_CONFIG.cloud.providerStorageKey, provider.trim().toLowerCase());
            }
            if (supabaseUrl) {
                localStorage.setItem(DISPLAY_CONFIG.cloud.supabaseUrlStorageKey, normalizeSupabaseBaseUrl(supabaseUrl));
            }
            if (supabaseKey) {
                localStorage.setItem(DISPLAY_CONFIG.cloud.supabaseAnonKeyStorageKey, supabaseKey.trim());
            }
        } catch (error) {
            console.warn('[TrajectoryDisplay] failed to load cloud config from URL', error);
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
        const provider = (localStorage.getItem(DISPLAY_CONFIG.cloud.providerStorageKey) || DEFAULT_CLOUD_CONFIG.provider).toLowerCase();
        const supabaseUrl = normalizeSupabaseBaseUrl(localStorage.getItem(DISPLAY_CONFIG.cloud.supabaseUrlStorageKey) || DEFAULT_CLOUD_CONFIG.supabaseUrl);
        const supabaseAnonKey = localStorage.getItem(DISPLAY_CONFIG.cloud.supabaseAnonKeyStorageKey) || DEFAULT_CLOUD_CONFIG.supabaseAnonKey;

        return {
            provider,
            supabaseUrl,
            supabaseAnonKey,
            enabled: provider === 'supabase' && !!supabaseUrl && !!supabaseAnonKey
        };
    }

    function initChart() {
        const canvas = document.getElementById('trajectory-chart');
        if (!canvas) {
            console.error('[TrajectoryDisplay] canvas not found: #trajectory-chart');
            return;
        }

        trajectoryChart = new Chart(canvas.getContext('2d'), {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'Mouse trajectory (cross-device)',
                    data: [],
                    pointRadius: DISPLAY_CONFIG.chartConfig.pointRadius,
                    backgroundColor: DISPLAY_CONFIG.chartConfig.backgroundColor,
                    borderColor: DISPLAY_CONFIG.chartConfig.borderColor,
                    borderWidth: DISPLAY_CONFIG.chartConfig.borderWidth
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'linear',
                        position: 'bottom',
                        title: { display: true, text: 'X' },
                        min: 0,
                        max: window.innerWidth || 1920
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'Y' },
                        reverse: true,
                        min: 0,
                        max: window.innerHeight || 1080
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const point = context.raw || {};
                                return 'coord: (' + point.x + ', ' + point.y + ')';
                            }
                        }
                    }
                }
            }
        });
    }

    function startRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        refreshTimer = setInterval(function () {
            loadAndDisplayData();
        }, DISPLAY_CONFIG.refreshInterval);
    }

    async function loadAndDisplayData() {
        if (isLoading) {
            return;
        }

        isLoading = true;
        try {
            const sharedData = await getBestAvailableData();
            if (!sharedData) {
                updateNoDataMessage();
                updateConnectionStatus('none');
                return;
            }

            const source = (sharedData.summary && sharedData.summary.dataSource) || 'unknown';
            if (sharedData.timestamp <= lastUpdateTime && source === lastSource) {
                return;
            }

            lastUpdateTime = sharedData.timestamp || Date.now();
            lastSource = source;

            updateStatsDisplay(sharedData.stats || {});
            updateChartData(sharedData.recentPoints || []);
            updateTimestampDisplay((sharedData.summary && sharedData.summary.lastUpdated) || new Date().toISOString(), source);
            updateConnectionStatus(source, sharedData.cloud || null);
        } catch (error) {
            console.error('[TrajectoryDisplay] load and display failed', error);
            updateConnectionStatus('error', { message: error.message });
            updateNoDataMessage();
        } finally {
            isLoading = false;
        }
    }

    async function getBestAvailableData() {
        const cloud = getCloudConfig();

        if (cloud.enabled) {
            try {
                return await fetchSupabaseSharedData(cloud);
            } catch (error) {
                console.warn('[TrajectoryDisplay] cloud fetch failed, fallback to local', error);
                const localFallback = getLocalSharedData();
                if (localFallback) {
                    localFallback.summary = localFallback.summary || {};
                    localFallback.summary.dataSource = 'local-fallback';
                    return localFallback;
                }
                throw error;
            }
        }

        return getLocalSharedData();
    }

    async function fetchSupabaseSharedData(cloud) {
        const endpoint = cloud.supabaseUrl.replace(/\/$/, '') + '/rest/v1/trajectory_points';
        const params = new URLSearchParams({
            select: 'user_id,device_id,event_type,x,y,timestamp,page_url,created_at',
            order: 'timestamp.desc',
            limit: String(DISPLAY_CONFIG.cloudQueryLimit)
        });

        const response = await fetch(endpoint + '?' + params.toString(), {
            method: 'GET',
            headers: {
                apikey: cloud.supabaseAnonKey,
                Authorization: 'Bearer ' + cloud.supabaseAnonKey
            }
        });

        if (!response.ok) {
            const detail = await response.text();
            throw new Error('Supabase query failed: ' + response.status + ' ' + detail);
        }

        const rows = await response.json();
        if (!Array.isArray(rows)) {
            throw new Error('Supabase response is not an array');
        }

        const orderedAsc = rows.slice().sort(function (a, b) {
            return Number(a.timestamp || 0) - Number(b.timestamp || 0);
        });

        const moveAndClick = orderedAsc.filter(function (row) {
            return (row.event_type === 'mousemove' || row.event_type === 'mousedown') && Number.isFinite(Number(row.x)) && Number.isFinite(Number(row.y));
        });

        const recentPoints = moveAndClick.slice(-DISPLAY_CONFIG.maxDisplayPoints).map(function (row) {
            return {
                t: Number(row.timestamp || Date.now()),
                x: Number(row.x),
                y: Number(row.y),
                type: row.event_type,
                userId: row.user_id,
                deviceId: row.device_id
            };
        });

        const moves = rows.filter(function (row) { return row.event_type === 'mousemove'; }).length;
        const clicks = rows.filter(function (row) { return row.event_type === 'mousedown'; }).length;
        const scrolls = rows.filter(function (row) { return row.event_type === 'scroll'; }).length;

        const users = new Set();
        const devices = new Set();
        rows.forEach(function (row) {
            if (row.user_id) users.add(row.user_id);
            if (row.device_id) devices.add(row.device_id);
        });

        const firstTs = orderedAsc.length ? Number(orderedAsc[0].timestamp || Date.now()) : Date.now();
        const lastTs = orderedAsc.length ? Number(orderedAsc[orderedAsc.length - 1].timestamp || Date.now()) : Date.now();
        const lastUpdatedIso = rows.length && rows[0].created_at ? rows[0].created_at : new Date(lastTs).toISOString();

        return {
            stats: {
                totalRecords: rows.length,
                moves: moves,
                clicks: clicks,
                scrolls: scrolls,
                sessionDuration: formatDuration(Math.max(0, lastTs - firstTs)),
                currentPage: 'cross-device',
                currentUser: users.size + ' users',
                currentDevice: devices.size + ' devices',
                lastUpdate: lastUpdatedIso,
                trackerStatus: 'cloud',
                hasFingerprint: false
            },
            recentPoints: recentPoints,
            summary: {
                totalPoints: rows.length,
                lastUpdated: lastUpdatedIso,
                hasFingerprint: false,
                fingerprintHash: null,
                dataSource: 'supabase'
            },
            cloud: {
                provider: cloud.provider,
                enabled: true,
                pendingPoints: null,
                lastSync: lastUpdatedIso
            },
            timestamp: lastTs || Date.now()
        };
    }

    function formatDuration(ms) {
        const seconds = Math.max(0, Math.round(ms / 1000));
        if (seconds < 60) {
            return String(seconds) + 's';
        }

        const minutes = Math.floor(seconds / 60);
        const rest = seconds % 60;
        return String(minutes) + 'm ' + String(rest) + 's';
    }

    function getLocalSharedData() {
        try {
            const raw = localStorage.getItem(DISPLAY_CONFIG.sharedDataKey);
            if (!raw) {
                return null;
            }
            const data = JSON.parse(raw);
            data.summary = data.summary || {};
            if (!data.summary.dataSource) {
                data.summary.dataSource = 'local';
            }
            data.timestamp = data.timestamp || Date.now();
            return data;
        } catch (error) {
            console.error('[TrajectoryDisplay] read local shared data failed', error);
            return null;
        }
    }

    function updateNoDataMessage() {
        if (trajectoryChart) {
            trajectoryChart.data.datasets[0].data = [];
            trajectoryChart.update('none');
        }

        const statsElement = document.getElementById('trajectory-stats');
        if (statsElement) {
            statsElement.innerHTML = '<p>Waiting for trajectory data from Supabase or local cache...</p>';
        }
    }

    function updateStatsDisplay(stats) {
        const statsElement = document.getElementById('trajectory-stats');
        if (!statsElement) return;

        const html = [
            '<div class="stats-grid">',
            createStatCard('Total', stats.totalRecords),
            createStatCard('Moves', stats.moves),
            createStatCard('Clicks', stats.clicks),
            createStatCard('Scrolls', stats.scrolls),
            createStatCard('Duration', stats.sessionDuration),
            createStatCard('Scope', stats.currentPage),
            createStatCard('Users', stats.currentUser),
            createStatCard('Devices', stats.currentDevice),
            '</div>'
        ].join('');

        statsElement.innerHTML = html;
    }

    function createStatCard(label, value) {
        return '' +
            '<div class="stat-card">' +
            '<h4>' + escapeHtml(String(label || '-')) + '</h4>' +
            '<p class="stat-value">' + escapeHtml(String(value == null ? '-' : value)) + '</p>' +
            '</div>';
    }

    function escapeHtml(value) {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updateChartData(points) {
        if (!trajectoryChart) {
            return;
        }

        if (!Array.isArray(points) || points.length === 0) {
            trajectoryChart.data.datasets[0].data = [];
            trajectoryChart.update('none');
            return;
        }

        const chartData = points.map(function (point) {
            return {
                x: Number(point.x),
                y: Number(point.y)
            };
        }).filter(function (point) {
            return Number.isFinite(point.x) && Number.isFinite(point.y);
        });

        trajectoryChart.data.datasets[0].data = chartData.slice(-DISPLAY_CONFIG.maxDisplayPoints);

        if (trajectoryChart.data.datasets[0].data.length > 0) {
            const xValues = trajectoryChart.data.datasets[0].data.map(function (d) { return d.x; });
            const yValues = trajectoryChart.data.datasets[0].data.map(function (d) { return d.y; });
            trajectoryChart.options.scales.x.min = Math.max(0, Math.min.apply(null, xValues) - 50);
            trajectoryChart.options.scales.x.max = Math.max.apply(null, xValues) + 50;
            trajectoryChart.options.scales.y.min = Math.max(0, Math.min.apply(null, yValues) - 50);
            trajectoryChart.options.scales.y.max = Math.max.apply(null, yValues) + 50;
        }

        trajectoryChart.update('none');
    }

    function updateTimestampDisplay(timestamp, source) {
        const timeElement = document.getElementById('data-timestamp');
        if (!timeElement) return;

        const date = new Date(timestamp);
        const timeText = Number.isNaN(date.getTime()) ? String(timestamp) : date.toLocaleString();
        timeElement.textContent = 'Last update: ' + timeText + ' (' + source + ')';
    }

    function updateConnectionStatus(source, cloudMeta) {
        const statusElement = document.getElementById('connection-status');
        if (!statusElement) return;

        if (source === 'supabase') {
            statusElement.innerHTML = '' +
                '<p style="color: #10b981;">Cloud connected (Supabase)</p>' +
                '<p>Collecting cross-device data in real time.</p>';
            return;
        }

        if (source === 'local' || source === 'local-fallback') {
            statusElement.innerHTML = '' +
                '<p style="color: #f59e0b;">Using local fallback</p>' +
                '<p>Cloud read failed or disabled. Showing local cache only.</p>';
            return;
        }

        if (source === 'error') {
            const msg = cloudMeta && cloudMeta.message ? cloudMeta.message : 'unknown error';
            statusElement.innerHTML = '' +
                '<p style="color: #ef4444;">Data connection error</p>' +
                '<p>' + escapeHtml(msg) + '</p>';
            return;
        }

        statusElement.innerHTML = '' +
            '<p style="color: #94a3b8;">Waiting for data</p>' +
            '<p>Please generate events on the source page.</p>';
    }

    function clearDisplay() {
        if (trajectoryChart) {
            trajectoryChart.data.datasets[0].data = [];
            trajectoryChart.update('none');
        }

        try {
            localStorage.removeItem(DISPLAY_CONFIG.sharedDataKey);
        } catch (error) {
            console.warn('[TrajectoryDisplay] clear local shared data failed', error);
        }

        updateNoDataMessage();
    }

    function stopRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }

    function setCloudConfig(provider, supabaseUrl, supabaseAnonKey) {
        if (provider) {
            localStorage.setItem(DISPLAY_CONFIG.cloud.providerStorageKey, String(provider).toLowerCase());
        }
        if (supabaseUrl) {
            localStorage.setItem(DISPLAY_CONFIG.cloud.supabaseUrlStorageKey, normalizeSupabaseBaseUrl(String(supabaseUrl)));
        }
        if (supabaseAnonKey) {
            localStorage.setItem(DISPLAY_CONFIG.cloud.supabaseAnonKeyStorageKey, String(supabaseAnonKey).trim());
        }
    }

    window.TrajectoryDisplay = {
        init: initTrajectoryDisplay,
        clear: clearDisplay,
        stop: stopRefresh,
        refreshNow: loadAndDisplayData,
        getCloudStatus: getCloudConfig,
        setCloudConfig: setCloudConfig,
        config: DISPLAY_CONFIG
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTrajectoryDisplay);
    } else {
        initTrajectoryDisplay();
    }
})();

