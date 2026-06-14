/* js/app.js */
import { startSession, initSessionHandlers, onLessonStart } from './stats.js';
import { startListView } from './modes/list-view.js';
import { startCardViewer } from './modes/card-viewer.js';

const WORDS_URL = './words.json';
const LS_HARD_KEY = 'vocabHardSetV1';
const LS_SHOW_TRANS_KEY = 'vocabShowTranscriptionV1';

const state = {
  showTranscription: true,
  lessons: [],
  currentLesson: null,
  bookId: ''
};


function loadShowTranscription() {
  const raw = localStorage.getItem(LS_SHOW_TRANS_KEY);
  if (raw === null) return true; // по умолчанию показываем
  return raw === '1';
}
function saveShowTranscription(v) {
  localStorage.setItem(LS_SHOW_TRANS_KEY, v ? '1' : '0');
}

export function getShowTranscription() {
  return !!state.showTranscription;
}

// Для режимов обучения (карточки/список): по настройке можно скрыть транскрипцию
export function formatStudyWord(text, lang) {
  if (lang !== 'en') return String(text ?? '');
  return state.showTranscription ? String(text ?? '') : stripTranscription(text);
}

// Для игр: всегда без транскрипции (иначе ломает unscramble и мешает восприятию)
export function formatGameWordEn(text) {
  return stripTranscription(text);
}


export function setHome(label, handler) {
  const bh = $('btn-home');
  if (!bh) return;
  bh.textContent = label || '';
  bh.onclick = null;
  if (handler) bh.onclick = handler;
  show(bh, !!handler);
}

export function gotoMenu() {
  show($('screen-menu'), true);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('btn-menu'), false);
  setHome(null, null);
  document.querySelector('h1 .muted').textContent = '· меню';
  updateMenuHardButton();
}

export function gotoLessons() {
  show($('screen-menu'), false);
  show($('screen-lessons'), true);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('btn-menu'), true);
  setHome(null, null);
  document.querySelector('h1 .muted').textContent = '· уроки';
}

export function getLessonWordsForGame() {
  const L = state.currentLesson;
  if (!(L?.words?.length)) return null;

  // Для игр всегда отдаём EN без транскрипции (иначе ломает unscramble и мешает восприятию)
  return L.words.map(pair => {
    const [en, ru] = Array.isArray(pair) ? pair : ['', ''];
    return [formatGameWordEn(en), String(ru ?? '')];
  });
}

export function getCurrentLessonId() {
  return state.currentLesson?.id ?? null;
}

/* ===== Hard count in menu ===== */
function loadHardSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HARD_KEY) || '[]')); }
  catch { return new Set(); }
}

export function updateMenuHardButton() {
  const btn = $('menu-play-hard');
  if (!btn) return;
  const count = loadHardSet().size;
  btn.textContent = count ? `Учить HARD-слова (${count})` : 'Учить HARD-слова (0)';
  btn.disabled = !count;
}

/* ===== Data loading ===== */
async function loadBooks() {
  const data = await fetchJsonNoCache(WORDS_URL);
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Неверная структура words.json: нужен { books:[...] }');
  }
  return data.books.map(b => ({ id: String(b.id), title: b.title || ('Book ' + b.id) }));
}

async function loadLessonsByBookId(bookId) {
  const data = await fetchJsonNoCache(WORDS_URL);
  if (!data || !Array.isArray(data.books)) {
    throw new Error('Неверная структура words.json: нужен { books:[...] }');
  }
  const book = data.books.find(b => String(b.id) === String(bookId));
  if (!book) throw new Error('Книга не найдена: ' + bookId);

  const lessons = (book.lessons || []).map((l, i) => ({
    id: l.id ?? `L${i + 1}`,
    title: l.title || `Урок ${i + 1}`,
    words: Array.isArray(l.words) ? l.words : []
  }));

  return { book, lessons };
}

