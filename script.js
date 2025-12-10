// script.js - Ultimate AI Edition V4.0
// Features: Worker-based Ambience, Cinema DSP Audio, Accessibility, Smart Skip

// --- 0. Performance: Ambient Light Worker (Inline Blob) ---
const workerCode = `
    let canvas, ctx, interval;
    self.onmessage = function(e) {
        if (e.data.type === 'init') {
            canvas = e.data.canvas;
            ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
        } else if (e.data.type === 'frame') {
            if(!ctx) return;
            // Draw frame bitmap efficiently
            ctx.drawImage(e.data.bitmap, 0, 0, canvas.width, canvas.height);
            e.data.bitmap.close(); // Important: Release memory
        }
    };
`;

class WebPlayerPro {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.video = document.getElementById('mainVideo');
        this.ambientCanvas = document.getElementById('ambientCanvas');
        
        // Configuration
        this.config = {
            hls: null,
            audioCtx: null,
            nodes: {}, // Audio Nodes
            worker: null,
            mediaRecorder: null,
            recordedChunks: [],
            isRecording: false,
            settings: {
                volume: 1,
                speed: 1,
                eco: false,
                theater: false,
                spatial: false,
                dialogue: false,
                superRes: false
            }
        };

        this.ui = this.cacheDOM();
        this.init();
    }

    cacheDOM() {
        return {
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
            spinner: document.getElementById('spinner'),
            // Menus
            settingsBtn: document.getElementById('settingsBtn'),
            settingsMenu: document.getElementById('settingsMenu'),
            audioMenuBtn: document.getElementById('audioMenuBtn'),
            audioMenu: document.getElementById('audioMenu'),
            aiMenuBtn: document.getElementById('aiMenuBtn'),
            aiMenu: document.getElementById('aiMenu'),
            recordBtn: document.getElementById('recordBtn')
        };
    }

    init() {
        this.initHLS();
        this.initWorker();
        this.setupEventListeners();
        this.loadPreferences();
        
        // Start Loop
        if ('requestVideoFrameCallback' in this.video) {
            this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
        }
    }

    // --- 1. Worker & Visuals ---
    initWorker() {
        if (window.Worker) {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            this.config.worker = new Worker(URL.createObjectURL(blob));
            
            // Transfer control of canvas to worker
            const offscreen = this.ambientCanvas.transferControlToOffscreen();
            this.config.worker.postMessage({ type: 'init', canvas: offscreen }, [offscreen]);
        }
    }

    updateAmbientLoop(now, metadata) {
        if (this.config.settings.eco || this.video.paused || this.video.ended) {
            // Stop loop in Eco mode or when paused
             if(!this.config.settings.eco && !this.video.paused) {
                 this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
             }
             return;
        }

        // Send frame to worker
        createImageBitmap(this.video).then(bitmap => {
            this.config.worker.postMessage({ type: 'frame', bitmap: bitmap }, [bitmap]);
        });

        this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
    }

    // --- 2. Advanced Audio Engine (Cinema DSP) ---
    initAudio() {
        if (this.config.audioCtx) return;
        
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.config.audioCtx = new AudioContext();
        
        // Base Graph
        this.config.nodes.source = this.config.audioCtx.createMediaElementSource(this.video);
        this.config.nodes.gain = this.config.audioCtx.createGain();
        
        // Effects Nodes
        this.config.nodes.compressor = this.config.audioCtx.createDynamicsCompressor(); // For Dialogue
        this.config.nodes.panner = this.config.audioCtx.createStereoPanner(); // For Spatial
        this.config.nodes.analyser = this.config.audioCtx.createAnalyser(); // For AI Visuals
        
        // Initial Connection: Source -> Gain -> Destination
        this.config.nodes.source.connect(this.config.nodes.gain);
        this.config.nodes.gain.connect(this.config.audioCtx.destination);
    }

    applyAudioEffects() {
        if (!this.config.audioCtx) this.initAudio();
        
        // Reset Connections
        this.config.nodes.source.disconnect();
        this.config.nodes.compressor.disconnect();
        this.config.nodes.panner.disconnect();
        this.config.nodes.gain.disconnect();

        let currentNode = this.config.nodes.source;

        // 1. Dialogue Boost (Compression + Gain)
        if (this.config.settings.dialogue) {
            this.config.nodes.compressor.threshold.value = -24;
            this.config.nodes.compressor.knee.value = 30;
            this.config.nodes.compressor.ratio.value = 12;
            this.config.nodes.compressor.attack.value = 0.003;
            this.config.nodes.compressor.release.value = 0.25;
            
            currentNode.connect(this.config.nodes.compressor);
            currentNode = this.config.nodes.compressor;
            this.config.nodes.gain.gain.value = 1.4; // Boost volume
        } else {
            this.config.nodes.gain.gain.value = 1.0;
        }

        // 2. Spatial Audio (Simulated 3D)
        if (this.config.settings.spatial) {
            // Simple oscillation to simulate movement or width
            if(!this.config.nodes.spatialInterval) {
                let startTime = this.config.audioCtx.currentTime;
                this.config.nodes.spatialInterval = setInterval(() => {
                    const time = this.config.audioCtx.currentTime - startTime;
                    // Subtle movement
                    this.config.nodes.panner.pan.value = Math.sin(time / 4) * 0.3; 
                }, 50);
            }
            currentNode.connect(this.config.nodes.panner);
            currentNode = this.config.nodes.panner;
        } else {
            if(this.config.nodes.spatialInterval) clearInterval(this.config.nodes.spatialInterval);
            this.config.nodes.panner.pan.value = 0;
        }

        // Final connection
        currentNode.connect(this.config.nodes.gain);
        this.config.nodes.gain.connect(this.config.audioCtx.destination);
    }

    // --- 3. Features Logic ---
    toggleSetting(key, element, type = 'bool') {
        this.config.settings[key] = !this.config.settings[key];
        const isOn = this.config.settings[key];
        
        // Update UI
        const span = element.querySelector('span');
        if(span) {
            span.innerText = isOn ? 'ON' : 'OFF';
            span.style.color = isOn ? 'var(--accent-color)' : 'inherit';
        }

        // Logic Switch
        switch(key) {
            case 'dialogue':
            case 'spatial':
                this.applyAudioEffects();
                this.showToast(`${key === 'dialogue' ? 'Voice Boost' : 'Spatial Audio'}: ${isOn ? 'Enabled' : 'Disabled'}`);
                break;
            case 'theater':
                document.body.classList.toggle('immersive-mode', isOn);
                this.showToast(isOn ? 'Immersive Mode Active 🍿' : 'Normal Mode');
                break;
            case 'eco':
                if(!isOn) this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
                this.showToast(isOn ? 'Battery Saver ON 🔋' : 'Battery Saver OFF');
                break;
            case 'upscale':
                // Simulated Super Resolution via CSS Filters
                this.video.style.filter = isOn ? 'contrast(1.1) saturate(1.1) drop-shadow(0 0 1px rgba(255,255,255,0.2))' : 'none';
                this.showToast(isOn ? 'AI Upscaling Active ✨' : 'Standard Resolution');
                break;
        }
    }

    recordClip() {
        if (this.config.isRecording) {
            this.config.mediaRecorder.stop();
            return;
        }

        try {
            // Attempt to capture stream (Requires CORS allowed source)
            const stream = this.video.captureStream ? this.video.captureStream() : this.video.mozCaptureStream();
            this.config.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' });
            this.config.recordedChunks = [];

            this.config.mediaRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) this.config.recordedChunks.push(e.data);
            };

            this.config.mediaRecorder.onstop = () => {
                const blob = new Blob(this.config.recordedChunks, { type: 'video/webm' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = `WebPlayer_Clip_${Date.now()}.webm`;
                document.body.appendChild(a);
                a.click();
                URL.revokeObjectURL(url);
                this.config.isRecording = false;
                this.ui.recordBtn.classList.remove('recording');
                this.ui.recordBtn.innerHTML = '<i class="fa-solid fa-scissors"></i>';
                this.showToast('Clip Saved Successfully 💾');
            };

            this.config.mediaRecorder.start();
            this.config.isRecording = true;
            this.ui.recordBtn.classList.add('recording');
            this.ui.recordBtn.innerHTML = '<i class="fa-solid fa-stop"></i>';
            this.showToast('Recording... (Max 15s)');
            
            // Auto stop
            setTimeout(() => { if(this.config.isRecording) this.config.mediaRecorder.stop(); }, 15000);

        } catch (e) {
            this.showToast('Error: Protected Content (DRM/CORS)');
            console.error(e);
        }
    }

    // --- 4. HLS & Basic Video Logic ---
    initHLS() {
        const streamURL = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'; // Test Source
        if (Hls.isSupported()) {
            this.config.hls = new Hls({ enableWorker: true, lowLatencyMode: true });
            this.config.hls.loadSource(streamURL);
            this.config.hls.attachMedia(this.video);
            this.config.hls.on(Hls.Events.MANIFEST_PARSED, () => this.ui.spinner.style.display = 'none');
            this.config.hls.on(Hls.Events.WAITING, () => this.container.classList.add('buffering'));
            this.config.hls.on(Hls.Events.FRAG_BUFFERED, () => this.container.classList.remove('buffering'));
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = streamURL;
        }
    }

    togglePlay() {
        if (this.video.paused) {
            this.video.play();
            this.initAudio(); // Initialize Context on gesture
        } else {
            this.video.pause();
        }
    }

    // --- 5. Event Listeners & UI ---
    setupEventListeners() {
        // Playback
        const toggle = () => this.togglePlay();
        this.ui.playBtn.onclick = toggle;
        this.ui.bigPlayBtn.onclick = toggle;
        this.video.onclick = toggle;
        
        this.video.onplay = () => {
            this.container.classList.remove('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            if(!this.config.settings.eco) this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
        };
        this.video.onpause = () => {
            this.container.classList.add('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        };

        // Time Update
        this.video.ontimeupdate = () => {
            const curr = this.video.currentTime;
            const dur = this.video.duration || 1;
            this.ui.progressBar.style.width = `${(curr/dur)*100}%`;
            this.ui.timeDisplay.innerText = this.formatTime(curr);
            this.ui.durationDisplay.innerText = this.formatTime(dur);

            // Smart Skip Trigger (Mock Logic)
            if (curr > 10 && curr < 20) this.ui.skipIntroBtn.classList.add('show');
            else this.ui.skipIntroBtn.classList.remove('show');
        };

        // Progress Seek
        this.ui.progressArea.onclick = (e) => {
            const width = this.ui.progressArea.clientWidth;
            const clickX = e.offsetX;
            this.video.currentTime = (clickX / width) * this.video.duration;
        };

        // Menus
        const toggleMenu = (btn, menu) => {
            btn.onclick = (e) => {
                e.stopPropagation();
                document.querySelectorAll('.dropdown-menu, .settings-menu').forEach(m => {
                    if(m !== menu) m.classList.remove('show');
                });
                menu.classList.toggle('show');
            };
        };
        toggleMenu(this.ui.settingsBtn, this.ui.settingsMenu);
        toggleMenu(this.ui.audioMenuBtn, this.ui.audioMenu);
        toggleMenu(this.ui.aiMenuBtn, this.ui.aiMenu);

        // Feature Toggles
        document.getElementById('dialogueBoostToggle').onclick = (e) => this.toggleSetting('dialogue', e.currentTarget);
        document.getElementById('spatialAudioToggle').onclick = (e) => this.toggleSetting('spatial', e.currentTarget);
        document.getElementById('theaterModeToggle').onclick = (e) => this.toggleSetting('theater', e.currentTarget);
        document.getElementById('ecoModeToggle').onclick = (e) => this.toggleSetting('eco', e.currentTarget);
        document.getElementById('upscaleToggle').onclick = (e) => this.toggleSetting('upscale', e.currentTarget);

        this.ui.recordBtn.onclick = () => this.recordClip();
        this.ui.skipIntroBtn.onclick = () => {
            this.video.currentTime += 85; 
            this.showToast('Intro Skipped (AI Detected) ⏩');
        };
        
        this.ui.fullscreenBtn.onclick = () => {
            if(!document.fullscreenElement) this.container.requestFullscreen();
            else document.exitFullscreen();
        };

        // Keyboard Shortcuts
        document.onkeydown = (e) => {
            if(e.target.tagName === 'INPUT') return;
            switch(e.key.toLowerCase()) {
                case ' ': e.preventDefault(); this.togglePlay(); break;
                case 'f': this.container.requestFullscreen(); break;
                case 'm': this.video.muted = !this.video.muted; break;
                case 'arrowright': this.video.currentTime += 5; this.showFeedback('⏩ +5s'); break;
                case 'arrowleft': this.video.currentTime -= 5; this.showFeedback('⏪ -5s'); break;
            }
        };

        // Close menus on click outside
        document.onclick = (e) => {
            if(!e.target.closest('.control-btn') && !e.target.closest('.dropdown-menu') && !e.target.closest('.settings-menu')) {
                document.querySelectorAll('.dropdown-menu, .settings-menu').forEach(m => m.classList.remove('show'));
            }
        };
    }

    // --- Helpers ---
    formatTime(s) {
        if(isNaN(s)) return "00:00";
        return new Date(s * 1000).toISOString().substr(11, 8).replace(/^00:/, '');
    }

    showToast(msg) {
        this.ui.toast.innerHTML = msg;
        this.ui.toast.classList.add('show');
        setTimeout(() => this.ui.toast.classList.remove('show'), 3000);
    }

    showFeedback(text) {
        const fb = document.getElementById('gestureFeedback');
        fb.innerText = text;
        fb.classList.add('show');
        setTimeout(() => fb.classList.remove('show'), 600);
    }

    loadPreferences() {
        // Logic to load saved settings from LocalStorage can go here
        console.log("WebPlayer Pro V4: Ready 🚀");
    }
}

// Launch
document.addEventListener('DOMContentLoaded', () => {
    window.player = new WebPlayerPro('playerContainer');
});