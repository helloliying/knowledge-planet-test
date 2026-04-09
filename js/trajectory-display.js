/**
 * 轨迹数据显示器
 * 用于在安全仪表板中显示从主测试页面采集的轨迹数据
 */

(function() {
    'use strict';
    
    // 配置
    const DISPLAY_CONFIG = {
        // 共享数据键名
        sharedDataKey: 'ks_shared_trajectory_data',
        
        // 数据刷新间隔（毫秒）
        refreshInterval: 2000,
        
        // 最大显示点数
        maxDisplayPoints: 500,
        
        // 图表配置
        chartConfig: {
            pointRadius: 1,
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderColor: 'rgba(59, 130, 246, 0.5)',
            borderWidth: 1
        }
    };
    
    // 全局变量
    let trajectoryChart = null;
    let refreshTimer = null;
    let lastUpdateTime = 0;
    
    /**
     * 初始化轨迹显示器
     */
    function initTrajectoryDisplay() {
        console.log('🚀 轨迹显示器初始化');
        
        // 初始化图表
        initChart();
        
        // 开始定期刷新
        startRefresh();
        
        // 初始加载数据
        loadAndDisplayData();
        
        console.log('✅ 轨迹显示器已启动');
    }
    
    /**
     * 初始化图表
     */
    function initChart() {
        const ctx = document.getElementById('trajectory-chart');
        if (!ctx) {
            console.error('找不到轨迹图表元素');
            return;
        }
        
        const canvasCtx = ctx.getContext('2d');
        trajectoryChart = new Chart(canvasCtx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: '鼠标轨迹 (来自主测试页面)',
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
                        title: {
                            display: true,
                            text: 'X 坐标'
                        },
                        min: 0,
                        max: window.innerWidth || 1920
                    },
                    y: {
                        type: 'linear',
                        position: 'left',
                        title: {
                            display: true,
                            text: 'Y 坐标'
                        },
                        reverse: true, // 反转Y轴，使顶部为0
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
                            label: function(context) {
                                const point = context.raw;
                                return `坐标: (${point.x}, ${point.y})`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    /**
     * 开始定期刷新
     */
    function startRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
        }
        
        refreshTimer = setInterval(() => {
            loadAndDisplayData();
        }, DISPLAY_CONFIG.refreshInterval);
    }
    
    /**
     * 加载并显示数据
     */
    function loadAndDisplayData() {
        const sharedData = getSharedData();
        
        if (!sharedData) {
            // 没有数据，显示提示
            updateNoDataMessage();
            return;
        }
        
        // 检查数据是否更新
        if (sharedData.timestamp <= lastUpdateTime) {
            return; // 数据没有更新
        }
        
        lastUpdateTime = sharedData.timestamp;
        
        // 更新统计数据
        updateStatsDisplay(sharedData.stats);
        
        // 更新图表数据
        updateChartData(sharedData.recentPoints);
        
        // 更新数据时间戳
        updateTimestampDisplay(sharedData.summary.lastUpdated);
    }
    
    /**
     * 获取共享数据
     */
    function getSharedData() {
        try {
            const data = localStorage.getItem(DISPLAY_CONFIG.sharedDataKey);
            if (!data) {
                return null;
            }
            
            return JSON.parse(data);
        } catch (error) {
            console.error('获取共享数据失败:', error);
            return null;
        }
    }
    
    /**
     * 更新无数据消息
     */
    function updateNoDataMessage() {
        // 可以在这里添加无数据时的UI提示
        if (trajectoryChart) {
            trajectoryChart.data.datasets[0].data = [];
            trajectoryChart.update('none');
        }
        
        // 更新统计显示
        const statsElement = document.getElementById('trajectory-stats');
        if (statsElement) {
            statsElement.innerHTML = '<p>⏳ 等待主测试页面采集数据...</p>';
        }
    }
    
    /**
     * 更新统计数据显示
     */
    function updateStatsDisplay(stats) {
        const statsElement = document.getElementById('trajectory-stats');
        if (!statsElement) return;
        
        const html = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h4>总记录数</h4>
                    <p class="stat-value">${stats.totalRecords}</p>
                </div>
                <div class="stat-card">
                    <h4>鼠标移动</h4>
                    <p class="stat-value">${stats.moves}</p>
                </div>
                <div class="stat-card">
                    <h4>点击事件</h4>
                    <p class="stat-value">${stats.clicks}</p>
                </div>
                <div class="stat-card">
                    <h4>滚动事件</h4>
                    <p class="stat-value">${stats.scrolls}</p>
                </div>
                <div class="stat-card">
                    <h4>会话时长</h4>
                    <p class="stat-value">${stats.sessionDuration}</p>
                </div>
                <div class="stat-card">
                    <h4>页面</h4>
                    <p class="stat-value">${stats.currentPage}</p>
                </div>
            </div>
        `;
        
        statsElement.innerHTML = html;
    }
    
    /**
     * 更新图表数据
     */
    function updateChartData(points) {
        if (!trajectoryChart || !points || points.length === 0) {
            return;
        }
        
        // 转换数据格式
        const chartData = points.map(point => ({
            x: point.x,
            y: point.y
        }));
        
        // 限制显示点数
        const displayData = chartData.slice(-DISPLAY_CONFIG.maxDisplayPoints);
        
        // 更新图表
        trajectoryChart.data.datasets[0].data = displayData;
        
        // 自动调整坐标轴范围
        if (displayData.length > 0) {
            const xValues = displayData.map(d => d.x);
            const yValues = displayData.map(d => d.y);
            
            trajectoryChart.options.scales.x.min = Math.min(...xValues) - 50;
            trajectoryChart.options.scales.x.max = Math.max(...xValues) + 50;
            trajectoryChart.options.scales.y.min = Math.min(...yValues) - 50;
            trajectoryChart.options.scales.y.max = Math.max(...yValues) + 50;
        }
        
        trajectoryChart.update('none');
    }
    
    /**
     * 更新时间戳显示
     */
    function updateTimestampDisplay(timestamp) {
        const timeElement = document.getElementById('data-timestamp');
        if (!timeElement) return;
        
        const date = new Date(timestamp);
        const formattedTime = date.toLocaleTimeString();
        timeElement.textContent = `最后更新: ${formattedTime}`;
    }
    
    /**
     * 清空显示数据（仅清除显示，不停止自动刷新）
     */
    function clearDisplay() {
        console.log('清空显示数据（自动刷新继续）');
        
        // 清除图表显示数据
        if (trajectoryChart) {
            trajectoryChart.data.datasets[0].data = [];
            trajectoryChart.update('none');
        }
        
        // 清除共享数据键（不影响主测试页面数据采集）
        try {
            localStorage.removeItem(DISPLAY_CONFIG.sharedDataKey);
        } catch (error) {
            console.warn('清除共享数据失败:', error);
        }
        
        // 更新无数据消息显示

        updateNoDataMessage();
        
        console.log('显示数据已清空，自动刷新继续工作');
    }
    
    /**
     * 停止刷新
     */
    function stopRefresh() {
        if (refreshTimer) {
            clearInterval(refreshTimer);
            refreshTimer = null;
        }
    }
    
    // 导出公共API
    window.TrajectoryDisplay = {
        init: initTrajectoryDisplay,
        clear: clearDisplay,
        stop: stopRefresh,
        config: DISPLAY_CONFIG
    };
    
    // 自动初始化
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initTrajectoryDisplay);
    } else {
        initTrajectoryDisplay();
    }
})();