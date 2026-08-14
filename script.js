/* ============================================================================
   owlcraft boot logic — extracted from index.html
   Loaded as: <script type="module" src="script.js"></script>
   Module scripts are deferred, so the DOM (canvas + boot splash) already exists
   when this runs — same as the original inline scripts at the end of <body>.
   ============================================================================ */

/* --- Part 1: Pre-boot PARALLEL PREFETCH (was the inline IIFE) ---------------
   The client reads its ~10.6k resources SERIALLY (one blocking fetch each on the
   single green thread), so over the internet a first load is ~10.6k × RTT ≈ 10 min.
   Here we fetch the whole boot set in parallel to WARM the browser cache (the assets
   are served immutable), then boot TeaVM — so the client's serial reads become
   instant cache hits. Latency-bound minutes → the parallel (bandwidth-bound)
   download of a few seconds. */
(function () {
  var boot = document.getElementById('owl-boot');
  var barWrap = document.getElementById('owl-bar-wrap');
  var bar = document.getElementById('owl-bar');
  var status = document.getElementById('owl-status');
  var countEl = document.getElementById('owl-count');
  var urls = Array.isArray(globalThis.__owlBootUrls) ? globalThis.__owlBootUrls : [];
  var total = urls.length, hidden = false, prefetchDone = false, lastActivity = Date.now(), bytes = 0;
  var origFetch = globalThis.fetch.bind(globalThis);
  var assetMap = new Map();   // pathname -> ArrayBuffer, populated by the prefetch, served to the client
  function mb(n) { return (n / 1048576).toFixed(1) + ' MB'; }
  function shorten(u) {
    try { u = new URL(u, location.href).pathname; } catch (e) {}
    return u.replace(/^\/resources\/assets\/minecraft\//, '')
            .replace(/^\/resources\//, '')
            .replace(/^\/owl-shaders(-gen)?\//, 'shaders/')
            .replace(/^\//, '');
  }
  function hide() {
    if (hidden) return; hidden = true;
    barWrap.className = 'bar'; bar.style.width = '100%';   // solid full bar, animation off
    setTimeout(function () { boot.classList.add('hidden');
      setTimeout(function () { boot.style.display = 'none'; }, 450); }, 150);
  }
  // Track ALL network activity (the prefetch + the client's post-boot cache-hit reads) so the hide
  // fires only once things go idle (Mojang's own LoadingOverlay has taken over).
  try {
    var po = new PerformanceObserver(function (l) {
      var e = l.getEntries();
      for (var i = 0; i < e.length; i++)
        if (e[i].name.indexOf('data:') !== 0 && e[i].name !== location.href) lastActivity = Date.now();
    });
    po.observe({ type: 'resource', buffered: true });
  } catch (e) { /* no PerformanceObserver — hide falls back to the stall net */ }
  // Parallel prefetch with bounded concurrency. force-cache + immutable headers means each response
  // lands in the browser cache; reading the body ensures it is fully downloaded (and cached).
  function prefetchAll() {
    if (!total) { barWrap.className = 'bar indet'; status.textContent = 'Loading…'; return Promise.resolve(); }
    var CONC = 64, i = 0;
    return new Promise(function (resolve) {
      var active = 0, done = 0;
      function step() {
        while (active < CONC && i < total) {
          var url = urls[i++]; active++;
          status.textContent = 'Loading ' + shorten(url);
          (function (u) {
            origFetch(u, { cache: 'force-cache' })
              .then(function (r) { return r.arrayBuffer(); })
              .catch(function () { return null; })
              .then(function (buf) {
                active--; done++;
                if (buf && buf.byteLength) { assetMap.set(u, buf); bytes += buf.byteLength; countEl.textContent = mb(bytes); }
                bar.style.width = Math.min(99, Math.round(done / total * 100)) + '%';
                lastActivity = Date.now();
                if (done >= total) resolve(); else step();
              });
          })(url);
        }
      }
      step();
    });
  }
  // The boot code below awaits this before calling main(), so the client boots against the warm Map.
  globalThis.__owlPrefetchDone = prefetchAll().then(function () {
    // In-memory fetch shim: serve the client's serial resource reads straight from the prefetched
    // Map — no browser fetch pipeline, no cache lookup, no Cloudflare round-trip. This turns
    // "Starting the game" from a 2nd serial pass over 10.6k requests (~2-3ms each) into instant
    // memory reads. Unknown URLs (CDN misses, the bridge is a WebSocket not a fetch) fall through.
    globalThis.fetch = function (input, init) {
      var key = null;
      try { key = new URL(typeof input === 'string' ? input : (input && input.url), location.href).pathname; } catch (e) {}
      lastActivity = Date.now();   // keep the splash up while the client is actively reading
      if (key && assetMap.has(key)) return Promise.resolve(new Response(assetMap.get(key), { status: 200 }));
      var p = origFetch(input, init);
      // Cache-on-miss: any resource read once (e.g. what the client fetches when JOINING a world,
      // which the title-screen measurement didn't cover) is stored, so re-reads/reloads are instant.
      if (key && (key.indexOf('/resources/') === 0 || key.indexOf('/owl-shaders') === 0)) {
        return p.then(function (r) {
          if (!r || !r.ok) return r;
          try {
            return r.clone().arrayBuffer().then(function (buf) { if (buf) assetMap.set(key, buf); return r; },
                                                 function () { return r; });
          } catch (e) { return r; }
        });
      }
      return p;
    };
    prefetchDone = true; status.textContent = 'Starting the game…'; lastActivity = Date.now();
    // Switch to the animated indeterminate bar for the boot-compute phase: the client parses models,
    // stitches atlases and compiles pipelines on one thread for ~20s with no progress signal, so a
    // solid bar would look frozen. The transform animation keeps moving on the compositor thread.
    barWrap.className = 'bar indet';
    backgroundPrefetch();   // quietly warm the REST of jar-resources so joining a world is instant too
  });

  // After the (blocking) boot prefetch, keep filling the Map with everything else under jar-resources
  // at low concurrency — non-blocking, so it never slows the running game. By the time the player
  // clicks "Join Default Server" (seconds later), the world's block/entity/model/data reads are
  // already in memory. Sounds live in the CDN index (not jar-resources) and stay lazy. Uses origFetch
  // so it isn't itself intercepted by the shim.
  var bgActive = 0;
  function backgroundPrefetch() {
    origFetch('/resources/.owl-index').then(function (r) { return r.ok ? r.text() : ''; }).then(function (txt) {
      var all = txt.split('\n');
      // data/ (structures, worldgen, tags, recipes) is read heavily on world JOIN and sorts LAST
      // (after assets/), so pull it forward — otherwise a quick join races ahead of it.
      all.sort(function (a, b) { return (a.indexOf('data/') === 0 ? 0 : 1) - (b.indexOf('data/') === 0 ? 0 : 1); });
      // High concurrency: nothing competes while the player idles on the title screen, and the
      // client's own reads are Map-served (instant), so this warms the full 84MB in ~20s not ~80s.
      var j = 0, BG_CONC = 48;
      function bgStep() {
        while (bgActive < BG_CONC && j < all.length) {
          var line = all[j++]; if (!line) continue;
          var url = '/resources/' + line;
          if (assetMap.has(url)) continue;
          bgActive++;
          origFetch(url, { cache: 'force-cache' })
            .then(function (r) { return r && r.ok ? r.arrayBuffer() : null; })
            .catch(function () { return null; })
            .then(function (buf) { bgActive--; if (buf) assetMap.set(url, buf); bgStep(); });
        }
      }
      bgStep();
    }).catch(function () { /* no index — cache-on-miss still covers join reads on 2nd read */ });
  }
  // Hide only once the client is actually RENDERING. With reads served from memory, network-idle no
  // longer means "done" — the client goes idle during the WebGPU pipeline-setup gap before the first
  // frame, which would fade the splash to a black canvas. The only caller of requestAnimationFrame on
  // this page is the client's render loop (WebGpuSurface.present), so counting frames after boot is a
  // reliable "Mojang overlay is on screen" signal. Fallbacks: a long post-prefetch idle, and a 120s net.
  var frames = 0;
  function onFrame() { if (prefetchDone) frames++; }
  // Primary signal: the client presents each canvas frame via GPUCanvasContext.getCurrentTexture().
  // The first couple calls mean the Mojang overlay is actually on screen. (requestAnimationFrame is a
  // backup, but TeaVM's binding may not route through the patched global — hence the WebGPU hook.)
  try {
    var GCC = globalThis.GPUCanvasContext;
    if (GCC && GCC.prototype && GCC.prototype.getCurrentTexture) {
      var origGCT = GCC.prototype.getCurrentTexture;
      GCC.prototype.getCurrentTexture = function () { onFrame(); return origGCT.apply(this, arguments); };
    }
  } catch (e) {}
  var origRAF = (typeof globalThis.requestAnimationFrame === 'function')
    ? globalThis.requestAnimationFrame.bind(globalThis) : null;
  if (origRAF) globalThis.requestAnimationFrame = function (cb) { onFrame(); return origRAF(cb); }
  var iv = setInterval(function () {
    if (hidden) { clearInterval(iv); return; }
    if (document.hidden) { lastActivity = Date.now(); return; }
    var idle = Date.now() - lastActivity;
    if ((prefetchDone && frames >= 2)   // the client has presented a couple frames (overlay visible)
        || idle > 120000) { clearInterval(iv); hide(); }
  }, 100);
})();

/* --- Part 2: Random per-player username (was the first inline module) --------
   Generated once via deploy/web/randomUsername.mjs, persisted to localStorage,
   exposed as __owlUsername for S6Main (--username). Runs before the main boot
   below, so the global is set before main(). Clamp to 16 chars (offline-mode
   username limit). */
const { default: generateUsername } = await import('https://owlcraft.raymondjxu.net/randomUsername.mjs');
let u = null;
try { u = localStorage.getItem('owlUsername'); } catch (e) {}
if (!u) { u = String(generateUsername() || 'Player').slice(0, 16);
  try { localStorage.setItem('owlUsername', u); } catch (e) {} }
globalThis.__owlUsername = u;

/* --- Part 3: Main boot (was the second inline module) ------------------------
   Wait for the parallel prefetch to warm the cache, THEN boot — the client's
   serial resource reads become instant cache hits instead of ~10.6k internet
   round-trips. (No prefetch data → resolves immediately, same as before.) */
const { main } = await import('https://owlcraft.raymondjxu.net/classes.js');
const fail = (msg) => console.error('OWLCRAFT_FATAL ' + msg);
window.addEventListener('error', (e) => fail('window-error ' + ((e.error && e.error.stack) || e.message)));
window.addEventListener('unhandledrejection', (e) => fail('unhandled-rejection ' + (e.reason && (e.reason.stack || e.reason))));
try {
  await (globalThis.__owlPrefetchDone || Promise.resolve());
  // Let the browser paint + hand the animated boot bar to the compositor before main() blocks the
  // main thread for ~20s (compute-bound boot) — otherwise the animation would freeze. setTimeout,
  // not requestAnimationFrame (the frame hook counts rAF and would trip the hide early).
  await new Promise((r) => setTimeout(r, 60));
  main([]);
} catch (e) { fail((e && e.stack) || String(e)); }
