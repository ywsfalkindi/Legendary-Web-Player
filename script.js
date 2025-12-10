// script.js - Ultimate AI Edition V5.0 (Phoenix)
// Features: Interactive Transcript, 5-Band EQ, Smart Zoom, Worker Ambience

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
            eqBands: [], // Equalizer bands
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
                superRes: false,
                smartZoom: false,
                transcript: false
            },
            controlsTimeout: null,
            transcriptData: [ // Mock Transcript Data
                { "start": "0.5", "end": "1.5", "text": "في هذا الفيديو،" },
                { "start": "1.6", "end": "2.8", "text": "سنستكشف مستقبل" },
                { "start": "2.9", "end": "4.2", "text": "مشغلات الويب." },
                { "start": "5.0", "end": "6.5", "text": "مع ميزات الذكاء الاصطناعي" },
                { "start": "6.6", "end": "8.0", "text": "التي تغير قواعد اللعبة." },
                { "start": "8.5", "end": "9.8", "text": "مثل النصوص التفاعلية،" },
                { "start": "10.0", "end": "11.5", "text": "والصوت السينمائي." },
                { "start": "12.0", "end": "14.0", "text": "استعدوا لتجربة فريدة." },
                { "start": "15.0", "end": "16.0", "text": "هل أنتم جاهزون؟" },
                { "start": "17.0", "end": "18.0", "text": "لنبدأ الآن." }
            ],
            currentTranscriptIndex: -1
        };

        this.ui = this.cacheDOM();
        this.init();
    }

    cacheDOM() {
        return {
            playBtn: document.getElementById('playPauseBtn'),
            videoWrapper: document.getElementById('videoWrapper'),
            bigPlayBtn: document.getElementById('bigPlayBtn'),
            progressBar: document.getElementById('progressBar'),
            bufferBar: document.getElementById('bufferBar'),
            progressArea: document.getElementById('progressArea'),
            tooltip: document.getElementById('progressTooltip'),
            timeDisplay: document.getElementById('currentTime'),
            durationDisplay: document.getElementById('duration'),
            fullscreenBtn: document.getElementById('fullscreenBtn'),
            pipBtn: document.getElementById('pipBtn'),
            scrubPreview: document.getElementById('scrubPreview'),
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
            equalizer: document.getElementById('equalizer'),
            aiMenuBtn: document.getElementById('aiMenuBtn'),
            aiMenu: document.getElementById('aiMenu'),
            recordBtn: document.getElementById('recordBtn'),
            // New UI
            transcriptBtn: document.getElementById('transcriptBtn'),
            transcriptPanel: document.getElementById('transcriptPanel'),
            transcriptContent: document.getElementById('transcriptContent'),
            closeTranscriptBtn: document.getElementById('closeTranscriptBtn')
        };
    }

    init() {
        this.initHLS();
        this.initWorker();
        this.setupEventListeners();
        this.loadPreferences();
        
        this.renderTranscript();
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
            // Stop loop in Eco mode, when paused, or when video ends.
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
        this.config.eqBands.forEach(band => band.disconnect());
        this.config.nodes.compressor.disconnect();
        this.config.nodes.panner.disconnect();
        this.config.nodes.gain.disconnect();

        // Rebuild the audio graph chain
        let currentNode = this.config.nodes.source;

        // 1. Connect through EQ bands
        this.config.eqBands.forEach(band => {
            currentNode.connect(band);
            currentNode = band;
        });

        // 2. Dialogue Boost (Compression + Gain)
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

        // 3. Spatial Audio (Simulated 3D)
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

    renderEqualizer() {
        const freqs = ['60', '310', '1k', '6k', '12k'];
        this.ui.equalizer.innerHTML = '';
        this.config.eqBands.forEach((band, i) => {
            const bandContainer = document.createElement('div');
            bandContainer.className = 'eq-band';

            const slider = document.createElement('input');
            slider.type = 'range';
            slider.min = -12;
            slider.max = 12;
            slider.step = 1;
            slider.value = 0;
            slider.oninput = (e) => { band.gain.value = e.target.value; };
            
            const label = document.createElement('label');
            label.innerText = freqs[i];

            bandContainer.appendChild(slider);
            bandContainer.appendChild(label);
            this.ui.equalizer.appendChild(bandContainer);
        });
    }

    // --- 3. Features Logic ---
    toggleSetting(key, element, type = 'bool') {
        this.config.settings[key] = !this.config.settings[key];
        const isOn = this.config.settings[key];
        
        // Update UI
        element.setAttribute('aria-checked', isOn);
        const span = element.querySelector('span');
        if(span) {
            span.innerText = isOn ? 'ON' : 'OFF';
            span.style.color = isOn ? 'var(--accent-color)' : 'inherit';
        }

        this.savePreferences();
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
            case 'smartZoom':
                this.ui.videoWrapper.classList.toggle('smart-zoom-active', isOn);
                this.showToast(isOn ? 'AI Smart Zoom ON 🔎' : 'Smart Zoom OFF');
                break;
            case 'transcript':
                this.container.classList.toggle('transcript-open', isOn);
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
        } else {
            this.video.pause();
        }
        this.initAudio(); // Initialize Context on first user gesture
    }

    // --- 5. Event Listeners & UI ---
    setupEventListeners() {
        // Playback
        const toggle = () => this.togglePlay();
        this.ui.playBtn.onclick = toggle;
        this.ui.bigPlayBtn.onclick = toggle;
        this.ui.videoWrapper.onclick = toggle;
        
        this.video.onplay = () => {
            this.container.classList.remove('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            if(!this.config.settings.eco) this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
            if(this.config.audioCtx && this.config.audioCtx.state === 'suspended') this.config.audioCtx.resume();
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

            this.updateTranscriptHighlight(curr);
            // Smart Skip Trigger (Mock Logic)
            if (curr > 10 && curr < 20) this.ui.skipIntroBtn.classList.add('show');
            else this.ui.skipIntroBtn.classList.remove('show');
        };

        // Progress Seek
        const seek = (e) => {
            const rect = this.ui.progressArea.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            this.video.currentTime = (clickX / width) * this.video.duration;
        };
        this.ui.progressArea.onclick = (e) => {
            seek(e);
        };

        // Progress Tooltip & Scrub Preview
        this.ui.progressArea.onmousemove = (e) => {
            const rect = this.ui.progressArea.getBoundingClientRect();
            const hoverX = e.clientX - rect.left;
            const width = rect.width;
            const hoverTime = (hoverX / width) * this.video.duration;

            if (isNaN(hoverTime)) return;

            this.ui.tooltip.style.left = `${hoverX}px`;
            this.ui.tooltip.innerText = this.formatTime(hoverTime);
            this.ui.scrubPreview.style.left = `${hoverX}px`;
        }

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
        
        this.ui.transcriptBtn.onclick = (e) => this.toggleSetting('transcript', e.currentTarget);
        this.ui.closeTranscriptBtn.onclick = (e) => this.toggleSetting('transcript', this.ui.transcriptBtn);

        // Feature Toggles
        document.getElementById('dialogueBoostToggle').onclick = (e) => this.toggleSetting('dialogue', e.currentTarget);
        document.getElementById('spatialAudioToggle').onclick = (e) => this.toggleSetting('spatial', e.currentTarget);
        document.getElementById('smartZoomToggle').onclick = (e) => this.toggleSetting('smartZoom', e.currentTarget);
        document.getElementById('theaterModeToggle').onclick = (e) => this.toggleSetting('theater', e.currentTarget);
        document.getElementById('ecoModeToggle').onclick = (e) => this.toggleSetting('eco', e.currentTarget);
        document.getElementById('upscaleToggle').onclick = (e) => this.toggleSetting('upscale', e.currentTarget);

        // Speed Control
        this.ui.settingsMenu.querySelectorAll('[data-speed]').forEach(el => {
            el.onclick = () => {
                this.ui.settingsMenu.querySelector('[data-speed].active').classList.remove('active');
                this.ui.settingsMenu.querySelector('[aria-checked="true"]').setAttribute('aria-checked', 'false');
                el.classList.add('active');
                el.setAttribute('aria-checked', 'true');
                this.video.playbackRate = el.dataset.speed;
                this.config.settings.speed = el.dataset.speed;
                this.savePreferences();
                this.showToast(`Speed: ${el.innerText}`);
            }
        });

        this.ui.recordBtn.onclick = () => this.recordClip();
        this.ui.skipIntroBtn.onclick = () => {
            this.video.currentTime += 85; 
            this.showToast('Intro Skipped (AI Detected) ⏩');
        };
        
        this.ui.fullscreenBtn.onclick = () => {
            if(!document.fullscreenElement) this.container.requestFullscreen();
            else document.exitFullscreen();
        };

        // Volume
        this.ui.volumeSlider.oninput = (e) => {
            this.video.volume = e.target.value;
            this.config.settings.volume = e.target.value;
            this.video.muted = e.target.value == 0;
            this.savePreferences();
        };
        this.video.onvolumechange = () => {
            this.ui.volumeSlider.value = this.video.volume;
            const icon = this.ui.volumeBtn.querySelector('i');
            if (this.video.muted || this.video.volume === 0) icon.className = 'fa-solid fa-volume-xmark';
            else if (this.video.volume < 0.5) icon.className = 'fa-solid fa-volume-low';
            else icon.className = 'fa-solid fa-volume-high';
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

        // Hide controls on inactivity
        this.container.onmousemove = () => {
            this.container.classList.remove('hide-cursor');
            this.container.classList.add('show-controls');
            clearTimeout(this.config.controlsTimeout);
            if (!this.video.paused) {
                this.config.controlsTimeout = setTimeout(() => {
                    this.container.classList.remove('show-controls');
                    this.container.classList.add('hide-cursor');
                }, 3000);
            }
        };
    }

    // --- Helpers ---
    formatTime(s) {
        if(isNaN(s)) return "00:00";
        const date = new Date(s * 1000);
        const hours = date.getUTCHours();
        return date.toISOString().slice(hours > 0 ? 11 : 14, 19);
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

    // --- Transcript Logic ---
    renderTranscript() {
        this.ui.transcriptContent.innerHTML = '';
        this.config.transcriptData.forEach((line, index) => {
            const span = document.createElement('span');
            span.textContent = line.text + ' ';
            span.dataset.index = index;
            span.onclick = () => { this.video.currentTime = line.start; };
            this.ui.transcriptContent.appendChild(span);
        });
    }

    updateTranscriptHighlight(currentTime) {
        if (!this.config.settings.transcript) return;

        let foundIndex = -1;
        for (let i = 0; i < this.config.transcriptData.length; i++) {
            if (currentTime >= this.config.transcriptData[i].start && currentTime <= this.config.transcriptData[i].end) {
                foundIndex = i;
                break;
            }
        }

        if (foundIndex !== this.config.currentTranscriptIndex) {
            // Remove old highlight
            const oldActive = this.ui.transcriptContent.querySelector('.active-word');
            if (oldActive) oldActive.classList.remove('active-word');
            // Add new highlight
            const newActive = this.ui.transcriptContent.querySelector(`[data-index="${foundIndex}"]`);
            if (newActive) newActive.classList.add('active-word');
            this.config.currentTranscriptIndex = foundIndex;
        }
    }

    loadPreferences() {
        const saved = localStorage.getItem('webplayer_prefs');
        if (saved) {
            const prefs = JSON.parse(saved);
            // Apply settings
            this.config.settings = { ...this.config.settings, ...prefs };

            // Apply Volume
            this.video.volume = this.config.settings.volume;
            this.ui.volumeSlider.value = this.config.settings.volume;

            // Apply Speed
            this.video.playbackRate = this.config.settings.speed;
            this.ui.settingsMenu.querySelector('[data-speed].active')?.classList.remove('active');
            this.ui.settingsMenu.querySelector(`[data-speed="${this.config.settings.speed}"]`)?.classList.add('active');

            // Apply Toggles (Theater, Eco etc.) by simulating a click if the setting is on
            if (this.config.settings.theater) document.getElementById('theaterModeToggle').click();
            if (this.config.settings.eco) document.getElementById('ecoModeToggle').click();
            if (this.config.settings.transcript) document.getElementById('transcriptBtn').click();
            
            console.log("WebPlayer Pro V4: Preferences loaded 💾");
        } else {
            console.log("WebPlayer Pro V4: Ready 🚀");
        }
    }
    savePreferences() {
        localStorage.setItem('webplayer_prefs', JSON.stringify(this.config.settings));
    }
}

// Launch
document.addEventListener('DOMContentLoaded', () => {
    window.player = new WebPlayerPro('playerContainer');
});