import { getLessonWordsForGame, getCurrentLessonId, setHome, gotoLessons } from '../app.js';
import { onGameStart, onGameError, onGameEnd } from '../stats.js';

/** Конфиг игры */
const CFG = {
  // сколько раз каждое слово должно появиться в игре
  repeatsPerWord: 3,

  options:   4,         // 4 варианта ответа
  baseSecs:  4.0,       // базовое время падения (сек)
  minSecs:   1.8,       // минимально возможная длительность

  // ускорение теперь в 3 раза слабее, чем было (0.10 / 3 ≈ 0.033)
  accelStep: 0.10 / 3
};

let words = [];          // [['heavy','тяжелый'], ...] из текущего урока
let playQueue = [];      // очередь слов на все раунды (каждое слово повторяется 3 раза)
let round = 0;
let totalRounds = 0;
let errors = 0;
let t0 = 0;
let timerId = null;
let speedX = 1.0;        // множитель скорости (1.0 → норм, 1.2 → быстрее)
let pendingStart = false;

function gotoFallingScreen() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('screen-game'), false);
  show($('screen-falling'), true);
  show($('btn-menu'), true);
  setHome('К меню', () => {
    show($('screen-falling'), false);
    show($('screen-menu'), true);
    stopTimer();
  });
  $('fw-errors').textContent = errors;
  $('fw-speed').textContent  = speedX.toFixed(1) + 'x';
}

/** Построение очереди: каждая пара повторяется repeatsPerWord раз */
function buildPlayQueue(basePairs, repeatsPerWord) {
  const queue = [];
  for (let i = 0; i < repeatsPerWord; i++) {
    // копия массива и перемешивание, чтобы каждый круг был в случайном порядке
    const batch = [...basePairs];
    window.shuffle?.(batch) || batch.sort(() => Math.random() - 0.5);
    queue.push(...batch);
  }
  return queue;
}

/** Старт игры извне */
export function startGame(extWords) {
  words = Array.isArray(extWords)
    ? extWords.filter(p => Array.isArray(p) && p.length >= 2)
    : [];
  if (!words.length) return;

  // ID урока для Firebase-статистики
  const lessonId = typeof getCurrentLessonId === 'function'
    ? (getCurrentLessonId() ?? null)
    : null;
  onGameStart('falling-words', lessonId);

  // Подготовка
  errors = 0;
  round = 0;
  speedX = 1.0;

  // Формируем очередь: каждое слово повторяется 3 раза
  playQueue = buildPlayQueue(words, CFG.repeatsPerWord);
  totalRounds = playQueue.length; // = words.length * repeatsPerWord

  gotoFallingScreen();
  $('fw-round').textContent = `0/${totalRounds}`;
  clearArea();
  startTimer();

  nextRound();
}

/** Внутренний старт (кнопка из меню) */
function requestLessonThenStart() {
  pendingStart = true;
  gotoLessons();
}
document.addEventListener('lesson-selected', () => {
  if (!pendingStart) return;
  const w = getLessonWordsForGame();
  if (w?.length) { pendingStart = false; startGame(w); }
});

/** Кнопки управления */
$('game-falling-start')?.addEventListener('click', () => {
  const w = getLessonWordsForGame();
  if (!w?.length) { requestLessonThenStart(); return; }
  startGame(w);
});

$('fw-exit')?.addEventListener('click', () => {
  pendingStart = false;
  stopTimer();
  show($('screen-falling'), false);
  show($('screen-menu'), true);
});
$('fw-restart')?.addEventListener('click', () => {
  const w = getLessonWordsForGame();
  if (w?.length) startGame(w);
});

/** Таймер времени выполнения */
function startTimer() {
  t0 = performance.now();
  stopTimer();
  timerId = setInterval(() => {
    const dt = (performance.now() - t0) / 1000;
    $('fw-time').textContent = dt.toFixed(1) + 's';
  }, 100);
}
function stopTimer() {
  if (timerId) { clearInterval(timerId); timerId = null; }
}

/** Раунд */
function nextRound() {
  if (round >= totalRounds) return finish();

  // берём следующую пару из очереди
  const pair = playQueue[round]; // [en, ru]
  round++;

  $('fw-round').textContent = `${round}/${totalRounds}`;

  // Подготовить цель + отвлекающие (цель фиксированная — pair)
  const { target, options } = pickQuestion(words, CFG.options, pair);

  // UI: варианты
  renderOptions(options, target);

  // UI: падающее слово
  spawnFallingWord(target.en);
}

