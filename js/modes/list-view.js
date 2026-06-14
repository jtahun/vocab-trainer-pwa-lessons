// js/modes/list-view.js
import { onListViewStart, onListViewEnd } from '../stats.js';
import { setHome, gotoLessons, formatStudyWord } from '../app.js';

let lessonRef = null;

export function startListView({ lesson }) {
  lessonRef = lesson;

  onListViewStart(lesson.id);

  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-viewer'), false);
  show($('screen-list'), true);
  show($('btn-menu'), true);

  setHome('К урокам', exitListView);

  renderList(lesson);
}

export async function exitListView() {
  await onListViewEnd();   // без аргументов 
  lessonRef = null;
  gotoLessons();
}

/* ===== Внутренний рендер ===== */
function renderList(lesson) {
  const wrap = $('words-list');
  $('list-meta').textContent = `${lesson.title} — ${lesson.words.length} слов`;

  wrap.innerHTML = lesson.words.map(([en, ru]) => `
    <div class="word-row">
      <span class="word-front">${escapeHtml(formatStudyWord(en, 'en'))}</span>
      <span class="word-back">— ${escapeHtml(ru)}</span>
    </div>
  `).join('');
}


// Перерисовка при смене настройки транскрипций
window.addEventListener('vocab:transcriptionChanged', () => {
  try { if (lessonRef) renderList(lessonRef); } catch {}
});
