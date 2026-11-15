// TEMPORARY TEST SETTING: 15 seconds, so it is quick to test.
// The real length is 25 minutes: change this line back to 25 * 60 * 1000.
const DURATION_MS = 15 * 1000;

const timeEl = document.getElementById('time');
const startPauseBtn = document.getElementById('start-pause');
const resetBtn = document.getElementById('reset');
const artEl = document.getElementById('art');
const restartBtn = document.getElementById('restart');
const detailsEl = document.getElementById('details');
const frameEl = document.getElementById('frame');
const messageEl = document.getElementById('message');
const titleEl = document.getElementById('painting-title');
const infoEl = document.getElementById('painting-info');
const linkEl = document.getElementById('painting-link');

// How blurred the painting is at the start (in pixels). It reaches 0 at 00:00.
const MAX_BLUR = 24;

// ---- Painting from the Met Museum (free public API, no key needed) ----
const MET = 'https://collectionapi.metmuseum.org/public/collection';
const SEARCH_WORDS = ['flowers', 'river', 'portrait', 'landscape', 'sky',
                      'garden', 'harbor', 'sunset', 'village', 'still life'];
const MAX_PAINTINGS = 5;  // how many different paintings to try before giving up
const WAIT_MS = 10000;   // how long to wait for the Met before giving up

const FRIENDLY_MESSAGE =
  "We couldn't load a painting right now. You can still use the timer. Refresh the page to try again.";

let painting = null; // the painting for this session: { image, title, artist, year, link }
const searchCache = {};

// Ask the Met for data. If it is slow (over 10 seconds), offline or returns an
// error, this throws, and the page shows the friendly message.
// A "not found" answer for one record is fine: that record is just skipped.
async function getJson(url, notFoundIsOk) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WAIT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 404 && notFoundIsOk) return null;
    if (!response.ok) throw new Error('Met API answered ' + response.status);
    return await response.json();
  } catch (e) {
    throw new Error('The Met is not responding');
  } finally {
    clearTimeout(timer);
  }
}

// Check that the picture really loads in the browser (true or false).
function preloadImage(url) {
  return new Promise((resolve) => {
    const img = new Image();
    let finished = false;
    const done = (ok) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(ok);
    };
    const timer = setTimeout(() => done(false), WAIT_MS);
    img.onload = () => done(img.naturalWidth > 0);
    img.onerror = () => done(false);
    img.src = url;
  });
}

// Pick a random painting that is public domain and has an image. A record that
// does not fit is quietly skipped for another one, up to 5 different paintings.
// Returns the painting, or null if none worked. Throws if the Met is not responding.
// Everything shown comes straight from the Met's data.
async function fetchPainting() {
  const tried = new Set();
  for (let n = 0; n < MAX_PAINTINGS; n++) {
    const word = SEARCH_WORDS[Math.floor(Math.random() * SEARCH_WORDS.length)];
    if (!searchCache[word]) {
      const found = await getJson(
        MET + '/v1.1/search?hasImages=true&medium=Paintings&q=' + encodeURIComponent(word));
      searchCache[word] = (found && found.objectIDs) || [];
    }
    const fresh = searchCache[word].filter((id) => !tried.has(id));
    if (fresh.length === 0) continue;
    const id = fresh[Math.floor(Math.random() * fresh.length)];
    tried.add(id);
    const obj = await getJson(MET + '/v1/objects/' + id, true);
    if (!obj) continue;
    const usable = obj.isPublicDomain && obj.primaryImageSmall &&
      obj.title && obj.objectURL && (obj.classification || '').includes('Paintings');
    if (!usable) continue;
    if (!(await preloadImage(obj.primaryImageSmall))) continue;
    return {
      image: obj.primaryImageSmall,
      title: obj.title,
      artist: obj.artistDisplayName || 'Unknown',
      year: obj.objectDate || 'Unknown',
      link: obj.objectURL
    };
  }
  return null;
}

// Put a short message in the artwork area instead of a painting.
function showMessage(text) {
  messageEl.textContent = text;
  messageEl.hidden = false;
  frameEl.classList.add('no-painting');
}

// Get a new painting and show it in the frame.
let loadCount = 0;
async function loadNewPainting() {
  const thisLoad = ++loadCount;
  painting = null;
  artEl.hidden = true;
  artEl.removeAttribute('src');
  showMessage('Loading painting\u2026');
  let found = null;
  try {
    found = await fetchPainting();
  } catch (e) {
    found = null; // the Met is not responding
  }
  if (thisLoad !== loadCount) return; // a newer load has started, so ignore this one
  if (found) {
    painting = found;
    artEl.src = found.image;
    artEl.hidden = false;
    messageEl.hidden = true;
    frameEl.classList.remove('no-painting');
    applyBlur(); // the new painting may be a different size
    if (!restartBtn.hidden) { // the timer finished while the painting was still loading
      fillDetails();
      showFinished(true);
    }
  } else {
    showMessage(FRIENDLY_MESSAGE);
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

let lastMs = DURATION_MS; // the time left that the blur was last worked out for

// The blur is a share of the time left, so it works for any timer length.
// The zoom grows with the blur, so the blurred edges stay outside the artwork area.
function applyBlur() {
  const blur = MAX_BLUR * lastMs / DURATION_MS;
  const width = artEl.clientWidth || 400;
  artEl.style.setProperty('--blur', blur.toFixed(2));
  artEl.style.setProperty('--zoom', (1 + 3 * blur / width).toFixed(4));
}

function showTime(ms) {
  lastMs = ms;
  applyBlur();
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
  detailsEl.hidden = !finished || !painting; // no painting means no details
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
  artEl.addEventListener('load', applyBlur);
window.addEventListener('resize', applyBlur);

showTime(DURATION_MS); // start strongly blurred, before any painting appears
loadNewPainting();
});

document.addEventListener('visibilitychange', () => {
  if (intervalId !== null) tick();
});

artEl.addEventListener('load', applyBlur);
window.addEventListener('resize', applyBlur);

showTime(DURATION_MS); // start strongly blurred, before any painting appears
loadNewPainting();
