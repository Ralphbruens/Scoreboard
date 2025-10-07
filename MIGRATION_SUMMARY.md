# Migration Summary - Simplified Scoreboard System

## ✅ What Has Been Changed

### Files Modified:
1. **script.js** - Completely rewritten with simplified logic
2. **index.html** - Updated to new 3-page structure (Check-in, Recording, Scoreboard)
3. **config.js** - Simplified (removed room code generation)
4. **styles.css** - Updated with new component styles

### Files Created:
1. **SUPABASE_SETUP_NEW.md** - Complete instructions for database setup

---

## 🔄 System Changes Overview

### OLD SYSTEM (Before):
- ❌ Room-based system with room codes
- ❌ Multiple rooms/sessions
- ❌ 5 fixed player slots (Fields 1-5)
- ❌ Complex session management
- ❌ Two database tables: `sessions` and `leaderboards`

### NEW SYSTEM (After):
- ✅ Single website, no room codes
- ✅ Unlimited players (check-in one at a time)
- ✅ Simple flow: Check-in → Record → View Scores
- ✅ One database table: `players`
- ✅ Auto-refreshing scoreboard (every 2000ms)

---

## 🗄️ Database Changes Required in Supabase

### Step 1: Delete Old Tables

Go to **Supabase Dashboard → SQL Editor** and run:

```sql
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS leaderboards CASCADE;
DROP TABLE IF EXISTS players CASCADE;
```

### Step 2: Create New Table

```sql
CREATE TABLE players (
    id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    checkin_time TIMESTAMP WITH TIME ZONE NOT NULL,
    bonus_score INTEGER DEFAULT 0,
    bruto_score BIGINT,
    netto_score BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on players" ON players
    FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_players_checkin_time ON players(checkin_time DESC);
CREATE INDEX idx_players_netto_score ON players(netto_score ASC NULLS LAST);
CREATE INDEX idx_players_bruto_score_null ON players(bruto_score) WHERE bruto_score IS NULL;
```

---

## 📱 How to Use the New System

### 1. Check-in Page
- Enter player name
- Set bonus score (optional, defaults to 0 seconds)
- Click "Check In Player"
- Player is saved to database with NULL scores

### 2. Recording Page
- **Automatically loads** the newest player who hasn't been recorded yet
- Click "Start Recording" to begin timer
- Click "Stop Recording" when player finishes
- Click "📊 Push Score to Database" to save the score
- Page automatically loads the next waiting player

### 3. Scoreboard Page
- Shows all players with completed scores
- Sorted by netto score (best time first)
- **Auto-refreshes every 2 seconds** - no manual refresh needed!
- Top 3 get special podium styling (gold, silver, bronze)

---

## 🔍 Key Features

### Auto-Refresh Scoreboard
The scoreboard page polls the database every 2000ms (2 seconds) to check for new scores. This means:
- Multiple people can record scores simultaneously
- Everyone sees updates in real-time
- No need to manually refresh

### Smart Player Loading
The recording page automatically fetches:
```sql
SELECT * FROM players 
WHERE bruto_score IS NULL 
ORDER BY checkin_time DESC 
LIMIT 1
```
This gets the most recently checked-in player who hasn't been recorded yet.

### Bonus Score Calculation
- **Bruto Score**: Raw time in milliseconds
- **Netto Score**: bruto_score + (bonus_score × 1000)
- Example: If bruto is 65,000ms (1:05) and bonus is 5s, netto is 70,000ms (1:10)

---

## 🚀 Testing the System

1. **Check Connection**: Open the app, header should show "Connected" with green indicator
2. **Test Check-in**: 
   - Go to Check-in tab
   - Enter "Test Player 1", bonus 5
   - Click Check In
   - Should see success message
3. **Test Recording**:
   - Go to Recording tab
   - Should see "Test Player 1" loaded
   - Start recording, wait 5 seconds, stop
   - Click "Push Score to Database"
4. **Test Scoreboard**:
   - Go to Scoreboard tab
   - Should see Test Player 1 with their score
   - Check-in another player and the scoreboard should auto-update

---

## 📊 Verifying in Supabase Dashboard

1. Go to **Table Editor → players**
2. You should see your test players with all data:
   - player_name
   - checkin_time
   - bonus_score
   - bruto_score (in milliseconds)
   - netto_score (in milliseconds)
   - created_at

---

## ⚠️ Important Notes

1. **No Authentication**: Current setup allows public access (suitable for local/private use)
2. **Data Persistence**: All data stays in database until manually deleted
3. **Unlimited Players**: No limit on check-ins (unlike old 5-slot system)
4. **One at a Time**: Recording page shows one player at a time (newest unrecorded)

---

## 🛠️ Troubleshooting

### "Database not available"
- Check `config.js` has correct Supabase URL and anon key
- Verify Supabase project is active

### "No players waiting to record"
- Make sure you checked in a player first
- Verify player exists in Supabase Table Editor
- Check that player's `bruto_score` is NULL

### Scores not showing on Scoreboard
- Ensure you clicked "Push Score to Database"
- Check browser console for errors
- Verify scores are not NULL in Supabase

---

## 📋 Quick Reference

### Database Table: `players`
| Column       | Type      | Description                           |
|--------------|-----------|---------------------------------------|
| id           | SERIAL    | Auto-increment primary key            |
| player_name  | TEXT      | Name of player                        |
| checkin_time | TIMESTAMP | When player was checked in            |
| bonus_score  | INTEGER   | Bonus penalty in seconds              |
| bruto_score  | BIGINT    | Raw time in milliseconds (nullable)   |
| netto_score  | BIGINT    | Final score in milliseconds (nullable)|
| created_at   | TIMESTAMP | Record creation time                  |

### Key SQL Queries
```sql
-- Check-in player
INSERT INTO players (player_name, checkin_time, bonus_score)
VALUES ('John Doe', NOW(), 5);

-- Get newest unrecorded player
SELECT * FROM players WHERE bruto_score IS NULL 
ORDER BY checkin_time DESC LIMIT 1;

-- Update player score
UPDATE players SET bruto_score = 65000, netto_score = 70000 
WHERE id = 1;

-- Get scoreboard (all completed)
SELECT * FROM players WHERE netto_score IS NOT NULL 
ORDER BY netto_score ASC;
```

---

## ✨ Summary

The system is now **much simpler**:
- ✅ No room codes to manage
- ✅ One table instead of multiple
- ✅ Linear workflow: check-in → record → view
- ✅ Auto-refreshing scoreboard
- ✅ Unlimited players

Your scoreboard app is ready to use! 🎉
