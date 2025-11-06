import { getLessonWordsForGame, setHome } from '../app.js';

function gotoGameScreen() {
  show($('screen-menu'), false);
  show($('screen-lessons'), false);
  show($('screen-list'), false);
  show($('screen-viewer'), false);
  show($('screen-game'), true);
  show($('btn-menu'), true);
  setHome('К меню', () => {
    show($('screen-menu'), true);
    show($('screen-game'), false);
  });
}

const BrickMatch = (() => {
  let gridEl, leftEl, metaEl, tiles = [], picked = null;

  const buildTiles = (pairs) => shuffle(
    pairs.flatMap(([en, ru], idx) => ([
      { id:`en_${idx}`, pid:idx, lang:'en', text:en, matched:false },
      { id:`ru_${idx}`, pid:idx, lang:'ru', text:ru, matched:false }
    ]))
  );

  const render = () => {
    gridEl.innerHTML = '';
    if (!tiles.length) { gridEl.innerHTML = '<div class="empty-hint">Список пуст. Выбери урок.</div>'; return; }
    tiles.forEach(t => {
      const el = document.createElement('button');
      el.className = 'brick'; el.type='button'; el.textContent = t.text; t.el = el;
      el.addEventListener('click', () => onPick(t));
      gridEl.appendChild(el);
    });
    updateHUD();
  };

  const onPick = (t) => {
    if (t.matched) return;
    if (!picked) { picked = t; t.el.classList.add('selected'); return; }
    if (picked.id === t.id) return;
    if (picked.pid === t.pid && picked.lang !== t.lang) {
      picked.matched = t.matched = true;
      picked.el.classList.add('match'); t.el.classList.add('match');
      setTimeout(() => {
        picked.el.classList.add('hideout'); t.el.classList.add('hideout');
        setTimeout(() => { picked.el.style.display='none'; t.el.style.display='none'; updateHUD(); checkWin(); }, 160);
      }, 120);
    } else {
      shake(picked.el); shake(t.el); picked.el.classList.remove('selected');
    }
    picked = null;
  };

  const shake = (el) => el.animate([
    { transform:'translateX(0)' },{ transform:'translateX(-4px)' },
    { transform:'translateX(4px)' },{ transform:'translateX(0)' }
  ], { duration:150, iterations:1 });

  const leftPairs = () => tiles.filter(x=>!x.matched).length/2;
  const updateHUD = () => $('game-left').textContent = `Осталось: ${leftPairs()}`;
  const checkWin = () => { if (leftPairs()===0) metaEl.textContent = 'Готово! 🎉 Все пары найдены'; };

  const start = (pairs) => {
    gridEl = $('game-grid'); leftEl = $('game-left'); metaEl = $('game-meta');
    tiles = buildTiles(pairs);
    $('game-title').textContent = '🧱 Стена пар';
    metaEl.textContent = `${pairs.length} пар · EN↔RU`;
    render();
  };

  const restart = () => {
    if (!tiles.length) return;
    const map = new Map();
    tiles.forEach(t => {
      if (!map.has(t.pid)) map.set(t.pid, { en:null, ru:null });
      map.get(t.pid)[t.lang] = t.text;
    });
    start([...map.values()].map(x => [x.en, x.ru]));
  };

  return { start, restart, gotoGameScreen };
})();

$('game-brick-start')?.addEventListener('click', () => {
  const words = getLessonWordsForGame();
  if (!words?.length) { alert('Выбери сначала урок со словами.'); return; }
  BrickMatch.gotoGameScreen();
  BrickMatch.start(words);
});
$('game-exit')?.addEventListener('click', () => history.back());
$('game-restart')?.addEventListener('click', () => BrickMatch.restart());
