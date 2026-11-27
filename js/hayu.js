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
  // Haptics. Android: Vibration API. iPhone (iOS 18+): no vibration API for
  // websites, but toggling a hidden switch control gives a light system tap.
  var canVibrate = typeof navigator.vibrate === 'function';
  var iosSwitch = null;
  function iosTap() {
    if (!iosSwitch) {
      iosSwitch = document.createElement('label');
      iosSwitch.setAttribute('aria-hidden', 'true');
      iosSwitch.style.display = 'none';
      var sw = document.createElement('input');
      sw.type = 'checkbox';
      sw.tabIndex = -1;
      sw.setAttribute('switch', '');
      iosSwitch.appendChild(sw);
      document.body.appendChild(iosSwitch);
    }
    iosSwitch.click();
  }
  function buzz(ms, el) {
    if (!touch) return;
    if (canVibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } return; }
    var ua = navigator.userActivation;
    if (!ua || ua.isActive) { iosTap(); return; }
    // iOS only counts a touch as a gesture when the finger lifts: tap then
    if (el) el.addEventListener('pointerup', iosTap, { once: true });
  }
  function ensureGame() { if (!frame) load(); if (touch) openHandheld(); }

  // Open / close: full-screen handheld; the phone's Back button closes it
  function openHandheld() {
    if (cabinet.classList.contains('is-open')) return;
    cabinet.classList.add('is-open');
    document.documentElement.classList.add('hh-lock');
    lockZoom(true);
    try { history.pushState({ hayu: 'open' }, ''); } catch (e) { /* ignore */ }
    requestAnimationFrame(fit);
  }
  function closeHandheld(fromHistory) {
    if (!cabinet.classList.contains('is-open')) return;
    releaseAll();
    cabinet.classList.remove('is-open');
    document.documentElement.classList.remove('hh-lock');
    lockZoom(false);
    if (!fromHistory && history.state && history.state.hayu === 'open') history.back();
    requestAnimationFrame(fit);
  }
  window.addEventListener('popstate', function () { closeHandheld(true); });

  // Controls: the whole control area is one touch zone, so near-misses still
  // count. Left half = D-pad (direction from its centre, slide to change),
  // right half = whichever of A / B is closer. Several fingers at once are fine.
  var zone = cabinet.querySelector('.hh-controls');
  var held = null, dpadPointer = null, pressed = {};   // pointerId -> A/B button
  function setDir(dir, fromPress) {
    if (dir === held) return;
    if (held) sendKey(held, false);
    held = dir;
    if (dir) { sendKey(dir, true); buzz(12, fromPress ? zone : null); }
    dpad.setAttribute('data-dir', dir || '');
  }
  function center(el) { var r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }
  function dirFrom(e) {
    var c = center(dpad), x = e.clientX - c.x, y = e.clientY - c.y;
    if (Math.sqrt(x * x + y * y) < c.w * 0.1) return held;   // small dead zone in the middle
    return Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : (y > 0 ? 'down' : 'up');
  }
  function onDpadSide(e) {
    var d = dpad.getBoundingClientRect(), ab = cabinet.querySelector('.ab').getBoundingClientRect();
    return e.clientX < (d.right + ab.left) / 2;
  }
  function nearestButton(e) {
    var best = null, bestD = Infinity;
    cabinet.querySelectorAll('[data-btn]').forEach(function (btn) {
      var c = center(btn), d = Math.pow(e.clientX - c.x, 2) + Math.pow(e.clientY - c.y, 2);
      if (d < bestD) { bestD = d; best = btn; }
    });
    return best;
  }
  zone.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var wasLoaded = !!frame;
    ensureGame();
    // capture the finger so release always reaches us (landscape: the zone has no box of its own)
    var cap = zone.getClientRects().length ? zone : e.target;
    try { cap.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    if (onDpadSide(e)) {
      dpadPointer = e.pointerId;
      setDir(dirFrom(e), true);
    } else if (wasLoaded) {
      var btn = nearestButton(e);
      pressed[e.pointerId] = btn;
      btn.classList.add('is-down'); buzz(18, zone);
      sendKey(btn.getAttribute('data-btn'), true);
    }
  });
  zone.addEventListener('pointermove', function (e) { if (e.pointerId === dpadPointer) setDir(dirFrom(e)); });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
    zone.addEventListener(t, function (e) {
      if (e.pointerId === dpadPointer) { dpadPointer = null; setDir(null); }
      var btn = pressed[e.pointerId];
      if (btn) { delete pressed[e.pointerId]; btn.classList.remove('is-down'); sendKey(btn.getAttribute('data-btn'), false); }
    });
  });

  // No zooming while the console is open (iPhone Safari ignores most of the
  // CSS for this): lock the viewport scale, which also resets any zoom, and
  // block pinch / double-tap gestures on the console.
  var viewport = document.querySelector('meta[name="viewport"]');
  var viewportDefault = viewport ? viewport.getAttribute('content') : '';
  function lockZoom(on) {
    if (!viewport) return;
    viewport.setAttribute('content', on
      ? 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover'
      : viewportDefault);
  }
  function blockWhenOpen(e) { if (cabinet.classList.contains('is-open')) e.preventDefault(); }
  ['gesturestart', 'gesturechange', 'gestureend', 'dblclick'].forEach(function (t) { cabinet.addEventListener(t, blockWhenOpen); });
  cabinet.addEventListener('touchmove', blockWhenOpen, { passive: false });
  cabinet.addEventListener('touchstart', function (e) { if (e.touches.length > 1) blockWhenOpen(e); }, { passive: false });
  if (touch) cabinet.addEventListener('dblclick', function (e) { e.preventDefault(); });

  // Pills: Sound (mute toggle) and Restart; power switch closes
  function syncSoundPill() { soundPill.setAttribute('aria-pressed', String(!muted)); soundPill.classList.toggle('is-off', muted); }
  cabinet.querySelectorAll('[data-hh]').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault(); buzz(10);
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
