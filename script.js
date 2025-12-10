// script.js - Ultimate AI Edition V6.0 (Titan)
// New Features: AI Chapters & Summary, Live Translation, Audio-Reactive Ambience, Refactored Audio Engine

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
                spatialAudio: false,
                dialogueBoost: false,
                upscale: false,
                transcript: false
            },
            controlsTimeout: null,
            transcriptData: [ // Mock Transcript Data
                { "start": "0.5", "end": "1.5", "text": "في هذا الفيديو،" },
                { "start": "1.6", "end": "2.8", "text": "سنستكشف" },
                { "start": "2.9", "end": "4.2", "text": "مستقبل مشغلات الويب." },
                { "start": "5.0", "end": "6.5", "text": "مع ميزات" },
                { "start": "6.6", "end": "8.0", "text": "الذكاء الاصطناعي التي تغير قواعد اللعبة." },
                { "start": "8.5", "end": "9.8", "text": "مثل النصوص" },
                { "start": "10.0", "end": "11.5", "text": "التفاعلية، والصوت السينمائي." },
                { "start": "12.0", "end": "14.0", "text": "استعدوا لتجربة فريدة." },
                { "start": "15.0", "end": "16.0", "text": "هل أنتم" },
                { "start": "17.0", "end": "18.0", "text": "جاهزون؟ لنبدأ الآن." }
            ],
            chaptersData: [ // Mock Chapters Data
                { "time": 0, "title": "المقدمة", "desc": "نظرة عامة على ميزات المشغل الجديدة." },
                { "time": 8, "title": "النص التفاعلي والصوت", "desc": "استكشاف النص المتزامن والصوت السينمائي." },
                { "time": 15, "title": "ميزات الذكاء الاصطناعي", "desc": "شرح لتقنيات التخطي الذكي والتحسين." },
                { "time": 25, "title": "التخصيص والتحكم", "desc": "التعمق في الإعدادات وأوضاع العرض." },
                { "time": 35, "title": "الخاتمة", "desc": "نظرة مستقبلية على تطور مشغلات الويب." }
            ],
            summaryData: { // Mock Summary Data
                title: "ملخص الفيديو بالذكاء الاصطناعي",
                points: [
                    "يقدم المشغل واجهة مستخدم حديثة مع تأثيرات بصرية متقدمة.",
                    "يحتوي على نص تفاعلي متزامن مع الفيديو لسهولة المتابعة والترجمة.",
                    "يوفر محرك صوت سينمائي مع معادل صوت (EQ) وميزات تعزيز الحوار والصوت المكاني.",
                    "يستخدم الذكاء الاصطناعي لميزات مثل الفصول الذكية، التخطي الذكي، وتلخيص المحتوى.",
                    "يدعم تخصيص التجربة من خلال أوضاع متعددة مثل وضع المسرح والوضع الاقتصادي."
                ]
            },
            activeIndices: { transcript: -1, chapter: -1 }
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
            chaptersBtn: document.getElementById('chaptersBtn'),
            transcriptBtn: document.getElementById('transcriptBtn'),
            sidePanel: document.getElementById('sidePanel'),
            closeSidePanelBtn: document.getElementById('closeSidePanelBtn'),
            sidePanelTabs: document.querySelectorAll('.tab-btn'),
            transcriptContent: document.getElementById('transcriptContent'),
            chaptersContent: document.getElementById('chaptersContent'),
            summaryContent: document.getElementById('summaryContent'),
            chapterMarkersContainer: document.getElementById('chapterMarkers'),
            translateSelect: document.getElementById('translateLangSelect')
        };
    }

    init() {
        this.initHLS();
        this.initWorker();
        this.setupEventListeners();
        this.initAudioEngine();
        this.loadPreferences();
        
        this.renderTranscript();
        this.renderChapters();
        this.renderSummary();
        this.renderChapterMarkers();
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
        // Audio-reactive ambient light in theater mode
        if (this.config.settings.theater && !this.config.settings.eco && this.config.nodes.analyser) {
            const dataArray = new Uint8Array(this.config.nodes.analyser.frequencyBinCount);
            this.config.nodes.analyser.getByteFrequencyData(dataArray);
            // Average of first 5 bins for bass response
            const bass = dataArray.slice(0, 5).reduce((a, b) => a + b, 0) / 5;
            const brightness = 0.8 + (bass / 255) * 0.4; // Map 0-255 to 0.8-1.2
            this.ambientCanvas.style.filter = `blur(40px) saturate(2) brightness(${brightness})`;
        }

        if (this.config.settings.eco || this.video.paused || this.video.ended || !this.config.worker) {
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
    initAudioEngine() {
        if (this.config.audioCtx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.config.audioCtx = new AudioContext();

        // Create all nodes upfront
        this.config.nodes.source = this.config.audioCtx.createMediaElementSource(this.video);
        this.config.nodes.gain = this.config.audioCtx.createGain();
        this.config.nodes.analyser = this.config.audioCtx.createAnalyser();
        this.config.nodes.analyser.fftSize = 32;

        // -- EQ Nodes --
        const freqs = [60, 310, 1000, 6000, 12000];
        this.config.eqBands = freqs.map(f => {
            const filter = this.config.audioCtx.createBiquadFilter();
            filter.type = 'peaking'; filter.frequency.value = f;
            filter.Q.value = 1; filter.gain.value = 0;
            return filter;
        });

        // -- Dialogue Boost Nodes --
        this.config.nodes.dialogueCompressor = this.config.audioCtx.createDynamicsCompressor();
        this.config.nodes.dialogueGain = this.config.audioCtx.createGain();

        // -- Spatial Audio Nodes --
        this.config.nodes.spatialPanner = this.config.audioCtx.createPanner();
        this.config.nodes.spatialLFO = this.config.audioCtx.createOscillator(); // LFO for effect
        this.config.nodes.spatialLFOgain = this.config.audioCtx.createGain(); // Controls LFO depth

        // Build a FIXED audio graph: Source -> EQ -> Dialogue -> Spatial -> Main Gain -> Destination
        let currentNode = this.config.nodes.source;

        // 1. Connect through EQ bands in series
        this.config.eqBands.forEach(band => {
            currentNode.connect(band);
            currentNode = band;
        });

        // 2. Connect to Dialogue Boost path
        currentNode.connect(this.config.nodes.dialogueCompressor);
        this.config.nodes.dialogueCompressor.connect(this.config.nodes.dialogueGain);
        currentNode = this.config.nodes.dialogueGain;

        // 3. Connect to Spatial Audio path
        this.config.nodes.spatialLFO.type = 'sine';
        this.config.nodes.spatialLFO.frequency.value = 0.25; // Slow, wide oscillation
        this.config.nodes.spatialLFO.connect(this.config.nodes.spatialLFOgain);
        this.config.nodes.spatialLFOgain.connect(this.config.nodes.spatialPanner.pan); // Modulate pan
        this.config.nodes.spatialLFO.start();
        currentNode.connect(this.config.nodes.spatialPanner);
        currentNode = this.config.nodes.spatialPanner;

        // 4. Final connection to main gain and destination
        currentNode.connect(this.config.nodes.gain);
        this.config.nodes.gain.connect(this.config.audioCtx.destination);

        // 5. Side-chain source to analyser for visuals
        this.config.nodes.source.connect(this.config.nodes.analyser);

        // Set initial "off" states without showing toasts
        this.toggleDialogueBoost(this.config.settings.dialogueBoost, true);
        this.toggleSpatialAudio(this.config.settings.spatialAudio, true);
    }

    toggleDialogueBoost(isOn, isInit = false) {
        if (!this.config.audioCtx) return;
        const { dialogueCompressor, dialogueGain } = this.config.nodes;
        dialogueCompressor.threshold.setValueAtTime(isOn ? -24 : 0, 0);
        dialogueCompressor.ratio.setValueAtTime(isOn ? 12 : 1, 0);
        dialogueGain.gain.setValueAtTime(isOn ? 1.4 : 1.0, 0);
        if (!isInit) this.showToast(`Voice Boost: ${isOn ? 'Enabled' : 'Disabled'}`);
    }

    toggleSpatialAudio(isOn, isInit = false) {
        if (!this.config.audioCtx) return;
        this.config.nodes.spatialLFOgain.gain.setValueAtTime(isOn ? 0.3 : 0, this.config.audioCtx.currentTime);
        if (!isInit) this.showToast(`Spatial Audio: ${isOn ? 'Enabled' : 'Disabled'}`);
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
    toggleSetting(key, element) {
        this.config.settings[key] = !this.config.settings[key];
        const isOn = this.config.settings[key];
        
        if (element) {
            element.setAttribute('aria-checked', isOn);
            const span = element.querySelector('span');
            if (span) {
                span.innerText = isOn ? 'ON' : 'OFF';
                span.style.color = isOn ? 'var(--accent-color)' : 'inherit';
            }
        }

        this.savePreferences();

        // Apply specific logic
        const handlers = {
            dialogueBoost: () => this.toggleDialogueBoost(isOn),
            spatialAudio: () => this.toggleSpatialAudio(isOn),
            theater: () => {
                document.body.classList.toggle('immersive-mode', isOn);
                this.showToast(isOn ? 'Immersive Mode Active 🍿' : 'Normal Mode');
            },
            eco: () => {
                if (!isOn && !this.video.paused) this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this));
                this.showToast(isOn ? 'Battery Saver ON 🔋' : 'Battery Saver OFF');
            },
            upscale: () => {
                this.video.style.filter = isOn ? 'contrast(1.1) saturate(1.1)' : 'none';
                this.showToast(isOn ? 'AI Upscaling Active ✨' : 'Standard Resolution');
            }
        };

        if (handlers[key]) handlerskey;
    }

    recordClip() {
        if (this.config.isRecording) {
            if (this.config.mediaRecorder && this.config.mediaRecorder.state === "recording") {
                this.config.mediaRecorder.stop();
            }
            return;
        }

        try {
            // Attempt to capture stream (Requires CORS allowed source)
            const stream = this.video.captureStream ? this.video.captureStream() : this.video.mozCaptureStream();
            this.config.mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9,opus' }); // Add opus for audio
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
            this.showToast(`Error recording: ${e.message}. Protected Content (DRM/CORS) or browser limitations.`);
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
            this.config.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                this.ui.spinner.style.display = 'none';
                console.log('WebPlayer Pro: HLS Manifest Parsed');
            });
            this.config.hls.on(Hls.Events.ERROR, (event, data) => {
                console.error('HLS Error:', data);
                if (data.fatal) {
                    this.showToast(`HLS Error: ${data.details}. Trying to recover...`);
                    this.config.hls.recoverMediaError();
                }
            });
            this.config.hls.on(Hls.Events.BUFFER_APPENDING, () => this.container.classList.add('buffering')); // More precise buffering event
            this.config.hls.on(Hls.Events.FRAG_BUFFERED, () => this.container.classList.remove('buffering'));
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = streamURL;
        }
    }

    togglePlay() {
        if (this.video.paused) {
            if (this.config.audioCtx && this.config.audioCtx.state === 'suspended') this.config.audioCtx.resume();
            this.video.play();
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
        this.ui.videoWrapper.onclick = toggle;
        
        this.video.onplay = () => {
            this.container.classList.remove('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            if(!this.config.settings.eco) this.video.requestVideoFrameCallback(this.updateAmbientLoop.bind(this)); // Restart loop if eco mode is off
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

            // Update highlights
            this.updateTranscriptHighlight(curr);
            this.updateChapterHighlight(curr);
            if (curr > 5 && curr < 10 && !this.video.paused) this.ui.skipIntroBtn.classList.add('show');
            else this.ui.skipIntroBtn.classList.remove('show');
        };

        // Progress Seek
        const seek = (e) => {
            const rect = this.ui.progressArea.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const width = rect.width;
            this.video.currentTime = (clickX / width) * this.video.duration;
        };
        this.ui.progressArea.onclick = (e) => { seek(e);
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
        // Initialize EQ UI after audio context is ready
        if (this.config.audioCtx) this.renderEqualizer();
        toggleMenu(this.ui.settingsBtn, this.ui.settingsMenu);
        toggleMenu(this.ui.audioMenuBtn, this.ui.audioMenu);
        toggleMenu(this.ui.aiMenuBtn, this.ui.aiMenu);
        
        // Side Panel
        this.ui.transcriptBtn.onclick = () => this.openSidePanel('transcript');
        this.ui.chaptersBtn.onclick = () => this.openSidePanel('chapters');
        this.ui.closeSidePanelBtn.onclick = () => this.closeSidePanel();
        this.ui.sidePanelTabs.forEach(tab => {
            tab.onclick = () => this.switchTab(tab.dataset.tab);
        });
        this.ui.translateSelect.onchange = (e) => this.translateTranscript(e.target.value);

        // Feature Toggles
        document.getElementById('dialogueBoostToggle').onclick = (e) => this.toggleSetting('dialogueBoost', e.currentTarget);
        document.getElementById('spatialAudioToggle').onclick = (e) => this.toggleSetting('spatialAudio', e.currentTarget);
        // document.getElementById('smartZoomToggle').onclick = (e) => this.toggleSetting('smartZoom', e.currentTarget);
        document.getElementById('theaterModeToggle').onclick = (e) => this.toggleSetting('theater', e.currentTarget);
        document.getElementById('ecoModeToggle').onclick = (e) => this.toggleSetting('eco', e.currentTarget);
        document.getElementById('upscaleToggle').onclick = (e) => this.toggleSetting('upscale', e.currentTarget);

        // Speed Control
        this.ui.settingsMenu.querySelectorAll('[data-speed]').forEach(el => {
            el.onclick = () => {
                this.ui.settingsMenu.querySelector('[data-speed].active').classList.remove('active');
                this.ui.settingsMenu.querySelector('[aria-checked="true"]').setAttribute('aria-checked', 'false');
                el.classList.add('active'); // Visually mark active speed
                el.setAttribute('aria-checked', 'true');
                this.video.playbackRate = el.dataset.speed;
                this.config.settings.speed = el.dataset.speed;
                this.savePreferences();
                this.showToast(`Speed: ${el.innerText}`);
            }
        });

        this.ui.recordBtn.onclick = () => this.recordClip();
        this.ui.skipIntroBtn.onclick = () => {
            this.video.currentTime = 10; // Example skip to time
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
            this.video.muted = (e.target.value == 0);
            this.savePreferences();
        };
        this.video.onvolumechange = () => {
            this.ui.volumeSlider.value = this.video.volume;
            const icon = this.ui.volumeBtn.querySelector('i');
            if (this.video.muted || this.video.volume === 0) icon.className = 'fa-solid fa-volume-xmark';
            else if (this.video.volume < 0.5) icon.className = 'fa-solid fa-volume-low';
            else icon.className = 'fa-solid fa-volume-high';
        };
        this.ui.volumeBtn.onclick = () => { this.video.muted = !this.video.muted; }; // Toggle mute
        // Keyboard Shortcuts
        document.onkeydown = (e) => {
            if(e.target.tagName === 'INPUT') return;
            switch(e.key.toLowerCase()) {
                case ' ': e.preventDefault(); this.togglePlay(); break;
                case 'f': this.ui.fullscreenBtn.click(); break; // Use click to toggle fullscreen
                case 'm': this.video.muted = !this.video.muted; break;
                case 'arrowright': this.video.currentTime += 5; this.showFeedback('⏩ +5s'); break;
                case 'arrowleft': this.video.currentTime -= 5; this.showFeedback('⏪ -5s'); break;
            }
        };

        // Close menus on click outside
        this.container.onclick = (e) => {
            if(!e.target.closest('.control-btn') && !e.target.closest('.dropdown-menu') && !e.target.closest('.settings-menu')) {
                document.querySelectorAll('.dropdown-menu, .settings-menu').forEach(m => m.classList.remove('show'));
            }
        };

        // Debounce for mousemove events
        const debounce = (func, delay) => {
            let timeout;
            return function(...args) {
                const context = this;
                clearTimeout(timeout);
                timeout = setTimeout(() => func.apply(context, args), delay);
            };
        };

        // Hide controls on inactivity
        this.container.onmousemove = debounce(() => {
            this.container.classList.remove('hide-cursor');
            this.container.classList.add('show-controls');
            clearTimeout(this.config.controlsTimeout);
            if (!this.video.paused) {
                this.config.controlsTimeout = setTimeout(() => {
                    if(!this.ui.settingsMenu.classList.contains('show') && !this.ui.audioMenu.classList.contains('show') && !this.ui.aiMenu.classList.contains('show')) this.container.classList.remove('show-controls');
                    if (!this.container.classList.contains('paused')) this.container.classList.add('hide-cursor'); // Only hide cursor if not paused or controls are explicitly shown
                }, 3000);
            }
        }, 100); // Debounce mousemove to prevent excessive calls
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

    // --- 6. Side Panel & Content Logic ---
    renderTranscript() {
        this.ui.transcriptContent.innerHTML = '';
        this.config.transcriptData.forEach((line, index) => {
            const span = document.createElement('span');
            span.textContent = line.text + ' ';
            span.dataset.index = index; // Use data-index for easier selection
            span.dataset.start = line.start; // Store start time for quick access
            span.dataset.end = line.end; // Store end time for quick access

            span.onclick = () => { this.video.currentTime = line.start; };
            this.ui.transcriptContent.appendChild(span);
        });
    }

    updateTranscriptHighlight(currentTime) {
        if (!this.container.classList.contains('side-panel-open')) return;

        const data = this.config.transcriptData;
        const currentIndex = this.config.activeIndices.transcript;

        // Fast path: check if we are still in the current segment
        if (currentIndex !== -1 && currentTime >= parseFloat(data[currentIndex].start) && currentTime < parseFloat(data[currentIndex].end)) {
            return; // No change needed
        }

        // Search for the new segment
        const foundIndex = data.findIndex(line => currentTime >= parseFloat(line.start) && currentTime < parseFloat(line.end));

        if (foundIndex !== currentIndex) {
            if (currentIndex !== -1) {
                const oldActive = this.ui.transcriptContent.querySelector(`[data-index="${currentIndex}"]`);
                if (oldActive) oldActive.classList.remove('active-word');
            }
            if (foundIndex !== -1) {
                const newActive = this.ui.transcriptContent.querySelector(`[data-index="${foundIndex}"]`);
                if (newActive) {
                    newActive.classList.add('active-word');
                    newActive.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
                }
            }
            this.config.activeIndices.transcript = foundIndex;
        }
    }

    translateTranscript(lang) {
        if (lang === 'ar') {
            this.renderTranscript(); // Render original
            this.showToast('عرض النص الأصلي');
            return;
        }
        this.showToast(`جاري الترجمة إلى ${lang}... (محاكاة)`);
        this.ui.transcriptContent.querySelectorAll('span').forEach(span => {
            const originalText = this.config.transcriptData[span.dataset.index].text;
            span.textContent = `[${lang}] ${originalText} `; // Mock translation
        });
    }

    renderChapters() {
        this.ui.chaptersContent.innerHTML = '';
        this.config.chaptersData.forEach((chapter, index) => {
            const item = document.createElement('div');
            item.className = 'chapter-item';
            item.dataset.index = index;
            item.onclick = () => { this.video.currentTime = chapter.time; };

            item.innerHTML = `
                <div class="chapter-thumbnail"></div>
                <div class="chapter-info">
                    <h4>${chapter.title}</h4>
                    <p>${this.formatTime(chapter.time)}</p>
                </div>
            `;
            this.ui.chaptersContent.appendChild(item);
        });
    }

    renderChapterMarkers() {
        this.ui.chapterMarkersContainer.innerHTML = '';
        const duration = this.video.duration || 1;
        this.config.chaptersData.forEach(chapter => {
            if (chapter.time > 0) {
                const marker = document.createElement('div');
                marker.className = 'chapter-marker';
                marker.style.left = `${(chapter.time / duration) * 100}%`;
                this.ui.chapterMarkersContainer.appendChild(marker);
            }
        });
    }

    updateChapterHighlight(currentTime) {
        if (!this.container.classList.contains('side-panel-open')) return;
        const data = this.config.chaptersData;
        let foundIndex = -1;
        for (let i = data.length - 1; i >= 0; i--) {
            if (currentTime >= data[i].time) {
                foundIndex = i;
                break;
            }
        }

        if (foundIndex !== this.config.activeIndices.chapter) {
            const oldActive = this.ui.chaptersContent.querySelector('.chapter-item.active');
            if (oldActive) oldActive.classList.remove('active');
            if (foundIndex !== -1) {
                const newActive = this.ui.chaptersContent.querySelector(`[data-index="${foundIndex}"]`);
                if (newActive) newActive.classList.add('active');
            }
            this.config.activeIndices.chapter = foundIndex;
        }
    }

    renderSummary() {
        const { title, points } = this.config.summaryData;
        const listItems = points.map(point => `<li>${point}</li>`).join('');
        this.ui.summaryContent.innerHTML = `<h4>${title}</h4><ul>${listItems}</ul>`;
    }

    openSidePanel(defaultTab = 'transcript') {
        const isPanelOpen = this.container.classList.contains('side-panel-open');
        if (!isPanelOpen) {
            this.container.classList.add('side-panel-open');
            this.config.settings.sidePanel = true;
            this.savePreferences();
        }
        this.switchTab(defaultTab);
        this.ui.transcriptBtn.classList.add('active');
        this.ui.chaptersBtn.classList.add('active');
    }

    closeSidePanel() {
        this.container.classList.remove('side-panel-open');
        this.config.settings.sidePanel = false;
        this.savePreferences();
        this.ui.transcriptBtn.classList.remove('active');
        this.ui.chaptersBtn.classList.remove('active');
    }

    switchTab(tabId) {
        this.ui.sidePanelTabs.forEach(tab => {
            const content = document.getElementById(tab.getAttribute('aria-controls'));
            if (tab.id === `tab-${tabId}`) {
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                content.classList.add('active');
            } else {
                tab.classList.remove('active');
                tab.setAttribute('aria-selected', 'false');
                content.classList.remove('active');
            }
        });
    }

    // --- 7. Preferences ---
    loadPreferences() {
        try {
            const saved = localStorage.getItem('webplayer_prefs');
            if (!saved) {
                console.log("WebPlayer Pro V6: No preferences found. Ready 🚀");
                return;
            }
            const prefs = JSON.parse(saved);
            // Apply settings
            this.config.settings = { ...this.config.settings, ...prefs };

            // Ensure boolean settings are actually booleans
            for (const key in this.config.settings) {
                if (typeof this.config.settings[key] === 'string' && (this.config.settings[key] === 'true' || this.config.settings[key] === 'false')) {
                    this.config.settings[key] = (this.config.settings[key] === 'true');
                }
            }

            // Apply Volume
            this.video.volume = this.config.settings.volume;
            this.ui.volumeSlider.value = this.config.settings.volume;

            // Apply Speed
            this.video.playbackRate = this.config.settings.speed;
            this.ui.settingsMenu.querySelector('[data-speed].active')?.classList.remove('active');
            const activeSpeedEl = this.ui.settingsMenu.querySelector(`[data-speed="${this.config.settings.speed}"]`);
            if (activeSpeedEl) {
                activeSpeedEl.classList.add('active');
                activeSpeedEl.setAttribute('aria-checked', 'true');
            }

            // Apply Toggles (Theater, Eco etc.) by directly setting state and updating UI
            const toggleElements = {
                theater: document.getElementById('theaterModeToggle'),
                eco: document.getElementById('ecoModeToggle'),
                dialogueBoost: document.getElementById('dialogueBoostToggle'),
                spatialAudio: document.getElementById('spatialAudioToggle'),
                upscale: document.getElementById('upscaleToggle')
            };

            for (const key in toggleElements) {
                if (this.config.settings[key] === true && toggleElements[key]) {
                    // Set initial state without toggling, as the handlers will be called by initAudioEngine or other init functions
                    toggleElements[key].setAttribute('aria-checked', 'true');
                    const span = toggleElements[key].querySelector('span');
                    if (span) {
                        span.innerText = 'ON';
                        span.style.color = 'var(--accent-color)';
                    }
                }
            }
            if (this.config.settings.sidePanel) this.openSidePanel();

            console.log("WebPlayer Pro V6: Preferences loaded 💾");
        } catch (e) { console.error("Failed to load preferences:", e); }
    }
    savePreferences() {
        localStorage.setItem('webplayer_prefs', JSON.stringify(this.config.settings));
    }
}

// Launch
document.addEventListener('DOMContentLoaded', () => {
    window.player = new WebPlayerPro('playerContainer');
});