// script.js - Ultimate Edition V3.0 (HLS + AI Features)

class WebPlayerPro {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.video = document.getElementById('mainVideo');
        this.ambientCanvas = document.getElementById('ambientCanvas');
        this.ctx = this.ambientCanvas.getContext('2d', { alpha: false, desynchronized: true });
        
        // Configuration & State
        this.state = {
            hls: null,
            audioCtx: null,
            sourceNode: null,
            gainNode: null,
            pannerNode: null,
            compressorNode: null,
            mediaRecorder: null,
            recordedChunks: [],
            isRecording: false,
            audioBoost: false,
            audio8D: false,
            ecoMode: false,
            brightness: 1,
            controlsTimer: null,
            ambientId: null,
            pannerId: null,
            lastTap: 0
        };

        // Cache DOM Elements
        this.ui = {
            playBtn: document.getElementById('playPauseBtn'),
            bigPlayBtn: document.getElementById('bigPlayBtn'),
            progressBar: document.getElementById('progressBar'),
            bufferBar: document.getElementById('bufferBar'),
            progressArea: document.getElementById('progressArea'),
            tooltip: document.getElementById('progressTooltip'),
            timeDisplay: document.getElementById('currentTime'),
            durationDisplay: document.getElementById('duration'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            pipBtn: document.getElementById('pipBtn'),
            volumeBtn: document.getElementById('muteBtn'),
            volumeSlider: document.getElementById('volumeSlider'),
            skipIntroBtn: document.getElementById('skipIntroBtn'),
            toast: document.getElementById('toast'),
            overlay: document.getElementById('brightnessOverlay'),
            feedback: document.getElementById('gestureFeedback'),
            liveBadge: document.getElementById('liveBadge'),
            // Menus
            settingsBtn: document.getElementById('settingsBtn'),
            settingsMenu: document.getElementById('settingsMenu'),
            audioMenuBtn: document.getElementById('audioMenuBtn'),
            audioMenu: document.getElementById('audioMenu'),
            effectsBtn: document.getElementById('videoEffectsBtn'),
            effectsMenu: document.getElementById('effectsMenu'),
            recordBtn: document.getElementById('recordBtn'),
            // Effects Inputs
            effectsInputs: document.querySelectorAll('.effects-menu input'),
            resetEffectsBtn: document.getElementById('resetEffects')
        };

        this.init();
    }

    init() {
        this.initHLS(); // Start Streaming Engine
        this.setupEventListeners();
        this.loadSettings();
        
        // Start Ambient Light Loop
        if ('requestVideoFrameCallback' in this.video) {
            this.video.requestVideoFrameCallback(this.updateAmbientLight.bind(this));
        } else {
            this.loopAmbientLight();
        }
    }