function populateBookSelect(books) {
  const sel = $('book-select');
  sel.innerHTML = books.map((b, i) =>
    `<option value="${b.id}" ${i === 0 ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
  ).join('');
  if (state.bookId) sel.value = String(state.bookId);
}

function renderLessons() {
  const wrap = $('lessons');
  wrap.innerHTML = '';
  $('lessons-meta').textContent = `Всего уроков: ${state.lessons.length}`;

  state.lessons.forEach(lesson => {
    const div = document.createElement('div');
    div.className = 'lesson';
    const count = Array.isArray(lesson.words) ? lesson.words.length : 0;
    div.innerHTML = `<h3>${escapeHtml(lesson.title || 'Без названия')}</h3><small>${count} слов</small>`;
    div.onclick = () => openLesson(lesson);
    wrap.appendChild(div);
  });
}

function buildMetaForLesson(lesson) {
  const meta = [];
  for (let i = 0; i < lesson.words.length; i++) meta.push([lesson.id, i]);
  lesson._meta = meta;
  return lesson;
}

function keyOf(bookId, lessonId, wordIdx) {
  return `${String(bookId)}|${lessonId}:${wordIdx}`;
}

function openLesson(lesson) {
  const L = buildMetaForLesson({ ...lesson });
  state.currentLesson = L;

  onLessonStart(lesson.id);

  $('lesson-title').textContent = L.title;
  $('badge-count').textContent = `${L.words.length} слов`;

  startListView({ lesson: L, bookId: state.bookId });

  document.dispatchEvent(new CustomEvent('lesson-selected', { detail: { id: lesson.id } }));
}

function playAll() {
  const words = [];
  const meta = [];

  state.lessons.forEach(L => {
    (L.words || []).forEach((pair, i) => { words.push(pair); meta.push([L.id, i]); });
  });

  const all = { id: 'all', title: 'Все слова', words, _meta: meta };
  state.currentLesson = all;

  $('lesson-title').textContent = all.title;
  $('badge-count').textContent = `${words.length} слов`;

  startCardViewer({ lesson: all, bookId: state.bookId, mode: 'all' });
}

function playHard() {
  const hardSet = loadHardSet();

  const words = [];
  const meta = [];

  state.lessons.forEach(L => {
    (L.words || []).forEach((pair, i) => {
      const k = keyOf(state.bookId, L.id, i);
      if (hardSet.has(k)) { words.push(pair); meta.push([L.id, i]); }
    });
  });

  const hard = { id: 'hard', title: 'HARD-слова', words, _meta: meta };
  state.currentLesson = hard;

  $('lesson-title').textContent = hard.title;
  $('badge-count').textContent = `${words.length} слов`;

  startCardViewer({ lesson: hard, bookId: state.bookId, mode: 'hard' });
}

/* ===== Events ===== */
$('book-select')?.addEventListener('change', async (e) => {
  try {
    state.bookId = String(e.target.value);
    const { lessons } = await loadLessonsByBookId(state.bookId);
    state.lessons = lessons;
    renderLessons();
    gotoMenu();
    updateMenuHardButton();
  } catch (err) {
    console.error('Не удалось загрузить выбранную книгу:', err);
    $('lessons').innerHTML = '<div class="muted">Не удалось загрузить выбранную книгу.</div>';
    gotoMenu();
  }
});

$('btn-menu')?.addEventListener('click', gotoMenu);

$('menu-choose-lesson')?.addEventListener('click', gotoLessons);
$('menu-play-all')?.addEventListener('click', playAll);
$('menu-play-hard')?.addEventListener('click', playHard);

$('btn-start-check')?.addEventListener('click', () => {
  if (!state.currentLesson) return;
  startCardViewer({ lesson: state.currentLesson, bookId: state.bookId, mode: 'lesson' });
});

/* Games select (как у тебя) */
let pendingGameId = null;

$('game-select')?.addEventListener('change', async (e) => {
  const id = e.target.value;
  const words = getLessonWordsForGame();

  if (!words?.length) {
    pendingGameId = id;
    gotoLessons();
    e.target.selectedIndex = 0;
    return;
  }

  if (id === 'brick') {
    const mod = await import('./games/brick-match.js');
    mod.startGame(words);
  } else if (id === 'falling') {
    const mod = await import('./games/falling-words.js');
    mod.startGame(words);
  } else if (id === 'unscr') {
    const mod = await import('./games/unscramble.js');
    mod.startGame(words);
  }
  e.target.selectedIndex = 0;
});

document.addEventListener('lesson-selected', async () => {
  if (!pendingGameId) return;
  const words = getLessonWordsForGame();
  if (!words?.length) return;

  const id = pendingGameId;
  pendingGameId = null;

  if (id === 'brick') {
    const mod = await import('./games/brick-match.js');
    mod.startGame(words);
  } else if (id === 'falling') {
    const mod = await import('./games/falling-words.js');
    mod.startGame(words);
  } else if (id === 'unscr') {
    const mod = await import('./games/unscramble.js');
    mod.startGame(words);
  }
});

/* Boot */
(async () => {
  try {
    state.showTranscription = loadShowTranscription();
    const books = await loadBooks();
    state.bookId = books[0] ? String(books[0].id) : '1';
    populateBookSelect(books);
    // Кнопка: показывать/скрывать транскрипцию в режимах обучения
    const btnTrans = $('toggle-transcription');
    if (btnTrans) {
      const syncLabel = () => {
        btnTrans.textContent = state.showTranscription ? 'Транскр.: Вкл' : 'Транскр.: Выкл';
      };
      syncLabel();
      btnTrans.addEventListener('click', () => {
        state.showTranscription = !state.showTranscription;
        saveShowTranscription(state.showTranscription);
        syncLabel();
        try { window.dispatchEvent(new CustomEvent('vocab:transcriptionChanged')); } catch {}
      });
    }


    const { lessons } = await loadLessonsByBookId(state.bookId);
    state.lessons = lessons;

    renderLessons();
    gotoMenu();
    updateMenuHardButton();
  } catch (e) {
    console.error('Не удалось загрузить книги/уроки:', e);
    $('lessons').innerHTML = '<div class="muted">words.json недоступен или имеет неверную структуру.</div>';
    gotoMenu();
  }
})();

/* Session boot (как у тебя было) */
window.addEventListener('load', () => {
  startSession();
  initSessionHandlers();
});

/* SW */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
