// TEMPORARY TEST SETTING: 15 seconds, so it is quick to test.
// The real length is 25 minutes: change this line back to 25 * 60 * 1000.
const DURATION_MS = 15 * 1000;

const timeEl = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause');
const resetBtn = document.getElementById('reset');
const artEl = document.getElementById('art');
const restartBtn = document.getElementById('restart');
const detailsEl = document.getElementById('details');
const statusEl = document.getElementById('status');
const titleEl = document.getElementById('painting-title');
const infoEl = document.getElementById('painting-info');
const linkEl = document.getElementById('painting-link');

// How blurred the painting is at the start (in pixels). It reaches 0 at 00:00.
const MAX_BLUR = 14;

// ---- Painting from the Met Museum (free public API, no key needed) ----
const MET = 'https://collectionapi.metmuseum.org/public/collection';
const SEARCH_WORDS = ['flowers', 'river', 'portrait', 'landscape', 'sky',
                      'garden', 'harbor', 'sunset', 'village', 'still life'];
const MAX_TRIES = 10;

let painting = null; // the painting for this session: { image, title, artist, year, link }
const searchCache = {};

async function getJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error('Met API answered ' + response.status);
  return response.json();
}

// Wait until the picture has really loaded in the browser.
function preloadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = () => reject(new Error('image did not load'));
    img.src = url;
  });
}

// Pick a random painting that is public domain and has an image.
// Everything shown comes straight from the Met's data.
async function fetchPainting() {
  for (let attempt = 0; attempt < MAX_TRIES; attempt++) {
    try {
      const word = SEARCH_WORDS[Math.floor(Math.random() * SEARCH_WORDS.length)];
      if (!searchCache[word]) {
        const found = await getJson(
          MET + '/v1.1/search?hasImages=true&medium=Paintings&q=' + encodeURIComponent(word));
        searchCache[word] = found.objectIDs || [];
      }
      const ids = searchCache[word];
      if (ids.length === 0) continue;
      const id = ids[Math.floor(Math.random() * ids.length)];
      const obj = await getJson(MET + '/v1/objects/' + id);
      const usable = obj.isPublicDomain && obj.primaryImageSmall &&
        obj.title && obj.objectURL && (obj.classification || '').includes('Paintings');
      if (!usable) continue;
      await preloadImage(obj.primaryImageSmall);
      return {
        image: obj.primaryImageSmall,
        title: obj.title,
        artist: obj.artistDisplayName || 'Artist not listed',
        year: obj.objectDate || 'Year not listed',
        link: obj.objectURL
      };
    } catch (e) {
      // Try again with another painting.
    }
  }
  return null;
}

// Get a new painting. Start waits until it is ready.
async function loadNewPainting() {
  painting = null;
  artEl.classList.remove('photo');
  startPauseBtn.disabled = true;
  statusEl.textContent = 'Loading painting\u2026';
  statusEl.hidden = false;
  const found = await fetchPainting();
  if (found) {
    painting = found;
    artEl.style.setProperty('--photo', 'url("' + found.image + '")');
    artEl.classList.add('photo');
    statusEl.hidden = true;
    startPauseBtn.disabled = false;
  } else {
    statusEl.textContent = 'Sorry, I could not get a painting. Please reload the page.';
  }
}

// The painting details are only put on the page when the timer is finished.
function fillDetails() {
  if (!painting) return;
  titleEl.textContent = painting.title;
  infoEl.textContent = painting.artist + ' \u00b7 ' + painting.year;
  linkEl.href = painting.link;
}

function clearDetails() {
  titleEl.textContent = '';
  infoEl.textContent = '';
  linkEl.removeAttribute('href');
}

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
    fillDetails();
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
  clearDetails();
  showTime(remainingMs);
}

// Reset keeps the same painting. Only Restart session loads a new one.
resetBtn.addEventListener('click', resetAll);
restartBtn.addEventListener('click', () => {
  resetAll();
  loadNewPainting();
});

document.addEventListener('visibilitychange', () => {
  if (intervalId !== null) tick();
});

loadNewPainting();
