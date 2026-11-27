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

  // Phones/tablets get the handheld (touch controls, opens full-screen)
  var touch = !!(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches);

  var canFullscreen = !!(screen.requestFullscreen || screen.webkitRequestFullscreen);
  if (!canFullscreen || touch) fsBtn.hidden = true;

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

  playBtn.addEventListener('click', function () { load(); if (touch) openHandheld(); });

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

  function restart() {
    if (!iframe) return;
    releaseAll();
    screen.classList.remove('is-ready', 'has-error');
    try { iframe.contentWindow.location.reload(); } catch (e) { iframe.src = iframe.src; }
  }
  restartBtn.addEventListener('click', restart);

  /* ============================================
     HANDHELD (touch devices)
     ============================================ */
  var dpad = cabinet.querySelector('[data-dpad]');
  var soundPill = cabinet.querySelector('[data-hh="sound"]');

  function input() {
    try { return iframe && iframe.contentWindow.hayuInput; } catch (e) { return null; }
  }
  function sendKey(name, isDown) {
    var api = input();
    if (!api) return;
    if (isDown) api.resumeAudio();
    api.key(name, isDown);
  }
  function releaseAll() {
    setDir(null);
    var api = input(); if (api) api.releaseAll();
    cabinet.querySelectorAll('.is-down').forEach(function (b) { b.classList.remove('is-down'); });
  }
  function buzz() { if (navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* ignore */ } }
  function ensureGame() { if (!frame) load(); if (touch) openHandheld(); }

  // Open / close: full-screen handheld; the phone's Back button closes it
  function openHandheld() {
    if (cabinet.classList.contains('is-open')) return;
    cabinet.classList.add('is-open');
    document.documentElement.classList.add('hh-lock');
    try { history.pushState({ hayu: 'open' }, ''); } catch (e) { /* ignore */ }
    requestAnimationFrame(fit);
  }
  function closeHandheld(fromHistory) {
    if (!cabinet.classList.contains('is-open')) return;
    releaseAll();
    cabinet.classList.remove('is-open');
    document.documentElement.classList.remove('hh-lock');
    if (!fromHistory && history.state && history.state.hayu === 'open') history.back();
    requestAnimationFrame(fit);
  }
  window.addEventListener('popstate', function () { closeHandheld(true); });

  // D-pad: one touch area, direction follows the thumb (slide between arms)
  var held = null, dpadPointer = null;
  function setDir(dir) {
    if (dir === held) return;
    if (held) sendKey(held, false);
    held = dir;
    if (dir) { sendKey(dir, true); buzz(); }
    dpad.setAttribute('data-dir', dir || '');
  }
  function dirFrom(e) {
    var r = dpad.getBoundingClientRect();
    var x = e.clientX - (r.left + r.width / 2), y = e.clientY - (r.top + r.height / 2);
    if (Math.sqrt(x * x + y * y) < r.width * 0.1) return held;   // small dead zone in the middle
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  }
  dpad.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    ensureGame();
    dpadPointer = e.pointerId;
    try { dpad.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    setDir(dirFrom(e));
  });
  dpad.addEventListener('pointermove', function (e) { if (e.pointerId === dpadPointer) setDir(dirFrom(e)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
    dpad.addEventListener(t, function (e) { if (e.pointerId === dpadPointer) { dpadPointer = null; setDir(null); } });
  });

  // A / B: press and hold like a key (A = Space, B = Enter: both start and retry)
  cabinet.querySelectorAll('[data-btn]').forEach(function (btn) {
    var name = btn.getAttribute('data-btn');
    btn.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (!frame) { ensureGame(); return; }
      ensureGame();
      btn.classList.add('is-down'); buzz();
      try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      sendKey(name, true);
    });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
      btn.addEventListener(t, function () {
        if (!btn.classList.contains('is-down')) return;
        btn.classList.remove('is-down');
        sendKey(name, false);
      });
    });
  });

  // Pills: Sound (mute toggle) and Restart; power switch closes
  function syncSoundPill() { soundPill.setAttribute('aria-pressed', String(!muted)); soundPill.classList.toggle('is-off', muted); }
  cabinet.querySelectorAll('[data-hh]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault(); buzz();
      var what = el.getAttribute('data-hh');
      if (what === 'close') closeHandheld(false);
      if (what === 'restart') { if (frame) restart(); else ensureGame(); }
      if (what === 'sound') { muted = !muted; sendVolume(); syncSoundPill(); }
    });
  });
  muteBtn.addEventListener('click', syncSoundPill);
  syncSoundPill();

  // Never leave a key stuck down
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
  cabinet.addEventListener('contextmenu', function (e) { if (touch) e.preventDefault(); });
})();
