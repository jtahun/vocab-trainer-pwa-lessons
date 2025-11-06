/* js/utils.js */
(function (window) {
  function $(id) { return document.getElementById(id); }
  function show(el, v = true) { if (!el) return; el.classList.toggle('hide', !v); }
  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }
  function shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  async function fetchJsonNoCache(urlStr) {
    const url = new URL(urlStr, location.href);
    url.searchParams.set('v', Date.now()); // cache-buster
    const res = await fetch(url.toString(), { cache: 'no-store' });
    if (!res.ok) throw new Error(urlStr + ' HTTP ' + res.status);
    let text = await res.text();
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1); // strip BOM
    const t = text.trim();
    if (!(t.startsWith('{') || t.startsWith('['))) {
      throw new Error('Получено не JSON (возможно HTML/404)');
    }
    return JSON.parse(text);
  }

  // Экспорт в глобальную область
  window.$ = $;
  window.show = show;
  window.clamp = clamp;
  window.escapeHtml = escapeHtml;
  window.shuffleArray = shuffleArray;
  window.shuffle = shuffleArray;
  window.fetchJsonNoCache = fetchJsonNoCache;
})(window);
