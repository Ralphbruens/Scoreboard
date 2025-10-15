// Clock page - synchronized with recording page via Supabase Realtime
class SyncedClock {
    constructor() {
        this.startTime = null;
        this.timerInterval = null;
        this.isRunning = false;
        this.supabase = null;
        this.subscription = null;
        
        this.init();
    }

    async init() {
        await this.initializeSupabase();
        this.subscribeToTimerUpdates();
        console.log('Clock initialized and listening for timer events via Supabase...');
    }

    async initializeSupabase() {
        try {
            if (SUPABASE_CONFIG.url === 'YOUR_SUPABASE_URL' || SUPABASE_CONFIG.anonKey === 'YOUR_SUPABASE_ANON_KEY') {
                console.error('Supabase not configured! Please update config.js');
                this.showError('Supabase not configured');
                return;
            }

            this.supabase = supabase.createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.anonKey);
            console.log('Supabase client created successfully');
            
            // Load initial timer state
            await this.loadInitialState();
        } catch (error) {
            console.error('Failed to initialize Supabase:', error);
            this.showError('Connection failed');
        }
    }

    async loadInitialState() {
        try {
            const { data, error } = await this.supabase
                .from('timer_sync')
                .select('*')
                .eq('id', 1)
                .single();

            if (error) {
                console.error('Failed to load initial state:', error);
                return;
            }

            if (data && data.timer_state === 'running' && data.start_time) {
                // Timer is already running, sync with it
                this.startTimer(data.start_time);
            }
        } catch (error) {
            console.error('Error loading initial state:', error);
        }
    }

    subscribeToTimerUpdates() {
        if (!this.supabase) return;

        // Subscribe to realtime changes on timer_sync table
        this.subscription = this.supabase
            .channel('timer-sync-channel')
            .on('postgres_changes', 
                { event: 'UPDATE', schema: 'public', table: 'timer_sync' },
                (payload) => {
                    console.log('Timer update received:', payload);
                    this.handleTimerUpdate(payload.new);
                }
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    this.updateStatus('Connected', 'connected');
                }
            });
    }

    handleTimerUpdate(data) {
        console.log('Handling timer update:', data);
        
        if (data.timer_state === 'running' && data.start_time) {
            this.startTimer(data.start_time);
        } else if (data.timer_state === 'stopped') {
            this.stopTimer();
        }
    }

    showError(message) {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.style.color = '#dc3545';
        }
    }

    updateStatus(text, className = '') {
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.className = 'status-indicator ' + className;
        }
    }

    startTimer(startTime) {
        console.log('Starting timer with start time:', startTime);
        this.startTime = startTime;
        this.isRunning = true;
        
        // Update status
        this.updateStatus('Running', 'running');

        // Clear any existing interval
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        // Start updating the display
        this.timerInterval = setInterval(() => {
            this.updateDisplay();
        }, 100);

        // Immediate update
        this.updateDisplay();
    }

    stopTimer() {
        console.log('Stopping timer');
        this.isRunning = false;

        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }

        // Update status
        this.updateStatus('Stopped', 'stopped');
        
        // Reset display after a short delay
        setTimeout(() => {
            this.resetDisplay();
        }, 2000);
    }

    resetDisplay() {
        this.startTime = null;
        
        // Reset display
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.textContent = '90.00';
            clockEl.style.color = '#CBFF73';
        }

        // Update status
        this.updateStatus('Waiting...', '');
    }

    updateDisplay() {
        if (!this.isRunning || !this.startTime) return;

        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, 90000 - elapsed); // 90 seconds = 90000ms
        const formatted = this.formatCountdown(remaining);

        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.textContent = formatted;
            
            // Change color based on time remaining
            if (remaining <= 0) {
                clockEl.style.color = '#dc3545'; // Red when time's up
            } else if (remaining <= 30000) {
                clockEl.style.color = '#ffc107'; // Yellow for last 30 seconds
            } else {
                clockEl.style.color = '#CBFF73'; // Green
            }
        }

        // Auto-stop when time runs out
        if (remaining <= 0 && this.isRunning) {
            this.stopTimer();
        }
    }

    formatCountdown(milliseconds) {
        const totalSeconds = milliseconds / 1000;
        const seconds = Math.floor(totalSeconds);
        const ms = Math.floor((milliseconds % 1000) / 10);
        
        return `${seconds.toString().padStart(3, '0')}.${ms.toString().padStart(2, '0')}`;
    }
}

// Initialize the clock when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SyncedClock();
});

