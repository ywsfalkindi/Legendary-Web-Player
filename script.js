// script.js - Ultimate Edition

document.addEventListener('DOMContentLoaded', () => {
    // 1. Elements Selection
    const container = document.getElementById('playerContainer');
    const video = document.getElementById('mainVideo');
    const playBtn = document.getElementById('playPauseBtn');
    const bigPlayBtn = document.getElementById('bigPlayBtn');
    const progressBar = document.getElementById('progressBar');
    const progressArea = document.getElementById('progressArea');
    const progressTooltip = document.getElementById('progressTooltip');
    const timeDisplay = document.getElementById('currentTime');
    const durationDisplay = document.getElementById('duration');
    const fullscreenBtn = document.getElementById('fullscreenBtn');
    const volumeBtn = document.getElementById('muteBtn');
    const volumeSlider = document.getElementById('volumeSlider');
    const settingsBtn = document.getElementById('settingsBtn');
    const settingsMenu = document.getElementById('settingsMenu');
    const speedOptions = document.querySelectorAll('#settingsMenu li[data-speed]');
    const pipBtn = document.getElementById('pipBtn');
    const ambientCanvas = document.getElementById('ambientCanvas');
    const toast = document.getElementById('toast');
    
    // Canvas Context for Ambient Light
    const ctx = ambientCanvas.getContext('2d', { alpha: false }); // Optimize performance
    let ambientInterval;

    // --- State Variables ---
    let isMouseDown = false;
    let controlsTimeout;

    // 2. Initialization & LocalStorage Resume
    function initPlayer() {
        // Restore Volume
        const savedVolume = localStorage.getItem('video-volume');
        if (savedVolume !== null) {
            video.volume = parseFloat(savedVolume);
            volumeSlider.value = savedVolume;
        }
        updateVolumeIcon();

        // Restore Playback Position (Smart Resume)
        const savedTime = localStorage.getItem('video-time');
        if (savedTime) {
            video.currentTime = parseFloat(savedTime);
            showToast(`تم استكمال المشاهدة من ${formatTime(video.currentTime)}`);
        }
    }

    // 3. Playback Logic
    function togglePlay() {
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
    }

    function updatePlayState() {
        if (video.paused) {
            container.classList.add('paused');
            playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            bigPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
            stopAmbientLight();
        } else {
            container.classList.remove('paused');
            playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            bigPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
            startAmbientLight();
        }
    }

    video.addEventListener('play', updatePlayState);
    video.addEventListener('pause', updatePlayState);
    
    // Toggle play on Click (Video & Buttons)
    playBtn.addEventListener('click', togglePlay);
    bigPlayBtn.addEventListener('click', togglePlay);
    video.addEventListener('click', togglePlay);

    // 4. Ambient Light Effect (The "Wow" Factor)
    function startAmbientLight() {
        if (ambientInterval) clearInterval(ambientInterval);
        // Draw every 33ms (~30fps) to save CPU
        ambientInterval = setInterval(() => {
            if (!video.paused && !video.ended) {
                ctx.drawImage(video, 0, 0, ambientCanvas.width, ambientCanvas.height);
            }
        }, 33);
    }
    
    function stopAmbientLight() {
        clearInterval(ambientInterval);
    }

    // Resize canvas match video aspect
    video.addEventListener('loadedmetadata', () => {
        ambientCanvas.width = 100; // Low res for performance (will be blurred by CSS)
        ambientCanvas.height = 100 * (video.videoHeight / video.videoWidth);
        durationDisplay.innerText = formatTime(video.duration);
    });

    // 5. Progress & Time
    video.addEventListener('timeupdate', () => {
        const current = video.currentTime;
        const duration = video.duration || 0;
        const progressPercent = (current / duration) * 100;
        
        progressBar.style.width = `${progressPercent}%`;
        timeDisplay.innerText = formatTime(current);

        // Save position every update (for Resume feature)
        localStorage.setItem('video-time', current);
    });

    // Seek Logic
    function seek(e) {
        const timelineWidth = progressArea.clientWidth;
        const clickX = e.offsetX;
        const duration = video.duration;
        video.currentTime = (clickX / timelineWidth) * duration;
    }

    progressArea.addEventListener('click', seek);
    
    // Dragging Seek
    progressArea.addEventListener('mousedown', () => isMouseDown = true);
    document.addEventListener('mouseup', () => isMouseDown = false);
    progressArea.addEventListener('mousemove', (e) => {
        if (isMouseDown) seek(e);
        
        // Tooltip logic
        const timelineWidth = progressArea.clientWidth;
        const hoverX = e.offsetX;
        const percent = (hoverX / timelineWidth) * 100;
        const time = (hoverX / timelineWidth) * video.duration;
        
        progressTooltip.style.left = `${percent}%`;
        progressTooltip.innerText = formatTime(time);
    });

    // 6. Volume Control
    volumeSlider.addEventListener('input', (e) => {
        video.volume = e.target.value;
        video.muted = e.target.value === '0';
        updateVolumeIcon();
        localStorage.setItem('video-volume', video.volume);
    });

    function updateVolumeIcon() {
        const vol = video.volume;
        if (video.muted || vol === 0) {
            volumeBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
        } else if (vol < 0.5) {
            volumeBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
        } else {
            volumeBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        }
    }

    volumeBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        if(video.muted) volumeSlider.value = 0;
        else volumeSlider.value = video.volume > 0 ? video.volume : 0.5; // restore default
        updateVolumeIcon();
    });

    // 7. Fullscreen & Double Click
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            container.requestFullscreen();
            fullscreenBtn.innerHTML = '<i class="fa-solid fa-compress"></i>';
        } else {
            document.exitFullscreen();
            fullscreenBtn.innerHTML = '<i class="fa-solid fa-expand"></i>';
        }
    }
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    container.addEventListener('dblclick', toggleFullscreen);

    // 8. Settings Menu (Speed) - Clean Implementation
    settingsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsMenu.classList.toggle('show');
    });

    document.addEventListener('click', (e) => {
        if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
            settingsMenu.classList.remove('show');
        }
    });

    speedOptions.forEach(option => {
        option.addEventListener('click', () => {
            // Remove active class from all
            speedOptions.forEach(opt => opt.classList.remove('active'));
            // Add to clicked
            option.classList.add('active');
            
            // Set Speed
            const speed = parseFloat(option.dataset.speed);
            video.playbackRate = speed;
            settingsMenu.classList.remove('show');
            showToast(`Speed: ${speed}x`);
        });
    });

    // 9. PIP
    pipBtn.addEventListener('click', () => {
        if (document.pictureInPictureElement) document.exitPictureInPicture();
        else video.requestPictureInPicture();
    });

    // 10. Advanced Keyboard Shortcuts
    document.addEventListener('keydown', (e) => {
        // Ignore if typing in an input
        if (document.activeElement.tagName === 'INPUT') return;

        switch(e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                togglePlay();
                break;
            case 'f':
                toggleFullscreen();
                break;
            case 'm':
                volumeBtn.click();
                showToast(video.muted ? "Muted" : "Unmuted");
                break;
            case 'arrowright':
            case 'l':
                video.currentTime += 5;
                showToast("+ 5s");
                break;
            case 'arrowleft':
            case 'j':
                video.currentTime -= 5;
                showToast("- 5s");
                break;
            case 'arrowup':
                e.preventDefault();
                video.volume = Math.min(1, video.volume + 0.1);
                volumeSlider.value = video.volume;
                showToast(`Volume: ${Math.round(video.volume * 100)}%`);
                updateVolumeIcon();
                break;
            case 'arrowdown':
                e.preventDefault();
                video.volume = Math.max(0, video.volume - 0.1);
                volumeSlider.value = video.volume;
                showToast(`Volume: ${Math.round(video.volume * 100)}%`);
                updateVolumeIcon();
                break;
        }
    });

    // 11. Buffering & Error Handling
    video.addEventListener('waiting', () => container.classList.add('buffering'));
    video.addEventListener('playing', () => container.classList.remove('buffering'));
    video.addEventListener('error', () => {
        showToast("خطأ في تحميل الفيديو");
    });

    // 12. Helper: Toast Notification
    function showToast(message) {
        toast.innerText = message;
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2000);
    }

    // 13. Helper: Time Format
    function formatTime(time) {
        if(isNaN(time)) return "00:00";
        let seconds = Math.floor(time % 60);
        let minutes = Math.floor(time / 60) % 60;
        let hours = Math.floor(time / 3600);

        seconds = seconds < 10 ? `0${seconds}` : seconds;
        minutes = minutes < 10 ? `0${minutes}` : minutes;

        if (hours == 0) return `${minutes}:${seconds}`;
        return `${hours}:${minutes}:${seconds}`;
    }

    // 14. Mobile Touch UX (Show controls on tap)
    container.addEventListener('touchstart', () => {
        container.classList.add('show-controls');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if(!video.paused) container.classList.remove('show-controls');
        }, 3000);
    });

    // Move mouse checks for desktop
    container.addEventListener('mousemove', () => {
        container.classList.remove('hide-cursor');
        container.classList.add('show-controls');
        clearTimeout(controlsTimeout);
        controlsTimeout = setTimeout(() => {
            if(!video.paused) {
                container.classList.remove('show-controls');
                container.classList.add('hide-cursor');
            }
        }, 3000);
    });

    // Run Init
    initPlayer();
});