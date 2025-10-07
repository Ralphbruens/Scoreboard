// Simplified Scoreboard App - No Room Codes
class ScoreboardApp {
    constructor() {
        this.supabase = null;
        this.currentPlayers = [];
        this.globalStartTime = null;
        this.globalTimer = null;
        this.playerTimers = {};
        this.isRecording = false;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.initializeSupabase();
    }

    async initializeSupabase() {
        try {
            if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
                console.warn('Supabase not configured. Running in offline mode.');
                this.updateConnectionStatus('offline', 'Offline Mode');
                return;
            }

            this.supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('Supabase client created successfully');
            this.updateConnectionStatus('online', 'Connected');
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            this.updateConnectionStatus('offline', 'Offline Mode');
        }
    }

    updateConnectionStatus(status, text) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');
        
        if (statusIndicator) statusIndicator.className = `status-indicator ${status}`;
        if (statusText) statusText.textContent = text;
    }

    setupEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchScreen(e.target.dataset.page));
        });

        // Multi-player check-in
        const checkinAllBtn = document.getElementById('checkin-all-btn');
        const clearAllBtn = document.getElementById('clear-all-btn');

        if (checkinAllBtn) {
            checkinAllBtn.addEventListener('click', () => this.checkInAllPlayers());
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllCheckInFields());
        }

        // Recording controls
        const loadPlayersBtn = document.getElementById('load-players-btn');
        const startAllBtn = document.getElementById('start-all-btn');
        const pushAllScoresBtn = document.getElementById('push-all-scores-btn');

        if (loadPlayersBtn) {
            loadPlayersBtn.addEventListener('click', () => this.loadWaitingPlayers());
        }

        if (startAllBtn) {
            startAllBtn.addEventListener('click', () => this.startAllPlayers());
        }

        if (pushAllScoresBtn) {
            pushAllScoresBtn.addEventListener('click', () => this.pushAllScoresToDatabase());
        }
    }

    switchScreen(screenName) {
        // Stop score polling when leaving results screen
        if (screenName !== 'results') {
            this.stopScorePolling();
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

        // Screen-specific actions
        if (screenName === 'results') {
            this.loadScores();
            this.startScorePolling();
        }
    }

    async checkInAllPlayers() {
        if (!this.supabase) {
            alert('Database not available. Please check your connection.');
            return;
        }

        // Collect all filled player data
        const playerInputs = document.querySelectorAll('.player-name-input');
        const bonusInputs = document.querySelectorAll('.bonus-input-field');
        
        const playersToCheckIn = [];
        
        for (let i = 0; i < playerInputs.length; i++) {
            const name = playerInputs[i].value.trim();
            if (name) {
                const bonusScore = parseInt(bonusInputs[i].value) || 0;
                playersToCheckIn.push({
                    player_name: name,
                    checkin_time: new Date().toISOString(),
                    bonus_score: bonusScore,
                    bruto_score: null,
                    netto_score: null
                });
            }
        }

        if (playersToCheckIn.length === 0) {
            alert('Please enter at least one player name');
            return;
        }

        try {
            console.log(`📝 Checking in ${playersToCheckIn.length} player(s)...`);

            const { data, error } = await this.supabase
                .from('players')
                .insert(playersToCheckIn)
                .select();

            if (error) {
                console.error('Error checking in players:', error);
                alert('Failed to check in players: ' + error.message);
                return;
            }

            console.log('✅ Players checked in successfully:', data);
            
            // Clear all fields
            this.clearAllCheckInFields();

            // Show success message
            this.showSuccessMessage(`${playersToCheckIn.length} player(s) checked in successfully!`);

        } catch (error) {
            console.error('Error in checkInAllPlayers:', error);
            alert('Failed to check in players');
        }
    }

    clearAllCheckInFields() {
        document.querySelectorAll('.player-name-input').forEach(input => {
            input.value = '';
        });
        document.querySelectorAll('.bonus-input-field').forEach(input => {
            input.value = '0';
        });
    }

    async loadWaitingPlayers() {
        if (!this.supabase) {
            alert('Database not available');
            return;
        }

        try {
            console.log('🔄 Loading waiting players...');

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .is('bruto_score', null)
                .order('checkin_time', { ascending: true });

            if (error) {
                console.error('Error loading players:', error);
                alert('Failed to load players: ' + error.message);
                return;
            }

            if (data && data.length > 0) {
                this.currentPlayers = data;
                console.log(`✅ Loaded ${data.length} player(s)`);
                this.displayWaitingPlayers();
            } else {
                console.log('No players waiting to record');
                this.showNoPlayersMessage();
            }

        } catch (error) {
            console.error('Error in loadWaitingPlayers:', error);
            alert('Failed to load players');
        }
    }

    displayWaitingPlayers() {
        const grid = document.getElementById('players-recording-grid');
        const startAllBtn = document.getElementById('start-all-btn');
        
        if (!grid) return;

        grid.innerHTML = '';

        this.currentPlayers.forEach((player, index) => {
            const playerCard = document.createElement('div');
            playerCard.className = 'player-recording-card';
            playerCard.dataset.playerId = player.id;
            playerCard.dataset.playerIndex = index;

            playerCard.innerHTML = `
                <div class="player-card-header">
                    <h3>${player.player_name}</h3>
                    <span class="bonus-badge">+${player.bonus_score}s</span>
                </div>
                <div class="player-timer" id="player-timer-${player.id}">00:00.00</div>
                <button class="btn btn-danger stop-player-btn" data-player-id="${player.id}" disabled>
                    Stop
                </button>
                <div class="player-score-display" id="score-display-${player.id}" style="display: none;"></div>
            `;

            grid.appendChild(playerCard);
        });

        // Show start all button
        if (startAllBtn) {
            startAllBtn.style.display = 'block';
        }

        // Add event listeners to stop buttons
        document.querySelectorAll('.stop-player-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const playerId = parseInt(e.target.dataset.playerId);
                this.stopPlayer(playerId);
            });
        });
    }

    showNoPlayersMessage() {
        const grid = document.getElementById('players-recording-grid');
        const startAllBtn = document.getElementById('start-all-btn');
        
        if (grid) {
            grid.innerHTML = `
                <div class="no-player-message">
                    <p>No players waiting to record</p>
                    <p>Please check in players first</p>
                </div>
            `;
        }
        
        if (startAllBtn) {
            startAllBtn.style.display = 'none';
        }
    }

    startAllPlayers() {
        if (this.currentPlayers.length === 0) {
            alert('No players to start');
            return;
        }

        this.isRecording = true;
        this.globalStartTime = Date.now();

        // Hide start button, show global timer
        const startAllBtn = document.getElementById('start-all-btn');
        const globalTimerDisplay = document.getElementById('global-timer-display');
        
        if (startAllBtn) startAllBtn.style.display = 'none';
        if (globalTimerDisplay) {
            globalTimerDisplay.style.display = 'block';
        }

        // Enable all stop buttons
        document.querySelectorAll('.stop-player-btn').forEach(btn => {
            btn.disabled = false;
        });

        // Start global timer
        this.globalTimer = setInterval(() => {
            this.updateGlobalTimer();
        }, 100);

        // Start individual timers for each player
        this.currentPlayers.forEach(player => {
            this.playerTimers[player.id] = setInterval(() => {
                this.updatePlayerTimer(player.id);
            }, 100);
        });

        console.log(`⏱️ Started recording for ${this.currentPlayers.length} player(s)`);
    }

    updateGlobalTimer() {
        const elapsed = Date.now() - this.globalStartTime;
        const formatted = this.formatTime(elapsed);
        const globalTimerDisplay = document.getElementById('global-timer-display');
        if (globalTimerDisplay) {
            globalTimerDisplay.textContent = formatted;
        }
    }

    updatePlayerTimer(playerId) {
        const elapsed = Date.now() - this.globalStartTime;
        const formatted = this.formatTime(elapsed);
        const timerElement = document.getElementById(`player-timer-${playerId}`);
        if (timerElement) {
            timerElement.textContent = formatted;
            timerElement.classList.add('running');
        }
    }

    stopPlayer(playerId) {
        if (!this.isRecording) return;

        const player = this.currentPlayers.find(p => p.id === playerId);
        if (!player) return;

        const brutoTime = Date.now() - this.globalStartTime;
        const nettoTime = brutoTime + (player.bonus_score * 1000);

        // Store scores
        player.bruto_score = brutoTime;
        player.netto_score = nettoTime;

        // Stop this player's timer
        if (this.playerTimers[playerId]) {
            clearInterval(this.playerTimers[playerId]);
            delete this.playerTimers[playerId];
        }

        // Update UI
        const timerElement = document.getElementById(`player-timer-${playerId}`);
        if (timerElement) {
            timerElement.classList.remove('running');
            timerElement.classList.add('stopped');
        }

        const stopBtn = document.querySelector(`[data-player-id="${playerId}"]`);
        if (stopBtn) stopBtn.disabled = true;

        // Show score breakdown
        const scoreDisplay = document.getElementById(`score-display-${playerId}`);
        if (scoreDisplay) {
            scoreDisplay.innerHTML = `
                <div class="mini-breakdown">
                    <div>Bruto: ${this.formatTime(brutoTime)}</div>
                    <div>Netto: ${this.formatTime(nettoTime)}</div>
                </div>
            `;
            scoreDisplay.style.display = 'block';
        }

        console.log(`⏹️ ${player.player_name} stopped at ${this.formatTime(brutoTime)}`);

        // Check if all players are done
        const allDone = this.currentPlayers.every(p => p.bruto_score !== null && p.bruto_score !== undefined);
        
        if (allDone) {
            this.allPlayersFinished();
        }
    }

    allPlayersFinished() {
        console.log('🏁 All players finished!');
        
        // Stop global timer
        if (this.globalTimer) {
            clearInterval(this.globalTimer);
            this.globalTimer = null;
        }

        this.isRecording = false;

        // Show push all scores button
        const pushAllBtn = document.getElementById('push-all-scores-btn');
        if (pushAllBtn) {
            pushAllBtn.style.display = 'block';
        }
    }

    async pushAllScoresToDatabase() {
        if (!this.supabase || this.currentPlayers.length === 0) {
            alert('No scores to push');
            return;
        }

        try {
            console.log('📤 Pushing all scores to database...');

            // Update each player
            const updates = this.currentPlayers.map(player => 
                this.supabase
                    .from('players')
                    .update({
                        bruto_score: player.bruto_score,
                        netto_score: player.netto_score
                    })
                    .eq('id', player.id)
            );

            const results = await Promise.all(updates);

            // Check for errors
            const errors = results.filter(r => r.error);
            if (errors.length > 0) {
                console.error('Some scores failed to save:', errors);
                alert(`${errors.length} score(s) failed to save. Check console.`);
                return;
            }

            console.log('✅ All scores pushed successfully');
            alert(`${this.currentPlayers.length} score(s) saved successfully!`);

            // Reset recording page
            this.resetRecordingPage();

        } catch (error) {
            console.error('Error in pushAllScoresToDatabase:', error);
            alert('Failed to push scores');
        }
    }

    resetRecordingPage() {
        this.currentPlayers = [];
        this.playerTimers = {};
        this.globalStartTime = null;
        this.isRecording = false;

        const grid = document.getElementById('players-recording-grid');
        const startAllBtn = document.getElementById('start-all-btn');
        const globalTimerDisplay = document.getElementById('global-timer-display');
        const pushAllBtn = document.getElementById('push-all-scores-btn');

        if (grid) grid.innerHTML = '';
        if (startAllBtn) startAllBtn.style.display = 'none';
        if (globalTimerDisplay) {
            globalTimerDisplay.style.display = 'none';
            globalTimerDisplay.textContent = '00:00.00';
        }
        if (pushAllBtn) pushAllBtn.style.display = 'none';
    }

    async loadScores() {
        if (!this.supabase) {
            console.log('Database not available');
            return;
        }

        try {
            console.log('📊 Loading scores...');

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .not('netto_score', 'is', null)
                .order('netto_score', { ascending: true });

            if (error) {
                console.error('Error loading scores:', error);
                return;
            }

            this.displayScores(data || []);

        } catch (error) {
            console.error('Error in loadScores:', error);
        }
    }

    displayScores(scores) {
        const scoresContainer = document.getElementById('scores-list');
        if (!scoresContainer) return;

        if (scores.length === 0) {
            scoresContainer.innerHTML = '<p class="no-scores">No scores recorded yet</p>';
            return;
        }

        scoresContainer.innerHTML = scores.map((player, index) => `
            <div class="score-card ${index < 3 ? 'podium-' + (index + 1) : ''}">
                <div class="rank">${index + 1}</div>
                <div class="player-details">
                    <div class="player-name">${player.player_name}</div>
                    <div class="score-details">
                        ${this.formatTime(player.bruto_score)} + ${player.bonus_score}s = ${this.formatTime(player.netto_score)}
                    </div>
                    <div class="checkin-date">${new Date(player.checkin_time).toLocaleString()}</div>
                </div>
                <div class="netto-time">${this.formatTime(player.netto_score)}</div>
            </div>
        `).join('');
    }

    startScorePolling() {
        // Stop any existing polling
        this.stopScorePolling();

        console.log('📊 Starting score polling (every 2000ms)...');
        
        this.pollingInterval = setInterval(() => {
            this.loadScores();
        }, 2000);
    }

    stopScorePolling() {
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
            console.log('⏹️ Stopped score polling');
        }
    }

    showSuccessMessage(message) {
        const successDiv = document.createElement('div');
        successDiv.className = 'success-message';
        successDiv.textContent = message;
        document.body.appendChild(successDiv);

        setTimeout(() => {
            successDiv.remove();
        }, 3000);
    }

    formatTime(milliseconds) {
        if (!milliseconds && milliseconds !== 0) return '00:00.00';
        
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