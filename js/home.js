(function () {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // ---- Grease-pencil "select" mark on each gallery frame ----
  const ring = '<svg class="pencil-ring" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' +
    '<path pathLength="1" d="M10 58 C 4 24, 38 4, 64 8 C 92 12, 99 40, 94 64 C 88 90, 56 98, 32 92 C 10 86, 2 64, 12 40 C 16 30, 24 22, 34 18"/></svg>';
  document.querySelectorAll('#gallery .shot').forEach((s, i) => {
    s.insertAdjacentHTML('beforeend', ring);
    // vary each mark a little so they look hand-drawn
    s.querySelector('.pencil-ring').style.transform = `rotate(${(i % 2 ? 1 : -1) * (1 + (i % 3))}deg)`;
  });

  // ---- Gallery filters ----
  const shots = [...document.querySelectorAll('#gallery .shot')];
  const chips = document.querySelectorAll('.chip[data-filter]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      const f = chip.dataset.filter;
      chips.forEach(c => {
        const on = c === chip;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on);
      });
      let n = 0;
      shots.forEach(s => {
        const show = f === 'all' || s.dataset.cat === f;
        s.classList.toggle('is-hidden', !show);
        s.classList.remove('pop');
        if (show && !reduce) {
          s.style.animationDelay = (n++ * 70) + 'ms';
          void s.offsetWidth; // restart animation
          s.classList.add('pop');
        }
      });
    });
  });

  // ---- Lightbox ----
  const lb = document.getElementById('lightbox');
  if (!lb) return;
  const img = lb.querySelector('.lb-img');
  const title = lb.querySelector('.lb-title');
  const meta = lb.querySelector('.lb-meta');
  const count = lb.querySelector('.lb-count');
  let list = [];
  let idx = 0;
  let opener = null;

  function visibleButtons() {
    return shots.filter(s => !s.classList.contains('is-hidden')).map(s => s.querySelector('.shot-btn'));
  }

  function show(i) {
    idx = (i + list.length) % list.length;
    const btn = list[idx];
    const thumb = btn.querySelector('img');
    img.classList.remove('loaded');
    img.onload = () => img.classList.add('loaded');
    img.src = btn.dataset.full;
    img.alt = thumb.alt;
    title.textContent = btn.querySelector('.shot-title').textContent;
    meta.textContent = btn.closest('.shot').querySelector('figcaption').textContent.replace(/^\s*▸\s*\d+\s*/, '');
    count.textContent = String(idx + 1).padStart(2, '0') + ' / ' + String(list.length).padStart(2, '0');
    if (img.complete && img.naturalWidth) img.classList.add('loaded');
    // Preload neighbour
    const next = list[(idx + 1) % list.length];
    if (next) new Image().src = next.dataset.full;
  }

  function open(btn) {
    list = visibleButtons();
    opener = btn;
    lb.hidden = false;
    document.body.style.overflow = 'hidden';
    show(list.indexOf(btn));
    requestAnimationFrame(() => lb.classList.add('is-open'));
    lb.querySelector('.lb-close').focus();
  }

  function close() {
    lb.classList.remove('is-open');
    document.body.style.overflow = '';
    setTimeout(() => { lb.hidden = true; img.removeAttribute('src'); }, reduce ? 0 : 350);
    if (opener) opener.focus();
  }

  shots.forEach(s => {
    const btn = s.querySelector('.shot-btn');
    btn.addEventListener('click', () => open(btn));
  });

  lb.querySelector('.lb-close').addEventListener('click', close);
  lb.querySelector('.lb-prev').addEventListener('click', () => show(idx - 1));
  lb.querySelector('.lb-next').addEventListener('click', () => show(idx + 1));
  lb.addEventListener('click', e => { if (e.target === lb || e.target.classList.contains('lb-figure')) close(); });

  document.addEventListener('keydown', e => {
    if (lb.hidden) return;
    if (e.key === 'Escape') close();
    else if (e.key === 'ArrowRight') show(idx + 1);
    else if (e.key === 'ArrowLeft') show(idx - 1);
    else if (e.key === 'Tab') {
      // keep focus inside the dialog
      const f = [...lb.querySelectorAll('button')];
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // Swipe on touch screens
  let sx = null;
  lb.addEventListener('touchstart', e => { sx = e.touches[0].clientX; }, { passive: true });
  lb.addEventListener('touchend', e => {
    if (sx === null) return;
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 50) show(idx + (dx < 0 ? 1 : -1));
    sx = null;
  });
})();
