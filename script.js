// Timer length: 25 minutes
const DURATION_MS = 25 * 60 * 1000;

const timeEl = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause');
const resetBtn = document.getElementById('reset');
const artEl = document.getElementById('art');

// How blurred the painting is at the start (in pixels). It reaches 0 at 00:00.
const MAX_BLUR = 14;

let remainingMs = DURATION_MS; // time left when stopped
let endTime = 0;               // the real-clock moment the timer will hit zero
let intervalId = null;         // null means the timer is not running

function showTime(ms) {
  artEl.style.setProperty('--blur', (MAX_BLUR * ms / DURATION_MS).toFixed(2));
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timeEl.textContent =
    String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

// Stop counting and set the button text ('Start' or 'Resume')
function stop(label) {
  clearInterval(intervalId);
  intervalId = null;
  startPauseBtn.textContent = label;
}

// Work out the time left from the real clock, so it stays correct
// even when the browser tab is in the background.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  showTime(remainingMs);
  if (remainingMs === 0) {
    stop('Start');
    startPauseBtn.disabled = true;
  }
}

function start() {
  endTime = Date.now() + remainingMs;
  intervalId = setInterval(tick, 250);
  startPauseBtn.textContent = 'Pause';
}

startPauseBtn.addEventListener('click', () => {
  if (intervalId === null) {
    start();
  } else {
    tick();
    if (intervalId !== null) stop('Resume');
  }
});

resetBtn.addEventListener('click', () => {
  stop('Start');
  remainingMs = DURATION_MS;
  startPauseBtn.disabled = false;
  showTime(remainingMs);
});

document.addEventListener('visibilitychange', () => {
  if (intervalId !== null) tick();
});
