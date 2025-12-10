// script.js - Ultimate Edition V2.0 (OOP & Optimized)

class VideoPlayer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.video = document.getElementById('mainVideo');
        this.ambientCanvas = document.getElementById('ambientCanvas');
        this.ctx = this.ambientCanvas.getContext('2d', { alpha: false });
        
        // UI Elements
        this.controls = {
            playBtn: document.getElementById('playPauseBtn'),
            bigPlayBtn: document.getElementById('bigPlayBtn'),
            progressBar: document.getElementById('progressBar'),
            bufferBar: document.getElementById('bufferBar'), // New
            progressArea: document.getElementById('progressArea'),
            progressTooltip: document.getElementById('progressTooltip'),
            timeDisplay: document.getElementById('currentTime'),
            durationDisplay: document.getElementById('duration'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            volumeBtn: document.getElementById('muteBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            settingsBtn: document.getElementById('settingsBtn'),
            settingsMenu: document.getElementById('settingsMenu'),
            pipBtn: document.getElementById('pipBtn'),
            audioBoostBtn: document.getElementById('audioBoostBtn'), // New
            screenshotBtn: document.getElementById('screenshotBtn'), // New
            aspectBtn: document.getElementById('aspectBtn'), // New
            toast: document.getElementById('toast'),
            spinner: document.getElementById('spinner'),
            brightnessOverlay: document.getElementById('brightnessOverlay'), // New
            gestureFeedback: document.getElementById('gestureFeedback') // New
        };

        // State
        this.state = {
            isMouseDown: false,
            controlsTimeout: null,
            ambientId: null,
            lastAmbientDraw: 0,
            audioContext: null,
            audioSource: null,
            compressorNode: null,
            gainNode: null,
            isAudioBoosted: false,
            brightness: 1, // 1 = 100%
            aspectRatioMode: 0, // 0: Contain, 1: Cover, 2: Fill
            aspectModes: ['', 'aspect-cover', 'aspect-fill']
        };

        this.init();
    }

    init() {
        this.loadSettings();
        this.setupEventListeners();
        this.setupMobileGestures();
        
        // Set Canvas Size initially
        this.ambientCanvas.width = 150; // Low res for performance
        this.ambientCanvas.height = 85;
    }

    // --- 1. Settings & Storage ---
    loadSettings() {
        // Volume
        const savedVol = localStorage.getItem('v-volume');
        if (savedVol !== null) {
            this.video.volume = parseFloat(savedVol);
            this.controls.volumeSlider.value = savedVol;
        }
        
        // Speed
        const savedSpeed = localStorage.getItem('v-speed');
        if (savedSpeed) this.setSpeed(parseFloat(savedSpeed));

        // Time (Resume)
        const savedTime = localStorage.getItem('v-time');
        if (savedTime) {
            this.video.currentTime = parseFloat(savedTime);
            this.showToast(`استكمال من ${this.formatTime(this.video.currentTime)}`);
        }

        // Filter
        const savedFilter = localStorage.getItem('v-filter');
        if (savedFilter) this.applyFilter(savedFilter);

        this.updateVolumeIcon();
    }

    saveSetting(key, value) {
        localStorage.setItem(`v-${key}`, value);
    }

    // --- 2. Event Listeners ---
    setupEventListeners() {
        // Playback
        this.controls.playBtn.addEventListener('click', () => this.togglePlay());
        this.controls.bigPlayBtn.addEventListener('click', () => this.togglePlay());
        this.video.addEventListener('click', () => this.togglePlay());
        this.video.addEventListener('play', () => this.updatePlayState(true));
        this.video.addEventListener('pause', () => this.updatePlayState(false));
        
        // Time & Buffer
        this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.video.addEventListener('progress', () => this.updateBuffer());
        
        // Seek
        this.controls.progressArea.addEventListener('click', (e) => this.seek(e));
        this.controls.progressArea.addEventListener('mousemove', (e) => this.handleSeekHover(e));
        this.controls.progressArea.addEventListener('mousedown', () => this.state.isMouseDown = true);
        document.addEventListener('mouseup', () => this.state.isMouseDown = false);
        this.controls.progressArea.addEventListener('mousemove', (e) => {
            if (this.state.isMouseDown) this.seek(e);
        });

        // Volume
        this.controls.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));
        this.controls.volumeBtn.addEventListener('click', () => this.toggleMute());

        // Fullscreen & PIP
        this.controls.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());
        this.container.addEventListener('dblclick', () => this.toggleFullscreen());
        this.controls.pipBtn.addEventListener('click', () => this.togglePip());

        // Settings Menu
        this.controls.settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.controls.settingsMenu.classList.toggle('show');
        });
        document.addEventListener('click', (e) => {
            if (!this.controls.settingsMenu.contains(e.target) && e.target !== this.controls.settingsBtn) {
                this.controls.settingsMenu.classList.remove('show');
            }
        });

        // Settings Items (Speed & Filter)
        document.querySelectorAll('#settingsMenu li[data-speed]').forEach(item => {
            item.addEventListener('click', () => {
                this.setSpeed(parseFloat(item.dataset.speed));
                this.highlightMenuItem(item, 'data-speed');
            });
        });
        document.querySelectorAll('#settingsMenu li[data-filter]').forEach(item => {
            item.addEventListener('click', () => {
                this.applyFilter(item.dataset.filter);
                this.highlightMenuItem(item, 'data-filter');
            });
        });

        // Shortcuts
        document.addEventListener('keydown', (e) => this.handleShortcuts(e));

        // Loading Errors
        this.video.addEventListener('waiting', () => this.container.classList.add('buffering'));
        this.video.addEventListener('playing', () => this.container.classList.remove('buffering'));

        // Controls Visibility
        this.container.addEventListener('mousemove', () => this.showControls());
        this.container.addEventListener('touchstart', () => this.showControls());

        // --- NEW FEATURES LISTENERS ---
        this.controls.audioBoostBtn.addEventListener('click', () => this.toggleAudioBoost());
        this.controls.screenshotBtn.addEventListener('click', () => this.takeSnapshot());
        this.controls.aspectBtn.addEventListener('click', () => this.toggleAspectRatio());
    }

    // --- 3. Logic & Methods ---

    togglePlay() {
        if (this.video.paused) {
            this.video.play();
            this.initAudioSystem(); // Init audio context on first interaction
        } else {
            this.video.pause();
        }
    }

    updatePlayState(isPlaying) {
        if (isPlaying) {
            this.container.classList.remove('paused');
            this.controls.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.controls.bigPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.startAmbientLight();
        } else {
            this.container.classList.add('paused');
            this.controls.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            this.controls.bigPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            this.stopAmbientLight();
        }
    }

    handleTimeUpdate() {
        const current = this.video.currentTime;
        const duration = this.video.duration || 0;
        const progressPercent = (current / duration) * 100;
        
        this.controls.progressBar.style.width = `${progressPercent}%`;
        this.controls.timeDisplay.innerText = this.formatTime(current);
        this.controls.durationDisplay.innerText = this.formatTime(duration);
        
        this.saveSetting('time', current);
    }

    updateBuffer() {
        if (this.video.duration > 0) {
            for (let i = 0; i < this.video.buffered.length; i++) {
                if (this.video.buffered.start(i) <= this.video.currentTime && this.video.buffered.end(i) >= this.video.currentTime) {
                    const bufferedEnd = this.video.buffered.end(i);
                    const width = (bufferedEnd / this.video.duration) * 100;
                    this.controls.bufferBar.style.width = `${width}%`;
                    break;
                }
            }
        }
    }

    seek(e) {
        const width = this.controls.progressArea.clientWidth;
        const clickX = e.offsetX;
        const duration = this.video.duration;
        this.video.currentTime = (clickX / width) * duration;
    }

    handleSeekHover(e) {
        const width = this.controls.progressArea.clientWidth;
        const hoverX = e.offsetX;
        const time = (hoverX / width) * this.video.duration;
        const percent = (hoverX / width) * 100;
        
        this.controls.progressTooltip.style.left = `${percent}%`;
        this.controls.progressTooltip.innerText = this.formatTime(time);
    }

    setVolume(value) {
        this.video.volume = value;
        this.video.muted = value === '0';
        this.updateVolumeIcon();
        this.saveSetting('volume', value);
        this.showToast(`Volume: ${Math.round(value * 100)}%`);
    }

    toggleMute() {
        this.video.muted = !this.video.muted;
        this.controls.volumeSlider.value = this.video.muted ? 0 : this.video.volume || 1;
        this.updateVolumeIcon();
    }

    updateVolumeIcon() {
        const vol = this.video.volume;
        const btn = this.controls.volumeBtn;
        if (this.video.muted || vol === 0) btn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        else if (vol < 0.5) btn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else btn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }

    setSpeed(speed) {
        this.video.playbackRate = speed;
        this.saveSetting('speed', speed);
        this.showToast(`Speed: ${speed}x`);
    }

    applyFilter(filterName) {
        this.video.className = ''; // Reset classes
        // Re-apply aspect ratio class if exists
        if(this.state.aspectRatioMode > 0) {
            this.video.classList.add(this.state.aspectModes[this.state.aspectRatioMode]);
        }
        
        if (filterName !== 'normal') {
            this.video.classList.add(`filter-${filterName}`);
        }
        this.saveSetting('filter', filterName);
    }

    highlightMenuItem(clickedItem, dataAttr) {
        document.querySelectorAll(`#settingsMenu li[${dataAttr}]`).forEach(item => item.classList.remove('active'));
        clickedItem.classList.add('active');
        this.controls.settingsMenu.classList.remove('show');
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.container.requestFullscreen();
            this.controls.fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            document.exitFullscreen();
            this.controls.fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    }

    togglePip() {
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else this.video.requestPictureInPicture();
    }

    // --- 4. Advanced Features (Boost, Ambient, Screenshot) ---

    // A. Ambient Light (Optimized with RequestAnimationFrame)
    startAmbientLight() {
        if (this.state.ambientId) cancelAnimationFrame(this.state.ambientId);
        
        const draw = (timestamp) => {
            // Throttle to 30fps (every ~33ms) to save CPU
            if (timestamp - this.state.lastAmbientDraw > 33) {
                if (!this.video.paused && !this.video.ended) {
                    this.ctx.drawImage(this.video, 0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
                }
                this.state.lastAmbientDraw = timestamp;
            }
            this.state.ambientId = requestAnimationFrame(draw);
        };
        this.state.ambientId = requestAnimationFrame(draw);
    }

    stopAmbientLight() {
        if (this.state.ambientId) {
            cancelAnimationFrame(this.state.ambientId);
            this.state.ambientId = null;
        }
    }

    // B. Audio Booster (Web Audio API)
    initAudioSystem() {
        if (this.state.audioContext) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.state.audioContext = new AudioContext();
        
        // Create nodes
        this.state.audioSource = this.state.audioContext.createMediaElementSource(this.video);
        this.state.compressorNode = this.state.audioContext.createDynamicsCompressor();
        this.state.gainNode = this.state.audioContext.createGain();

        // Configure Compressor for "Dialogue Boost"
        this.state.compressorNode.threshold.value = -50;
        this.state.compressorNode.knee.value = 40;
        this.state.compressorNode.ratio.value = 12;
        this.state.compressorNode.attack.value = 0;
        this.state.compressorNode.release.value = 0.25;

        // Connect graph: Source -> Destination (Normal) initially
        this.state.audioSource.connect(this.state.audioContext.destination);
    }

    toggleAudioBoost() {
        if (!this.state.audioContext) this.initAudioSystem();
        
        this.state.isAudioBoosted = !this.state.isAudioBoosted;
        
        // Disconnect everything
        this.state.audioSource.disconnect();
        this.state.compressorNode.disconnect();
        this.state.gainNode.disconnect();

        if (this.state.isAudioBoosted) {
            // Path: Source -> Compressor -> Gain (Boost) -> Destination
            this.state.gainNode.gain.value = 1.5; // +50% volume
            this.state.audioSource.connect(this.state.compressorNode);
            this.state.compressorNode.connect(this.state.gainNode);
            this.state.gainNode.connect(this.state.audioContext.destination);
            
            this.controls.audioBoostBtn.classList.add('active');
            this.showToast('Audio Boost: ON 🚀');
        } else {
            // Path: Source -> Destination
            this.state.audioSource.connect(this.state.audioContext.destination);
            this.controls.audioBoostBtn.classList.remove('active');
            this.showToast('Audio Boost: OFF');
        }
    }

    // C. Screenshot
    takeSnapshot() {
        const canvas = document.createElement('canvas');
        canvas.width = this.video.videoWidth;
        canvas.height = this.video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(this.video, 0, 0, canvas.width, canvas.height);
        
        try {
            const dataURL = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `snapshot_${Date.now()}.png`;
            link.href = dataURL;
            link.click();
            this.showToast('تم حفظ لقطة الشاشة 📸');
        } catch (e) {
            this.showToast('فشل حفظ الصورة (CORS Error)');
        }
    }

    // D. Aspect Ratio
    toggleAspectRatio() {
        this.state.aspectRatioMode = (this.state.aspectRatioMode + 1) % 3;
        
        // Remove old classes
        this.video.classList.remove('aspect-cover', 'aspect-fill');
        
        // Add new class if needed
        const newClass = this.state.aspectModes[this.state.aspectRatioMode];
        if (newClass) this.video.classList.add(newClass);

        const modesNames = ['أصلي', 'تكبير (Cover)', 'تعبئة (Fill)'];
        this.showToast(`العرض: ${modesNames[this.state.aspectRatioMode]}`);
    }

    // --- 5. Mobile Gestures (Touch) ---
    setupMobileGestures() {
        let touchStartX = 0;
        let touchStartY = 0;
        let isSeeking = false;
        
        this.container.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        });

        this.container.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (!touchStartX || !touchStartY) return;

            const currentX = e.touches[0].clientX;
            const currentY = e.touches[0].clientY;
            const diffX = touchStartX - currentX;
            const diffY = touchStartY - currentY;
            
            // Check direction
            if (Math.abs(diffX) > Math.abs(diffY)) {
                // Horizontal (Seek)
                if (Math.abs(diffX) > 10) {
                    const seekTime = diffX > 0 ? -0.5 : 0.5; // Sensitivity
                    this.video.currentTime += seekTime;
                    this.showFeedback(diffX > 0 ? '⏪' : '⏩');
                }
            } else {
                // Vertical (Volume/Brightness)
                const containerWidth = this.container.clientWidth;
                if (touchStartX < containerWidth / 2) {
                    // Left Side: Brightness
                    if (Math.abs(diffY) > 5) {
                        const change = diffY > 0 ? 0.02 : -0.02;
                        this.state.brightness = Math.min(1, Math.max(0.2, this.state.brightness + change));
                        // Inverse logic for overlay opacity (0 brightness = 0.8 opacity black)
                        this.controls.brightnessOverlay.style.opacity = 1 - this.state.brightness;
                        this.showFeedback(`🔆 ${Math.round(this.state.brightness * 100)}%`);
                    }
                } else {
                    // Right Side: Volume
                    if (Math.abs(diffY) > 5) {
                         const change = diffY > 0 ? 0.02 : -0.02;
                         const newVol = Math.min(1, Math.max(0, this.video.volume + change));
                         this.setVolume(newVol);
                         this.controls.volumeSlider.value = newVol;
                         this.showFeedback(`🔊 ${Math.round(newVol * 100)}%`);
                    }
                }
            }
            // Reset for smooth drag
            touchStartX = currentX;
            touchStartY = currentY;
        });

        // Double Tap
        let lastTap = 0;
        this.container.addEventListener('touchend', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                // Double Tap Detected
                const width = this.container.clientWidth;
                const x = e.changedTouches[0].clientX;
                if (x < width / 3) {
                    this.video.currentTime -= 10;
                    this.showFeedback('⏪ -10s');
                } else if (x > (width * 2) / 3) {
                    this.video.currentTime += 10;
                    this.showFeedback('⏩ +10s');
                } else {
                    this.togglePlay();
                }
            }
            lastTap = currentTime;
        });
    }

    showFeedback(text) {
        const el = this.controls.gestureFeedback;
        el.innerText = text;
        el.classList.add('show');
        clearTimeout(this.gestureTimeout);
        this.gestureTimeout = setTimeout(() => el.classList.remove('show'), 500);
    }

    // --- 6. Helpers ---
    showToast(msg) {
        this.controls.toast.innerText = msg;
        this.controls.toast.classList.add('show');
        setTimeout(() => this.controls.toast.classList.remove('show'), 2000);
    }

    showControls() {
        this.container.classList.remove('hide-cursor');
        this.container.classList.add('show-controls');
        clearTimeout(this.state.controlsTimeout);
        this.state.controlsTimeout = setTimeout(() => {
            if (!this.video.paused) {
                this.container.classList.remove('show-controls');
                this.container.classList.add('hide-cursor');
            }
        }, 3000);
    }

    handleShortcuts(e) {
        if (document.activeElement.tagName === 'INPUT') return;
        
        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k': e.preventDefault(); this.togglePlay(); break;
            case 'f': this.toggleFullscreen(); break;
            case 'm': this.toggleMute(); break;
            case 'arrowright': this.video.currentTime += 5; this.showToast("+ 5s"); break;
            case 'arrowleft': this.video.currentTime -= 5; this.showToast("- 5s"); break;
            case 'arrowup': 
                e.preventDefault(); 
                this.setVolume(Math.min(1, this.video.volume + 0.1)); 
                this.controls.volumeSlider.value = this.video.volume;
                break;
            case 'arrowdown': 
                e.preventDefault(); 
                this.setVolume(Math.max(0, this.video.volume - 0.1)); 
                this.controls.volumeSlider.value = this.video.volume;
                break;
        }
    }

    formatTime(time) {
        if (isNaN(time)) return "00:00";
        let seconds = Math.floor(time % 60);
        let minutes = Math.floor(time / 60) % 60;
        let hours = Math.floor(time / 3600);
        seconds = seconds < 10 ? `0${seconds}` : seconds;
        minutes = minutes < 10 ? `0${minutes}` : minutes;
        if (hours == 0) return `${minutes}:${seconds}`;
        return `${hours}:${minutes}:${seconds}`;
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    window.player = new VideoPlayer('playerContainer');
});