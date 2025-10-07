// Simplified Scoreboard App - No Room Codes
class ScoreboardApp {
    constructor() {
        this.supabase = null;
        this.currentPlayer = null;
        this.startTime = null;
        this.timer = null;
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
        const startBtn = document.getElementById('start-recording-btn');
        const stopBtn = document.getElementById('stop-recording-btn');
        const pushScoreBtn = document.getElementById('push-score-btn');

        if (startBtn) {
            startBtn.addEventListener('click', () => this.startRecording());
        }

        if (stopBtn) {
            stopBtn.addEventListener('click', () => this.stopRecording());
        }

        if (pushScoreBtn) {
            pushScoreBtn.addEventListener('click', () => this.pushScoreToDatabase());
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
        if (screenName === 'recording') {
            this.loadNewestPlayer();
        } else if (screenName === 'results') {
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

    async loadNewestPlayer() {
        if (!this.supabase) {
            alert('Database not available');
            return;
        }

        try {
            console.log('🔄 Loading newest player...');

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .is('bruto_score', null)
                .order('checkin_time', { ascending: false })
                .limit(1);

            if (error) {
                console.error('Error loading player:', error);
                this.showNoPlayerMessage();
                return;
            }

            if (data && data.length > 0) {
                this.currentPlayer = data[0];
                console.log('✅ Loaded player:', this.currentPlayer.player_name);
                this.displayCurrentPlayer();
            } else {
                console.log('No players waiting to record');
                this.showNoPlayerMessage();
            }

        } catch (error) {
            console.error('Error in loadNewestPlayer:', error);
            this.showNoPlayerMessage();
        }
    }

    displayCurrentPlayer() {
        const playerDisplay = document.getElementById('current-player-display');
        const startBtn = document.getElementById('start-recording-btn');
        
        if (playerDisplay && this.currentPlayer) {
            playerDisplay.innerHTML = `
                <div class="player-info-card">
                    <h3>${this.currentPlayer.player_name}</h3>
                    <p>Checked in: ${new Date(this.currentPlayer.checkin_time).toLocaleTimeString()}</p>
                    <p>Bonus Score: +${this.currentPlayer.bonus_score}s</p>
                </div>
            `;
            playerDisplay.style.display = 'block';
            if (startBtn) startBtn.disabled = false;
        }
    }

    showNoPlayerMessage() {
        const playerDisplay = document.getElementById('current-player-display');
        const startBtn = document.getElementById('start-recording-btn');
        
        if (playerDisplay) {
            playerDisplay.innerHTML = `
                <div class="no-player-message">
                    <p>No players waiting to record</p>
                    <p>Please check in a player first</p>
                </div>
            `;
            playerDisplay.style.display = 'block';
        }
        if (startBtn) startBtn.disabled = true;
        
        // Reset recording UI
        this.resetRecordingUI();
    }

    startRecording() {
        if (!this.currentPlayer) {
            alert('No player loaded');
            return;
        }

        this.isRecording = true;
        this.startTime = Date.now();

        // Update UI
        document.getElementById('start-recording-btn').style.display = 'none';
        document.getElementById('stop-recording-btn').style.display = 'block';
        document.getElementById('push-score-btn').style.display = 'none';
        
        // Start timer
        this.timer = setInterval(() => {
            this.updateTimer();
        }, 100);

        console.log('⏱️ Recording started for', this.currentPlayer.player_name);
    }

    updateTimer() {
        const elapsed = Date.now() - this.startTime;
        const formatted = this.formatTime(elapsed);
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = formatted;
            timerDisplay.classList.add('running');
        }
    }

    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;
        const brutoTime = Date.now() - this.startTime;

        // Stop timer
        clearInterval(this.timer);
        this.timer = null;

        // Calculate netto score
        const nettoTime = brutoTime + (this.currentPlayer.bonus_score * 1000);

        // Store scores temporarily
        this.currentPlayer.bruto_score = brutoTime;
        this.currentPlayer.netto_score = nettoTime;

        // Update UI
        document.getElementById('stop-recording-btn').style.display = 'none';
        document.getElementById('push-score-btn').style.display = 'block';
        
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.classList.remove('running');
        }

        // Show score breakdown
        this.displayScoreBreakdown();

        console.log('⏹️ Recording stopped. Bruto:', this.formatTime(brutoTime), 'Netto:', this.formatTime(nettoTime));
    }

    displayScoreBreakdown() {
        const breakdown = document.getElementById('score-breakdown');
        if (breakdown && this.currentPlayer) {
            breakdown.innerHTML = `
                <div class="breakdown-card">
                    <h4>Score Summary</h4>
                    <div class="breakdown-row">
                        <span>Bruto Time:</span>
                        <span>${this.formatTime(this.currentPlayer.bruto_score)}</span>
                    </div>
                    <div class="breakdown-row">
                        <span>Bonus:</span>
                        <span>+${this.currentPlayer.bonus_score}s</span>
                    </div>
                    <div class="breakdown-row final">
                        <span>Netto Score:</span>
                        <span>${this.formatTime(this.currentPlayer.netto_score)}</span>
                    </div>
                </div>
            `;
            breakdown.style.display = 'block';
        }
    }

    async pushScoreToDatabase() {
        if (!this.supabase || !this.currentPlayer) {
            alert('Cannot push score');
            return;
        }

        try {
            console.log('📤 Pushing score to database...');

            const { error } = await this.supabase
                .from('players')
                .update({
                    bruto_score: this.currentPlayer.bruto_score,
                    netto_score: this.currentPlayer.netto_score
                })
                .eq('id', this.currentPlayer.id);

            if (error) {
                console.error('Error pushing score:', error);
                alert('Failed to push score: ' + error.message);
                return;
            }

            console.log('✅ Score pushed successfully');
            alert('Score saved successfully!');

            // Reset for next player
            this.resetRecordingUI();
            this.currentPlayer = null;

            // Reload newest player
            await this.loadNewestPlayer();

        } catch (error) {
            console.error('Error in pushScoreToDatabase:', error);
            alert('Failed to push score');
        }
    }

    resetRecordingUI() {
        document.getElementById('start-recording-btn').style.display = 'block';
        document.getElementById('stop-recording-btn').style.display = 'none';
        document.getElementById('push-score-btn').style.display = 'none';
        
        const timerDisplay = document.getElementById('timer-display');
        if (timerDisplay) {
            timerDisplay.textContent = '00:00.00';
            timerDisplay.classList.remove('running');
        }

        const breakdown = document.getElementById('score-breakdown');
        if (breakdown) {
            breakdown.style.display = 'none';
        }
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