    // --- 1. HLS & Streaming Engine ---
    initHLS() {
        // Example Stream (HLS Test Source) - Replace with your own URL
        const streamURL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'; 
        
        if (Hls.isSupported()) {
            this.state.hls = new Hls({
                capLevelToPlayerSize: true, // Auto quality based on size
                startLevel: -1 // Auto start
            });
            this.state.hls.loadSource(streamURL);
            this.state.hls.attachMedia(this.video);
            this.state.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.showToast('Ready to Stream 🚀');
            });
            this.state.hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
                const level = this.state.hls.levels[data.level];
                if(level) this.showToast(`Quality: ${level.height}p`);
            });
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = streamURL; // Safari Fallback
        } else {
            // MP4 Fallback
            this.video.src = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';
        }
    }

    // --- 2. Audio Engine (Web Audio API) ---
    initAudio() {
        if (this.state.audioCtx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.state.audioCtx = new AudioContext();
        
        // Nodes
        this.state.sourceNode = this.state.audioCtx.createMediaElementSource(this.video);
        this.state.gainNode = this.state.audioCtx.createGain(); // For Boost
        this.state.compressorNode = this.state.audioCtx.createDynamicsCompressor(); // For Dialog
        this.state.pannerNode = this.state.audioCtx.createStereoPanner(); // For 8D
        
        // Compressor Settings (Voice Clarity)
        this.state.compressorNode.threshold.value = -50;
        this.state.compressorNode.knee.value = 40;
        this.state.compressorNode.ratio.value = 12;

        // Default Graph: Source -> Panner -> Destination
        this.state.sourceNode.connect(this.state.pannerNode);
        this.state.pannerNode.connect(this.state.audioCtx.destination);
    }

    toggleAudioBoost() {
        this.initAudio();
        this.state.audioBoost = !this.state.audioBoost;
        
        // Re-route Graph
        this.state.sourceNode.disconnect();
        this.state.pannerNode.disconnect();
        this.state.compressorNode.disconnect();
        this.state.gainNode.disconnect();

        if (this.state.audioBoost) {
            // Path: Source -> Compressor -> Gain -> Panner -> Dest
            this.state.gainNode.gain.value = 1.5; // +50% Vol
            this.state.sourceNode.connect(this.state.compressorNode);
            this.state.compressorNode.connect(this.state.gainNode);
            this.state.gainNode.connect(this.state.pannerNode);
            this.state.pannerNode.connect(this.state.audioCtx.destination);
            document.querySelector('#boostToggle span').innerText = 'ON';
            document.querySelector('#boostToggle span').style.color = 'var(--accent-color)';
            this.showToast('Audio Boost: Active 🔊');
        } else {
            // Normal Path
            this.state.sourceNode.connect(this.state.pannerNode);
            this.state.pannerNode.connect(this.state.audioCtx.destination);
            document.querySelector('#boostToggle span').innerText = 'OFF';
            document.querySelector('#boostToggle span').style.color = 'inherit';
            this.showToast('Audio Boost: Normal');
        }
    }

    toggle8DAudio() {
        this.initAudio();
        this.state.audio8D = !this.state.audio8D;
        const badge = document.querySelector('#audio8DToggle span');

        if (this.state.audio8D) {
            badge.innerText = 'ON';
            badge.style.color = 'var(--accent-color)';
            this.showToast('8D Audio: Active 🎧');
            
            // Start Oscillation
            let startTime = this.state.audioCtx.currentTime;
            const oscillate = () => {
                if (!this.state.audio8D) {
                    this.state.pannerNode.pan.value = 0;
                    return;
                }
                // Sine wave from -1 to 1 every 8 seconds
                const time = this.state.audioCtx.currentTime - startTime;
                this.state.pannerNode.pan.value = Math.sin(time / 2); 
                this.state.pannerId = requestAnimationFrame(oscillate);
            };
            oscillate();
        } else {
            badge.innerText = 'OFF';
            badge.style.color = 'inherit';
            cancelAnimationFrame(this.state.pannerId);
            this.state.pannerNode.pan.value = 0;
            this.showToast('8D Audio: Disabled');
        }
    }

    // --- 3. Visuals & Ambient Light ---
    updateAmbientLight(now, metadata) {
        if (this.state.ecoMode || this.video.paused) {
             if('requestVideoFrameCallback' in this.video) 
                 this.video.requestVideoFrameCallback(this.updateAmbientLight.bind(this));
             return;
        }

        this.ctx.drawImage(this.video, 0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
        this.video.requestVideoFrameCallback(this.updateAmbientLight.bind(this));
    }

    loopAmbientLight() {
        // Fallback for older browsers
        const loop = () => {
            if (!this.state.ecoMode && !this.video.paused) {
                this.ctx.drawImage(this.video, 0, 0, this.ambientCanvas.width, this.ambientCanvas.height);
            }
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    toggleEcoMode() {
        this.state.ecoMode = !this.state.ecoMode;
        const icon = document.querySelector('#ecoModeToggle .toggle-icon');
        
        if (this.state.ecoMode) {
            this.ambientCanvas.style.opacity = 0;
            if (this.state.hls) this.state.hls.currentLevel = 0; // Lowest quality
            icon.innerText = 'ON';
            icon.style.color = '#00ff00';
            this.showToast('Eco Mode: ON 🍃');
        } else {
            this.ambientCanvas.style.opacity = 0.5;
            if (this.state.hls) this.state.hls.currentLevel = -1; // Auto
            icon.innerText = 'OFF';
            icon.style.color = 'inherit';
            this.showToast('Eco Mode: OFF');
        }
    }

    // --- 4. Logic & Features ---
    togglePlay() {
        if (this.video.paused) {
            this.video.play().catch(e => console.error(e));
            this.initAudio(); // Initialize audio context on first user interaction
        } else {
            this.video.pause();
        }
    }

    recordClip() {
        // Uses MediaRecorder to capture the video stream
        if (this.state.isRecording) {
            this.state.mediaRecorder.stop();
            return;
        }

        // Try to capture stream from video (Cross-Origin might block this)
        // Fallback: Capture from Canvas (if no subtitles/overlay needed)
        try {
            // Note: captureStream might require flags in some browsers or CORS set correctly
            const stream = this.video.captureStream ? this.video.captureStream() : this.video.mozCaptureStream();
            
            this.state.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
            this.state.recordedChunks = [];

            this.state.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.state.recordedChunks.push(e.data);
            };

            this.state.mediaRecorder.onstop = () => {
                const blob = new Blob(this.state.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `clip_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                this.state.isRecording = false;
                this.ui.recordBtn.classList.remove('recording');
                this.showToast('Clip Saved! 💾');
            };

            this.state.mediaRecorder.start();
            this.state.isRecording = true;
            this.ui.recordBtn.classList.add('recording');
            this.showToast('Recording... (Max 10s)');

            // Auto stop after 10 seconds
            setTimeout(() => {
                if(this.state.isRecording) this.state.mediaRecorder.stop();
            }, 10000);

        } catch (e) {
            this.showToast('Error: CORS protects this video from recording');
            console.error(e);
        }
    }

    applyColorGrade() {
        const filters = [];
        this.ui.effectsInputs.forEach(input => {
            const unit = input.dataset.filter === 'hue-rotate' ? 'deg' : '%';
            filters.push(`${input.dataset.filter}(${input.value}${unit})`);
        });
        this.video.style.filter = filters.join(' ');
    }

    // --- 5. Events & Inputs ---
    setupEventListeners() {
        // Playback
        const toggle = () => this.togglePlay();
        this.ui.playBtn.onclick = toggle;
        this.ui.bigPlayBtn.onclick = toggle;
        this.video.onclick = toggle;

        this.video.onplay = () => {
            this.container.classList.remove('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.ui.bigPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        };
        this.video.onpause = () => {
            this.container.classList.add('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            this.ui.bigPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        };

        // Time Update (Smart Resume Logic + Intro Skip)
        this.video.ontimeupdate = () => {
            const curr = this.video.currentTime;
            const dur = this.video.duration || 0;
            
            // Update UI
            this.ui.progressBar.style.width = `${(curr/dur)*100}%`;
            this.ui.timeDisplay.innerText = this.formatTime(curr);
            this.ui.durationDisplay.innerText = this.formatTime(dur);
            
            // Mock Smart Intro Skip (Appear between 0:05 and 0:15)
            if (curr > 5 && curr < 15) this.ui.skipIntroBtn.classList.add('show');
            else this.ui.skipIntroBtn.classList.remove('show');

            localStorage.setItem('v-resume-time', curr);
        };

        // Seeking
        this.ui.progressArea.onclick = (e) => {
            const width = this.ui.progressArea.clientWidth;
            const clickX = e.offsetX;
            const duration = this.video.duration;
            this.video.currentTime = (clickX / width) * duration;
        };
        this.ui.progressArea.onmousemove = (e) => {
             const width = this.ui.progressArea.clientWidth;
             const hoverX = e.offsetX;
             const time = (hoverX / width) * this.video.duration;
             this.ui.tooltip.style.left = `${e.offsetX}px`;
             this.ui.tooltip.innerText = this.formatTime(time);
        };

        // Volume
        this.ui.volumeSlider.oninput = (e) => {
            this.video.volume = e.target.value;
            this.video.muted = e.target.value == 0;
            this.updateVolumeUI();
        };
        this.ui.volumeBtn.onclick = () => {
            this.video.muted = !this.video.muted;
            this.updateVolumeUI();
        };

        // Menus Toggles
        const toggleMenu = (btn, menu) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                // Close others
                document.querySelectorAll('.dropdown-menu, .settings-menu').forEach(m => {
                    if(m !== menu) m.classList.remove('show');
                });
                menu.classList.toggle('show');
            };
        };
        toggleMenu(this.ui.settingsBtn, this.ui.settingsMenu);
        toggleMenu(this.ui.audioMenuBtn, this.ui.audioMenu);
        toggleMenu(this.ui.effectsBtn, this.ui.effectsMenu);
        
        document.onclick = (e) => {
            if(!e.target.closest('.control-btn') && !e.target.closest('.dropdown-menu') && !e.target.closest('.settings-menu')) {
                 document.querySelectorAll('.dropdown-menu, .settings-menu').forEach(m => m.classList.remove('show'));
            }
        };

        // Feature Buttons
        document.getElementById('boostToggle').onclick = () => this.toggleAudioBoost();
        document.getElementById('audio8DToggle').onclick = () => this.toggle8DAudio();
        document.getElementById('ecoModeToggle').onclick = () => this.toggleEcoMode();
        this.ui.recordBtn.onclick = () => this.recordClip();
        this.ui.skipIntroBtn.onclick = () => {
            this.video.currentTime += 85; // Skip typical anime intro length
            this.showToast('Intro Skipped ⏩');
        };
        this.ui.fullscreenBtn.onclick = () => {
            if(!document.fullscreenElement) this.container.requestFullscreen();
            else document.exitFullscreen();
        };

        // Effects
        this.ui.effectsInputs.forEach(input => {
            input.oninput = () => this.applyColorGrade();
        });
        this.ui.resetEffectsBtn.onclick = () => {
            this.ui.effectsInputs.forEach(i => i.value = i.getAttribute('value'));
            this.applyColorGrade();
        };

        // Keyboard Shortcuts
        document.onkeydown = (e) => {
            if (e.target.tagName === 'INPUT') return;
            switch(e.key.toLowerCase()) {
                case ' ': e.preventDefault(); this.togglePlay(); break;
                case 'f': this.container.requestFullscreen(); break;
                case 'm': this.ui.volumeBtn.click(); break;
                case 'arrowright': this.video.currentTime += 5; this.showFeedback('⏩ +5s'); break;
                case 'arrowleft': this.video.currentTime -= 5; this.showFeedback('⏪ -5s'); break;
            }
        };

        // Gestures (Touch)
        this.setupGestures();
    }

    setupGestures() {
        let touchX, touchY;
        this.container.ontouchstart = (e) => {
            touchX = e.touches[0].clientX;
            touchY = e.touches[0].clientY;
        };
        this.container.ontouchmove = (e) => {
            e.preventDefault();
            if(!touchX) return;
            const diffX = touchX - e.touches[0].clientX;
            const diffY = touchY - e.touches[0].clientY;
            
            if(Math.abs(diffX) > Math.abs(diffY)) {
                if(Math.abs(diffX) > 10) {
                    this.video.currentTime += diffX > 0 ? -0.2 : 0.2; // Seek
                }
            } else {
                 if(touchX > this.container.clientWidth / 2) {
                     // Volume (Right side)
                     const v = Math.min(1, Math.max(0, this.video.volume + (diffY > 0 ? 0.02 : -0.02)));
                     this.video.volume = v;
                     this.ui.volumeSlider.value = v;
                     this.showFeedback(`🔊 ${Math.round(v*100)}%`);
                 } else {
                     // Brightness (Left side)
                     this.state.brightness = Math.min(1, Math.max(0.2, this.state.brightness + (diffY > 0 ? 0.02 : -0.02)));
                     this.ui.overlay.style.opacity = 1 - this.state.brightness;
                     this.showFeedback(`🔆 ${Math.round(this.state.brightness*100)}%`);
                 }
            }
            touchX = e.touches[0].clientX;
            touchY = e.touches[0].clientY;
        };
        
        // Double Tap
        this.container.ontouchend = (e) => {
            const now = new Date().getTime();
            if (now - this.state.lastTap < 300) {
                // Double tap
                const x = e.changedTouches[0].clientX;
                if (x < this.container.clientWidth / 3) {
                    this.video.currentTime -= 10;
                    this.showFeedback('⏪ -10s');
                } else if (x > (this.container.clientWidth * 2) / 3) {
                    this.video.currentTime += 10;
                    this.showFeedback('⏩ +10s');
                } else {
                    this.togglePlay();
                }
            }
            this.state.lastTap = now;
        };
    }

    // --- Helpers ---
    loadSettings() {
        // Smart Resume
        const savedTime = localStorage.getItem('v-resume-time');
        if (savedTime && parseFloat(savedTime) > 10) {
            this.video.currentTime = parseFloat(savedTime) - 5; // Rewind 5s context
            this.showToast('Resuming playback... 🔄');
        }
    }

    updateVolumeUI() {
        const v = this.video.volume;
        if(this.video.muted || v === 0) this.ui.volumeBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        else if(v < 0.5) this.ui.volumeBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        else this.ui.volumeBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }

    formatTime(s) {
        if(isNaN(s)) return "00:00";
        return new Date(s * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
    }

    showToast(msg) {
        this.ui.toast.innerText = msg;
        this.ui.toast.classList.add('show');
        setTimeout(() => this.ui.toast.classList.remove('show'), 2000);
    }
    
    showFeedback(text) {
        this.ui.feedback.innerText = text;
        this.ui.feedback.classList.add('show');
        setTimeout(() => this.ui.feedback.classList.remove('show'), 500);
    }
}

// Launch
document.addEventListener('DOMContentLoaded', () => {
    window.player = new WebPlayerPro('playerContainer');
});