/** Вызов падающего слова */
function spawnFallingWord(text) {
  const area = $('fw-area');
  clearArea();

  const el = document.createElement('div');
  el.className = 'falling-word';
  el.textContent = text;

  // Длительность падения: быстрее с каждым раундом
  const secs = Math.max(CFG.minSecs, CFG.baseSecs / speedX);
  el.style.animationDuration = `${secs}s`;

  // Если долетело — считаем ошибкой
  const onEnd = () => {
    el.removeEventListener('animationend', onEnd);
    // если слово ещё не обработано кликом:
    if (area.contains(el)) {
      errors++;
      onGameError();                           // ⇐ логируем ошибку в Firebase
      $('fw-errors').textContent = errors;

      // Ускоряемся (теперь шаг в 3 раза меньше, чем раньше через CFG.accelStep)
      speedX += CFG.accelStep;
      $('fw-speed').textContent = speedX.toFixed(1) + 'x';

      nextRound();
    }
    el.remove();
  };

  el.addEventListener('animationend', onEnd);
  area.appendChild(el);
}

/**
 * Генерация вопроса: правильный перевод + 3 отвлекающих
 * Если передана forcedPair, используем её как цель.
 */
function pickQuestion(pairs, nOptions, forcedPair = null) {
  let en, ru;

  if (forcedPair) {
    [en, ru] = forcedPair;
  } else {
    // старое поведение — случайный выбор
    const idx = Math.floor(Math.random() * pairs.length);
    [en, ru] = pairs[idx];
  }

  // Собрать отвлекающие
  const pool = pairs.map(p => p[1]);
  const distractors = [];
  while (distractors.length < nOptions - 1) {
    const alt = pool[Math.floor(Math.random() * pool.length)];
    if (alt !== ru && !distractors.includes(alt)) distractors.push(alt);
  }

  // Перемешать варианты
  const all = [ru, ...distractors].map(text => ({ text, correct: text === ru }));
  window.shuffle?.(all) || all.sort(() => Math.random() - 0.5);

  return { target: { en, ru }, options: all };
}

/** Рендер вариантов и обработка выбора */
function renderOptions(opts, target) {
  const box = $('fw-options');
  box.innerHTML = '';
  opts.forEach(o => {
    const btn = document.createElement('button');
    btn.className = 'btn';
    btn.textContent = o.text;
    btn.addEventListener('click', () => {
      // Проверяем, что слово ещё не «упало»
      const area = $('fw-area');
      const falling = area.querySelector('.falling-word');
      if (!falling) return; // уже упало и раунд завершён

      if (o.correct) {
        // верно → удаляем падающее слово, ускоряемся
        falling.remove();
        speedX += CFG.accelStep;
        $('fw-speed').textContent = speedX.toFixed(1) + 'x';
      } else {
        // ошибка и переходим дальше
        errors++;
        onGameError();                       // ⇐ логируем ошибку в Firebase
        $('fw-errors').textContent = errors;
        // лёгкая «тряска» неверной кнопки
        btn.animate(
          [
            { transform: 'translateX(0)' },
            { transform: 'translateX(-4px)' },
            { transform: 'translateX(4px)' },
            { transform: 'translateX(0)' }
          ],
          { duration: 150, iterations: 1 }
        );
        // слово продолжит падать; если хочется — можно сразу завершать раунд:
        // falling.remove();
      }
      // Следующий раунд:
      nextRound();
    });
    box.appendChild(btn);
  });
}

/** Утилиты */
function clearArea() {
  const area = $('fw-area');
  while (area.firstChild) area.removeChild(area.firstChild);
}

function finish() {
  stopTimer();
  // Итоги
  const timeTxt = $('fw-time').textContent;

  // Статистика в Firebase
  onGameEnd({
    errors,
    speedX,
    timeShown: timeTxt,
    roundsPlayed: totalRounds,
  });

  const msg = `Готово!\nВремя: ${timeTxt}\nОшибок: ${errors}\nСкорость: ${speedX.toFixed(1)}x`;
  alert(msg);

  // Возврат в меню
  show($('screen-falling'), false);
  show($('screen-menu'), true);
}
