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

// ---- Bell (Soft Chime), made with the browser's built-in Web Audio ----
let audioCtx = null;   // created on the first click, because browsers need a click before playing sound
let bell = null;       // the bell that is waiting to ring (or ringing) right now

// One note: several pure tones that fade away together.
// Each tone is [pitch multiplier, loudness, fade-out seconds].
function ringNote(ctx, out, when, pitch, tones, volume) {
  return tones.map(([mult, loud, fade]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = pitch * mult;
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.linearRampToValueAtTime(volume * loud, when + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, when + fade);
    osc.connect(gain);
    gain.connect(out);
    osc.start(when);
    osc.stop(when + fade + 0.05);
    return osc;
  });
}

// Plan the bell to ring after `seconds`. It uses the audio clock, which keeps
// good time even when the tab is in the background.
function scheduleBell(seconds) {
  cancelBell();
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioCtx.resume();
    const out = audioCtx.createGain();
    out.connect(audioCtx.destination);
    const when = audioCtx.currentTime + seconds;
    const oscillators = ringNote(audioCtx, out, when, 1568, [
      [1,    1.0,  3.4],
      [2.76, 0.35, 2.0],
      [5.4,  0.12, 0.9]
    ], 0.35);
    bell = { out, oscillators };
  } catch (e) {
    bell = null; // no sound available: the timer still works
  }
}

// Take the bell away: if it is waiting, it never rings; if it is ringing, it fades out fast.
function cancelBell() {
  if (!bell) return;
  const { out, oscillators } = bell;
  bell = null;
  const now = audioCtx.currentTime;
  out.gain.cancelScheduledValues(now);
  out.gain.setTargetAtTime(0, now, 0.02);
  oscillators.forEach((osc) => {
    try { osc.stop(now + 0.15); } catch (e) { /* already stopped */ }
  });
  setTimeout(() => out.disconnect(), 400);
}

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
  scheduleBell(remainingMs / 1000);
}

startPauseBtn.addEventListener('click', () => {
  if (intervalId === null) {
    start();
  } else {
    tick();
    if (intervalId !== null) {
      stop('Resume');
      cancelBell();
    }
  }
});

// Back to the very start: full time, fully blurred, details hidden.
function resetAll() {
  stop('Start');
  cancelBell();
  remainingMs = DURATION_MS;
  showFinished(false);
  showTime(remainingMs);
}

resetBtn.addEventListener('click', resetAll);
restartBtn.addEventListener('click', resetAll);

document.addEventListener('visibilitychange', () => {
  if (intervalId !== null) tick();
});
