# Supabase Setup Instructions

This guide will help you set up Supabase for real-time synchronization across multiple devices.

## Step 1: Create Supabase Account and Project

1. **Go to Supabase**: Visit [supabase.com](https://supabase.com)
2. **Sign Up/Login**: Create an account or sign in with GitHub
3. **Create New Project**:
   - Click "New Project"
   - Choose your organization
   - Enter project name: `scoreboard-app`
   - Set a secure database password
   - Choose a region close to your location
   - Click "Create new project"

## Step 2: Get Your Project Credentials

1. **Wait for Setup**: Project setup takes 1-2 minutes
2. **Go to Settings**: Click the gear icon (Settings) in the left sidebar
3. **API Settings**: Click on "API" in the settings menu
4. **Copy Credentials**:
   - Copy the **Project URL** (starts with `https://`)
   - Copy the **anon public** key (starts with `eyJ`)

## Step 3: Create Database Table

1. **Go to SQL Editor**: Click "SQL Editor" in the left sidebar
2. **Create New Query**: Click "New query"
3. **Run This SQL**:

```sql
-- Create sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    room_code TEXT UNIQUE NOT NULL,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create leaderboards table
CREATE TABLE leaderboards (
    id SERIAL PRIMARY KEY,
    player_name TEXT NOT NULL,
    field_number INTEGER NOT NULL,
    bruto_time BIGINT NOT NULL,
    bonus_score INTEGER NOT NULL,
    netto_time BIGINT NOT NULL,
    session_date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE leaderboards ENABLE ROW LEVEL SECURITY;

-- Create policies for public access (suitable for this app)
CREATE POLICY "Allow all operations on sessions" ON sessions
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on leaderboards" ON leaderboards
    FOR ALL USING (true) WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX idx_sessions_room_code ON sessions(room_code);
CREATE INDEX idx_leaderboards_date ON leaderboards(session_date);
CREATE INDEX idx_leaderboards_netto_time ON leaderboards(netto_time);
```

4. **Run the Query**: Click "Run" to execute the SQL

## Step 4: Enable Real-time (Realtime)

1. **Go to Database**: Click "Database" in the left sidebar
2. **Replication**: Click on "Replication" tab
3. **Enable Realtime**: Toggle ON for the `sessions` table
4. **Save Changes**: Click "Save"

## Step 5: Configure Your App

1. **Open `config.js`** in your project
2. **Replace the placeholder values**:

```javascript
const SUPABASE_CONFIG = {
    url: 'https://your-project-id.supabase.co',  // Your Project URL
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // Your anon key
};
```

**Example:**
```javascript
const SUPABASE_CONFIG = {
    url: 'https://abcdefghijklmnop.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTY5ODc2ODAwMCwiZXhwIjoyMDE0MzQ0MDAwfQ.example'
};
```

## Step 6: Test the Connection

1. **Open your app** in a web browser
2. **Check the header**: You should see:
   - Room code displayed (e.g., "ABC123")
   - Connection status showing "Connected" with green indicator
3. **Open the same URL on another device**: Both devices should show the same room code
4. **Test check-in**: Check in a player on one device, it should appear on the other

## Troubleshooting

### Connection Issues
- **"Offline Mode"**: Check your Supabase URL and anon key
- **"Connection Error"**: Verify your Supabase project is active
- **CORS Errors**: Supabase handles CORS automatically, but check browser console

### Real-time Not Working
- **Check Realtime is enabled**: Go to Database → Replication → Sessions table should be ON
- **Browser console errors**: Check for JavaScript errors
- **Network issues**: Try refreshing the page

### Data Not Syncing
- **Check RLS policies**: Make sure the policies allow public access
- **Database permissions**: Verify the anon key has proper permissions
- **Table structure**: Ensure the `sessions` table was created correctly

## Security Considerations

This setup uses public access for simplicity. For production use, consider:

1. **Implement authentication** if needed
2. **Add proper RLS policies** based on user roles
3. **Use environment variables** instead of hardcoded keys
4. **Set up proper backup strategies**

## Database Schema

### Sessions Table
- `id`: Unique session identifier
- `room_code`: Human-readable room code (6 characters)
- `data`: JSON object containing all session data
- `created_at`: Timestamp when session was created
- `updated_at`: Timestamp when session was last updated

### Leaderboards Table
- `id`: Auto-incrementing primary key
- `player_name`: Name of the player
- `field_number`: Field number (1-5)
- `bruto_time`: Raw time in milliseconds
- `bonus_score`: Bonus score in seconds
- `netto_time`: Final calculated time in milliseconds
- `session_date`: Date of the session
- `created_at`: Timestamp when record was created

## Next Steps

1. **Deploy your app** using Vercel, Netlify, or GitHub Pages
2. **Test on multiple devices** to ensure real-time sync works
3. **Monitor usage** in Supabase dashboard
4. **Set up backups** if needed for important data

Your scoreboard app is now ready for multi-device real-time synchronization!
