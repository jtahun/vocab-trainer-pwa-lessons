/* js/app.js */
/* Глобальные утилиты приходят из utils.js: $, show, clamp, escapeHtml, shuffleArray, fetchJsonNoCache */

const WORDS_URL = './words.json';
const LS_HARD_KEY = 'vocabHardSetV1';

/* ===== Hard store ===== */
function loadHardSet() {
  try { return new Set(JSON.parse(localStorage.getItem(LS_HARD_KEY) || '[]')); }
  catch { return new Set(); }
}
function saveHardSet(set) { localStorage.setItem(LS_HARD_KEY, JSON.stringify([...set])); }
const hardSet = loadHardSet();

export function getCurrentLessonId() {
  return state.currentLesson?.id ?? null;
}

/* ===== Состояние рендеринга ===== */
const state = {
  lessons: [],
  currentLesson: null,
  idx: 0,
  order: [],
  revealed: false,
  dir: 'en-ru',
  bookId: '' // текущая книга
};

/* ===== Загрузка данных ===== */
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

/* ===== UI helpers ===== */
function populateBookSelect(books) {
  const sel = $('book-select');
  sel.innerHTML = books.map((b, i) =>
    `<option value="${b.id}" ${i === 0 ? 'selected' : ''}>${escapeHtml(b.title)}</option>`
  ).join('');
  if (state.bookId) sel.value = String(state.bookId);
}

/* ===== Навигация по экранам ===== */

export function setHome(label, handler) {
  const bh = $('btn-home');
  if (!bh) return;
  bh.textContent = label || '';
  bh.onclick = null;
  if (handler) bh.onclick = handler;
  show(bh, !!handler);
}

export function getLessonWordsForGame() {
  const L = state.currentLesson;  
  return (L?.words?.length) ? L.words : null;
}

function gotoMenu() {
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

function gotoViewer() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), true);
  show($('btn-menu'), true);
  setHome('К списку', gotoList);
  document.querySelector('h1 .muted').textContent = '· карточки';
}

function gotoList() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), true);
  show($('screen-viewer'), false);
  show($('btn-menu'), true);
  setHome('К урокам', backToLessons);
  document.querySelector('h1 .muted').textContent = '· список';
}


/* ===== Рендер списков ===== */
function renderLessons() {
  const wrap = $('lessons');
  wrap.innerHTML = '';
  $('lessons-meta').textContent = `Всего уроков: ${state.lessons.length}`;

  state.lessons.forEach(lesson => {
    const div = document.createElement('div');
    div.className = 'lesson';
    const count = Array.isArray(lesson.words) ? lesson.words.length : 0;
    div.innerHTML = `<h3>${escapeHtml(lesson.title || 'Без названия')}</h3>
      <small>${count} слов</small>`;
    div.onclick = () => openLesson(lesson);
    wrap.appendChild(div);
  });
}

function renderLessonList() {
  const L = state.currentLesson;
  const wrap = $('words-list');
  if (!L || !Array.isArray(L.words)) {
    wrap.innerHTML = '<div class="muted">Нет слов.</div>';
    $('list-meta').textContent = '';
    return;
  }
  $('list-meta').textContent = `${L.title} — ${L.words.length} слов`;
  wrap.innerHTML = L.words.map(pair => {
    const [en, ru] = Array.isArray(pair) ? pair : ['—', '—'];
    return `<div class="word-row">
              <span class="word-front">${escapeHtml(en)}</span>
              <span class="word-back">— ${escapeHtml(ru)}</span>
            </div>`;
  }).join('');
}

/* ===== Утилиты для метаданных урока ===== */
function buildMetaForLesson(lesson) {
  const meta = [];
  for (let i = 0; i < lesson.words.length; i++) meta.push([lesson.id, i]);
  lesson._meta = meta;
  return lesson;
}

function openLesson(lesson) {
  const L = buildMetaForLesson({ ...lesson });
  state.currentLesson = L;
  state.idx = 0;
  state.order = [...Array(L.words.length).keys()];
  state.revealed = false;
  $('lesson-title').textContent = L.title;
  $('badge-count').textContent = `${L.words.length} слов`;

  renderLessonList();
  gotoList();
  document.dispatchEvent(new CustomEvent('lesson-selected', { detail:{ id: lesson.id } }));
}

function playAll() {
  const words = [];
  const meta = [];
  state.lessons.forEach(L => {
    (L.words || []).forEach((pair, i) => { words.push(pair); meta.push([L.id, i]); });
  });
  const all = { id: 'all', title: 'Все слова', words };
  all._meta = meta;
  state.currentLesson = all;
  state.idx = 0; state.order = [...Array(words.length).keys()]; state.revealed = false;
  $('lesson-title').textContent = all.title;
  $('badge-count').textContent = `${words.length} слов`;
  gotoViewer();
  renderCard();
}

