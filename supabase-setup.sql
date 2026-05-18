-- Supabase setup for cross-device trajectory tracking
-- Run this in Supabase SQL Editor.

CREATE TABLE IF NOT EXISTS public.trajectory_points (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    device_id VARCHAR(100) NOT NULL,
    page_url TEXT NOT NULL,
    event_type VARCHAR(20) NOT NULL, -- mousemove, mousedown, scroll
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
    "timestamp" BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trajectory_user_id ON public.trajectory_points(user_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_device_id ON public.trajectory_points(device_id);
CREATE INDEX IF NOT EXISTS idx_trajectory_timestamp ON public.trajectory_points("timestamp");
CREATE INDEX IF NOT EXISTS idx_trajectory_created_at ON public.trajectory_points(created_at);

CREATE OR REPLACE VIEW public.trajectory_stats AS
SELECT
    user_id,
    device_id,
    COUNT(*) AS total_points,
    COUNT(CASE WHEN event_type = 'mousemove' THEN 1 END) AS move_points,
    COUNT(CASE WHEN event_type = 'mousedown' THEN 1 END) AS click_points,
    MIN("timestamp") AS first_seen,
    MAX("timestamp") AS last_seen,
    MAX(created_at) AS last_updated
FROM public.trajectory_points
GROUP BY user_id, device_id;

CREATE OR REPLACE VIEW public.recent_activity AS
SELECT
    user_id,
    device_id,
    page_url,
    event_type,
    COUNT(*) AS event_count,
    MAX("timestamp") AS last_event_time
FROM public.trajectory_points
WHERE "timestamp" > EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') * 1000
GROUP BY user_id, device_id, page_url, event_type;

ALTER TABLE public.trajectory_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_insert_trajectory_points" ON public.trajectory_points;
DROP POLICY IF EXISTS "allow_select_trajectory_points" ON public.trajectory_points;
DROP POLICY IF EXISTS "allow_delete_own_trajectory_points" ON public.trajectory_points;

CREATE POLICY "allow_insert_trajectory_points" ON public.trajectory_points
    FOR INSERT
    WITH CHECK (true);

CREATE POLICY "allow_select_trajectory_points" ON public.trajectory_points
    FOR SELECT
    USING (true);

CREATE POLICY "allow_delete_own_trajectory_points" ON public.trajectory_points
    FOR DELETE
    USING (user_id = current_setting('app.user_id', true));

CREATE OR REPLACE FUNCTION public.get_user_trajectory(
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
    event_ts BIGINT,
    created_at TIMESTAMPTZ
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
            tp."timestamp" AS event_ts,
            tp.created_at
        FROM public.trajectory_points tp
        ORDER BY tp."timestamp" DESC
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
            tp."timestamp" AS event_ts,
            tp.created_at
        FROM public.trajectory_points tp
        WHERE tp.user_id = p_user_id
        ORDER BY tp."timestamp" DESC
        LIMIT p_limit;
    END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.cleanup_old_trajectory_data()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.trajectory_points
    WHERE "timestamp" < EXTRACT(EPOCH FROM NOW() - INTERVAL '30 days') * 1000;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
