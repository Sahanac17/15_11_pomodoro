// TEMPORARY TEST SETTING: 15 seconds, so it is quick to test.
// The real length is 25 minutes: change this line back to 25 * 60 * 1000.
const DURATION_MS = 15 * 1000;

const timeEl = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause');
const resetBtn = document.getElementById('reset');
const artEl = document.getElementById('art');
const restartBtn = document.getElementById('restart');
const detailsEl = document.getElementById('details');

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

// Finished view: only Restart session, plus the painting details.
// Back to the normal view: Start/Pause and Reset, details hidden.
function showFinished(finished) {
  startPauseBtn.hidden = finished;
  resetBtn.hidden = finished;
  restartBtn.hidden = !finished;
  detailsEl.hidden = !finished;
}

// Work out the time left from the real clock, so it stays correct
// even when the browser tab is in the background.
function tick() {
  remainingMs = Math.max(0, endTime - Date.now());
  showTime(remainingMs);
  if (remainingMs === 0) {
    stop('Start');
    showFinished(true);
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

// Back to the very start: full time, fully blurred, details hidden.
function resetAll() {
  stop('Start');
  remainingMs = DURATION_MS;
  showFinished(false);
  showTime(remainingMs);
}

resetBtn.addEventListener('click', resetAll);
restartBtn.addEventListener('click', resetAll);

document.addEventListener('visibilitychange', () => {
  if (intervalId !== null) tick();
});
