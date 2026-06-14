import { getLessonWordsForGame, gotoLessons, getCurrentLessonId } from '../app.js';
import { onGameStart, onGameError, onGameEnd } from '../stats.js';

let words = [];
let idx = 0;
let errors = 0;
let attempts = 2;
let wordHadError = false;
let pendingStart = false;

function gotoScreen() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('screen-game'), false);
  show($('screen-falling'), false);
  show($('screen-unscr'), true);
  show($('btn-menu'), true);
}

/** Внешний старт игры */
export function startGame(list) {
  words = list.map(p => ({ en: p[0], ru: p[1] }));
  if (!words.length) return;

  // lessonId для Firebase
  const lessonId =
    typeof getCurrentLessonId === 'function'
      ? (getCurrentLessonId() ?? null)
      : null;

  onGameStart('unscramble', lessonId);

  idx = 0;
  errors = 0;
  $('un-errors').textContent = errors;
  $('un-round').textContent = `0/${words.length}`;
  gotoScreen();
  nextWord();
}

function nextWord() {
  if (idx >= words.length) {
    // игра закончилась
    onGameEnd({
      totalWords: words.length,
      errors,
    });

    alert(`Готово!\nОшибок: ${errors}`);
    show($('screen-unscr'), false);
    show($('screen-menu'), true);
    return;
  }

  const w = words[idx];
  attempts = 2;
  wordHadError = false;

  $('un-round').textContent = `${idx + 1}/${words.length}`;

  const scrambled = scramble(w.en);
  $('un-word').textContent = scrambled;
  $('un-input').value = '';
  $('un-input').focus();
}

/**
 * Перемешивание фразы:
 * - пробелы стоят на месте;
 * - в каждом слове перемешиваем ~60% букв, остальные остаются как в оригинале.
 */
function scramble(s) {
  // если строка короткая — не трогаем
  if (!s || s.length < 3) return s;

  const chars = s.split('');
  const len = chars.length;
  let i = 0;

  while (i < len) {
    if (chars[i] === ' ') {
      i++;
      continue;
    }

    // нашли начало слова (без пробелов)
    const start = i;
    while (i < len && chars[i] !== ' ') {
      i++;
    }
    const end = i - 1; // индекс последнего символа слова

    const word = chars.slice(start, end + 1).join('');
    const scrambledWord = scrambleWordLimited(word, 0.6); // 60% букв двигаем

    for (let k = 0; k < scrambledWord.length; k++) {
      chars[start + k] = scrambledWord[k];
    }
  }

  const result = chars.join('');

  // если вдруг получилось один-в-один (редко, но может) — можно один раз принудительно перескраблить
  if (result === s && s.length > 3) {
    return scrambleWordLimited(s.replace(/ /g, ''), 0.6)
      .split('')
      .reduce((acc, ch, idx) => {
        // В этом fallback просто игнорируем пробелы, но это уже крайний случай.
        return acc + ch;
      }, '');
  }

  return result;
}

/**
 * Перемешивание только части букв слова.
 * fraction = доля позиций, которые должны "переехать" (0.6 → 60%).
 */
function scrambleWordLimited(word, fraction) {
  const chars = word.split('');
  const L = chars.length;

  // короткие слова не трогаем
  if (L < 3) return word;

  // сколько букв будем двигать
  let countToMove = Math.round(L * fraction);
  if (countToMove >= L) countToMove = L - 1;
  if (countToMove < 1) countToMove = 1;

  const indices = Array.from({ length: L }, (_, i) => i);
  shuffle(indices);

  const movable = indices.slice(0, countToMove).sort((a, b) => a - b);
  const movableChars = movable.map(i => chars[i]);

  // перемешиваем "подмножество" до тех пор, пока оно не станет отличаться от исходного
  let attempts = 0;
  do {
    shuffle(movableChars);
    attempts++;
    if (attempts > 10) break; // чтобы не зациклиться
  } while (movable.every((idx, pos) => chars[idx] === movableChars[pos]));

  const res = chars.slice();
  movable.forEach((idx, pos) => {
    res[idx] = movableChars[pos];
  });

  return res.join('');
}

/** утилита перетасовки массива (Фишер–Йейтс) */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

// проверка ввода
$('un-submit')?.addEventListener('click', () => {
  const input = $('un-input').value.trim().toLowerCase();
  const target = words[idx].en.toLowerCase();

  if (input === target) {
    idx++;
    nextWord();
    return;
  }

  // ошибка
  attempts--;
  if (!wordHadError) {
    errors++;
    wordHadError = true;
    $('un-errors').textContent = errors;

    // логируем первую ошибку по слову в Firebase
    onGameError();
  }

  // shake эффект
  const el = $('screen-unscr');
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 350);

  if (attempts <= 0) {
    // пропуск
    idx++;
    nextWord();
  }
});

// выход
$('un-exit')?.addEventListener('click', () => {
  pendingStart = false;
  show($('screen-unscr'), false);
  show($('screen-menu'), true);
});
