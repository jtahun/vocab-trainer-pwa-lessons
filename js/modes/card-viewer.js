// js/modes/card-viewer.js
import { setHome, gotoMenu, updateMenuHardButton, formatStudyWord } from '../app.js';
import { startListView } from './list-view.js';
import { onSelfCheckStart, onSelfCheckEnd } from '../stats.js';

let lessonRef = null;
let bookIdRef = '';
let modeRef = 'lesson';

let idx = 0;
let order = [];
let revealed = false;
let dir = 'en-ru';

const LS_HARD_KEY = 'vocabHardSetV1';

function loadHardSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HARD_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveHardSet(set) {
  localStorage.setItem(LS_HARD_KEY, JSON.stringify([...set]));
}

function showViewer() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), true);
  show($('btn-menu'), true);
  document.querySelector('h1 .muted').textContent = '· карточки';
}

export function startCardViewer({ lesson, bookId, mode }) {
  lessonRef = lesson;
  bookIdRef = String(bookId ?? '');
  modeRef = mode || 'lesson';

  idx = 0;
  order = [...Array(lesson.words.length).keys()];
  revealed = false;
  dir = 'en-ru';

  // stats.js ждёт: mode + lessonId (для all/hard -> null)
  onSelfCheckStart({
    mode: modeRef,
    lessonId: (modeRef === 'lesson') ? lesson.id : null
  });

  showViewer();

  // Домой: для урока -> к списку, для all/hard -> в меню
  setHome(modeRef === 'lesson' ? 'К списку' : 'К меню', exitCardViewer);

  bindViewerHandlers();
  renderCard();
}

export async function exitCardViewer() {
  unbindViewerHandlers();

  // stats.js сам посчитает durationSec по startedAt
  await onSelfCheckEnd();

  const backLesson = lessonRef;
  const backMode = modeRef;

  lessonRef = null;
  modeRef = 'lesson';

  if (backMode === 'lesson' && backLesson) startListView({ lesson: backLesson });
  else gotoMenu();
}

/* ===== Карточки ===== */
function currentIndex() {
  const L = lessonRef; if (!L) return -1;
  return clamp(idx, 0, L.words.length - 1);
}

function keyOf(lessonId, wordIdx) {
  return `${bookIdRef}|${lessonId}:${wordIdx}`;
}

function indexToKey(i) {
  const L = lessonRef; if (!L || !L._meta) return null;
  const realIdx = order[i];
  const [lessonId, wordIdx] = L._meta[realIdx];
  return keyOf(lessonId, wordIdx);
}

function renderCard() {
  const L = lessonRef;

  if (!L || !L.words || L.words.length === 0) {
    $('word-front').textContent = 'Нет слов';
    $('word-back').textContent = '—';
    show($('word-back'), false);
    $('counter').textContent = '0 / 0';
    show($('badge-hard'), false);
    return;
  }

  const i = currentIndex();
  idx = i;

  const pair = L.words[order[i]] || ['—', '—'];
  const [en, ru] = Array.isArray(pair) ? pair : ['—', '—'];

  const frontLang = (dir === 'en-ru') ? 'en' : 'ru';
  const backLang  = (dir === 'en-ru') ? 'ru' : 'en';

  $('word-front').textContent = formatStudyWord((dir === 'en-ru') ? en : ru, frontLang);
  $('word-back').textContent  = formatStudyWord((dir === 'en-ru') ? ru : en, backLang);
  show($('word-back'), revealed);

  $('counter').textContent = `${i + 1} / ${L.words.length}`;

  const hardSet = loadHardSet();
  const k = indexToKey(i);
  const isHard = k && hardSet.has(k);

  $('badge-hard').classList.toggle('hide', !isHard);
  $('toggle-hard').textContent = isHard ? '★ Удалить Hard' : '☆ В Hard';
  $('badge-dir').textContent = dir === 'en-ru' ? 'EN→RU' : 'RU→EN';

  $('reveal').disabled = revealed;
}

function next() {
  const L = lessonRef; if (!L?.words?.length) return;
  idx = (idx + 1) % L.words.length;
  revealed = false;
  renderCard();
}

function prev() {
  const L = lessonRef; if (!L?.words?.length) return;
  idx = (idx - 1 + L.words.length) % L.words.length;
  revealed = false;
  renderCard();
}

