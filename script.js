// Timer length: 25 minutes
const DURATION_MS = 25 * 60 * 1000;

const timeEl = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause');
const resetBtn = document.getElementById('reset');

let remainingMs = DURATION_MS; // time left when stopped
let endTime = 0;               // the real-clock moment the timer will hit zero
let intervalId = null;         // null means the timer is not running

function showTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  timeEl.textContent =
    String(minutes).padStart(2, '0') + ':' + String(seconds).padStart(2, '0');
}

function stop() {
  clearInterval(intervalId);
  intervalId = null;
  startPauseBtn.textContent = 'Start';
}

// Work out the time left from the real clock, so it stays correct
// even when the browser tab is in the background.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  showTime(remainingMs);
  if (remainingMs === 0) {
    stop();
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
    stop();
  }
});

resetBtn.addEventListener('click', () => {
  stop();
  remainingMs = DURATION_MS;
  startPauseBtn.disabled = false;
  showTime(remainingMs);
});

document.addEventListener('visibilitychange', () => {
  if (intervalId !== null) tick();
});
