// script.js

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
const pipBtn = document.getElementById('pipBtn');

// 1. Playback Logic
function togglePlay() {
    if (video.paused) {
        video.play();
        container.classList.remove('paused');
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        bigPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
    } else {
        video.pause();
        container.classList.add('paused');
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        bigPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}

video.addEventListener('click', togglePlay);
playBtn.addEventListener('click', togglePlay);

// 2. Buffering Logic (Spinner)
video.addEventListener('waiting', () => container.classList.add('buffering'));
video.addEventListener('playing', () => container.classList.remove('buffering'));

// 3. Time Update & Progress
video.addEventListener('timeupdate', (e) => {
    let current = e.target.currentTime;
    let duration = e.target.duration || 0;

    let progressWidth = (current / duration) * 100;
    progressBar.style.width = `${progressWidth}%`;

    timeDisplay.innerText = formatTime(current);
    durationDisplay.innerText = formatTime(duration);
});

// 4. Seek (القفز عند النقر)
progressArea.addEventListener('click', (e) => {
    let timelineWidth = progressArea.clientWidth;
    let clickX = e.offsetX;
    video.currentTime = (clickX / timelineWidth) * video.duration;
});

// Tooltip on Hover (إظهار الوقت عند تمرير الماوس)
progressArea.addEventListener('mousemove', (e) => {
    let timelineWidth = progressArea.clientWidth;
    let clickX = e.offsetX;
    let percent = (clickX / timelineWidth) * 100;
    progressTooltip.style.left = `${percent}%`;
    
    let time = (clickX / timelineWidth) * video.duration;
    progressTooltip.innerText = formatTime(time);
});

// 5. Volume
volumeSlider.addEventListener('input', (e) => {
    video.volume = e.target.value;
    updateVolumeIcon();
});

function updateVolumeIcon() {
    if(video.volume === 0 || video.muted) {
        volumeBtn.innerHTML = '<i class="fa-solid fa-volume-xmark"></i>';
    } else if (video.volume < 0.5) {
        volumeBtn.innerHTML = '<i class="fa-solid fa-volume-low"></i>';
    } else {
        volumeBtn.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
    }
}

volumeBtn.addEventListener('click', () => {
    if(video.muted) {
        video.muted = false;
        video.volume = volumeSlider.value; // Restore previous volume
    } else {
        video.muted = true;
    }
    updateVolumeIcon();
});

// 6. Fullscreen & Double Click
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
container.addEventListener('dblclick', toggleFullscreen); // ميزة النقر المزدوج

// 7. Settings Menu (Speed)
settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // منع إغلاق القائمة فوراً
    settingsMenu.classList.toggle('show');
});

// إغلاق القائمة عند النقر في الخارج
document.addEventListener('click', (e) => {
    if (!settingsMenu.contains(e.target) && e.target !== settingsBtn) {
        settingsMenu.classList.remove('show');
    }
});

// تغيير السرعة (تستدعى من HTML)
window.changeSpeed = function(speed) {
    video.playbackRate = speed;
    // تحديث الشكل (Bold)
    document.querySelectorAll('.settings-menu li').forEach(li => li.classList.remove('active'));
    // نبحث عن العنصر الذي ضغطناه (هنا حيلة بسيطة لعدم تعقيد الكود)
    event.target.classList.add('active');
    settingsMenu.classList.remove('show');
}

// 8. Picture in Picture
pipBtn.addEventListener('click', () => {
    if (document.pictureInPictureElement) document.exitPictureInPicture();
    else video.requestPictureInPicture();
});

// 9. Keyboard Shortcuts (الاحترافية الحقيقية)
document.addEventListener('keydown', (e) => {
    // التأكد أننا لا نكتب في حقل نصي
    if (document.activeElement.tagName === 'INPUT') return;

    switch(e.key.toLowerCase()) {
        case ' ':
        case 'k':
            e.preventDefault(); // منع نزول الصفحة
            togglePlay();
            break;
        case 'f':
            toggleFullscreen();
            break;
        case 'm':
            volumeBtn.click();
            break;
        case 'arrowright':
            video.currentTime += 5;
            break;
        case 'arrowleft':
            video.currentTime -= 5;
            break;
    }
});

// Helper Function
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

// Init
container.classList.add('paused');