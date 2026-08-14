/* ============================================================================
   owlcraft.js — the ENTIRE original index.html expressed as one JavaScript file.

   The HTML shell only needs:
       <script type="module" src="owlcraft.js"></script>

   Everything the static HTML used to contain — the <style> block, the canvas +
   boot-splash markup, the boot-manifest/config scripts, the parallel-prefetch
   IIFE, the username module, the main boot module and the analytics beacon —
   is created/run from here, in the SAME order and with the SAME behavior.
   (Must be loaded as type="module": it uses top-level await + import(), exactly
   like the original inline module scripts.)
   ============================================================================ */

// Module scripts are deferred, so <body> normally exists already — this guard
// only matters if someone loads the file from <head> in a non-standard way.
if (!document.body) {
  await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
}

/* ============================================================================
   0. <head> equivalents — page title + the original <style> block, verbatim.
   ============================================================================ */
document.title = 'owlcraft';

const owlCss = `
html, body { margin: 0; height: 100%; overflow: hidden; background: #16182a; color: #ddd; font: 13px monospace; }
#owl-canvas { display: block; width: 100vw; height: 100vh; outline: none; }
#owl-boot { position: fixed; inset: 0; z-index: 10; display: flex; flex-direction: column;
  align-items: center; justify-content: center; background: #16182a; color: #e8e2d0;
  font-family: ui-monospace, "SFMono-Regular", Menlo, monospace; transition: opacity .4s ease; }
#owl-boot .owl { width: 96px; height: 96px; image-rendering: pixelated; margin-bottom: 28px; }
#owl-boot .mark { font-size: 34px; letter-spacing: .55em; text-indent: .55em; font-weight: 700; }
/* Fixed-width panel keeps the bar + status in place: the status is one ellipsised line of a
   constant width, so a changing filename never reflows or re-centers the layout (no jitter). */
#owl-boot .panel { width: 460px; max-width: 86vw; margin-top: 44px; }
#owl-boot .bar { position: relative; width: 100%; height: 4px; background: rgba(232,226,208,.15);
  border-radius: 2px; overflow: hidden; }
#owl-boot .bar > i { position: absolute; left: 0; top: 0; height: 100%; width: 0;
  background: #e8e2d0; border-radius: 2px; transition: width .2s ease; }
/* Indeterminate bar: a segment slides across. Uses transform (compositor-thread) NOT left, so it
   keeps animating even while the client's boot compute blocks the main thread for ~20s — otherwise
   the bar would freeze. Shown during the boot-compute phase and the no-manifest fallback. */
#owl-boot .bar.indet > i { width: 34%; left: 0; animation: owlslide 1.15s ease-in-out infinite; }
@keyframes owlslide { from { transform: translateX(-115%); } to { transform: translateX(315%); } }
#owl-boot .statusrow { display: flex; justify-content: space-between; gap: 12px; margin-top: 14px;
  font-size: 12px; color: rgba(232,226,208,.7); }
#owl-boot .status { flex: 1 1 auto; min-width: 0; height: 1.25em; line-height: 1.25em;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: left; }
#owl-boot .count { flex: 0 0 auto; opacity: .8; font-variant-numeric: tabular-nums; }
#owl-boot.hidden { opacity: 0; pointer-events: none; }
`;
const owlStyleEl = document.createElement('style');
owlStyleEl.textContent = owlCss;
document.head.appendChild(owlStyleEl);

/* ============================================================================
   1. <body> markup — the canvas + boot splash, built with DOM APIs.
      Same ids/classes/attributes as the original HTML.
   ============================================================================ */
const owlCanvas = document.createElement('canvas');
owlCanvas.id = 'owl-canvas';
owlCanvas.width = 1280;
owlCanvas.height = 720;
owlCanvas.tabIndex = 0;

// Inline pixel-owl glyph (data-URI SVG); keeps the page self-contained (no network for the splash).
const owlImg = document.createElement('img');
owlImg.className = 'owl';
owlImg.alt = 'owlcraft';
owlImg.src = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' shape-rendering='crispEdges'><g fill='%23e8e2d0'><rect x='4' y='2' width='2' height='2'/><rect x='10' y='2' width='2' height='2'/><rect x='3' y='4' width='10' height='7'/><rect x='11' y='4' width='2' height='2'/></g><g fill='%2316182a'><rect x='5' y='6' width='2' height='2'/><rect x='9' y='6' width='2' height='2'/><rect x='7' y='8' width='2' height='2'/></g></svg>";

const owlMark = document.createElement('div');
owlMark.className = 'mark';
owlMark.textContent = 'OWLCRAFT';

const owlPanel = document.createElement('div');
owlPanel.className = 'panel';

const owlBarWrap = document.createElement('div');
owlBarWrap.className = 'bar';
owlBarWrap.id = 'owl-bar-wrap';
const owlBar = document.createElement('i');
owlBar.id = 'owl-bar';
owlBarWrap.appendChild(owlBar);

