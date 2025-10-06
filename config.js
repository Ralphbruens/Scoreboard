// Supabase Configuration
// Replace these with your actual Supabase project credentials
const SUPABASE_CONFIG = {
    url: 'https://qtfrpegymruflklektyj.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF0ZnJwZWd5bXJ1ZmxrbGVrdHlqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NjI2NDMsImV4cCI6MjA3NTMzODY0M30.rPhFkX4Vr92IWIzNn2kJv8HWSjRjkSRyuL2Zz2TuspI'
};

// Session Configuration
const SESSION_CONFIG = {
    sessionId: null, // Will be generated automatically
    roomCode: null   // Will be generated automatically or loaded from URL
};

// Generate a unique session ID
function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Generate a room code for easy sharing
function generateRoomCode() {
    return Math.random().toString(36).substr(2, 6).toUpperCase();
}

// Get room code from URL parameters
function getRoomCodeFromURL() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room');
}

// Set room code in URL
function setRoomCodeInURL(roomCode) {
    const url = new URL(window.location);
    url.searchParams.set('room', roomCode);
    window.history.replaceState({}, '', url);
}

// Initialize session
function initializeSession() {
    // Check if room code is provided in URL
    const urlRoomCode = getRoomCodeFromURL();
    
    if (urlRoomCode) {
        // Join existing room
        SESSION_CONFIG.roomCode = urlRoomCode;
        SESSION_CONFIG.sessionId = 'session_' + urlRoomCode;
    } else {
        // Create new room
        SESSION_CONFIG.roomCode = generateRoomCode();
        SESSION_CONFIG.sessionId = generateSessionId();
        // Update URL with the new room code
        setRoomCodeInURL(SESSION_CONFIG.roomCode);
    }
}

// Initialize session when script loads
initializeSession();