function shuffleCards() {
  const L = lessonRef; if (!L?.words?.length) return;
  order = shuffleArray([...order]);
  idx = 0;
  revealed = false;
  renderCard();
}

function reveal() { revealed = true; renderCard(); }

function toggleDir() {
  dir = (dir === 'en-ru') ? 'ru-en' : 'en-ru';
  revealed = false;
  renderCard();
}

function toggleHard() {
  const i = currentIndex(); if (i < 0) return;
  const k = indexToKey(i); if (!k) return;

  const hardSet = loadHardSet();
  if (hardSet.has(k)) hardSet.delete(k);
  else hardSet.add(k);

  saveHardSet(hardSet);
  updateMenuHardButton();
  renderCard();
}

/* ===== bind/unbind ===== */
let bound = false;

function bindViewerHandlers() {
  if (bound) return;
  bound = true;

  $('next')?.addEventListener('click', next);
  $('prev')?.addEventListener('click', prev);
  $('shuffle')?.addEventListener('click', shuffleCards);
  $('reveal')?.addEventListener('click', reveal);
  $('badge-dir')?.addEventListener('click', toggleDir);
  $('toggle-hard')?.addEventListener('click', toggleHard);

  window.addEventListener('keydown', onKeyDown);
  bindGestures();
}

function unbindViewerHandlers() {
  if (!bound) return;
  bound = false;

  $('next')?.removeEventListener('click', next);
  $('prev')?.removeEventListener('click', prev);
  $('shuffle')?.removeEventListener('click', shuffleCards);
  $('reveal')?.removeEventListener('click', reveal);
  $('badge-dir')?.removeEventListener('click', toggleDir);
  $('toggle-hard')?.removeEventListener('click', toggleHard);

  window.removeEventListener('keydown', onKeyDown);
  unbindGestures();
}

function onKeyDown(e) {
  if (e.key === 'ArrowRight' || e.key === 'Enter') next();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.code === 'Space') { e.preventDefault(); if (!revealed) reveal(); }
  else if (e.key?.toLowerCase?.() === 'h') toggleHard();
  else if (e.key?.toLowerCase?.() === 'd') toggleDir();
}

/* Жесты (mobile) */
let gestureBound = false;
let gestureHandlers = null;

function bindGestures() {
  if (gestureBound) return;
  const zone = document.getElementById('touch-area');
  if (!zone) return;

  gestureBound = true;

  let sx = 0, sy = 0, ex = 0, ey = 0;
  let longTapTimer = null;
  let moved = false;

  const THRESH = 40;
  const LONG_MS = 500;

  const onStart = (e) => {
    const t = e.changedTouches[0];
    sx = ex = t.clientX; sy = ey = t.clientY; moved = false;

    clearTimeout(longTapTimer);
    longTapTimer = setTimeout(() => toggleHard(), LONG_MS);
  };

  const onMove = (e) => {
    const t = e.changedTouches[0];
    ex = t.clientX; ey = t.clientY;
    if (Math.hypot(ex - sx, ey - sy) > 8) moved = true;
    if (moved) clearTimeout(longTapTimer);
  };

  const onEnd = () => {
    clearTimeout(longTapTimer);
    const dx = ex - sx; const dy = ey - sy;

    if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) {
      if (!revealed) reveal(); else next();
      return;
    }

    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -THRESH) next();
      else if (dx > THRESH) prev();
    } else {
      if (dy < -THRESH) reveal();
      else if (dy > THRESH) toggleDir();
    }
  };

  zone.addEventListener('touchstart', onStart, { passive: true });
  zone.addEventListener('touchmove', onMove, { passive: true });
  zone.addEventListener('touchend', onEnd, { passive: true });

  gestureHandlers = { zone, onStart, onMove, onEnd };
}

function unbindGestures() {
  if (!gestureBound || !gestureHandlers) return;
  gestureBound = false;

  const { zone, onStart, onMove, onEnd } = gestureHandlers;
  zone.removeEventListener('touchstart', onStart);
  zone.removeEventListener('touchmove', onMove);
  zone.removeEventListener('touchend', onEnd);

  gestureHandlers = null;
}


// Перерисовка при смене настройки транскрипций
window.addEventListener('vocab:transcriptionChanged', () => {
  try { renderCard(); } catch {}
});
