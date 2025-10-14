# Timer Sync Setup for Cross-Device Synchronization

## Database Setup Required

To enable the clock to sync across different devices (e.g., tablet controls the timer, PC displays the clock), you need to create a timer sync table in Supabase.

### Step 1: Create Timer Sync Table

Go to your **Supabase Dashboard → SQL Editor** and run this SQL:

```sql
-- Create timer_sync table for cross-device timer synchronization
CREATE TABLE timer_sync (
    id INTEGER PRIMARY KEY DEFAULT 1,
    timer_state TEXT NOT NULL DEFAULT 'stopped',
    start_time BIGINT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert the initial row (only one row allowed)
INSERT INTO timer_sync (id, timer_state, start_time) 
VALUES (1, 'stopped', NULL);

-- Enable Row Level Security
ALTER TABLE timer_sync ENABLE ROW LEVEL SECURITY;

-- Create policy for public access
CREATE POLICY "Allow all operations on timer_sync" ON timer_sync
    FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE timer_sync;
```

### Step 2: Enable Realtime (If Not Already Enabled)

1. Go to **Supabase Dashboard → Database → Replication**
2. Find `timer_sync` table
3. Toggle the switch to **ON** for Realtime

### Step 3: Test the Setup

1. Open the main app on one device (tablet)
2. Open `clock.html` on another device (PC)
3. Press "Start All Players" on the tablet
4. The clock on the PC should start immediately!

## How It Works

- When you press "Start" on any device, it updates the `timer_sync` table in Supabase
- All other devices subscribed to that table receive the update instantly via Supabase Realtime
- The clock page automatically starts/stops based on the database changes

## Troubleshooting

### Clock not starting on other device
- Check browser console for errors
- Verify Realtime is enabled in Supabase (Database → Replication)
- Make sure both devices are connected to the internet

### "Failed to sync timer" error
- Check Supabase credentials in `config.js`
- Verify the `timer_sync` table exists
- Check RLS policies allow public access

