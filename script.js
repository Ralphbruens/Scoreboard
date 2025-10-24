// Simplified Scoreboard App - No Room Codes
class ScoreboardApp {
    constructor() {
        this.supabase = null;
        this.currentPlayers = [];
        this.globalStartTime = null;
        this.globalTimer = null;
        this.playerTimers = {};
        this.isRecording = false;
        this.timerChannel = null;
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.initializeSupabase();
        this.initTimerChannel();
    }

    initTimerChannel() {
        // Timer sync is now handled via Supabase Realtime for cross-device support
        // BroadcastChannel only works on same device, Supabase works across devices
        console.log('Timer sync will use Supabase Realtime for cross-device support');
    }

    async syncTimerState(state, startTime = null) {
        if (!this.supabase) {
            console.warn('Cannot sync timer: Supabase not available');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('timer_sync')
                .update({ 
                    timer_state: state,
                    start_time: startTime,
                    updated_at: new Date().toISOString()
                })
                .eq('id', 1);

            if (error) {
                console.error('Failed to sync timer state:', error);
            } else {
                console.log(`Timer synced: ${state}`, startTime ? `Start time: ${startTime}` : '');
            }
        } catch (error) {
            console.error('Error syncing timer:', error);
        }
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

        // Header toggle button
        const headerToggleBtn = document.getElementById('header-toggle-btn');
        if (headerToggleBtn) {
            headerToggleBtn.addEventListener('click', () => this.toggleHeader());
        }

        // Multi-player check-in
        const checkinAllBtn = document.getElementById('checkin-all-btn');
        const clearAllBtn = document.getElementById('clear-all-btn');

        if (checkinAllBtn) {
            checkinAllBtn.addEventListener('click', () => this.checkInAllPlayers());
        }

        if (clearAllBtn) {
            clearAllBtn.addEventListener('click', () => this.clearAllCheckInFields());
        }

        // Bonus settings toggle buttons
        document.querySelectorAll('.btn-toggle-bonus').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = e.target.dataset.index;
                const bonusSection = document.querySelector(`.bonus-section[data-index="${index}"]`);
                if (bonusSection) {
                    if (bonusSection.style.display === 'none') {
                        bonusSection.style.display = 'block';
                        e.target.textContent = 'Hide Settings';
                    } else {
                        bonusSection.style.display = 'none';
                        e.target.textContent = 'Settings';
                    }
                }
            });
        });

        // Recording controls
        const loadPlayersBtn = document.getElementById('load-players-btn');
        const startAllBtn = document.getElementById('start-all-btn');
        const pushAllScoresBtn = document.getElementById('push-all-scores-btn');
        const openClockBtn = document.getElementById('open-clock-btn');

        if (loadPlayersBtn) {
            loadPlayersBtn.addEventListener('click', () => this.loadWaitingPlayers());
        }

        if (startAllBtn) {
            startAllBtn.addEventListener('click', () => this.startAllPlayers());
        }

        if (pushAllScoresBtn) {
            pushAllScoresBtn.addEventListener('click', () => this.pushAllScoresToDatabase());
        }

        if (openClockBtn) {
            openClockBtn.addEventListener('click', () => this.openClockPage());
        }
    }

    toggleHeader() {
        const header = document.getElementById('main-header');
        const toggleBtn = document.getElementById('header-toggle-btn');
        
        if (header && toggleBtn) {
            header.classList.toggle('hidden');
            toggleBtn.classList.toggle('header-hidden');
        }
    }

    openClockPage() {
        // Open clock page in a new window
        const width = 1200;
        const height = 800;
        const left = (screen.width - width) / 2;
        const top = (screen.height - height) / 2;
        
        window.open(
            'clock.html',
            'ClockDisplay',
            `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=no,toolbar=no,menubar=no,location=no,status=no`
        );
        
        console.log('Opened clock display window');
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
        const randomBonusChecks = document.querySelectorAll('.random-bonus-check');
        
        const playersToCheckIn = [];
        
        // Field-specific bonus ranges
        const fieldRanges = [
            { min: 6, max: 16 },  // Field 1: 6-16 seconds
            { min: 15, max: 25 }, // Field 2: 15-25 seconds
            { min: 0, max: 0 },   // Field 3: 0 seconds
            { min: 12, max: 22 }, // Field 4: 12-22 seconds
            { min: 2, max: 10 }   // Field 5: 2-10 seconds
        ];
        
        for (let i = 0; i < playerInputs.length; i++) {
            const name = playerInputs[i].value.trim();
            if (name) {
                let bonusScore;
                
                // Check if "Random Bonus" is checked for this player
                if (randomBonusChecks[i].checked) {
                    const range = fieldRanges[i];
                    if (range.min === range.max) {
                        bonusScore = range.min;
                    } else {
                        bonusScore = Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
                    }
                }
                // Use manual bonus input
                else {
                    bonusScore = parseInt(bonusInputs[i].value) || 0;
                }
                
                playersToCheckIn.push({
                    player_name: name,
                    field_number: i + 1, // Store which field (1-5) this player is assigned to
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
            console.log('Bonus scores:', playersToCheckIn.map(p => `${p.player_name}: ${p.bonus_score}s`));

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
        document.querySelectorAll('.postal-code-input').forEach(input => {
            input.value = '';
        });
        document.querySelectorAll('.bonus-input-field').forEach(input => {
            input.value = '0';
        });
        document.querySelectorAll('.random-bonus-check').forEach(checkbox => {
            checkbox.checked = true; // Set back to default (checked)
        });
        // Hide all bonus sections and reset button text
        document.querySelectorAll('.bonus-section').forEach(section => {
            section.style.display = 'none';
        });
        document.querySelectorAll('.btn-toggle-bonus').forEach(btn => {
            btn.textContent = 'Settings';
        });
    }

    async loadWaitingPlayers() {
        if (!this.supabase) {
            alert('Database not available');
            return;
        }

        try {
            console.log('🔄 Loading waiting players...');

            // First, get the most recent check-in time for unrecorded players
            const { data: allWaiting, error: waitingError } = await this.supabase
                .from('players')
                .select('*')
                .is('bruto_score', null)
                .order('checkin_time', { ascending: false })
                .limit(1);

            if (waitingError) {
                console.error('Error loading players:', waitingError);
                alert('Failed to load players: ' + waitingError.message);
                return;
            }

            if (!allWaiting || allWaiting.length === 0) {
                console.log('No players waiting to record');
                this.showNoPlayersMessage();
                return;
            }

            const mostRecentCheckinTime = allWaiting[0].checkin_time;
            const mostRecentDate = new Date(mostRecentCheckinTime);
            
            // Get all players checked in within the same second (same batch)
            // This groups players checked in together
            const timeWindowStart = new Date(mostRecentDate.getTime() - 2000); // 2 second window before
            const timeWindowEnd = new Date(mostRecentDate.getTime() + 2000);   // 2 second window after

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .is('bruto_score', null)
                .gte('checkin_time', timeWindowStart.toISOString())
                .lte('checkin_time', timeWindowEnd.toISOString())
                .order('checkin_time', { ascending: true })
                .limit(5); // Maximum 5 players per recording session

            if (error) {
                console.error('Error loading players:', error);
                alert('Failed to load players: ' + error.message);
                return;
            }

            if (data && data.length > 0) {
                this.currentPlayers = data;
                console.log(`✅ Loaded ${data.length} player(s) from the same check-in batch`);
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

            // Use the actual field number assigned during check-in
            const fieldNumber = player.field_number || (index + 1);

            playerCard.innerHTML = `
                <div class="field-label-recording">Field ${fieldNumber}</div>
                <div class="player-card-header">
                    <h3>${player.player_name}</h3>
                    <span class="bonus-badge">+${player.bonus_score}s</span>
                </div>
                <div class="player-timer" id="player-timer-${player.id}">90.00</div>
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

    async startAllPlayers() {
        if (this.currentPlayers.length === 0) {
            alert('No players to start');
            return;
        }

        this.isRecording = true;
        this.globalStartTime = Date.now();
        
        // Sync timer state to Supabase for cross-device synchronization
        await this.syncTimerState('running', this.globalStartTime);
        
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
        const remaining = Math.max(0, 90000 - elapsed); // 90 seconds = 90000 ms
        const formatted = this.formatCountdown(remaining);
        const globalTimerDisplay = document.getElementById('global-timer-display');
        if (globalTimerDisplay) {
            globalTimerDisplay.textContent = formatted;
            
            // Change color based on time remaining
            if (remaining <= 0) {
                globalTimerDisplay.style.color = '#dc3545'; // Red when time's up
            } else if (remaining <= 30000) {
                globalTimerDisplay.style.color = '#ffc107'; // Yellow for last 30 seconds
            } else {
                globalTimerDisplay.style.color = '#28a745'; // Green
            }
        }

        // Auto-stop all players when time runs out
        if (remaining <= 0 && this.isRecording) {
            this.autoStopAllPlayers();
        }
    }

    updatePlayerTimer(playerId) {
        const elapsed = Date.now() - this.globalStartTime;
        const remaining = Math.max(0, 90000 - elapsed);
        const formatted = this.formatCountdown(remaining);
        const timerElement = document.getElementById(`player-timer-${playerId}`);
        if (timerElement) {
            timerElement.textContent = formatted;
            timerElement.classList.add('running');
            
            // Change color based on time remaining
            if (remaining <= 0) {
                timerElement.style.color = '#dc3545';
            } else if (remaining <= 30000) {
                timerElement.style.color = '#ffc107';
            } else {
                timerElement.style.color = '#28a745';
            }
        }
    }

    formatCountdown(milliseconds) {
        const totalSeconds = milliseconds / 1000;
        const seconds = Math.floor(totalSeconds);
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${seconds.toString().padStart(3, '0')}.${ms.toString().padStart(2, '0')}`;
    }

    stopPlayer(playerId) {
        if (!this.isRecording) return;

        const player = this.currentPlayers.find(p => p.id === playerId);
        if (!player) return;

        const elapsed = Date.now() - this.globalStartTime;
        const remainingMs = Math.max(0, 90000 - elapsed);
        const brutoScore = Math.floor(remainingMs / 1000); // Seconds remaining
        const nettoScore = brutoScore + player.bonus_score; // Add bonus score

        // Store scores (in seconds for bruto/netto, but we'll store milliseconds for compatibility)
        player.bruto_score = brutoScore * 1000; // Store as milliseconds for compatibility
        player.netto_score = nettoScore * 1000;
        player.bruto_score_seconds = brutoScore; // Actual score in seconds
        player.netto_score_seconds = nettoScore;

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
                    <div>⏱️ Bruto: ${brutoScore}s</div>
                    <div>⚡ Bonus: +${player.bonus_score}s</div>
                    <div class="final-score">🏆 Netto: ${nettoScore}s</div>
                </div>
            `;
            scoreDisplay.style.display = 'block';
        }

        console.log(`⏹️ ${player.player_name} stopped - Bruto: ${brutoScore}s, Netto: ${nettoScore}s`);

        // Check if all players are done
        const allDone = this.currentPlayers.every(p => p.bruto_score !== null && p.bruto_score !== undefined);
        
        if (allDone) {
            this.allPlayersFinished();
        }
    }

    autoStopAllPlayers() {
        console.log('⏰ Time\'s up! Auto-stopping all remaining players...');
        
        this.currentPlayers.forEach(player => {
            if (player.bruto_score === null || player.bruto_score === undefined) {
                this.stopPlayer(player.id);
            }
        });
    }

    async allPlayersFinished() {
        console.log('🏁 All players finished!');
        
        // Stop global timer
        if (this.globalTimer) {
            clearInterval(this.globalTimer);
            this.globalTimer = null;
        }

        this.isRecording = false;

        // Sync timer stop to Supabase for cross-device synchronization
        await this.syncTimerState('stopped', null);

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

    async resetRecordingPage() {
        this.currentPlayers = [];
        this.playerTimers = {};
        this.globalStartTime = null;
        this.isRecording = false;

        // Sync timer reset to Supabase for cross-device synchronization
        await this.syncTimerState('stopped', null);

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

            // Load last 5 players (most recent)
            await this.loadRecentScores();

            // Load weekly top 5 (highscore)
            await this.loadWeeklyTopScores();

        } catch (error) {
            console.error('Error in loadScores:', error);
        }
    }

    async loadRecentScores() {
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .not('netto_score', 'is', null)
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) {
                console.error('Error loading recent scores:', error);
                return;
            }

            this.displayScores(data || [], 'recent-scores-list', false);

        } catch (error) {
            console.error('Error in loadRecentScores:', error);
        }
    }

    async loadTodayTopScores() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .not('netto_score', 'is', null)
                .gte('checkin_time', todayISO)
                .order('netto_score', { ascending: false })
                .limit(10);

            if (error) {
                console.error('Error loading today\'s scores:', error);
                return;
            }

            this.displayScores(data || [], 'today-scores-list', true);

        } catch (error) {
            console.error('Error in loadTodayTopScores:', error);
        }
    }

    async loadWeeklyTopScores() {
        try {
            const weekAgo = new Date();
            weekAgo.setDate(weekAgo.getDate() - 7);
            weekAgo.setHours(0, 0, 0, 0);
            const weekAgoISO = weekAgo.toISOString();

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .not('netto_score', 'is', null)
                .gte('checkin_time', weekAgoISO)
                .order('netto_score', { ascending: false })
                .limit(5);

            if (error) {
                console.error('Error loading weekly scores:', error);
                return;
            }

            this.displayScores(data || [], 'weekly-scores-list', true);

        } catch (error) {
            console.error('Error in loadWeeklyTopScores:', error);
        }
    }

    displayScores(scores, containerId, showRanking = true) {
        const scoresContainer = document.getElementById(containerId);
        if (!scoresContainer) return;

        if (scores.length === 0) {
            scoresContainer.innerHTML = '<div class="score-row"><div class="no-scores">No scores recorded yet</div></div>';
            return;
        }

        scoresContainer.innerHTML = scores.map((player, index) => {
            const brutoSeconds = Math.floor(player.bruto_score / 1000);
            const nettoSeconds = Math.floor(player.netto_score / 1000);
            const bonusText = player.bonus_score > 0 ? `+${player.bonus_score}` : '0';
            
            // Use field_number from database, fallback to index + 1 if not available
            const fieldNumber = player.field_number || (index + 1);
            
            return `
                <div class="score-row">
                    <div class="field-number">${fieldNumber}</div>
                    <div class="player-name">${player.player_name}</div>
                    <div class="bruto-score">${brutoSeconds}</div>
                    <div class="bonus-score">${bonusText}</div>
                    <div class="netto-score">${nettoSeconds}</div>
                </div>
            `;
        }).join('');
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