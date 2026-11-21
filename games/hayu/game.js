// Hayu loader. Downloads the gzipped build from this site, unpacks it in the
// browser (DecompressionStream), then starts Unity from local blob: URLs.
// No third-party requests. Tells the parent page (/hayu) when it's ready.
(function () {
  'use strict';

  var BUILD = 'Build/';
  // Fallback sizes (bytes) for the progress bar if the server sends no Content-Length
  var EXPECTED = { 'Hayu.data.gz': 8015357, 'Hayu.wasm.gz': 11280791 };

  var canvas = document.getElementById('unity-canvas');
  var loading = document.getElementById('loading');
  var bar = loading.querySelector('.bar span');
  var pct = loading.querySelector('.pct');
  var errorBox = document.getElementById('error');

  function tell(type, detail) {
    try { window.parent.postMessage({ hayu: type, detail: detail || '' }, window.location.origin); } catch (e) { /* not framed */ }
  }

  function setProgress(p) {
    var v = Math.max(0, Math.min(1, p));
    bar.style.transform = 'scaleX(' + v.toFixed(3) + ')';
    pct.textContent = Math.round(v * 100) + '%';
  }

  function fail(message) {
    loading.hidden = true;
    errorBox.hidden = false;
    errorBox.querySelector('.msg').textContent = message;
    tell('error', message);
  }

  if (!('WebAssembly' in window) || !('DecompressionStream' in window) || !window.fetch) {
    fail('This browser is too old to run Hayu here. A current version of Chrome, Edge, Firefox or Safari will work.');
    return;
  }

  // Download progress across both files = first 80% of the bar
  var got = {}, total = {};
  function onBytes(name, n, size) {
    got[name] = n; total[name] = size;
    var g = 0, t = 0;
    Object.keys(EXPECTED).forEach(function (k) { g += got[k] || 0; t += total[k] || EXPECTED[k]; });
    setProgress(0.8 * g / t);
  }

  function fetchGz(name, type) {
    return fetch(BUILD + name).then(function (res) {
      if (!res.ok) throw new Error(name + ' (HTTP ' + res.status + ')');
      var size = parseInt(res.headers.get('Content-Length'), 10) || EXPECTED[name];
      var reader = res.body.getReader();
      var chunks = [], n = 0;
      function pump() {
        return reader.read().then(function (r) {
          if (r.done) return;
          chunks.push(r.value); n += r.value.length;
          onBytes(name, n, Math.max(size, n));
          return pump();
        });
      }
      return pump().then(function () { return new Blob(chunks); });
    }).then(function (blob) {
      // Unpack if gzipped (magic bytes 1f 8b); pass through if something already decompressed it
      return blob.slice(0, 2).arrayBuffer().then(function (head) {
        var b = new Uint8Array(head);
        if (b[0] !== 0x1f || b[1] !== 0x8b) return blob;
        return new Response(blob.stream().pipeThrough(new DecompressionStream('gzip'))).blob();
      });
    }).then(function (raw) {
      return URL.createObjectURL(new Blob([raw], { type: type }));
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Could not load ' + src)); };
      document.body.appendChild(s);
    });
  }

  // Master volume: Unity plays through Web Audio, so every connection to the
  // speakers is routed through one gain node we control from the parent page.
  var volume = 0.5, gains = [];
  if (window.AudioNode && window.AudioDestinationNode) {
    var connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest) {
      if (dest instanceof AudioDestinationNode) {
        var ctx = dest.context, g = null;
        for (var i = 0; i < gains.length; i++) if (gains[i].context === ctx) g = gains[i];
        if (!g) { g = ctx.createGain(); g.gain.value = volume; connect.call(g, dest); gains.push(g); }
        var args = Array.prototype.slice.call(arguments); args[0] = g;
        return connect.apply(this, args);
      }
      return connect.apply(this, arguments);
    };
  }
  function setVolume(v) {
    volume = Math.max(0, Math.min(1, +v || 0));
    gains.forEach(function (g) { g.gain.setTargetAtTime(volume, g.context.currentTime, 0.03); });
  }
  window.hayuAudio = { gains: gains, get volume() { return volume; } };

  tell('loading');

  Promise.all([
    fetchGz('Hayu.data.gz', 'application/octet-stream'),
    fetchGz('Hayu.wasm.gz', 'application/wasm'),
    loadScript(BUILD + 'Hayu.loader.js')
  ]).then(function (urls) {
    var dataUrl = urls[0], codeUrl = urls[1];
    /* global createUnityInstance */
    return createUnityInstance(canvas, {
      dataUrl: dataUrl,
      codeUrl: codeUrl,
      frameworkUrl: BUILD + 'Hayu.framework.js',
      streamingAssetsUrl: 'StreamingAssets',
      companyName: 'mehemtxeyd',
      productName: 'Hayu',
      productVersion: '1.0',
      cacheControl: function () { return 'no-store'; },
      showBanner: function (msg, type) {
        if (type === 'error') fail(msg);
        else if (window.console) console.warn(msg);
      }
    }, function (p) {
      setProgress(0.8 + 0.2 * p);
    }).then(function (instance) {
      window.hayu = instance;
      setTimeout(function () { URL.revokeObjectURL(dataUrl); URL.revokeObjectURL(codeUrl); }, 5000);
      loading.hidden = true;
      canvas.focus({ preventScroll: true });
      tell('ready');
    });
  }).catch(function (err) {
    fail(String(err && err.message ? err.message : err));
  });

  // Parent page asks for focus (e.g. after pressing Play or leaving fullscreen)
  window.addEventListener('message', function (e) {
    if (e.origin !== window.location.origin || !e.data) return;
    if (e.data.hayu === 'focus') canvas.focus({ preventScroll: true });
    if (e.data.hayu === 'volume') setVolume(e.data.value);
  });
  // Clicking anywhere in the frame gives the canvas the keyboard
  document.addEventListener('pointerdown', function () { canvas.focus({ preventScroll: true }); });
})();
