/**
 * Web Player Pro - Legendary Edition (Optimized V8)
 * Refactored for: Performance, Battery Life, UX Persistence, and PC Support.
 */

// --- 1. WebGL Ambient Engine (Battery Optimized) ---
class AmbientEngine {
    constructor(canvas, sourceVideo) {
        this.canvas = canvas;
        this.video = sourceVideo;
        this.gl = this.canvas.getContext('webgl', { preserveDrawingBuffer: false, alpha: false });
        this.active = false;
        this.animationId = null; // لتتبع الحلقة وإيقافها
        
        if (!this.gl) { console.warn("WebGL disabled."); return; }
        this.initShaders();
        this.initBuffers();
        this.resize();
        // تحديث الحجم عند تغيير حجم النافذة
        window.addEventListener('resize', () => this.resize());
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
        // Shader بسيط جداً للأداء، الاعتماد الكلي على CSS Blur
        const fsSource = `
            precision mediump float;
            varying vec2 vTexCoord;
            uniform sampler2D uTexture;
            void main() {
                vec4 color = texture2D(uTexture, vTexCoord);
                // زيادة التشبع (Saturation) فقط
                float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
                vec3 satColor = mix(vec3(gray), color.rgb, 1.8);
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
        const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
        const buffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
        const position = this.gl.getAttribLocation(this.program, "position");
        this.gl.enableVertexAttribArray(position);
        this.gl.vertexAttribPointer(position, 2, this.gl.FLOAT, false, 0, 0);

        this.texture = this.gl.createTexture();
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
    }

    resize() {
        // حجم صغير جداً للأداء، والـ CSS Blur سيقوم بتنعيمه
        this.canvas.width = 64; 
        this.canvas.height = 36;
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }

    start() {
        if (this.active) return;
        this.active = true;
        this.loop();
    }

    stop() {
        this.active = false;
        if (this.animationId) cancelAnimationFrame(this.animationId);
    }

    loop() {
        if (!this.active) return;
        if (this.video.readyState >= 2) {
            try {
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.texture);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.video);
                this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
            } catch(e) { this.stop(); }
        }
        this.animationId = requestAnimationFrame(() => this.loop());
    }
}

// --- 2. Advanced Audio Engine (Stereo Widening & Smart DSP) ---
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
        
        this.nodes.source = this.ctx.createMediaElementSource(this.video);
        this.nodes.gain = this.ctx.createGain();

        // 1. Stereo Widening (Haas Effect) بدلاً من Panner المتحرك
        this.nodes.splitter = this.ctx.createChannelSplitter(2);
        this.nodes.merger = this.ctx.createChannelMerger(2);
        this.nodes.delay = this.ctx.createDelay();
        this.nodes.delay.delayTime.value = 0; // افتراضياً معطل

        // 2. Smart Compressor (إعدادات هادئة لا تسبب الضجيج)
        this.nodes.compressor = this.ctx.createDynamicsCompressor();
        this.nodes.compressor.threshold.value = -24; // كان -50 (مشوه)
        this.nodes.compressor.knee.value = 30;
        this.nodes.compressor.ratio.value = 1; // 1 = معطل
        this.nodes.compressor.attack.value = 0.003;
        this.nodes.compressor.release.value = 0.25;

        // Routing Graph:
        // Source -> Compressor -> Splitter
        // Left -> Merger Left
        // Right -> Delay -> Merger Right
        // Merger -> Gain -> Destination
        
        this.nodes.source.connect(this.nodes.compressor);
        this.nodes.compressor.connect(this.nodes.splitter);
        
        // القناة اليسرى تمر مباشرة
        this.nodes.splitter.connect(this.nodes.merger, 0, 0);
        // القناة اليمنى تمر عبر التأخير (Delay)
        this.nodes.splitter.connect(this.nodes.delay, 1); 
        this.nodes.delay.connect(this.nodes.merger, 0, 1);
        
        this.nodes.merger.connect(this.nodes.gain);
        this.nodes.gain.connect(this.ctx.destination);
    }

    setVolume(val) {
        if(this.nodes.gain) this.nodes.gain.gain.value = val;
    }

    toggleSpatial(enable) {
        if (!this.ctx) this.init();
        // تأخير 20ms يخلق شعوراً بالاتساع المذهل دون دوار
        const delayTime = enable ? 0.02 : 0;
        this.nodes.delay.delayTime.setTargetAtTime(delayTime, this.ctx.currentTime, 0.5);
    }

    toggleDialogueBoost(enable) {
        if (!this.ctx) this.init();
        const now = this.ctx.currentTime;
        // ضغط ناعم لرفع الصوت الخافت
        this.nodes.compressor.ratio.setTargetAtTime(enable ? 4 : 1, now, 0.2);
        this.nodes.gain.gain.setTargetAtTime(enable ? 1.5 : 1, now, 0.2);
    }
}

// --- 3. Gesture Controller (Mouse + Touch Support) ---
class GestureController {
    constructor(element, callbacks) {
        this.element = element;
        this.cbs = callbacks; 
        this.startX = 0;
        this.startY = 0;
        this.isDragging = false;
        
        // Touch Events
        this.element.addEventListener('touchstart', this.onStart.bind(this), {passive: false});
        this.element.addEventListener('touchmove', this.onMove.bind(this), {passive: false});
        this.element.addEventListener('touchend', this.onEnd.bind(this));

        // Mouse Events (دعم الكمبيوتر)
        this.element.addEventListener('mousedown', this.onMouseDown.bind(this));
        window.addEventListener('mousemove', this.onMouseMove.bind(this)); // Window لسلاسة السحب
        window.addEventListener('mouseup', this.onMouseUp.bind(this));

        // Double Click
        this.lastClick = 0;
        this.element.addEventListener('click', (e) => {
             const now = Date.now();
             if (now - this.lastClick < 300) {
                 this.handleDoubleTap(e);
             }
             this.lastClick = now;
        });
    }

    // موحد (للفأرة واللمس)
    getCoord(e) {
        return e.touches ? { x: e.touches[0].clientX, y: e.touches[0].clientY } : { x: e.clientX, y: e.clientY };
    }

    onStart(e) { this.startDrag(this.getCoord(e)); }
    onMouseDown(e) { this.isMouseDown = true; this.startDrag(this.getCoord(e)); }

    startDrag(pos) {
        this.startX = pos.x;
        this.startY = pos.y;
        this.isDragging = false;
    }

    onMove(e) { e.preventDefault(); this.processMove(this.getCoord(e)); }
    onMouseMove(e) { if(this.isMouseDown) { e.preventDefault(); this.processMove(this.getCoord(e)); } }

    processMove(pos) {
        const diffX = pos.x - this.startX;
        const diffY = this.startY - pos.y;
        
        if (Math.abs(diffX) > 10 || Math.abs(diffY) > 10) this.isDragging = true;
        
        if (this.isDragging && Math.abs(diffY) > Math.abs(diffX)) {
            const sensitivity = 0.01;
            // Left: Brightness, Right: Volume
            if (this.startX < window.innerWidth / 2) {
                if (this.cbs.onBright) this.cbs.onBright(diffY * sensitivity);
            } else {
                if (this.cbs.onVolume) this.cbs.onVolume(diffY * sensitivity);
            }
        }
    }

    onEnd(e) { this.isDragging = false; }
    onMouseUp(e) { this.isMouseDown = false; this.isDragging = false; }

    handleDoubleTap(e) {
        const width = this.element.clientWidth;
        const x = e.offsetX;
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
            notes: [], // سيتم تحميلها من الذاكرة
            isAddingNote: false,
            settings: { theater: false, eco: false }
        };

        this.audioEngine = new AudioEngine(this.video);
        this.ambientEngine = new AmbientEngine(document.getElementById('ambientCanvas'), this.video);
        
        this.init();
        this.setupGestures();
        this.initHLS();
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
            settingsBtn: document.getElementById('settingsBtn'),
            colorBtn: document.getElementById('colorBtn')
        };
    }

    init() {
        // 1. استرجاع الملاحظات المحفوظة (Persistence)
        const savedNotes = localStorage.getItem('player_notes');
        if (savedNotes) {
            this.state.notes = JSON.parse(savedNotes);
            this.state.notes.forEach(n => this.renderNotePin(n));
            this.updateNotesList();
        }

        // 2. Playback Events
        const toggleHandler = () => this.togglePlay();
        this.ui.playBtn.onclick = toggleHandler;
        this.ui.bigPlayBtn.onclick = toggleHandler;
        
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
            // توفير البطارية: إيقاف المحرك فوراً
            this.ambientEngine.stop(); 
        });
        this.video.addEventListener('timeupdate', () => this.updateProgress());
        this.video.addEventListener('loadedmetadata', () => {
            this.ui.durationDisplay.innerText = this.formatTime(this.video.duration);
        });

        // 3. إصلاح شريط التقدم (Click to Scrub)
        this.ui.progressArea.addEventListener('click', (e) => {
            const rect = this.ui.progressArea.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = clickX / rect.width;
            if(isFinite(this.video.duration)) {
                this.video.currentTime = pct * this.video.duration;
            }
        });

        this.ui.volumeSlider.addEventListener('input', (e) => {
            this.video.volume = e.target.value;
            this.audioEngine.setVolume(e.target.value);
        });

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

        // الذكاء الاصطناعي (Lazy Load)
        document.getElementById('aiSearchInput').addEventListener('focus', () => {
            this.injectAIScripts(); // حمل الملفات فقط عندما يريد المستخدم البحث
        });
    }

    injectAIScripts() {
        if (window.tf) return; // تم التحميل سابقاً
        this.showToast("جاري تحميل محرك الذكاء الاصطناعي...");
        const scripts = [
            "https://cdn.jsdelivr.net/npm/@tensorflow/tfjs",
            "https://cdn.jsdelivr.net/npm/@tensorflow-models/coco-ssd"
        ];
        scripts.forEach(src => {
            const s = document.createElement('script');
            s.src = src;
            s.async = true;
            document.head.appendChild(s);
        });
    }

    initHLS() {
        const source = 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8';
        if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true });
            hls.loadSource(source);
            hls.attachMedia(this.video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => document.getElementById('spinner').style.display = 'none');
        } else if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
            this.video.src = source;
        }
    }

    togglePlay() {
        if (this.video.paused) {
            this.video.play().catch(e => console.log("Autoplay blocked"));
            this.audioEngine.init();
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

        // استخدام الـ Wrapper للتحكم بدلاً من الزر فقط ليشمل الشاشة كاملة
        new GestureController(document.querySelector('.player-container'), {
            onSeek: (dt) => {
                this.video.currentTime += dt;
                showFb(dt > 0 ? '⏩ +10s' : '⏪ -10s');
            },
            onVolume: (delta) => {
                let v = this.video.volume + (delta * 0.1);
                v = Math.max(0, Math.min(1, v));
                this.video.volume = v;
                this.ui.volumeSlider.value = v;
                showFb(`🔊 ${Math.round(v * 100)}%`);
            },
            onBright: (delta) => {
                this.state.brightness += (delta * 0.1);
                this.state.brightness = Math.max(0.3, Math.min(1.5, this.state.brightness));
                this.ui.overlay.style.backgroundColor = `rgba(0,0,0,${1 - (this.state.brightness / 1.5)})`; 
                showFb(`☀ ${Math.round(this.state.brightness * 100)}%`);
            },
            onToggle: () => this.togglePlay()
        });
    }

    setupSpatialNotes() {
        document.getElementById('addNoteBtn').onclick = () => {
            this.state.isAddingNote = !this.state.isAddingNote;
            const btn = document.getElementById('addNoteBtn');
            btn.innerHTML = this.state.isAddingNote ? 'انقر على الفيديو لتثبيت الملاحظة ❌' : 'إضافة ملاحظة مكانية <i class="fa-solid fa-map-pin"></i>';
            btn.style.borderColor = this.state.isAddingNote ? 'var(--primary)' : '#555';
            this.container.style.cursor = this.state.isAddingNote ? 'crosshair' : 'default';
        };

        this.ui.spatialLayer.onclick = (e) => {
            if (!this.state.isAddingNote) return;
            const rect = this.ui.spatialLayer.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * 100;
            const y = ((e.clientY - rect.top) / rect.height) * 100;
            const time = this.video.currentTime;

            // حفظ الملاحظة
            const noteData = { x, y, time, id: Date.now() };
            this.state.notes.push(noteData);
            localStorage.setItem('player_notes', JSON.stringify(this.state.notes)); // حفظ دائم

            this.renderNotePin(noteData);
            this.updateNotesList();

            // Reset Mode
            this.state.isAddingNote = false;
            document.getElementById('addNoteBtn').click();
            this.showToast('تم تثبيت الملاحظة بنجاح 📌');
        };

        this.video.addEventListener('timeupdate', () => {
            document.querySelectorAll('.spatial-pin').forEach(pin => {
                const pinTime = parseFloat(pin.dataset.time);
                if (Math.abs(this.video.currentTime - pinTime) < 2) {
                    pin.style.display = 'block';
                } else {
                    pin.style.display = 'none';
                }
            });
        });
    }

    renderNotePin(note) {
        const pin = document.createElement('div');
        pin.className = 'spatial-pin';
        pin.style.left = `${note.x}%`;
        pin.style.top = `${note.y}%`;
        pin.dataset.time = note.time;
        pin.title = `ملاحظة عند ${this.formatTime(note.time)}`;
        pin.onclick = (e) => {
            e.stopPropagation();
            this.showToast(`ملاحظة محفوظة عند ${this.formatTime(note.time)}`);
        };
        this.ui.spatialLayer.appendChild(pin);
    }

    updateNotesList() {
        const list = document.getElementById('notesList');
        list.innerHTML = '';
        this.state.notes.forEach((note, index) => {
            const item = document.createElement('div');
            item.className = 'chapter-item'; // Reuse styling
            item.style.padding = '10px';
            item.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
            item.style.cursor = 'pointer';
            item.innerHTML = `<div class="chapter-info"><h4 style="color:#fff">ملاحظة ${index + 1}</h4><p style="color:#aaa">${this.formatTime(note.time)}</p></div>`;
            item.onclick = () => { this.video.currentTime = note.time; };
            list.appendChild(item);
        });
    }

    setupColorGrading() {
        const options = document.querySelectorAll('#colorMenu li[data-lut]');
        options.forEach(opt => {
            opt.onclick = () => {
                options.forEach(o => o.classList.remove('active'));
                opt.classList.add('active');
                this.video.classList.remove('lut-warm', 'lut-cool', 'lut-bw', 'lut-vintage');
                const lut = opt.dataset.lut;
                if (lut !== 'none') {
                    this.video.classList.add(`lut-${lut}`);
                    this.showToast(`تم تطبيق فلتر: ${opt.innerText}`);
                }
            };
        });
    }

    updateProgress() {
        const cur = this.video.currentTime;
        const dur = this.video.duration || 1;
        const pct = (cur / dur) * 100;
        this.ui.progressBar.style.width = `${pct}%`;
        this.ui.timeDisplay.innerText = this.formatTime(cur);
        
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
            this.showToast(`توسيع الستيريو: ${v ? 'مفعل' : 'معطل'}`);
        });
        setupToggle('dialogueBoostToggle', (v) => { 
            this.audioEngine.toggleDialogueBoost(v);
            this.showToast(`تعزيز الحوار: ${v ? 'مفعل' : 'معطل'}`);
        });
        setupToggle('theaterModeToggle', (v) => { 
            document.body.classList.toggle('immersive-mode', v);
            this.showToast(v ? 'وضع المسرح' : 'الوضع العادي');
        });

        document.querySelectorAll('[data-speed]').forEach(sp => {
            sp.onclick = () => {
                this.video.playbackRate = parseFloat(sp.dataset.speed);
                document.querySelectorAll('[data-speed]').forEach(s => s.classList.remove('active'));
                sp.classList.add('active');
            };
        });

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
}

document.addEventListener('DOMContentLoaded', () => {
    window.player = new WebPlayerPro('playerContainer');
});