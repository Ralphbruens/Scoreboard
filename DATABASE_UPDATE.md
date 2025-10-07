# Database Update - Add Field Number Column

## What Changed
We added a `field_number` column to track which field (1-5) each player was assigned to during check-in.

## Database Migration Required

Go to **Supabase Dashboard → SQL Editor** and run this SQL:

```sql
-- Add field_number column to players table
ALTER TABLE players 
ADD COLUMN field_number INTEGER;

-- Set default field_number for existing records (optional)
-- This updates old records to have a field number based on their ID
UPDATE players 
SET field_number = ((id - 1) % 5) + 1 
WHERE field_number IS NULL;
```

## What This Does

### Before:
- Check in Alice at Field 1, Bob at Field 3
- Recording screen shows: "Field 1: Alice", "Field 2: Bob" ❌

### After:
- Check in Alice at Field 1, Bob at Field 3
- Recording screen shows: "Field 1: Alice", "Field 3: Bob" ✅

## How It Works

1. **Check-in**: When you fill in a player slot (Field 1-5), the field number is stored
2. **Recording**: The actual field number is displayed on each player card
3. **Database**: New column stores which field (1-5) the player was assigned to

## Testing

1. Go to Supabase and run the SQL above
2. In your app, check in 3 players:
   - Field 1: "Alice"
   - Field 3: "Bob" (skip Field 2)
   - Field 5: "Charlie" (skip Field 4)
3. Go to Recording page and click "Load Waiting Players"
4. You should see:
   - **Field 1**: Alice
   - **Field 3**: Bob
   - **Field 5**: Charlie

Perfect! The field numbers now match their original assignments! 🎯
