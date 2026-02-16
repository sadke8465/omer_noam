-- Create table to track scheduled OneSignal notification IDs
-- This allows us to cancel notifications when tasks are updated/deleted

CREATE TABLE IF NOT EXISTS task_notifications (
  id SERIAL PRIMARY KEY,
  task_id INTEGER REFERENCES tasks(id) ON DELETE CASCADE,
  notification_id TEXT NOT NULL,
  tag TEXT NOT NULL, -- 'evening-before', 'morning-of', 'evening-of'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups by task_id
CREATE INDEX IF NOT EXISTS idx_task_notifications_task_id ON task_notifications(task_id);

-- Enable RLS
ALTER TABLE task_notifications ENABLE ROW LEVEL SECURITY;

-- Allow all access (same as tasks table — personal app)
CREATE POLICY "Allow all access to task_notifications"
  ON task_notifications FOR ALL
  USING (true) WITH CHECK (true);
