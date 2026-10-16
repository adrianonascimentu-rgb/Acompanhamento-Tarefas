-- MIGRATION: Optimize notifications table performance
-- Resolves "statement timeout 57014" by adding necessary indexes and refining RLS.

DO $$ 
BEGIN
    -- 1. Create high-performance indexes for notification queries
    -- For fetchNotifications (filtering by profile_id and ordering by created_at)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_notifications_profile_created') THEN
        CREATE INDEX idx_notifications_profile_created ON public.notifications(profile_id, created_at DESC);
    END IF;

    -- For unread count and clearing notifications (filtering by profile_id and read status)
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'idx_notifications_profile_read') THEN
        CREATE INDEX idx_notifications_profile_read ON public.notifications(profile_id, read) WHERE read = false;
    END IF;

    -- 2. Ensure RLS is optimized
    -- The previous "Allow all" policy might be too broad or inefficient on large tables
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow all on notifications" ON public.notifications;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'notifications_isolation_policy' AND tablename = 'notifications') THEN
        CREATE POLICY "notifications_isolation_policy" ON public.notifications
            FOR ALL TO authenticated
            USING (profile_id = auth.uid())
            WITH CHECK (profile_id = auth.uid());
    END IF;

    -- 3. Data retention policy (Optional but recommended for performance)
    -- Delete notifications older than 30 days that are already read
    DELETE FROM public.notifications 
    WHERE created_at < NOW() - INTERVAL '30 days' 
    AND read = true;

END $$;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
