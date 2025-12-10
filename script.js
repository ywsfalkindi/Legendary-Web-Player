/**
 * Web Player Pro - Legendary Edition V7
 * Features: WebGL Ambient, Spatial Audio, Gestures, Spatial Notes, VTT, Local AI
 */

// --- 1. WebGL Ambient Engine (GPU Optimized) ---
class AmbientEngine {
    constructor(canvas, sourceVideo) {
        this.canvas = canvas;
        this.video = sourceVideo;
        this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: false, alpha: false });
        this.active = false;
        
        if (!this.gl) {
            console.warn("WebGL not supported. Ambient light disabled.");
            return;
        }
        this.initShaders();
        this.initBuffers();
        this.resize();
    }

    initShaders() {
        const vsSource = `
            attribute vec2 position;
            varying vec2 vTexCoord;
            void main() {
                gl_Position = vec4(position, 0.0, 1.0);
                vTexCoord = (position + 1.0) * 0.5;
                vTexCoord.y = 1.0 - vTexCoord.y;
            }
        `;
        // Fragment shader: Read texture, heavy blur simulation via lower resolution sampling + saturation boost
        const fsSource = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                vec4 color = texture2D(uTexture, vTexCoord);
                // Boost saturation
                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                vec3 satColor = mix(vec3(gray), color.rgb, 1.6);
                gl_FragColor = vec4(satColor, 1.0);
            }
        `;
        const compile = (src, type) => {
            const shader = this.gl.createShader(type);
            this.gl.shaderSource(shader, src);
            this.gl.compileShader(shader);
            return shader;
        };
        const program = this.gl.createProgram();
        this.gl.attachShader(program, compile(vsSource, this.gl.VERTEX_SHADER));
        this.gl.attachShader(program, compile(fsSource, this.gl.FRAGMENT_SHADER));
        this.gl.linkProgram(program);
        this.gl.useProgram(program);
        this.program = program;
    }

    initBuffers() {
        // Full screen quad
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        const position = this.gl.getAttribLocation(this.program, "position");
        this.gl.enableVertexAttribArray(position);
        this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);

        // Texture
        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    resize() {
        this.canvas.width = window.innerWidth / 4; // Low res for performance & natural blur
        this.canvas.height = window.innerHeight / 4;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    start() {
        this.active = true;
        this.loop();
    }

    stop() { this.active = false; }

    loop() {
        if (!this.active) return;
        if (this.video.readyState >= 2) {
            try {
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.video);
                this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            } catch(e) {
                // Handle potential CORS issues gracefully
                this.stop(); 
                console.log("WebGL Security/CORS stop.");
            }
        }
        requestAnimationFrame(() => this.loop());
    }
}

// --- 2. Advanced Audio Engine (Spatial & Cinema DSP) ---
class AudioEngine {
    constructor(videoElement) {
        this.video = videoElement;
        this.ctx = null;
        this.nodes = {};
    }

    init() {
        if (this.ctx) return;
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioCtx();
        
        // Source
        this.nodes.source = this.ctx.createMediaElementSource(this.video);
        this.nodes.gain = this.ctx.createGain();
        
        // Spatial Audio Setup (Panner)
        this.nodes.panner = this.ctx.createStereoPanner();
        this.nodes.osc = this.ctx.createOscillator();
        this.nodes.oscGain = this.ctx.createGain();
        this.nodes.osc.type = 'sine';
        this.nodes.osc.frequency.value = 0.1; // Slow movement
        this.nodes.oscGain.gain.value = 0; // Off by default
        this.nodes.osc.connect(this.nodes.oscGain);
        this.nodes.oscGain.connect(this.nodes.panner.pan);
        this.nodes.osc.start();

        // Dialogue Boost (Compressor)
        this.nodes.compressor = this.ctx.createDynamicsCompressor();
        this.nodes.compressor.threshold.value = 0; // Off

        // Graph: Source -> Compressor -> Panner -> Gain -> Dest
        this.nodes.source.connect(this.nodes.compressor);
        this.nodes.compressor.connect(this.nodes.panner);
        this.nodes.panner.connect(this.nodes.gain);
        this.nodes.gain.connect(this.ctx.destination);
    }

    setVolume(val) {
        if(this.nodes.gain) this.nodes.gain.gain.value = val;
    }

    toggleSpatial(enable) {
        if (!this.ctx) this.init();
        // Ramp value to avoid clicking
        const now = this.ctx.currentTime;
        this.nodes.oscGain.gain.setTargetAtTime(enable ? 0.5 : 0, now, 0.5);
    }

    toggleDialogueBoost(enable) {
        if (!this.ctx) this.init();
        const now = this.ctx.currentTime;
        // Aggressive compression for speech clarity
        this.nodes.compressor.threshold.setTargetAtTime(enable ? -50 : 0, now, 0.2);
        this.nodes.compressor.ratio.setTargetAtTime(enable ? 12 : 1, now, 0.2);
        // Makeup gain
        this.nodes.gain.gain.setTargetAtTime(enable ? 1.5 : 1, now, 0.2); 
    }
}

// --- 3. Gesture Controller (Touch & Mouse) ---
class GestureController {
    constructor(element, callbacks) {
        this.element = element;
        this.cbs = callbacks; // { onSeek, onVolume, onBright }
        this.startX = 0;
        this.startY = 0;
        this.touchStartTime = 0;
        this.isDragging = false;
        
        this.element.addEventListener('touchstart', this.onStart.bind(this), {passive: false});
        this.element.addEventListener('touchmove', this.onMove.bind(this), {passive: false});
        this.element.addEventListener('touchend', this.onEnd.bind(this));
        
        // Double click detection
        this.lastClick = 0;
        this.element.addEventListener('click', (e) => {
             const now = Date.now();
             if (now - this.lastClick < 300) {
                 this.handleDoubleTap(e);
             }
             this.lastClick = now;
        });
    }

    onStart(e) {
        this.startX = e.touches[0].clientX;
        this.startY = e.touches[0].clientY;
        this.touchStartTime = Date.now();
        this.isDragging = false;
    }

    onMove(e) {
        e.preventDefault(); // Prevent scroll
        const diffX = e.touches[0].clientX - this.startX;
        const diffY = this.startY - e.touches[0].clientY; // Up is positive
        
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) this.isDragging = true;
        
        // Vertical Swipe
        if (this.isDragging && Math.abs(diffY) > Math.abs(diffX)) {
            const sensitivity = 0.01;
            // Left side: Brightness, Right side: Volume
            if (this.startX < window.innerWidth / 2) {
                if (this.cbs.onBright) this.cbs.onBright(diffY * sensitivity);
            } else {
                if (this.cbs.onVolume) this.cbs.onVolume(diffY * sensitivity);
            }
        }
    }

    onEnd(e) {
        // Reset Logic
    }

    handleDoubleTap(e) {
        const width = this.element.clientWidth;
        const x = e.offsetX; // Relative to element
        // Left 30%: Seek Back, Right 30%: Seek Forward
        if (x < width * 0.3) this.cbs.onSeek(-10);
        else if (x > width * 0.7) this.cbs.onSeek(10);
        else if (this.cbs.onToggle) this.cbs.onToggle();
    }
}

// --- 4. Main Player Class ---
class WebPlayerPro {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.video = document.getElementById('mainVideo');
        this.ui = this.cacheDOM();
        
        this.state = {
            isPlaying: false,
            volume: 1,
            brightness: 1,
            notes: [],
            isAddingNote: false,
            settings: { theater: false, eco: false }
        };

        // Initialize Modules
        this.audioEngine = new AudioEngine(this.video);
        this.ambientEngine = new AmbientEngine(document.getElementById('ambientCanvas'), this.video);
        
        this.init();
        this.setupGestures();
        this.initHLS();
        this.initVTT(); // Standard Track Support
        
        // Simulated AI Model Loader
        setTimeout(() => this.loadAIModels(), 2000);
    }

    cacheDOM() {
        return {
            playBtn: document.getElementById('playPauseBtn'),
            bigPlayBtn: document.getElementById('bigPlayBtn'),
            progressBar: document.getElementById('progressBar'),
            progressArea: document.getElementById('progressArea'),
            timeDisplay: document.getElementById('currentTime'),
            durationDisplay: document.getElementById('duration'),
            volumeSlider: document.getElementById('volumeSlider'),
            sidePanel: document.getElementById('sidePanel'),
            toast: document.getElementById('toast'),
            overlay: document.getElementById('brightnessOverlay'),
            spatialLayer: document.getElementById('spatialNotesLayer'),
            skipIntro: document.getElementById('skipIntroBtn'),
            // Menus
            settingsBtn: document.getElementById('settingsBtn'),
            colorBtn: document.getElementById('colorBtn')
        };
    }

    init() {
        // Playback Events
        this.ui.playBtn.onclick = () => this.togglePlay();
        this.ui.bigPlayBtn.onclick = () => this.togglePlay();
        
        this.video.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.container.classList.remove('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            this.ambientEngine.start();
        });
        
        this.video.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.container.classList.add('paused');
            this.ui.playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            if(this.state.settings.eco) this.ambientEngine.stop();
        });

        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('loadedmetadata', () => {
            this.ui.durationDisplay.innerText = this.formatTime(this.video.duration);
        });

        // Volume
        this.ui.volumeSlider.addEventListener('input', (e) => {
            this.video.volume = e.target.value;
            this.audioEngine.setVolume(e.target.value);
        });

        // Menus
        this.setupMenus();
        this.setupSidePanel();
        this.setupSpatialNotes();
        this.setupColorGrading();
        
        // Keyboard
        document.addEventListener('keydown', (e) => {
            if(e.code === 'Space') { e.preventDefault(); this.togglePlay(); }
            if(e.code === 'ArrowRight') this.video.currentTime += 5;
            if(e.code === 'ArrowLeft') this.video.currentTime -= 5;
            if(e.code === 'KeyM') this.video.muted = !this.video.muted;
            if(e.code === 'KeyF') document.getElementById('fullscreenBtn').click();
        });

        // Fullscreen
        document.getElementById('fullscreenBtn').onclick = () => {
            if(!document.fullscreenElement) this.container.requestFullscreen();
            else document.exitFullscreen();
        };
    }

    initHLS() {
        const source = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
        if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(source);
            hls.attachMedia(this.video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                document.getElementById('spinner').style.display = 'none';
            });
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = source;
        }
    }

    togglePlay() {
        if (this.video.paused) {
            this.video.play().catch(e => console.log("Autoplay blocked"));
            this.audioEngine.init(); // Resume Context
        } else {
            this.video.pause();
        }
    }

    setupGestures() {
        const feedback = document.getElementById('gestureFeedback');
        const showFb = (text) => {
            feedback.innerText = text;
            feedback.classList.add('show');
            clearTimeout(this.fbTimer);
            this.fbTimer = setTimeout(() => feedback.classList.remove('show'), 600);
        };

        new GestureController(this.ui.bigPlayBtn.parentElement, {
            onSeek: (dt) => {
                this.video.currentTime += dt;
                showFb(dt > 0 ? '⏩ +10s' : '⏪ -10s');
            },
            onVolume: (delta) => {
                let v = this.video.volume + (delta * 0.1); // Sensitivity
                v = Math.max(0, Math.min(1, v));
                this.video.volume = v;
                this.ui.volumeSlider.value = v;
                showFb(`🔊 ${Math.round(v * 100)}%`);
            },
            onBright: (delta) => {
                this.state.brightness += (delta * 0.1);
                this.state.brightness = Math.max(0.3, Math.min(1.5, this.state.brightness));
                this.ui.overlay.style.backgroundColor = `rgba(0,0,0,${1 - (this.state.brightness / 1.5)})`; 
                // Simple overlay opacity hack for brightness
                showFb(`☀ ${Math.round(this.state.brightness * 100)}%`);
            },
            onToggle: () => this.togglePlay()
        });
    }

    setupSpatialNotes() {
        // Toggle "Add Note" mode
        document.getElementById('addNoteBtn').onclick = () => {
            this.state.isAddingNote = !this.state.isAddingNote;
            const btn = document.getElementById('addNoteBtn');
            btn.innerHTML = this.state.isAddingNote ? 'انقر على الفيديو لتثبيت الملاحظة ❌' : 'إضافة ملاحظة مكانية <i class="fa-solid fa-map-pin"></i>';
            btn.style.borderColor = this.state.isAddingNote ? 'var(--primary)' : '#555';
            this.container.style.cursor = this.state.isAddingNote ? 'crosshair' : 'default';
        };

        // Click on video layer to add pin
        this.ui.spatialLayer.onclick = (e) => {
            if (!this.state.isAddingNote) return;
            const rect = this.ui.spatialLayer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            const time = this.video.currentTime;

            this.addSpatialNote(x, y, time);
            
            // Reset Mode
            this.state.isAddingNote = false;
            document.getElementById('addNoteBtn').click(); // Toggle off
            this.showToast('تم تثبيت الملاحظة بنجاح 📌');
        };

        // Render loop for notes visibility (show only near timestamp)
        this.video.addEventListener('timeupdate', () => {
            document.querySelectorAll('.spatial-pin').forEach(pin => {
                const pinTime = parseFloat(pin.dataset.time);
                // Show if within 2 seconds of the note time
                if (Math.abs(this.video.currentTime - pinTime) < 2) {
                    pin.style.display = 'block';
                } else {
                    pin.style.display = 'none';
                }
            });
        });
    }

    addSpatialNote(x, y, time) {
        // Add to DOM
        const pin = document.createElement('div');
        pin.className = 'spatial-pin';
        pin.style.left = `${x}%`;
        pin.style.top = `${y}%`;
        pin.dataset.time = time;
        pin.title = `ملاحظة عند ${this.formatTime(time)}`;
        
        pin.onclick = (e) => {
            e.stopPropagation();
            this.showToast(`ملاحظة: محتوى تجريبي عند ${this.formatTime(time)}`);
        };
        
        this.ui.spatialLayer.appendChild(pin);

        // Add to List
        const list = document.getElementById('notesList');
        const item = document.createElement('div');
        item.className = 'chapter-item'; // Reuse class
        item.innerHTML = `<div class="chapter-info"><h4>ملاحظة ${this.state.notes.length + 1}</h4><p>${this.formatTime(time)}</p></div>`;
        item.onclick = () => { this.video.currentTime = time; };
        list.appendChild(item);
        
        this.state.notes.push({ x, y, time });
    }

    setupColorGrading() {
        const options = document.querySelectorAll('#colorMenu li[data-lut]');
        options.forEach(opt => {
            opt.onclick = () => {
                // UI Update
                options.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                
                // Remove all lut classes
                this.video.classList.remove('lut-warm', 'lut-cool', 'lut-bw', 'lut-vintage');
                
                const lut = opt.dataset.lut;
                if (lut !== 'none') {
                    this.video.classList.add(`lut-${lut}`);
                    this.showToast(`تم تطبيق فلتر: ${opt.innerText}`);
                }
            };
        });
    }

    // --- Helpers & Logic ---
    updateProgress() {
        const cur = this.video.currentTime;
        const dur = this.video.duration || 1;
        const pct = (cur / dur) * 100;
        
        this.ui.progressBar.style.width = `${pct}%`;
        this.ui.timeDisplay.innerText = this.formatTime(cur);

        // Intro Skip Logic (Mock)
        if (cur > 10 && cur < 15) this.ui.skipIntro.classList.add('show');
        else this.ui.skipIntro.classList.remove('show');
    }

    formatTime(s) {
        if(isNaN(s)) return "00:00";
        const min = Math.floor(s / 60);
        const sec = Math.floor(s % 60);
        return `${min}:${sec < 10 ? '0' + sec : sec}`;
    }

    showToast(msg) {
        this.ui.toast.innerText = msg;
        this.ui.toast.classList.add('show');
        setTimeout(() => this.ui.toast.classList.remove('show'), 3000);
    }

    setupMenus() {
        // Generic Toggle
        const toggle = (btnId, menuId) => {
            const btn = document.getElementById(btnId);
            const menu = document.getElementById(menuId);
            btn.onclick = (e) => {
                e.stopPropagation();
                menu.classList.toggle('show');
            };
        };
        toggle('settingsBtn', 'settingsMenu');
        toggle('colorBtn', 'colorMenu');

        // Settings Items
        const setupToggle = (id, action) => {
            document.getElementById(id).onclick = function() {
                const span = this.querySelector('span');
                const isOn = span.innerText === 'OFF';
                span.innerText = isOn ? 'ON' : 'OFF';
                span.style.color = isOn ? 'var(--accent)' : '#aaa';
                action(isOn);
            };
        };

        setupToggle('spatialAudioToggle', (v) => { 
            this.audioEngine.toggleSpatial(v);
            this.showToast(`الصوت المكاني: ${v ? 'مفعل' : 'معطل'}`);
        });

        setupToggle('dialogueBoostToggle', (v) => { 
            this.audioEngine.toggleDialogueBoost(v);
            this.showToast(`تعزيز الحوار: ${v ? 'مفعل' : 'معطل'}`);
        });

        setupToggle('theaterModeToggle', (v) => { 
            document.body.classList.toggle('immersive-mode', v);
            this.showToast(v ? 'وضع المسرح' : 'الوضع العادي');
        });

        // Speed
        document.querySelectorAll('[data-speed]').forEach(sp => {
            sp.onclick = () => {
                this.video.playbackRate = parseFloat(sp.dataset.speed);
                document.querySelectorAll('[data-speed]').forEach(s => s.classList.remove('active'));
                sp.classList.add('active');
            };
        });

        // Close menus on click outside
        window.onclick = (e) => {
            if (!e.target.closest('.dropdown-container')) {
                document.querySelectorAll('.dropdown-menu, .settings-menu').forEach(m => m.classList.remove('show'));
            }
        };
    }

    setupSidePanel() {
        const panel = document.getElementById('sidePanel');
        document.getElementById('sidePanelBtn').onclick = () => panel.classList.add('open');
        document.getElementById('closeSidePanelBtn').onclick = () => panel.classList.remove('open');
        
        // Tabs
        const tabs = document.querySelectorAll('.tab-btn');
        tabs.forEach(t => {
            t.onclick = () => {
                tabs.forEach(x => x.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                t.classList.add('active');
                document.getElementById(`content-${t.dataset.tab}`).classList.add('active');
            };
        });
    }

    initVTT() {
        // Fallback Mock Data if tracks fail to load
        const mockTranscript = [
            { t: 0, text: "أهلاً بكم في الإصدار الأسطوري." },
            { t: 5, text: "هذا المشغل يستخدم WebGL." },
            { t: 10, text: "يمكنك إضافة ملاحظات مكانية هنا." }
        ];
        
        const container = document.getElementById('transcriptBody');
        mockTranscript.forEach(line => {
            const span = document.createElement('span');
            span.innerText = line.text + " ";
            span.onclick = () => this.video.currentTime = line.t;
            container.appendChild(span);
        });

        // Search Mock
        document.getElementById('aiSearchInput').addEventListener('keyup', (e) => {
            const term = e.target.value.toLowerCase();
            if(e.key === 'Enter') {
                this.showToast(`جاري البحث بالذكاء الاصطناعي عن: ${term}...`);
                // Simulate AI search latency
                setTimeout(() => {
                    this.showToast(`تم العثور على "${term}" في الدقيقة 00:15`);
                    this.video.currentTime = 15;
                }, 1000);
            }
        });
    }

    async loadAIModels() {
        try {
            // Check if TF is loaded
            if (window.tf && window.cocoSsd) {
                console.log("Loading AI Vision Model...");
                this.model = await cocoSsd.load();
                console.log("AI Model Ready.");
                this.showToast("🚀 الذكاء الاصطناعي جاهز للتحليل");
            }
        } catch (e) {
            console.log("AI Model lazy load skipped.");
        }
    }
}

// Start
document.addEventListener('DOMContentLoaded', () => {
    window.player = new WebPlayerPro('playerContainer');
});