function playHard() {
  const words = [];
  const meta = [];
  state.lessons.forEach(L => {
    (L.words || []).forEach((pair, i) => {
      const k = keyOf(L.id, i);
      if (hardSet.has(k)) { words.push(pair); meta.push([L.id, i]); }
    });
  });
  const hard = { id: 'hard', title: 'HARD-слова', words };
  hard._meta = meta;
  state.currentLesson = hard;
  state.idx = 0; state.order = [...Array(words.length).keys()]; state.revealed = false;
  $('lesson-title').textContent = hard.title;
  $('badge-count').textContent = `${words.length} слов`;
  gotoViewer();
  renderCard();
}

function backToLessons() {
  state.currentLesson = null;
  gotoLessons();
}

/* ===== Работа с карточками ===== */
function currentIndex() {
  const L = state.currentLesson; if (!L) return -1;
  return clamp(state.idx, 0, L.words.length - 1);
}
function indexToKey(idx) {
  const L = state.currentLesson; if (!L || !L._meta) return null;
  const realIdx = state.order[idx];
  const [lessonId, wordIdx] = L._meta[realIdx];
  return keyOf(lessonId, wordIdx);
}
function keyOf(lessonId, wordIdx) { return `${state.bookId}|${lessonId}:${wordIdx}`; }

function renderCard() {
  const L = state.currentLesson;
  if (!L || !L.words || L.words.length === 0) {
    $('word-front').textContent = 'Нет слов';
    $('word-back').textContent = '—';
    show($('word-back'), false);
    $('counter').textContent = '0 / 0';
    show($('badge-hard'), false);
    return;
  }
  const i = currentIndex();
  state.idx = i;
  const pair = L.words[state.order[i]] || ['—', '—'];
  const [en, ru] = Array.isArray(pair) ? pair : ['—', '—'];

  const front = state.dir === 'en-ru' ? en : ru;
  const back = state.dir === 'en-ru' ? ru : en;

  $('word-front').textContent = front;
  $('word-back').textContent = back;
  show($('word-back'), state.revealed);

  $('counter').textContent = `${i + 1} / ${L.words.length}`;

  const k = indexToKey(i);
  const isHard = k && hardSet.has(k);
  $('badge-hard').classList.toggle('hide', !isHard);
  $('toggle-hard').textContent = isHard ? '★ Удалить Hard' : '☆ В Hard';

  $('badge-dir').textContent = state.dir === 'en-ru' ? 'EN→RU' : 'RU→EN';

  $('reveal').disabled = state.revealed;
}

function next() {
  const L = state.currentLesson; if (!L || !L.words.length) return;
  state.idx = (state.idx + 1) % L.words.length;
  state.revealed = false;
  renderCard();
}
function prev() {
  const L = state.currentLesson; if (!L || !L.words.length) return;
  state.idx = (state.idx - 1 + L.words.length) % L.words.length;
  state.revealed = false;
  renderCard();
}
function shuffleCards() {
  const L = state.currentLesson; if (!L) return;
  state.order = shuffleArray([...state.order]); // новая перемешанная копия
  state.idx = 0; state.revealed = false;
  renderCard();
}
function reveal() { state.revealed = true; renderCard(); }
function toggleDir() { state.dir = (state.dir === 'en-ru') ? 'ru-en' : 'en-ru'; state.revealed = false; renderCard(); }
function toggleHard() {
  const i = currentIndex(); if (i < 0) return;
  const k = indexToKey(i); if (!k) return;
  if (hardSet.has(k)) hardSet.delete(k); else hardSet.add(k);
  saveHardSet(hardSet);
  renderCard();
  updateMenuHardButton();
}

function updateMenuHardButton() {
  const btn = $('menu-play-hard');
  const count = hardSet.size;
  btn.textContent = count ? `Учить HARD-слова (${count})` : 'Учить HARD-слова (0)';
  btn.disabled = !count;
}

