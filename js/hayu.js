// Hayu player: loads the game (games/hayu/) into the screen only when the
// visitor presses Play, scales its native 1600×900 frame to fit, and adds
// fullscreen + restart. The game itself lives in a same-origin iframe.
(function () {
  'use strict';

  var cabinet = document.getElementById('game');
  if (!cabinet) return;

  var W = 1600, H = 900;
  var screen = cabinet.querySelector('[data-screen]');
  var playBtn = cabinet.querySelector('[data-play]');
  var fsBtn = document.querySelector('[data-fullscreen]');
  var restartBtn = document.querySelector('[data-restart]');
  var frame = null, iframe = null;

  // Phones/tablets: the game needs a keyboard
  if (window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches) {
    document.querySelector('.touch-note').hidden = false;
    cabinet.querySelector('.btn-play-label').textContent = 'Load anyway';
  }

  var canFullscreen = !!(screen.requestFullscreen || screen.webkitRequestFullscreen);
  if (!canFullscreen) fsBtn.hidden = true;

  function fit() {
    if (!frame) return;
    var r = screen.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var k = Math.min(r.width / W, r.height / H);
    var x = (r.width - W * k) / 2, y = (r.height - H * k) / 2;
    frame.style.transform = 'translate(' + x.toFixed(2) + 'px,' + y.toFixed(2) + 'px) scale(' + k.toFixed(5) + ')';
  }

  function focusGame() {
    if (!iframe) return;
    try { iframe.focus({ preventScroll: true }); } catch (e) { iframe.focus(); }
    try { iframe.contentWindow.postMessage({ hayu: 'focus' }, window.location.origin); } catch (e) { /* not ready */ }
  }

  function load() {
    if (frame) return;
    frame = document.createElement('div');
    frame.className = 'screen-frame';
    iframe = document.createElement('iframe');
    iframe.src = cabinet.getAttribute('data-src');
    iframe.title = 'Hayu, playable game';
    iframe.width = W;
    iframe.height = H;
    iframe.setAttribute('allow', 'autoplay; fullscreen; gamepad');
    iframe.setAttribute('allowfullscreen', '');
    frame.appendChild(iframe);
    screen.appendChild(frame);
    screen.classList.add('is-playing');
    fit();
    fsBtn.disabled = false;
    restartBtn.disabled = false;
    iframe.addEventListener('load', focusGame);
  }

  playBtn.addEventListener('click', load);

  // ---- Volume (remembered on this device) ----
  var vol = document.querySelector('[data-vol]');
  var muteBtn = document.querySelector('[data-mute]');
  var muted = false;
  try {
    var saved = JSON.parse(localStorage.getItem('hayu-volume') || 'null');
    if (saved) { vol.value = saved.v; muted = !!saved.m; }
  } catch (e) { /* storage unavailable */ }

  function sendVolume() {
    var v = muted ? 0 : vol.value / 100;
    muteBtn.classList.toggle('is-muted', muted || +vol.value === 0);
    muteBtn.setAttribute('aria-pressed', String(muted));
    muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
    vol.style.setProperty('--fill', (muted ? 0 : vol.value) + '%');
    try { localStorage.setItem('hayu-volume', JSON.stringify({ v: +vol.value, m: muted })); } catch (e) { /* ignore */ }
    if (iframe) try { iframe.contentWindow.postMessage({ hayu: 'volume', value: v }, window.location.origin); } catch (e) { /* not ready */ }
  }
  vol.addEventListener('input', function () { muted = false; sendVolume(); });
  vol.addEventListener('change', focusGame);
  muteBtn.addEventListener('click', function () { muted = !muted; sendVolume(); focusGame(); });
  sendVolume();

  // Messages from the game page
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || !e.data || !e.data.hayu) return;
    if (e.data.hayu === 'loading' || e.data.hayu === 'ready') sendVolume();
    if (e.data.hayu === 'ready') { screen.classList.add('is-ready'); focusGame(); }
    if (e.data.hayu === 'error') screen.classList.add('has-error');
  });

  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(screen);
  else window.addEventListener('resize', fit);

  fsBtn.addEventListener('click', function () {
    var active = document.fullscreenElement || document.webkitFullscreenElement;
    if (active) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else {
      (screen.requestFullscreen || screen.webkitRequestFullscreen).call(screen);
    }
  });

  function onFullscreenChange() {
    var on = !!(document.fullscreenElement || document.webkitFullscreenElement);
    fsBtn.textContent = on ? 'Exit fullscreen' : 'Fullscreen';
    requestAnimationFrame(function () { fit(); focusGame(); });
  }
  document.addEventListener('fullscreenchange', onFullscreenChange);
  document.addEventListener('webkitfullscreenchange', onFullscreenChange);

  restartBtn.addEventListener('click', function () {
    if (!iframe) return;
    screen.classList.remove('is-ready', 'has-error');
    try { iframe.contentWindow.location.reload(); } catch (e) { iframe.src = iframe.src; }
  });
})();
