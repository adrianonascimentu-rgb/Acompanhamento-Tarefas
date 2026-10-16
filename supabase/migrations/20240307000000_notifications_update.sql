-- Migration to add task_id and event_key to notifications
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES tasks(id) ON DELETE CASCADE;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS event_key TEXT;

-- Add index for faster duplicate checking
CREATE INDEX IF NOT EXISTS idx_notifications_task_event ON notifications(task_id, event_key, profile_id);