/* ===== События ===== */
$('book-select').addEventListener('change', async (e) => {
  try {
    const newBookId = String(e.target.value);
    state.bookId = newBookId;

    const { lessons } = await loadLessonsByBookId(newBookId);
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

const btnStartCheck = $('btn-start-check');
if (btnStartCheck) btnStartCheck.addEventListener('click', () => {
  state.idx = 0;
  state.revealed = false;
  gotoViewer();
  renderCard();
});

$('btn-menu').addEventListener('click', gotoMenu);

$('next').addEventListener('click', next);
$('prev').addEventListener('click', prev);
$('shuffle').addEventListener('click', shuffleCards);
$('reveal').addEventListener('click', reveal);
$('badge-dir').addEventListener('click', toggleDir);
$('toggle-hard').addEventListener('click', toggleHard);

$('menu-choose-lesson').addEventListener('click', gotoLessons);
$('menu-play-all').addEventListener('click', playAll);
$('menu-play-hard').addEventListener('click', playHard);
$('menu-about').addEventListener('click', () => alert(`Vocab Trainer PWA
Режим самопроверки: нажмите «Показать перевод».
Отмечайте сложные слова кнопкой «В Hard».`));

/* Клавиатура (desktop) */
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight' || e.key === 'Enter') next();
  else if (e.key === 'ArrowLeft') prev();
  else if (e.code === 'Space') { e.preventDefault(); if (!state.revealed) reveal(); }
  else if (e.key && e.key.toLowerCase && e.key.toLowerCase() === 'h') toggleHard();
  else if (e.key && e.key.toLowerCase && e.key.toLowerCase() === 'd') toggleDir();
});

/* Жесты (мобильный приоритет) */
(function initGestures() {
  const zone = document.getElementById('touch-area');
  let sx = 0, sy = 0, ex = 0, ey = 0, t0 = 0, longTapTimer = null, moved = false;
  const THRESH = 40;
  const LONG_MS = 500;

  zone.addEventListener('touchstart', (e) => {
    const t = e.changedTouches[0];
    sx = ex = t.clientX; sy = ey = t.clientY; t0 = Date.now(); moved = false;
    clearTimeout(longTapTimer);
    longTapTimer = setTimeout(() => { toggleHard(); }, LONG_MS);
  }, { passive: true });

  zone.addEventListener('touchmove', (e) => {
    const t = e.changedTouches[0]; ex = t.clientX; ey = t.clientY;
    if (Math.hypot(ex - sx, ey - sy) > 8) moved = true;
    if (moved) clearTimeout(longTapTimer);
  }, { passive: true });

  zone.addEventListener('touchend', (e) => {
    clearTimeout(longTapTimer);
    const dx = ex - sx; const dy = ey - sy;
    if (Math.abs(dx) < THRESH && Math.abs(dy) < THRESH) {
      if (!state.revealed) reveal(); else next();
      return;
    }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx < -THRESH) next();
      else if (dx > THRESH) prev();
    } else {
      if (dy < -THRESH) reveal();
      else if (dy > THRESH) toggleDir();
    }
  }, { passive: true });
})();

/* ===== Self-tests (опционально) ===== */
function runSelfTests(errorMode = false) {
  const results = [];
  const assert = (name, cond) => { results.push({ name, cond }); };

  assert('Есть touch-area', !!document.getElementById('touch-area'));
  assert('Кнопка Показать перевод существует', !!$('reveal'));
  assert('Переключатель EN↔RU (badge-dir) существует', !!$('badge-dir'));
  assert('Кнопка В Hard существует', !!$('toggle-hard'));
  assert('hardSet инициализирован', hardSet instanceof Set);

  if (Array.isArray(state.lessons) && state.lessons.length) {
    const L0 = state.lessons[0];
    assert('lesson[0].words — массив', Array.isArray(L0.words));
    if (L0.words.length) {
      const pair = L0.words[0];
      assert('слово — пара из 2', Array.isArray(pair) && pair.length === 2);
    }
  }

  const dir0 = state.dir; toggleDir(); const dir1 = state.dir; toggleDir();
  assert('toggleDir меняет направление', dir0 !== dir1);

  const ok = results.filter(r => r.cond).length; const fail = results.length - ok;
  console.group('%cSelf-tests (mobile-first)', 'color:#22d3ee');
  results.forEach(r => console.log(r.cond ? '✅' : '❌', r.name));
  console.log(`Итог: ${ok}/${results.length} пройдено${fail ? `, ${fail} ошибок` : ''}.`, errorMode ? '(errorMode)' : '');
  console.groupEnd();
}

/* ===== Boot ===== */
(async () => {
  try {
    const books = await loadBooks();
    state.bookId = books[0] ? String(books[0].id) : '1';
    populateBookSelect(books);

    const { lessons } = await loadLessonsByBookId(state.bookId);
    state.lessons = lessons;

    renderLessons();
    gotoMenu();
    updateMenuHardButton();
    runSelfTests();
  } catch (e) {
    console.error('Не удалось загрузить книги/уроки:', e);
    $('lessons').innerHTML = '<div class="muted">words.json недоступен или имеет неверную структуру.</div>';
    gotoMenu();
    runSelfTests(true);
  }
})();

/* ===== SW registration (optional) ===== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(console.warn);
}
