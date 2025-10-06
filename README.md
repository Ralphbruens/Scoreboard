# Scoreboard App

A modern web application for managing player scores with stopwatch functionality. Perfect for timing-based competitions across multiple devices.

## Features

### 🎯 Player Management
- **5 Player Check-in**: Each player gets assigned to a field (1-5)
- **Customizable Bonus Scores**: Adjust bonus points per field
- **Duplicate Prevention**: No duplicate player names or field assignments

### ⏱️ Score Recording
- **Synchronized Start**: One button starts all players simultaneously
- **Individual Stopwatches**: Each player has their own stop button
- **Real-time Display**: Live timer updates for all players

### 📊 Results & Leaderboards
- **Automatic Calculations**: Netto score = Bruto time + Bonus score
- **Transparent Breakdown**: Shows calculation details for each player
- **Daily & Weekly Leaderboards**: Track high scores over time
- **Export Functionality**: Download results as JSON

### 📱 Multi-Device Support
- **Responsive Design**: Optimized for tablets, phones, and TVs
- **Separate Access**: Each screen can be accessed independently
- **Offline Capability**: Works without internet connection

## Quick Start

### Prerequisites
- Supabase account (free) for real-time synchronization
- Modern web browser
- Internet connection

### Local Development
1. **Clone or download the project files**
2. **Set up Supabase** (see SUPABASE_SETUP.md for detailed instructions):
   - Create a Supabase project
   - Run the provided SQL to create tables
   - Enable real-time replication
   - Copy your credentials to `config.js`
3. **Open `index.html` in a web browser**
4. **Or use a local server**:
   ```bash
   npm install
   npm run dev
   ```

### Multi-Device Setup
1. **Deploy to a hosting service** (Vercel, Netlify, GitHub Pages)
2. **Access from multiple devices** using the same URL
3. **Share the Room Code** displayed in the header
4. **Each device can access different screens**:
   - **Tablet 1**: Check-in screen for player registration
   - **Tablet 2**: Recording screen for timing
   - **TV/Display**: Results screen for live leaderboard

### Deployment Options

#### Option 1: Vercel (Recommended)
1. **Create GitHub Repository**:
   - Create a new repository on GitHub
   - Upload all project files
   - Make sure `package.json` and `vercel.json` are included

2. **Deploy to Vercel**:
   - Go to [vercel.com](https://vercel.com)
   - Sign up/login with GitHub
   - Click "New Project"
   - Import your GitHub repository
   - Deploy (automatic deployment)

3. **Custom Domain** (Optional):
   - In Vercel dashboard, go to Settings → Domains
   - Add your custom domain

#### Option 2: Netlify
1. **Prepare Files**:
   - Create `_redirects` file in root directory with content: `/* /index.html 200`

2. **Deploy**:
   - Go to [netlify.com](https://netlify.com)
   - Drag and drop your project folder
   - Or connect GitHub repository for automatic deployments

#### Option 3: GitHub Pages
1. **Setup Repository**:
   - Create GitHub repository
   - Upload all files
   - Go to Settings → Pages
   - Select "Deploy from a branch" → "main"
   - Your app will be available at `https://username.github.io/repository-name`

## Usage Guide

### Check-in Screen (Tablet 1)
1. Enter player names in the input fields
2. Adjust bonus scores if needed (default: +5s, +10s, +15s, +20s, +25s)
3. Click "Check In" for each player
4. Players are automatically assigned to fields 1-5

### Recording Screen (Tablet 2)
1. Verify all players are checked in
2. Click "Start All Players" to begin timing
3. Each player clicks "Stop" when finished
4. Results are automatically calculated when all players finish

### Results Screen (TV/Display)
1. View final rankings and scores
2. See daily and weekly leaderboards
3. Export results for record keeping
4. Start new session when ready

## Technical Details

### Data Storage
- **Supabase Database**: Real-time synchronization across devices
- **Local Storage**: Leaderboards and settings persist locally
- **Room-based Sessions**: Each session has a unique room code for easy sharing
- **Export Feature**: JSON export for backup and analysis

### Browser Compatibility
- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+

### Performance
- **Lightweight**: ~50KB total (HTML + CSS + JS)
- **Fast Loading**: Optimized assets and caching
- **Responsive**: Works on devices from 320px to 4K displays

## Customization

### Styling
- Edit `styles.css` to change colors, fonts, or layout
- CSS variables are used for easy theme customization
- Responsive breakpoints can be adjusted

### Functionality
- Modify `script.js` to change behavior
- Bonus score ranges can be adjusted
- Timer precision can be modified (currently 10ms)

### Fields
- Currently supports 5 players/fields
- Can be extended by modifying the arrays in the JavaScript

## Troubleshooting

### Common Issues
1. **Players not checking in**: Ensure names are unique and not empty
2. **Timers not working**: Check browser JavaScript is enabled
3. **Data not saving**: Verify browser allows localStorage
4. **Layout issues**: Clear browser cache and refresh

### Browser Console
- Open Developer Tools (F12) to see any error messages
- Check Console tab for debugging information

## Support

For issues or feature requests:
1. Check the browser console for errors
2. Verify all files are present and accessible
3. Test in different browsers
4. Clear browser cache and try again

## License

MIT License - feel free to modify and distribute as needed.
