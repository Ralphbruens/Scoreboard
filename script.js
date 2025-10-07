// Global state management with Supabase integration
class ScoreboardApp {
    constructor() {
        this.players = Array(5).fill(null);
        this.bonusScores = [5, 10, 15, 20, 25]; // Default bonus scores for fields 1-5
        this.timers = Array(5).fill(null);
        this.startTimes = Array(5).fill(null);
        this.brutoScores = Array(5).fill(null);
        this.isRecording = false;
        this.globalStartTime = null;
        this.globalTimer = null;
        this.sessionResults = [];
        this.todayLeaderboard = [];
        this.weeklyLeaderboard = [];
        
        // Supabase integration
        this.supabase = null;
        this.sessionData = {
            id: SESSION_CONFIG.sessionId,
            roomCode: SESSION_CONFIG.roomCode,
            players: Array(5).fill(null),
            bonusScores: [5, 10, 15, 20, 25],
            isRecording: false,
            recordingStartTime: null,
            brutoScores: Array(5).fill(null),
            sessionResults: [],
            lastUpdated: Date.now()
        };
        
        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.loadLeaderboards();
        this.updateBonusDisplay();
        await this.initializeSupabase();
        this.displayRoomCode();
        this.setupRealtimeSubscription();
    }

    async initializeSupabase() {
        try {
            // Check if Supabase is configured
            if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
                console.warn('Supabase not configured. Running in offline mode.');
                this.updateConnectionStatus('offline', 'Offline Mode');
                return;
            }

            this.supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            
            // Simple connection test - just try to create the client
            console.log('Supabase client created successfully');
            this.updateConnectionStatus('online', 'Connected');
            
            // Load or create session
            await this.loadOrCreateSession();
            
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            this.updateConnectionStatus('offline', 'Offline Mode');
        }
    }

    updateConnectionStatus(status, text) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        statusIndicator.className = `status-indicator ${status}`;
        statusText.textContent = text;
    }

    displayRoomCode() {
        document.getElementById('room-code').textContent = this.sessionData.roomCode;
    }

    async loadOrCreateSession() {
        if (!this.supabase) {
            console.log('Supabase not available, using local session only');
            return;
        }
    
        try {
            console.log('Loading session for room:', this.sessionData.roomCode);
            
            // Try to load existing session by room code
            const { data, error } = await this.supabase
                .from('sessions')
                .select('*')
                .eq('room_code', this.sessionData.roomCode)
                .single();
    
            if (error) {
                if (error.code === 'PGRST116') {
                    // No rows returned - this is normal for new rooms
                    console.log('No existing session found, creating new one');
                    await this.saveSessionData();
                } else {
                    console.error('Database error loading session:', error);
                    // Continue with local session only
                    return;
                }
            } else if (data) {
                console.log('Found existing session, loading data');
                // Load existing session data
                this.sessionData = { ...data.data };
                this.sessionData.id = data.id; // Keep the database ID
                this.players = [...this.sessionData.players];
                this.bonusScores = [...this.sessionData.bonusScores];
                this.isRecording = this.sessionData.isRecording;
                this.brutoScores = [...this.sessionData.brutoScores];
                this.sessionResults = [...this.sessionData.sessionResults];
                
                // Update UI based on loaded data
                this.updateUIFromSessionData();
            }
        } catch (error) {
            console.error('Error in loadOrCreateSession:', error);
            // Continue with local session only
        }
    }

    async saveSessionData() {
        if (!this.supabase) {
            console.log('Supabase not available, cannot save session data');
            return;
        }

        try {
            // Update the lastUpdated timestamp
            this.sessionData.lastUpdated = Date.now();
            
            const sessionRecord = {
                room_code: this.sessionData.roomCode,
                data: this.sessionData,
                updated_at: new Date().toISOString()
            };

            console.log('Saving session data for room:', this.sessionData.roomCode);
            
            // Use upsert with onConflict to update existing records
            const { data, error } = await this.supabase
                .from('sessions')
                .upsert(sessionRecord, { 
                    onConflict: 'room_code',
                    ignoreDuplicates: false 
                })
                .select();

            if (error) {
                console.error('Error saving session:', error);
                console.error('Error details:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
            } else {
                console.log('Session data saved successfully to database');
                // Store the database ID if this is the first save
                if (data && data.length > 0 && !this.sessionData.id) {
                    this.sessionData.id = data[0].id;
                    console.log('Stored database ID:', this.sessionData.id);
                }
            }
        } catch (error) {
            console.error('Error in saveSessionData:', error);
        }
    }

    setupRealtimeSubscription() {
        if (!this.supabase) {
            console.log('Supabase not available, skipping real-time subscription');
            return;
        }
    
        console.log('Setting up real-time subscription for room:', this.sessionData.roomCode);
    
        const channel = this.supabase
            .channel('sessions-' + this.sessionData.roomCode)
            .on('postgres_changes', 
                { 
                    event: '*', // Listen to all events (INSERT, UPDATE, DELETE)
                    schema: 'public', 
                    table: 'sessions',
                    filter: `room_code=eq.${this.sessionData.roomCode}`
                }, 
                (payload) => {
                    console.log('Real-time update received:', payload);
                    
                    // Check if this update is for our room
                    if (!payload.new || payload.new.room_code !== this.sessionData.roomCode) {
                        console.log('Update not for our room, ignoring');
                        return;
                    }
                    
                    const newSessionData = payload.new.data;
                    
                    // Don't update if this is our own change (prevent loops)
                    if (newSessionData.lastUpdated <= this.sessionData.lastUpdated) {
                        console.log('Update is older or same, ignoring');
                        return;
                    }
                    
                    console.log('Applying real-time update:', newSessionData);
                    
                    this.sessionData = newSessionData;
                    this.players = [...this.sessionData.players];
                    this.bonusScores = [...this.sessionData.bonusScores];
                    this.isRecording = this.sessionData.isRecording;
                    this.brutoScores = [...this.sessionData.brutoScores];
                    this.sessionResults = [...this.sessionData.sessionResults];
                    
                    this.updateUIFromSessionData();
                })
            .subscribe((status) => {
                console.log('Realtime subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('✅ Successfully subscribed to real-time updates');
                } else if (status === 'CHANNEL_ERROR') {
                    console.error('❌ Real-time subscription failed');
                }
            });

        // Also set up a polling fallback every 2 seconds
        this.pollingInterval = setInterval(async () => {
            await this.checkForUpdates();
        }, 2000);
    }

    async checkForUpdates() {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from('sessions')
                .select('*')
                .eq('room_code', this.sessionData.roomCode)
                .single();

            if (error) {
                console.log('Polling check failed:', error);
                return;
            }

            if (data && data.data.lastUpdated > this.sessionData.lastUpdated) {
                console.log('Polling found newer data, updating...');
                
                this.sessionData = data.data;
                this.players = [...this.sessionData.players];
                this.bonusScores = [...this.sessionData.bonusScores];
                this.isRecording = this.sessionData.isRecording;
                this.brutoScores = [...this.sessionData.brutoScores];
                this.sessionResults = [...this.sessionData.sessionResults];
                
                this.updateUIFromSessionData();
            }
        } catch (error) {
            console.error('Error in polling check:', error);
        }
    }

    updateUIFromSessionData() {
        // Update check-in screen
        this.updateCheckInScreen();
        
        // Update recording screen if currently recording
        if (this.isRecording && this.sessionData.recordingStartTime) {
            this.updateRecordingScreen();
        }
        
        // Update results screen if session is complete
        if (this.sessionResults.length > 0) {
            this.updateResultsScreen();
        }
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchScreen(e.target.dataset.page));
        });

        // Player check-in
        document.querySelectorAll('.player-input').forEach((input, index) => {
            input.addEventListener('input', (e) => this.handlePlayerInput(e, index));
        });

        document.querySelectorAll('.checkin-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.checkInPlayer(index));
        });

        // Bonus score settings
        document.querySelectorAll('.bonus-input').forEach((input, index) => {
            input.addEventListener('input', (e) => this.updateBonusScore(index, e.target.value));
        });

        // Recording controls
        document.getElementById('start-all-btn').addEventListener('click', () => this.startAllPlayers());
        document.querySelectorAll('.stop-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.stopPlayer(index));
        });

        // Action buttons
        document.getElementById('reset-session').addEventListener('click', () => this.resetSession());
        document.getElementById('export-results').addEventListener('click', () => this.exportResults());
    }

    switchScreen(screenName) {
        // Hide all screens
        document.querySelectorAll('.screen').forEach(screen => {
            screen.classList.remove('active');
        });

        // Show selected screen
        document.getElementById(`${screenName}-screen`).classList.add('active');

        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-page="${screenName}"]`).classList.add('active');

        // Update content based on screen
        if (screenName === 'recording') {
            this.updateRecordingScreen();
        } else if (screenName === 'results') {
            this.updateResultsScreen();
        }
    }

    handlePlayerInput(event, index) {
        const input = event.target;
        const checkinBtn = input.parentElement.querySelector('.checkin-btn');
        
        if (input.value.trim().length > 0) {
            checkinBtn.disabled = false;
        } else {
            checkinBtn.disabled = true;
        }
    }

    async checkInPlayer(index) {
        const input = document.querySelectorAll('.player-input')[index];
        const playerName = input.value.trim();
        
        if (!playerName) return;

        // Check if player name already exists
        if (this.players.some(p => p && p.name.toLowerCase() === playerName.toLowerCase())) {
            alert('Player name already exists!');
            return;
        }

        this.players[index] = {
            name: playerName,
            fieldNumber: index + 1,
            bonusScore: this.bonusScores[index]
        };

        // Update session data
        this.sessionData.players[index] = this.players[index];
        this.sessionData.lastUpdated = Date.now();
        
        // Save to database
        await this.saveSessionData();

        // Update UI
        this.updateCheckInScreen();
    }

    updateCheckInScreen() {
        this.players.forEach((player, index) => {
            const slot = document.querySelector(`[data-slot="${index}"]`);
            const input = slot.querySelector('.player-input');
            const checkinBtn = slot.querySelector('.checkin-btn');
            const status = slot.querySelector('.player-status');
            
            if (player) {
                slot.classList.add('occupied');
                input.value = player.name;
                input.disabled = true;
                checkinBtn.disabled = true;
                status.textContent = 'Checked In';
                status.classList.add('checked-in');
            } else {
                slot.classList.remove('occupied');
                input.value = '';
                input.disabled = false;
                checkinBtn.disabled = true;
                status.textContent = 'Available';
                status.classList.remove('checked-in');
            }
        });

        // Enable navigation to recording screen if players are checked in
        const hasPlayers = this.players.some(p => p !== null);
        if (hasPlayers) {
            document.querySelector('[data-page="recording"]').style.opacity = '1';
        }
    }

    updateBonusScore(fieldIndex, value) {
        this.bonusScores[fieldIndex] = parseInt(value) || 0;
        this.updateBonusDisplay();
        
        // Update existing player bonus scores
        if (this.players[fieldIndex]) {
            this.players[fieldIndex].bonusScore = this.bonusScores[fieldIndex];
        }
    }

    updateBonusDisplay() {
        document.querySelectorAll('.bonus-score').forEach((element, index) => {
            element.textContent = `+${this.bonusScores[index]}s`;
        });
    }

    updateRecordingScreen() {
        document.querySelectorAll('.player-recording').forEach((element, index) => {
            const player = this.players[index];
            if (player) {
                element.querySelector('.player-name').textContent = player.name;
                element.querySelector('.field-info').textContent = `Field ${player.fieldNumber} (+${player.bonusScore}s)`;
                element.style.display = 'block';
                
                // Update timer display
                const timerElement = element.querySelector('.timer');
                const stopBtn = element.querySelector('.stop-btn');
                
                if (this.isRecording && this.sessionData.recordingStartTime) {
                    // Calculate elapsed time
                    const elapsed = Date.now() - this.sessionData.recordingStartTime;
                    timerElement.textContent = this.formatTime(elapsed);
                    timerElement.classList.add('running');
                    stopBtn.disabled = false;
                    
                    // Start local timer if not already running
                    if (!this.timers[index]) {
                        this.timers[index] = setInterval(() => {
                            this.updatePlayerTimer(index);
                        }, 100);
                    }
                } else if (this.brutoScores[index] !== null) {
                    // Show final time
                    timerElement.textContent = this.formatTime(this.brutoScores[index]);
                    timerElement.classList.remove('running');
                    stopBtn.disabled = true;
                }
            } else {
                element.style.display = 'none';
            }
        });
        
        // Update global timer
        if (this.isRecording && this.sessionData.recordingStartTime) {
            const elapsed = Date.now() - this.sessionData.recordingStartTime;
            document.getElementById('global-timer').textContent = this.formatTime(elapsed);
            
            // Update start button
            const startBtn = document.getElementById('start-all-btn');
            startBtn.disabled = true;
            startBtn.textContent = 'Recording...';
        }
    }

    async startAllPlayers() {
        if (this.players.filter(p => p !== null).length === 0) {
            alert('Please check in at least one player first!');
            return;
        }

        this.isRecording = true;
        this.globalStartTime = Date.now();
        this.sessionData.isRecording = true;
        this.sessionData.recordingStartTime = this.globalStartTime;
        this.sessionData.lastUpdated = Date.now();
        
        // Save to database
        await this.saveSessionData();
        
        // Update UI
        document.getElementById('start-all-btn').disabled = true;
        document.getElementById('start-all-btn').textContent = 'Recording...';
        
        // Start global timer
        this.globalTimer = setInterval(() => {
            this.updateGlobalTimer();
        }, 100);

        // Start individual timers
        this.players.forEach((player, index) => {
            if (player) {
                this.startTimes[index] = this.globalStartTime;
                this.timers[index] = setInterval(() => {
                    this.updatePlayerTimer(index);
                }, 100);
                
                document.querySelectorAll('.stop-btn')[index].disabled = false;
                document.querySelectorAll('.timer')[index].classList.add('running');
            }
        });
    }

    updateGlobalTimer() {
        const elapsed = Date.now() - this.globalStartTime;
        const formatted = this.formatTime(elapsed);
        document.getElementById('global-timer').textContent = formatted;
    }

    updatePlayerTimer(index) {
        const elapsed = Date.now() - this.startTimes[index];
        const formatted = this.formatTime(elapsed);
        document.getElementById(`timer-${index}`).textContent = formatted;
    }

    async stopPlayer(index) {
        if (!this.isRecording || !this.startTimes[index]) return;

        const brutoTime = Date.now() - this.startTimes[index];
        this.brutoScores[index] = brutoTime;

        // Update session data
        this.sessionData.brutoScores[index] = brutoTime;
        this.sessionData.lastUpdated = Date.now();

        // Stop timer
        clearInterval(this.timers[index]);
        this.timers[index] = null;

        // Update UI
        document.querySelectorAll('.stop-btn')[index].disabled = true;
        document.querySelectorAll('.timer')[index].classList.remove('running');
        
        // Save to database
        await this.saveSessionData();
        
        // Check if all active players have finished
        const activePlayers = this.players.filter(p => p !== null);
        const finishedPlayers = this.brutoScores.filter(score => score !== null).length;
        
        if (finishedPlayers === activePlayers.length) {
            await this.finishSession();
        }
    }

    async finishSession() {
        this.isRecording = false;
        clearInterval(this.globalTimer);
        
        // Calculate results
        this.sessionResults = this.players.map((player, index) => {
            if (player && this.brutoScores[index] !== null) {
                return {
                    name: player.name,
                    fieldNumber: player.fieldNumber,
                    brutoTime: this.brutoScores[index],
                    bonusScore: player.bonusScore,
                    nettoTime: this.brutoScores[index] + player.bonusScore * 1000
                };
            }
            return null;
        }).filter(result => result !== null);

        // Sort by netto time (ascending - lower is better)
        this.sessionResults.sort((a, b) => a.nettoTime - b.nettoTime);

        // Update session data
        this.sessionData.isRecording = false;
        this.sessionData.sessionResults = this.sessionResults;
        this.sessionData.lastUpdated = Date.now();

        // Save to database
        await this.saveSessionData();

        // Update leaderboards
        this.updateLeaderboards();
        
        // Switch to results screen
        this.switchScreen('results');
    }

    updateLeaderboards() {
        // Add to today's leaderboard
        this.sessionResults.forEach(result => {
            this.todayLeaderboard.push({
                ...result,
                date: new Date().toISOString().split('T')[0],
                timestamp: Date.now()
            });
        });

        // Sort today's leaderboard
        this.todayLeaderboard.sort((a, b) => a.nettoTime - b.nettoTime);

        // Keep only top 10
        this.todayLeaderboard = this.todayLeaderboard.slice(0, 10);

        // Update weekly leaderboard (last 7 days)
        const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        this.weeklyLeaderboard = this.todayLeaderboard
            .filter(entry => entry.timestamp >= weekAgo)
            .sort((a, b) => a.nettoTime - b.nettoTime)
            .slice(0, 10);

        // Save to localStorage
        this.saveLeaderboards();
    }

    updateResultsScreen() {
        // Update current session results
        const currentResultsContainer = document.getElementById('current-results');
        currentResultsContainer.innerHTML = '';

        this.sessionResults.forEach((result, index) => {
            const resultCard = this.createResultCard(result, index + 1);
            currentResultsContainer.appendChild(resultCard);
        });

        // Update today's leaderboard
        this.updateLeaderboardDisplay('today-leaderboard', this.todayLeaderboard);

        // Update weekly leaderboard
        this.updateLeaderboardDisplay('weekly-leaderboard', this.weeklyLeaderboard);
    }

    createResultCard(result, rank) {
        const card = document.createElement('div');
        card.className = 'result-card';
        
        card.innerHTML = `
            <div class="result-header">
                <div class="result-player-name">${result.name}</div>
                <div class="result-field">Field ${result.fieldNumber}</div>
            </div>
            <div class="score-calculation">
                <div class="calculation-row">
                    <span>Bruto Time:</span>
                    <span>${this.formatTime(result.brutoTime)}</span>
                </div>
                <div class="calculation-row">
                    <span>Bonus Score:</span>
                    <span>+${result.bonusScore}s</span>
                </div>
                <div class="calculation-row">
                    <span>Netto Score:</span>
                    <span>${this.formatTime(result.nettoTime)}</span>
                </div>
            </div>
        `;

        return card;
    }

    updateLeaderboardDisplay(containerId, leaderboard) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

        if (leaderboard.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #6c757d; padding: 20px;">No records yet</p>';
            return;
        }

        leaderboard.forEach((entry, index) => {
            const item = document.createElement('div');
            item.className = `leaderboard-item rank-${index + 1}`;
            
            item.innerHTML = `
                <div class="rank-info">
                    <div class="rank-number">${index + 1}</div>
                    <div class="player-info-result">
                        <div class="player-name-result">${entry.name}</div>
                        <div class="field-info-result">Field ${entry.fieldNumber}</div>
                    </div>
                </div>
                <div class="score-info">
                    <div class="netto-score">${this.formatTime(entry.nettoTime)}</div>
                    <div class="score-breakdown">${this.formatTime(entry.brutoTime)} + ${entry.bonusScore}s</div>
                </div>
            `;

            container.appendChild(item);
        });
    }

    resetSession() {
        if (confirm('Are you sure you want to start a new session? This will clear all current data.')) {
            // Clear polling interval
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
                this.pollingInterval = null;
            }

            // Reset all data
            this.players = Array(5).fill(null);
            this.timers = Array(5).fill(null);
            this.startTimes = Array(5).fill(null);
            this.brutoScores = Array(5).fill(null);
            this.isRecording = false;
            this.globalStartTime = null;
            this.sessionResults = [];

            // Clear timers
            if (this.globalTimer) {
                clearInterval(this.globalTimer);
                this.globalTimer = null;
            }
            
            this.timers.forEach(timer => {
                if (timer) clearInterval(timer);
            });

            // Reset UI
            this.resetUI();
            
            // Switch to login screen
            this.switchScreen('login');
        }
    }

    resetUI() {
        // Reset login screen
        document.querySelectorAll('.player-slot').forEach((slot, index) => {
            slot.classList.remove('occupied');
            slot.querySelector('.player-input').value = '';
            slot.querySelector('.player-input').disabled = false;
            slot.querySelector('.checkin-btn').disabled = true;
            slot.querySelector('.player-status').textContent = 'Available';
            slot.querySelector('.player-status').classList.remove('checked-in');
        });

        // Reset recording screen
        document.getElementById('start-all-btn').disabled = false;
        document.getElementById('start-all-btn').textContent = 'Start All Players';
        document.getElementById('global-timer').textContent = '00:00:00';
        
        document.querySelectorAll('.timer').forEach(timer => {
            timer.textContent = '00:00:00';
            timer.classList.remove('running');
        });
        
        document.querySelectorAll('.stop-btn').forEach(btn => {
            btn.disabled = true;
        });
    }

    exportResults() {
        const data = {
            sessionResults: this.sessionResults,
            todayLeaderboard: this.todayLeaderboard,
            weeklyLeaderboard: this.weeklyLeaderboard,
            exportDate: new Date().toISOString()
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scoreboard-results-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    loadLeaderboards() {
        try {
            const saved = localStorage.getItem('scoreboard-leaderboards');
            if (saved) {
                const data = JSON.parse(saved);
                this.todayLeaderboard = data.todayLeaderboard || [];
                this.weeklyLeaderboard = data.weeklyLeaderboard || [];
            }
        } catch (error) {
            console.error('Error loading leaderboards:', error);
        }
    }

    saveLeaderboards() {
        try {
            const data = {
                todayLeaderboard: this.todayLeaderboard,
                weeklyLeaderboard: this.weeklyLeaderboard
            };
            localStorage.setItem('scoreboard-leaderboards', JSON.stringify(data));
        } catch (error) {
            console.error('Error saving leaderboards:', error);
        }
    }

    formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ScoreboardApp();
});

// Service Worker for offline functionality (optional)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('SW registered: ', registration);
            })
            .catch(registrationError => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}