const owlStatusRow = document.createElement('div');
owlStatusRow.className = 'statusrow';
const owlStatus = document.createElement('span');
owlStatus.className = 'status';
owlStatus.id = 'owl-status';
owlStatus.textContent = 'Loading…';
const owlCount = document.createElement('span');
owlCount.className = 'count';
owlCount.id = 'owl-count';
owlStatusRow.appendChild(owlStatus);
owlStatusRow.appendChild(owlCount);

owlPanel.appendChild(owlBarWrap);
owlPanel.appendChild(owlStatusRow);

const owlBoot = document.createElement('div');
owlBoot.id = 'owl-boot';
owlBoot.appendChild(owlImg);
owlBoot.appendChild(owlMark);
owlBoot.appendChild(owlPanel);

document.body.appendChild(owlCanvas);
document.body.appendChild(owlBoot);

/* Cloudflare analytics beacon (was the last tag in <body>). Injected now —
   fire-and-forget, in parallel with everything below, exactly like the
   original deferred module tag. */
(function () {
  const s = document.createElement('script');
  s.type = 'module';
  s.src = 'https://static.cloudflareinsights.com/beacon.min.js/v4513226cdae34746b4dedf0b4dfa099e1781791509496';
  s.integrity = 'sha512-ZE9pZaUXND66v380QUtch/5sE9tPFh2zg45pR2PB0CVkCtOREv2AJKkSidISWkysEuQ0EH8faUU5du78bx87UQ==';
  s.crossOrigin = 'anonymous';
  s.setAttribute('data-cf-beacon', '{"version":"2024.11.0","token":"11230bc28a6f42e2b491d5afe85661fd","r":1}');
  document.head.appendChild(s);
})();

/* ============================================================================
   2. The two external CLASSIC scripts, loaded sequentially (same order as the
      original blocking <script src> tags):
        - boot-manifest.js: baked ordered list of ~10.6k immutable boot
          resources (__owlBootUrls) + totals; enables the parallel prefetch.
          Absent → the bar falls back to indeterminate, no prefetch.
        - config.js: runtime config (__owlServerAddr/__owlServerName/
          __owlBridgeUrl); must exist before the client boots.
      Like the original page, a failed load doesn't stop the rest.
   ============================================================================ */
function owlLoadClassicScript(src) {
  return new Promise(function (resolve) {
    const s = document.createElement('script');
    s.src = src;
    s.onload = function () { resolve(true); };
    s.onerror = function () { resolve(false); };
    document.head.appendChild(s);
  });
}
await owlLoadClassicScript('https://owlcraft.raymondjxu.net/boot-manifest.js');
await owlLoadClassicScript('https://owlcraft.raymondjxu.net/config.js');

/* ============================================================================
   3. Pre-boot PARALLEL PREFETCH (the original inline IIFE, verbatim).
      The client reads its ~10.6k resources SERIALLY (one blocking fetch each on
      the single green thread), so over the internet a first load is ~10.6k × RTT
      ≈ 10 min. Here we fetch the whole boot set in parallel to WARM the browser
      cache (the assets are served immutable), then boot TeaVM — so the client's
      serial reads become instant cache hits.
   ============================================================================ */
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

/* ============================================================================
   4 + 5. The two original inline MODULE scripts. Both imports are STARTED here
      in parallel (like the original static imports, which fetched during HTML
      parsing) but AWAITED in the original DOM order: username first, then boot.
   ============================================================================ */
const owlUsernameModP = import('https://owlcraft.raymondjxu.net/randomUsername.mjs');
const owlClassesModP  = import('https://owlcraft.raymondjxu.net/classes.js');

/* --- 4. Random per-player username (was the first inline module) -------------
   Generated once, persisted to localStorage, exposed as __owlUsername for
   S6Main (--username). Runs before the boot below, so the global is set before
   main(). Clamp to 16 chars (offline-mode username limit). In the original
   page a failure here didn't stop the boot module — same here. */
try {
  const { default: generateUsername } = await owlUsernameModP;
  let u = null;
  try { u = localStorage.getItem('owlUsername'); } catch (e) {}
  if (!u) { u = String(generateUsername() || 'Player').slice(0, 16);
    try { localStorage.setItem('owlUsername', u); } catch (e) {} }
  globalThis.__owlUsername = u;
} catch (e) { console.error('OWLCRAFT_USERNAME ' + ((e && e.stack) || e)); }

/* --- 5. Main boot (was the second inline module) ------------------------------
   Wait for the parallel prefetch to warm the cache, THEN boot — the client's
   serial resource reads become instant cache hits instead of ~10.6k internet
   round-trips. (No prefetch data → resolves immediately, same as before.) */
const { main } = await owlClassesModP;
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
