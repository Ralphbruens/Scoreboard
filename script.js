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
        // No automatic polling on init - only on results screen
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
            
            // Simple connection test
            console.log('Supabase client created successfully');
            this.updateConnectionStatus('online', 'Connected');
            
            // Try to load existing session (but don't auto-apply)
            await this.loadSessionIfExists();
            
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

    async loadSessionIfExists() {
        if (!this.supabase) {
            console.log('Supabase not available, using local session only');
            return;
        }
    
        try {
            console.log('Checking for existing session for room:', this.sessionData.roomCode);
            
            const { data, error } = await this.supabase
                .from('sessions')
                .select('id, room_code, data, updated_at')
                .eq('room_code', this.sessionData.roomCode)
                .maybeSingle();
    
            if (error) {
                console.error('Database error loading session:', error);
                return;
            }
            
            if (data) {
                console.log('Found existing session in database');
                // Store it but don't auto-load (user will manually refresh)
                this.cachedSessionData = data;
            } else {
                console.log('No existing session found');
            }
        } catch (error) {
            console.error('Error in loadSessionIfExists:', error);
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

            console.log('📤 Saving session data for room:', this.sessionData.roomCode);
            
            const { data, error } = await this.supabase
                .from('sessions')
                .upsert(sessionRecord, { 
                    onConflict: 'room_code',
                    ignoreDuplicates: false 
                })
                .select();

            if (error) {
                console.error('Error saving session:', error);
            } else {
                console.log('✅ Session data saved successfully to database');
                if (data && data.length > 0 && !this.sessionData.id) {
                    this.sessionData.id = data[0].id;
                }
            }
        } catch (error) {
            console.error('Error in saveSessionData:', error);
        }
    }

    // Manual refresh for Recording screen
    async refreshPlayers() {
        if (!this.supabase) {
            alert('Database not available');
            return;
        }

        try {
            console.log('🔄 Manually refreshing players from database...');
            
            const { data, error } = await this.supabase
                .from('sessions')
                .select('id, room_code, data, updated_at')
                .eq('room_code', this.sessionData.roomCode)
                .maybeSingle();

            if (error) {
                console.error('Error fetching players:', error);
                alert('Failed to refresh players');
                return;
            }

            if (data && data.data) {
                const dbId = data.id;
                this.sessionData = data.data;
                this.sessionData.id = dbId;
                
                // Update local state
                this.players = [...this.sessionData.players];
                this.bonusScores = [...this.sessionData.bonusScores];
                
                // Update Recording screen
                this.updateRecordingScreen();
                
                // Show which players were loaded
                const newPlayers = this.players.filter(p => p !== null).map(p => p.name);
                if (newPlayers.length > 0) {
                    const lastUpdateInfo = document.getElementById('last-update-info');
                    if (lastUpdateInfo) {
                        lastUpdateInfo.textContent = `✅ Loaded players: ${newPlayers.join(', ')}`;
                        lastUpdateInfo.style.display = 'block';
                        setTimeout(() => {
                            lastUpdateInfo.style.display = 'none';
                        }, 5000);
                    }
                }
                
                console.log('✅ Players refreshed successfully');
            } else {
                alert('No session data found');
            }
        } catch (error) {
            console.error('Error in refreshPlayers:', error);
            alert('Failed to refresh players');
        }
    }

    // Start automatic polling for Results screen only
    startResultsPolling() {
        // Stop any existing polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
        }

        console.log('📊 Starting results polling (every 2000ms)...');
        
        this.pollingInterval = setInterval(async () => {
            await this.checkForNewResults();
        }, 2000);
        
        // Also check immediately
        this.checkForNewResults();
    }

    stopResultsPolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏹️ Stopped results polling');
        }
    }

    async checkForNewResults() {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from('sessions')
                .select('id, room_code, data, updated_at')
                .eq('room_code', this.sessionData.roomCode)
                .maybeSingle();

            if (error) {
                console.log('Polling check error:', error);
                return;
            }

            if (data && data.data && data.data.lastUpdated > this.sessionData.lastUpdated) {
                console.log('📥 Found new results, updating scoreboard...');
                
                const dbId = data.id;
                this.sessionData = data.data;
                this.sessionData.id = dbId;
                
                // Update local state
                this.sessionResults = [...this.sessionData.sessionResults];
                
                // Update Results screen
                this.updateResultsScreen();
                
                // Show sync indicator
                this.showSyncIndicator('New results loaded!');
            }
        } catch (error) {
            console.error('Error in polling check:', error);
        }
    }
    
    showSyncIndicator(message = 'Synced ✓') {
        const statusText = document.querySelector('.status-text');
        if (statusText) {
            const originalText = statusText.textContent;
            statusText.textContent = message;
            setTimeout(() => {
                statusText.textContent = 'Connected';
            }, 2000);
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

        // Recording controls - Check if buttons exist before adding listeners
        const refreshBtn = document.getElementById('refresh-players-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.refreshPlayers());
        }

        const startAllBtn = document.getElementById('start-all-btn');
        if (startAllBtn) {
            startAllBtn.addEventListener('click', () => this.startAllPlayers());
        }

        const updateScoreboardBtn = document.getElementById('update-scoreboard-btn');
        if (updateScoreboardBtn) {
            updateScoreboardBtn.addEventListener('click', () => this.updateScoreboardManually());
        }

        document.querySelectorAll('.stop-btn').forEach((btn, index) => {
            btn.addEventListener('click', () => this.stopPlayer(index));
        });

        // Action buttons
        const resetBtn = document.getElementById('reset-session');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.resetSession());
        }

        const exportBtn = document.getElementById('export-results');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.exportResults());
        }
    }

    switchScreen(screenName) {
        // Stop polling when leaving results screen
        if (screenName !== 'results') {
            this.stopResultsPolling();
        }

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
            // Start automatic polling for results screen
            this.startResultsPolling();
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
        this.sessionData.bonusScores = [...this.bonusScores];
        this.sessionData.lastUpdated = Date.now();
        
        // Save to database immediately
        await this.saveSessionData();

        // Update UI
        this.updateCheckInScreen();
        
        console.log('✅ Player checked in and saved to database:', playerName);
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

        // Update bonus scores display
        this.updateBonusDisplay();
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
                
                if (this.brutoScores[index] !== null) {
                    // Show final time
                    timerElement.textContent = this.formatTime(this.brutoScores[index]);
                    timerElement.classList.remove('running');
                    stopBtn.disabled = true;
                } else {
                    timerElement.textContent = '00:00.00';
                    stopBtn.disabled = !this.isRecording;
                }
            } else {
                element.style.display = 'none';
            }
        });
    }

    async startAllPlayers() {
        if (this.players.filter(p => p !== null).length === 0) {
            alert('Please refresh and load players first!');
            return;
        }

        this.isRecording = true;
        this.globalStartTime = Date.now();
        
        // Update UI
        const startBtn = document.getElementById('start-all-btn');
        if (startBtn) {
            startBtn.disabled = true;
            startBtn.textContent = 'Recording...';
        }
        
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

        console.log('⏱️ All players started');
    }

    updateGlobalTimer() {
        const elapsed = Date.now() - this.globalStartTime;
        const formatted = this.formatTime(elapsed);
        const globalTimerEl = document.getElementById('global-timer');
        if (globalTimerEl) {
            globalTimerEl.textContent = formatted;
        }
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

        // Stop timer
        clearInterval(this.timers[index]);
        this.timers[index] = null;

        // Update UI
        document.querySelectorAll('.stop-btn')[index].disabled = true;
        document.querySelectorAll('.timer')[index].classList.remove('running');
        
        console.log(`⏹️ Player ${index + 1} stopped at ${this.formatTime(brutoTime)}`);
        
        // Check if all active players have finished
        const activePlayers = this.players.filter(p => p !== null);
        const finishedPlayers = this.brutoScores.filter(score => score !== null).length;
        
        if (finishedPlayers === activePlayers.length) {
            console.log('🏁 All players finished!');
            this.isRecording = false;
            clearInterval(this.globalTimer);
            
            // Show "Update Score to Scoreboard" button
            const updateBtn = document.getElementById('update-scoreboard-btn');
            if (updateBtn) {
                updateBtn.style.display = 'block';
            }
        }
    }

    async updateScoreboardManually() {
        console.log('📊 Manually updating scoreboard...');
        
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

        // Sort by netto time
        this.sessionResults.sort((a, b) => a.nettoTime - b.nettoTime);

        // Update session data
        this.sessionData.sessionResults = this.sessionResults;
        this.sessionData.brutoScores = [...this.brutoScores];
        this.sessionData.lastUpdated = Date.now();

        // Save to database
        await this.saveSessionData();

        // Update leaderboards
        this.updateLeaderboards();
        
        alert('✅ Scores uploaded to scoreboard successfully!');
        
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
        if (currentResultsContainer) {
            currentResultsContainer.innerHTML = '';

            this.sessionResults.forEach((result, index) => {
                const resultCard = this.createResultCard(result, index + 1);
                currentResultsContainer.appendChild(resultCard);
            });
        }

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
        if (!container) return;

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
            // Stop polling
            this.stopResultsPolling();

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
        const startBtn = document.getElementById('start-all-btn');
        if (startBtn) {
            startBtn.disabled = false;
            startBtn.textContent = 'Start All Players';
        }

        const globalTimer = document.getElementById('global-timer');
        if (globalTimer) {
            globalTimer.textContent = '00:00:00';
        }

        const updateBtn = document.getElementById('update-scoreboard-btn');
        if (updateBtn) {
            updateBtn.style.display = 'none';
        }
        
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