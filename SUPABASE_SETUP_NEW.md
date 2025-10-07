# Supabase Setup Instructions - Simplified Version

## ⚠️ IMPORTANT: Database Migration Required

This is a **complete redesign** of the backend. You need to create a new table structure.

## Changes Summary

### What's Different:
- ❌ **REMOVED**: Room codes system
- ❌ **REMOVED**: Sessions table
- ❌ **REMOVED**: Leaderboards table (merged into players table)
- ✅ **NEW**: Single `players` table with all data
- ✅ **SIMPLIFIED**: One website, no multiple rooms

---

## Step 1: Delete Old Tables (If They Exist)

Go to your Supabase Dashboard → SQL Editor → New Query, and run:

```sql
-- Drop old tables if they exist
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS leaderboards CASCADE;
DROP TABLE IF EXISTS players CASCADE;
```

---

## Step 2: Create New Players Table

Run this SQL in Supabase SQL Editor:

```sql
-- Create the new simplified players table
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    field_number INTEGER,
    checkin_time TIMESTAMP WITH TIME ZONE NOT NULL,
    bonus_score INTEGER DEFAULT 0,
    bruto_score BIGINT,
    netto_score BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Create policy for public access (suitable for this app)
CREATE POLICY "Allow all operations on players" ON players
    FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_players_checkin_time ON players(checkin_time DESC);
CREATE INDEX idx_players_netto_score ON players(netto_score ASC NULLS LAST);
CREATE INDEX idx_players_bruto_score_null ON players(bruto_score) WHERE bruto_score IS NULL;
```

---

## Step 3: Verify Table Structure

In Supabase Dashboard → Table Editor → `players` table should have these columns:

| Column Name    | Type                        | Nullable | Default |
|----------------|----------------------------|----------|---------|
| id             | integer (PRIMARY KEY)      | No       | Auto    |
| player_name    | text                       | No       | -       |
| field_number   | integer                    | Yes      | NULL    |
| checkin_time   | timestamp with time zone   | No       | -       |
| bonus_score    | integer                    | Yes      | 0       |
| bruto_score    | bigint                     | Yes      | NULL    |
| netto_score    | bigint                     | Yes      | NULL    |
| created_at     | timestamp with time zone   | Yes      | NOW()   |

---

## Step 4: Test the Connection

1. **Open your app** in a web browser
2. **Check the header**: You should see "Connected" with green indicator
3. **Test the flow**:
   - Go to Check-in tab
   - Enter a player name (e.g., "John Doe")
   - Set bonus score (e.g., 5 seconds)
   - Click "Check In Player"
   - Go to Recording tab
   - You should see the player you just checked in
   - Click "Start Recording"
   - Wait a few seconds, then "Stop Recording"
   - Click "Push Score to Database"
   - Go to Scoreboard tab
   - You should see the score appear (and auto-refresh every 2 seconds)

---

## How the New System Works

### 1. Check-in Page
- User enters player name and optional bonus score
- Click "Check In Player"
- Player record is created in database with:
  - `player_name`: The name entered
  - `checkin_time`: Current timestamp
  - `bonus_score`: The bonus score entered
  - `bruto_score`: NULL (not recorded yet)
  - `netto_score`: NULL (not recorded yet)

### 2. Recording Page
- **Automatically fetches** the newest player where `bruto_score IS NULL`
- This means it gets the most recently checked-in player who hasn't been recorded yet
- User clicks "Start Recording" to begin timer
- User clicks "Stop Recording" when player finishes
- Scores are calculated:
  - `bruto_score`: Raw time in milliseconds
  - `netto_score`: bruto_score + (bonus_score × 1000)
- User clicks "Push Score to Database" to update the player record

### 3. Scoreboard Page
- Shows all players where `netto_score IS NOT NULL` (i.e., players who have completed scores)
- Ordered by `netto_score` ascending (best time first)
- **Auto-refreshes every 2000ms** to check for new scores
- No manual refresh needed!

---

## Database Queries Used

### Check-in (Insert new player):
```sql
INSERT INTO players (player_name, checkin_time, bonus_score)
VALUES ('Player Name', NOW(), 5)
```

### Fetch newest player for recording:
```sql
SELECT * FROM players
WHERE bruto_score IS NULL
ORDER BY checkin_time DESC
LIMIT 1
```

### Update player with scores:
```sql
UPDATE players
SET bruto_score = 12345, netto_score = 17345
WHERE id = 1
```

### Fetch all scores for scoreboard:
```sql
SELECT * FROM players
WHERE netto_score IS NOT NULL
ORDER BY netto_score ASC
```

---

## Troubleshooting

### "Database not available"
- Check that your Supabase URL and anon key are correct in `config.js`
- Verify your Supabase project is running

### "No players waiting to record"
- Make sure you checked in a player first
- Check the Check-in page worked (green success message)
- Verify in Supabase Table Editor that the player exists

### Scores not appearing on Scoreboard
- Check that you clicked "Push Score to Database" after recording
- Verify the `bruto_score` and `netto_score` columns are not NULL in Supabase Table Editor
- Check browser console for errors

### Auto-refresh not working
- Make sure you're on the Scoreboard tab
- Check browser console - polling should log every 2 seconds
- Verify your internet connection

---

## Data Management

### Clearing Old Data

To clear all players and start fresh:

```sql
-- Delete all players
DELETE FROM players;

-- Or delete only players with scores (keep checked-in players)
DELETE FROM players WHERE netto_score IS NOT NULL;

-- Or delete players older than a specific date
DELETE FROM players WHERE checkin_time < '2025-01-01';
```

### Viewing Statistics

```sql
-- Count total players
SELECT COUNT(*) FROM players;

-- Count players waiting to record
SELECT COUNT(*) FROM players WHERE bruto_score IS NULL;

-- Count players with scores
SELECT COUNT(*) FROM players WHERE netto_score IS NOT NULL;

-- Average scores
SELECT 
    AVG(bruto_score) as avg_bruto,
    AVG(netto_score) as avg_netto,
    MIN(netto_score) as best_score,
    MAX(netto_score) as worst_score
FROM players 
WHERE netto_score IS NOT NULL;
```

---

## Security Considerations

The current setup allows **public access** to the players table. This is simple but not secure for production.

### For Production (Optional):

1. **Add Authentication** using Supabase Auth
2. **Update RLS Policies** to restrict access:

```sql
-- Remove public policy
DROP POLICY "Allow all operations on players" ON players;

-- Add authenticated-only policy
CREATE POLICY "Authenticated users can do everything" ON players
    FOR ALL 
    USING (auth.role() = 'authenticated')
    WITH CHECK (auth.role() = 'authenticated');
```

3. **Add user tracking**:

```sql
-- Add user_id column to track who created each record
ALTER TABLE players ADD COLUMN user_id UUID REFERENCES auth.users(id);
```

---

## Migration from Old System

If you have data in the old `leaderboards` table you want to keep:

```sql
-- Migrate old leaderboard data to new players table
INSERT INTO players (player_name, checkin_time, bonus_score, bruto_score, netto_score)
SELECT 
    player_name,
    created_at as checkin_time,
    bonus_score,
    bruto_time as bruto_score,
    netto_time as netto_score
FROM leaderboards;
```

---

## Summary of Changes in Supabase Dashboard

✅ **To Do in Supabase:**
1. Run SQL to drop old tables (if they exist)
2. Run SQL to create new `players` table
3. Verify RLS policies are enabled
4. Test by checking in a player from the app

❌ **No Longer Needed:**
- Room codes
- Sessions table
- Leaderboards table
- Multiple room management

---

Your simplified scoreboard app is now ready! 🎉
