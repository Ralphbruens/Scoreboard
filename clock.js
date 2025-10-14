// Clock page - synchronized with recording page
class SyncedClock {
    constructor() {
        this.startTime = null;
        this.timerInterval = null;
        this.isRunning = false;
        this.channel = null;
        
        this.init();
    }

    init() {
        // Create BroadcastChannel for communication between pages
        this.channel = new BroadcastChannel('timer-sync');
        
        // Listen for messages from the recording page
        this.channel.onmessage = (event) => {
            this.handleMessage(event.data);
        };

        console.log('Clock initialized and listening for timer events...');
    }

    handleMessage(data) {
        console.log('Received message:', data);
        
        switch(data.type) {
            case 'timer-start':
                this.startTimer(data.startTime);
                break;
            case 'timer-stop':
                this.stopTimer();
                break;
            case 'timer-reset':
                this.resetTimer();
                break;
        }
    }

    startTimer(startTime) {
        console.log('Starting timer with start time:', startTime);
        this.startTime = startTime;
        this.isRunning = true;
        
        // Update status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Running';
            statusEl.classList.add('running');
            statusEl.classList.remove('stopped');
        }

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
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Stopped';
            statusEl.classList.add('stopped');
            statusEl.classList.remove('running');
        }
    }

    resetTimer() {
        console.log('Resetting timer');
        this.stopTimer();
        this.startTime = null;
        
        // Reset display
        const clockEl = document.getElementById('clock');
        if (clockEl) {
            clockEl.textContent = '120.00';
            clockEl.style.color = '#CBFF73';
        }

        // Update status
        const statusEl = document.getElementById('status');
        if (statusEl) {
            statusEl.textContent = 'Waiting...';
            statusEl.classList.remove('running', 'stopped');
        }
    }

    updateDisplay() {
        if (!this.isRunning || !this.startTime) return;

        const elapsed = Date.now() - this.startTime;
        const remaining = Math.max(0, 120000 - elapsed); // 120 seconds = 120000ms
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

