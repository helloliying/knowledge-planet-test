-- Supabase 轨迹数据表设置
-- 在 Supabase SQL 编辑器中运行此脚本

-- 创建轨迹点表
CREATE TABLE IF NOT EXISTS trajectory_points (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    page_url TEXT NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- 'mousemove', 'mousedown', 'scroll'
    x INTEGER,
    y INTEGER,
    page_x INTEGER,
    page_y INTEGER,
    screen_x INTEGER,
    screen_y INTEGER,
    button INTEGER,
    scroll_x INTEGER,
    scroll_y INTEGER,
    user_agent TEXT,
    screen_width INTEGER,
    screen_height INTEGER,
    color_depth INTEGER,
    timezone VARCHAR(100),
    language VARCHAR(50),
    timestamp BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_trajectory_user_id ON trajectory_points(user_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_device_id ON trajectory_points(device_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_timestamp ON trajectory_points(timestamp);
CREATE INDEX IF NOT EXISTS idx_trajectory_created_at ON trajectory_points(created_at);

-- 创建统计视图
CREATE OR REPLACE VIEW trajectory_stats AS
SELECT 
    user_id,
    device_id,
    COUNT(*) as total_points,
    COUNT(CASE WHEN event_type = 'mousemove' THEN 1 END) as move_points,
    COUNT(CASE WHEN event_type = 'mousedown' THEN 1 END) as click_points,
    MIN(timestamp) as first_seen,
    MAX(timestamp) as last_seen,
    MAX(created_at) as last_updated
FROM trajectory_points
GROUP BY user_id, device_id;

-- 创建最近活动视图
CREATE OR REPLACE VIEW recent_activity AS
SELECT 
    user_id,
    device_id,
    page_url,
    event_type,
    COUNT(*) as event_count,
    MAX(timestamp) as last_event_time
FROM trajectory_points
WHERE timestamp > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
GROUP BY user_id, device_id, page_url, event_type;

-- 启用行级安全 (RLS)
ALTER TABLE trajectory_points ENABLE ROW LEVEL SECURITY;

-- 创建插入策略（允许任何人插入数据）
CREATE POLICY "允许插入轨迹数据" ON trajectory_points
    FOR INSERT WITH CHECK (true);

-- 创建读取策略（允许任何人读取数据）
CREATE POLICY "允许读取轨迹数据" ON trajectory_points
    FOR SELECT USING (true);

-- 创建删除策略（仅允许删除自己的数据）
CREATE POLICY "允许删除自己的数据" ON trajectory_points
    FOR DELETE USING (user_id = current_setting('app.user_id', true));

-- 创建函数：获取用户轨迹数据
CREATE OR REPLACE FUNCTION get_user_trajectory(
    p_user_id VARCHAR DEFAULT NULL,
    p_limit INTEGER DEFAULT 1000
)
RETURNS TABLE (
    id BIGINT,
    user_id VARCHAR,
    device_id VARCHAR,
    page_url TEXT,
    event_type VARCHAR,
    x INTEGER,
    y INTEGER,
    timestamp BIGINT,
    created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    IF p_user_id IS NULL THEN
        RETURN QUERY
        SELECT 
            tp.id,
            tp.user_id,
            tp.device_id,
            tp.page_url,
            tp.event_type,
            tp.x,
            tp.y,
            tp.timestamp,
            tp.created_at
        FROM trajectory_points tp
        ORDER BY tp.timestamp DESC
        LIMIT p_limit;
    ELSE
        RETURN QUERY
        SELECT 
            tp.id,
            tp.user_id,
            tp.device_id,
            tp.page_url,
            tp.event_type,
            tp.x,
            tp.y,
            tp.timestamp,
            tp.created_at
        FROM trajectory_points tp
        WHERE tp.user_id = p_user_id
        ORDER BY tp.timestamp DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 创建函数：清理旧数据（保留30天）
CREATE OR REPLACE FUNCTION cleanup_old_trajectory_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM trajectory_points
    WHERE timestamp < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- 创建定时任务（每天清理一次）
-- 注意：Supabase 需要配置 pg_cron 扩展
-- 在 Supabase 中启用 pg_cron 扩展后运行：
-- SELECT cron.schedule('cleanup-old-trajectory-data', '0 0 * * *', 'SELECT cleanup_old_trajectory_data();');

-- 测试数据插入
INSERT INTO trajectory_points (
    user_id, device_id, page_url, event_type, x, y, timestamp, user_agent
) VALUES (
    'test_user_1', 'test_device_1', 'https://example.com', 'mousemove', 100, 200, EXTRACT(EPOCH FROM NOW()) * 1000, 'Test Browser'
) ON CONFLICT DO NOTHING;

-- 查看表结构
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'trajectory_points'
ORDER BY ordinal_position;