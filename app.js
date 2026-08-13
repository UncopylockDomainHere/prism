/* ============================================================
   Prism Launcher Web Clone — Application Logic
   ============================================================
   This file is HEAVILY CONFIGURABLE. See the CONFIG section
   below to add your own:
     • Minecraft versions (built-in list)
     • jsdelivr-backed "custom" versions (loaded as HTML on Launch)
     • Resource packs (with real downloadable files + icons)
   ============================================================ */

/* ============================================================
   CONFIG  —  EDIT THIS SECTION
   ============================================================ */

// Built-in Minecraft version list shown in the "Custom" tab.
// Each entry: { version, released (M/D/YY), type }
// type must be one of: release | snapshot | beta | alpha | experiment
const BUILTIN_VERSIONS = [
];

// jsdelivr-backed custom versions the user can add via the URL box
// in the Custom tab. These appear in the version list with type "custom".
// When an instance created from one of these is Launched, the URL is
// loaded inside an iframe (like loading an HTML game).
//
// Format: { version, url, note }
//   - version : display name in the version list
//   - url     : the jsdelivr (or any) URL that gets loaded on Launch
//   - note    : optional tooltip/description
//
// You can also add new ones at runtime by typing a URL into the
// "Add a jsdelivr version" box and pressing Enter / clicking Add.
const CUSTOM_VERSIONS = [
  { version: "EaglercraftX 1.8.8", url: "https://cdn.jsdelivr.net/gh/v10letfur/Eaglercraft-X-1.8.8/EaglercraftX_1.8_u53_Offline_Signed.html", note: "Eaglercraft X 1.8.8 offline signed build — runs in-browser", },
];

/* ---- Resource Packs ----
   Each pack is described here. The icon is loaded automatically from
   ./resourcepacks/[FOLDER]/icon/  (looks for icon.png, icon.jpg,
   icon.webp, icon.jpeg, or icon.gif — the first that exists).

   downloadUrl MUST point to a real file you want the user to download
   when they click "Download". It can be any URL (jsdelivr, your own
   server, a direct zip link, etc.). To host your own, drop a file into
   ./resourcepacks/[FOLDER]/ and point downloadUrl at it, e.g.
   "./resourcepacks/Faithful/Faithful.zip".

   Format:
   {
     folder:       "Faithful",          // subfolder under ./resourcepacks/
     name:         "Faithful 32x",      // display name
     description:  "Doubled-resolution...",
     author:       "Vattic",
     mcVersion:    "1.21.x",
     downloadUrl:  "https://cdn.jsdelivr.net/...",  // REAL download
   }
*/
const RESOURCE_PACKS = [
  {
    folder: "Faithful",
    name: "Faithful 32x",
    description: "A classic double-resolution texture pack that stays true to the default Minecraft look while adding crispness and detail to every block and item.",
    author: "Vattic & contributors",
    mcVersion: "1.21.x",
    downloadUrl: "https://cdn.jsdelivr.net/gh/Vattic/Faithful-32x-Java@main/readme.md",
  },
];

/* ============================================================
   END CONFIG  (you generally don't need to edit below this)
   ============================================================ */

/* ---------- State ---------- */
const State = {
  instances: [],        // [{id, name, group, version, versionType, url|null, icon}]
  selectedInstanceId: null,
  // add-instance dialog state
  addDialog: {
    activeTab: "custom",
    selectedVersion: null,   // version string
    customVersionMap: {},    // version -> url  (from CUSTOM_VERSIONS + runtime adds)
    selectedLoader: "None",
    filters: { release: true, snapshot: false, beta: false, alpha: false, experiment: false, custom: true },
    search: "",
    name: "",
    group: "No group",
  },
  // resource pack dialog state
  rpDialog: {
    selectedFolder: null,
    search: "",
  },
  nextInstanceId: 1,
  playtime: 0,
};

/* merge CUSTOM_VERSIONS into the version->url map */
function rebuildCustomVersionMap() {
  const map = {};
  CUSTOM_VERSIONS.forEach(v => { map[v.version] = v.url; });
  Object.assign(map, State.addDialog.customVersionMap);
  State.addDialog.customVersionMap = map;
}

/* ---------- Utility ---------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

function toast(msg, kind = "ok", ms = 3200) {
  const wrap = $("#toastWrap") || (() => {
    const w = document.createElement("div");
    w.id = "toastWrap"; w.className = "toast-wrap"; document.body.appendChild(w); return w;
  })();
  const t = document.createElement("div");
  t.className = "toast " + kind;
  t.textContent = msg;
  wrap.appendChild(t);
  setTimeout(() => { t.style.opacity = "0"; t.style.transition = "opacity .3s"; setTimeout(() => t.remove(), 300); }, ms);
}

/* Resolve a resource pack icon URL — looks inside ./resourcepacks/[folder]/icon/
   for icon.png | icon.jpg | icon.jpeg | icon.webp | icon.gif (first hit).
   Because we can't synchronously probe the filesystem from the browser, we
   try each extension in order and fall back to a generated block icon. */
function resolvePackIcon(folder) {
  const exts = ["png", "jpg", "jpeg", "webp", "gif"];
  // We return the first candidate; <img onerror> chains through the rest.
  return exts.map(e => `resourcepacks/${encodeURIComponent(folder)}/icon/icon.${e}`);
}

/* ---------- Rendering: main window ---------- */
function renderInstances() {
  const sidebar = $("#instanceSidebar");
  const grid = $("#instanceView");
  sidebar.innerHTML = "";
  grid.innerHTML = "";

  // Group instances
  const groups = {};
  State.instances.forEach(inst => {
    const g = inst.group || "No group";
    (groups[g] = groups[g] || []).push(inst);
  });

  // Sidebar groups (always show known groups + any present)
  const groupOrder = ["No group", "Modpack", "Vanilla-likes", "Ungrouped"];
  Object.keys(groups).forEach(g => { if (!groupOrder.includes(g)) groupOrder.push(g); });

  groupOrder.forEach(gName => {
    const items = groups[gName];
    if (!items || items.length === 0) return;
    const header = document.createElement("div");
    header.className = "group-header";
    header.innerHTML = `<span class="arrow">▼</span><span>${esc(gName)}</span> <span style="margin-left:auto;color:var(--text-faint);font-size:11px">${items.length}</span>`;
    const wrap = document.createElement("div");
    wrap.className = "group-items";
    items.forEach(inst => {
      const it = document.createElement("div");
      it.className = "instance-item" + (inst.id === State.selectedInstanceId ? " selected" : "");
      it.innerHTML = `
        <img class="inst-icon" src="${esc(inst.icon)}" alt="" onerror="this.style.visibility='hidden'">
        <div style="overflow:hidden">
          <div class="inst-name">${esc(inst.name)}</div>
          <div class="inst-meta">${esc(inst.version)}</div>
        </div>`;
      it.addEventListener("click", () => selectInstance(inst.id));
      it.addEventListener("contextmenu", e => { e.preventDefault(); openInstanceContextMenu(e, inst); });
      wrap.appendChild(it);
    });
    header.addEventListener("click", () => header.classList.toggle("collapsed"));
    sidebar.appendChild(header);
    sidebar.appendChild(wrap);
  });

  // Grid cards (flat, in order)
  if (State.instances.length === 0) {
    grid.style.display = "flex";
    grid.style.alignItems = "center";
    grid.style.justifyContent = "center";
    grid.innerHTML = `<div style="text-align:center;color:var(--text-faint)">
      <div style="font-size:40px;margin-bottom:10px">⛏️</div>
      <div style="font-size:14px;margin-bottom:6px">No instances yet</div>
      <div style="font-size:12px">Click <b>Add Instance</b> in the toolbar to create one.</div>
    </div>`;
    grid.style.gridTemplateColumns = "";
    return;
  }
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "repeat(auto-fill, minmax(120px, 1fr))";
  State.instances.forEach(inst => {
    const card = document.createElement("div");
    card.className = "inst-card" + (inst.id === State.selectedInstanceId ? " selected" : "");
    card.innerHTML = `
      <img class="card-icon" src="${esc(inst.icon)}" alt="" onerror="this.style.visibility='hidden'">
      <div class="card-name">${esc(inst.name)}</div>
      <div class="card-ver">${esc(inst.version)}</div>`;
    card.addEventListener("click", () => selectInstance(inst.id));
    card.addEventListener("contextmenu", e => { e.preventDefault(); openInstanceContextMenu(e, inst); });
    grid.appendChild(card);
  });
}

function selectInstance(id) {
  State.selectedInstanceId = id;
  renderInstances();
  updateActionButtons();
}

function updateActionButtons() {
  const has = State.selectedInstanceId != null;
  ["#actEdit","#actChangeGroup","#actFolder","#actExport","#actCopy","#actDelete","#actShortcut"].forEach(s => {
    const el = $(s); if (el) el.disabled = !has;
  });
  const launch = $("#actLaunch"); if (launch) launch.disabled = !has;
}

/* ---------- Context menu ---------- */
function openInstanceContextMenu(e, inst) {
  selectInstance(inst.id);
  const menu = $("#ctxMenu");
  menu.innerHTML = `
    <div class="ctx-item" data-act="launch">▶ Launch</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" data-act="edit">Edit Instance…</div>
    <div class="ctx-item" data-act="changeGroup">Change Group…</div>
    <div class="ctx-item" data-act="folder">Open Folder</div>
    <div class="ctx-sep"></div>
    <div class="ctx-item" data-act="copy">Copy Instance…</div>
    <div class="ctx-item" data-act="delete">Delete</div>`;
  menu.style.left = Math.min(e.clientX, window.innerWidth - 180) + "px";
  menu.style.top  = Math.min(e.clientY, window.innerHeight - 260) + "px";
  menu.classList.add("show");
  $$(".ctx-item", menu).forEach(item => {
    item.addEventListener("click", () => {
      menu.classList.remove("show");
      handleInstanceAction(item.dataset.act, inst);
    });
  });
}
document.addEventListener("click", () => { const m = $("#ctxMenu"); if (m) m.classList.remove("show"); });
document.addEventListener("contextmenu", e => {
  // keep context menu only on instances
  if (!e.target.closest(".instance-item") && !e.target.closest(".inst-card")) {
    const m = $("#ctxMenu"); if (m) m.classList.remove("show");
  }
});

function handleInstanceAction(act, inst) {
  switch (act) {
    case "launch": launchInstance(inst); break;
    case "edit": toast("Instance settings would open here (demo)", "ok"); break;
    case "changeGroup": changeInstanceGroup(inst); break;
    case "folder": toast(`Instance folder: instances/${esc(inst.name)}`, "ok"); break;
    case "copy": copyInstance(inst); break;
    case "delete": deleteInstance(inst); break;
    case "shortcut": toast("Shortcut creation is a demo feature", "ok"); break;
  }
}

function changeInstanceGroup(inst) {
  const g = prompt("Enter new group for '" + inst.name + "':", inst.group || "No group");
  if (g != null) { inst.group = g.trim() || "No group"; renderInstances(); toast("Moved to group: " + inst.group, "ok"); }
}
function copyInstance(inst) {
  const copy = JSON.parse(JSON.stringify(inst));
  copy.id = State.nextInstanceId++;
  copy.name = inst.name + " (copy)";
  State.instances.push(copy);
  renderInstances(); toast("Instance copied", "ok");
}
function deleteInstance(inst) {
  if (!confirm("Delete instance '" + inst.name + "'? This cannot be undone.")) return;
  State.instances = State.instances.filter(i => i.id !== inst.id);
  if (State.selectedInstanceId === inst.id) State.selectedInstanceId = null;
  renderInstances(); updateActionButtons(); toast("Instance deleted", "ok");
}

/* ---------- Toolbar / action buttons ---------- */
function handleAction(act) {
  const inst = State.instances.find(i => i.id === State.selectedInstanceId) || null;
  handleInstanceAction(act, inst);
}

/* ============================================================
   Add Instance Dialog
   ============================================================ */
function openAddDialog() {
  State.addDialog.activeTab = "custom";
  State.addDialog.selectedVersion = null;
  State.addDialog.selectedLoader = "None";
  State.addDialog.search = "";
  State.addDialog.name = "";
  State.addDialog.group = "No group";
  State.addDialog.filters = { release: true, snapshot: false, beta: false, alpha: false, experiment: false, custom: true };
  rebuildCustomVersionMap();
  $("#addNameInput").value = "";
  $("#addGroupInput").value = "No group";
  $("#versionSearch").value = "";
  $("#customUrlInput").value = "";
  $$(".add-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === "custom"));
  $$(".add-pane").forEach(p => p.classList.toggle("active", p.dataset.pane === "custom"));
  $$(".loader-opt").forEach(o => o.classList.toggle("selected", o.dataset.loader === "None"));
  $$(".filter-opt input").forEach(cb => { cb.checked = !!State.addDialog.filters[cb.dataset.filter]; });
  renderVersionTable();
  $("#addOverlay").classList.add("show");
}
function closeAddDialog() { $("#addOverlay").classList.remove("show"); }

function switchAddTab(tab) {
  State.addDialog.activeTab = tab;
  $$(".add-tab").forEach(t => t.classList.toggle("active", t.dataset.tab === tab));
  $$(".add-pane").forEach(p => p.classList.toggle("active", p.dataset.pane === tab));
  // When opening the Resource Packs tab inside the add dialog, render the list
  // and sync its search box so it isn't stale.
  if (tab === "resourcepacks") {
    const addSearch = $("#rpSearchInputAdd");
    if (addSearch) addSearch.value = State.rpDialog.search;
    renderResourcePacksAll();
  }
}

/* Combined version list = built-in + custom */
function allVersions() {
  const custom = Object.keys(State.addDialog.customVersionMap).map(v => ({
    version: v, released: "—", type: "custom",
  }));
  return [...BUILTIN_VERSIONS, ...custom];
}

function filteredVersions() {
  const f = State.addDialog.filters;
  const q = State.addDialog.search.trim().toLowerCase();
  return allVersions().filter(v => {
    if (!f[v.type]) return false;
    if (q && !v.version.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderVersionTable() {
  const tbody = $("#versionTbody");
  const rows = filteredVersions();
  tbody.innerHTML = "";
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-faint);padding:24px">No versions match the current filters.</td></tr>`;
    return;
  }
  rows.forEach(v => {
    const tr = document.createElement("tr");
    tr.dataset.version = v.version;
    tr.className = v.version === State.addDialog.selectedVersion ? "selected" : "";
    tr.innerHTML = `
      <td>${esc(v.version)}</td>
      <td style="color:var(--text-dim)">${esc(v.released)}</td>
      <td><span class="badge ${v.type}">${v.type}</span></td>`;
    tr.addEventListener("click", () => {
      State.addDialog.selectedVersion = v.version;
      // auto-name if empty
      if (!State.addDialog.name) {
        const base = v.version;
        State.addDialog.name = base;
        $("#addNameInput").value = base;
      }
      renderVersionTable();
    });
    tbody.appendChild(tr);
  });
}

function addCustomVersionFromInput() {
  const input = $("#customUrlInput");
  let url = input.value.trim();
  if (!url) { toast("Enter a jsdelivr (or any) URL first.", "err"); return; }
  if (!/^https?:\/\//i.test(url)) { toast("URL must start with http(s)://", "err"); return; }
  // Derive a version label from the URL path
  let label = url.split("/").pop() || "Custom Version";
  label = label.replace(/\.(html?|php)$/i, "") || "Custom Version";
  // Ensure uniqueness
  let base = label, n = 1;
  while (State.addDialog.customVersionMap[label] && State.addDialog.customVersionMap[label] !== url) {
    label = base + " (" + (++n) + ")";
  }
  State.addDialog.customVersionMap[label] = url;
  // make sure custom filter is on
  State.addDialog.filters.custom = true;
  const cb = $$(`input[data-filter="custom"]`)[0]; if (cb) cb.checked = true;
  renderVersionTable();
  toast("Added version: " + label, "ok");
  input.value = "";
  // auto-select it for convenience
  State.addDialog.selectedVersion = label;
  if (!State.addDialog.name) { State.addDialog.name = label; $("#addNameInput").value = label; }
  renderVersionTable();
}

function confirmAddInstance() {
  const name = $("#addNameInput").value.trim();
  const group = $("#addGroupInput").value.trim() || "No group";
  const ver = State.addDialog.selectedVersion;
  if (!ver) { toast("Select a version from the list first.", "err"); return; }
  if (!name) { toast("Enter a name for the instance.", "err"); return; }

  const customUrl = State.addDialog.customVersionMap[ver] || null;
  const inst = {
    id: State.nextInstanceId++,
    name,
    group,
    version: ver,
    versionType: allVersions().find(v => v.version === ver)?.type || "release",
    url: customUrl,
    loader: State.addDialog.selectedLoader,
    icon: "assets/instance-default.png",
  };
  State.instances.push(inst);
  State.selectedInstanceId = inst.id;
  renderInstances();
  updateActionButtons();
  closeAddDialog();
  toast(`Instance "${name}" created (${ver})`, "ok");
}

/* ============================================================
   Launch — loads the jsdelivr URL so it runs like a real HTML page
   ============================================================

   Why we don't just set iframe.src = url:
     jsdelivr serves .html files with Content-Type: text/plain, so the
     browser shows the raw source as text instead of running it. Also,
     many hosted game HTML files (e.g. Eaglercraft offline builds) work
     best when served as real HTML documents with relative asset paths
     resolved against the original URL.

   Strategy:
     1. Fetch the HTML text from the URL (jsdelivr sends permissive CORS
        headers — access-control-allow-origin: * — so this works).
     2. Inject a <base> tag pointing at the original URL so any relative
        resource references (./assets/…, epk files, worker scripts, etc.)
        resolve against the original jsdelivr location.
     3. Wrap the HTML in a Blob with type text/html and load that blob
        URL into the iframe. The browser now parses & runs it as a real
        webpage.

   Fallbacks:
     • If the fetch is blocked by CORS, we retry by loading the URL
       directly in the iframe (works when the host allows framing and
       serves real HTML).
     • If even that fails, we offer an "Open in new tab" button so the
       page runs in a full top-level context.
   ============================================================ */
async function launchInstance(inst) {
  if (!inst) return;
  if (!inst.url) {
    toast(`"${inst.version}" is a built-in Minecraft version — no jsdelivr URL attached. Add a jsdelivr version to load a real HTML game.`, "err", 5000);
    return;
  }

  const overlay   = $("#launchOverlay");
  const loading   = $("#launchLoading");
  const errorBox  = $("#launchError");
  const errorMsg  = $("#launchErrorMsg");
  const iframe    = $("#launchFrame");
  const title     = $("#launchName");
  const urlLabel  = $("#launchUrl");

  title.textContent  = inst.name + "  —  " + inst.version;
  urlLabel.textContent = inst.url;
  errorBox.classList.remove("show");
  loading.style.display = "flex";
  // reset iframe
  iframe.src = "about:blank";
  overlay.classList.add("show");

  const setLoadingText = (t) => { const el = $("#launchLoadingText"); if (el) el.textContent = t; };

  try {
    setLoadingText("Fetching game files…");
    const resp = await fetch(inst.url, { mode: "cors" });
    if (!resp.ok) throw new Error("HTTP " + resp.status + " " + resp.statusText);
    let html = await resp.text();

    if (!html || html.length < 16) throw new Error("Received empty response.");

    // Inject a <base> so relative URLs in the HTML resolve against the
    // original jsdelivr location (important for game asset / worker paths).
    html = injectBaseTag(html, inst.url);

    // Serve as a real HTML document via a Blob URL.
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const blobUrl = URL.createObjectURL(blob);

    setLoadingText("Starting…");
    iframe.src = blobUrl;

    // Clean up the blob URL once the iframe has loaded it.
    iframe.addEventListener("load", () => {
      loading.style.display = "none";
      // revoke after a short delay so sub-resources can still resolve via base
      setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch(e){} }, 60000);
    }, { once: true });

    // Safety: hide spinner after a while even if load is slow
    setTimeout(() => { loading.style.display = "none"; }, 4000);

  } catch (err) {
    // CORS or network blocked the fetch — fall back to a direct iframe load.
    setLoadingText("Trying direct load…");
    iframe.src = inst.url;
    iframe.addEventListener("load", () => { loading.style.display = "none"; }, { once: true });
    setTimeout(() => { loading.style.display = "none"; }, 4000);

    // Show a non-blocking hint + an "open in new tab" option, since direct
    // loads of text/plain HTML or X-Frame-Option-blocked pages may render
    // as raw text or stay blank.
    if (errorMsg) errorMsg.textContent = "Couldn't fetch & re-serve the page (" + err.message + "). It's loading directly instead — if it appears as raw text or stays blank, open it in a new tab.";
    errorBox.classList.add("show");
    setupErrorOpenTab(inst.url);
  }
}

/* Insert a <base href="..."> into <head> (or at the very top) so relative
   URLs inside the fetched HTML resolve against the original file's location. */
function injectBaseTag(html, baseUrl) {
  const baseTag = '<base href="' + baseUrl.replace(/"/g, "&quot;") + '">';
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, m => m + baseTag);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, m => m + baseTag);
  }
  return baseTag + html;
}

/* Wire the error box's "Open in new tab" action. */
function setupErrorOpenTab(url) {
  const btn = $("#launchErrorOpenTab");
  if (!btn) return;
  // replace node to clear old listeners
  const fresh = btn.cloneNode(true);
  btn.parentNode.replaceChild(fresh, btn);
  fresh.id = "launchErrorOpenTab";
  fresh.addEventListener("click", () => {
    window.open(url, "_blank", "noopener");
  });
}
function closeLaunch() {
  const overlay = $("#launchOverlay");
  const iframe = $("#launchFrame");
  iframe.src = "about:blank";
  overlay.classList.remove("show");
  $("#launchLoading").style.display = "flex";
  $("#launchError").classList.remove("show");
}

/* ============================================================
   Resource Packs dialog
   ============================================================ */
function openResourceDialog() {
  State.rpDialog.selectedFolder = null;
  State.rpDialog.search = "";
  $("#rpSearchInput").value = "";
  renderResourcePacksAll();
  $("#rpDownloadBtn").disabled = true;
  $("#rpSelectedInfo").textContent = "No resource pack selected.";
  $("#resourceOverlay").classList.add("show");
}
function closeResourceDialog() { $("#resourceOverlay").classList.remove("show"); }

/* Render the resource pack list into every container that exists.
   This covers BOTH the standalone Resource Packs dialog (#rpList)
   and the in-add-dialog Resource Packs tab (#rpListAdd). */
function renderResourcePacksAll() {
  const q = State.rpDialog.search.trim().toLowerCase();
  const packs = RESOURCE_PACKS.filter(p =>
    !q || p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || (p.author||"").toLowerCase().includes(q)
  );

  const html = (() => {
    if (packs.length === 0) {
      return `<div style="text-align:center;color:var(--text-faint);padding:30px">No resource packs match your search.</div>`;
    }
    return packs.map(p => {
      const selected = p.folder === State.rpDialog.selectedFolder ? " selected" : "";
      const candidates = resolvePackIcon(p.folder);
      let imgAttrs = `src="${esc(candidates[0])}" `;
      let onerror = candidates.slice(1).map(u => `this.onerror=null;this.src='${u.replace(/'/g,"\\'")}'`).join(";")
        + `;this.onerror=null;this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2256%22 height=%2256%22><rect width=%2256%22 height=%2256%22 fill=%22%23444%22/><text x=%2250%25%22 y=%2255%25%22 font-size=%2222%22 fill=%22%23ddd%22 text-anchor=%22middle%22>${esc((p.name||"?").charAt(0))}</text></svg>'`;
      imgAttrs += `onerror="${onerror.replace(/"/g,"&quot;")}"`;
      return `<div class="rp-card${selected}" data-folder="${esc(p.folder)}">
        <img class="rp-icon" ${imgAttrs} alt="">
        <div class="rp-info">
          <div class="rp-name">${esc(p.name)}</div>
          <div class="rp-desc">${esc(p.description)}</div>
          <div class="rp-meta">by ${esc(p.author || "Unknown")} • Minecraft ${esc(p.mcVersion || "—")}</div>
        </div>
      </div>`;
    }).join("");
  })();

  ["#rpList", "#rpListAdd"].forEach(sel => {
    const list = $(sel);
    if (!list) return;
    list.innerHTML = html;
    $$(".rp-card", list).forEach(card => {
      card.addEventListener("click", () => {
        State.rpDialog.selectedFolder = card.dataset.folder;
        renderResourcePacksAll();
        const dl = $("#rpDownloadBtn"); if (dl) dl.disabled = false;
        const info = $("#rpSelectedInfo"); if (info) info.textContent = "Selected: " + (RESOURCE_PACKS.find(p => p.folder === card.dataset.folder)||{}).name;
      });
    });
  });
}

/* keep legacy name for safety */
const renderResourcePacks = renderResourcePacksAll;

function downloadSelectedPack() {
  const folder = State.rpDialog.selectedFolder;
  const pack = RESOURCE_PACKS.find(p => p.folder === folder);
  if (!pack) { toast("Select a resource pack first.", "err"); return; }
  if (!pack.downloadUrl) { toast("This pack has no download URL configured.", "err"); return; }
  // Actually trigger a real file download in the browser
  const a = document.createElement("a");
  a.href = pack.downloadUrl;
  // Derive a filename
  let fname = pack.downloadUrl.split("/").pop() || (pack.name.replace(/\s+/g,"_") + ".zip");
  a.download = fname;
  a.rel = "noopener";
  a.target = "_blank"; // helps with cross-origin; download attr still attempts save
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  toast("Downloading: " + fname, "ok", 4000);
}

/* ============================================================
   Wiring up the DOM on load
   ============================================================ */
function init() {
  rebuildCustomVersionMap();

  // Toolbar
  $("#btnAddInstance").addEventListener("click", openAddDialog);
  $("#btnResourcePacks").addEventListener("click", openResourceDialog);
  $("#btnFolders").addEventListener("click", () => toast("Folders view is a demo feature", "ok"));
  $("#btnSettings").addEventListener("click", () => toast("Settings is a demo feature", "ok"));
  $("#btnHelp").addEventListener("click", () => toast("Prism Launcher Web Clone — demo build", "ok"));

  // Action sidebar
  $("#actLaunch").addEventListener("click", () => handleAction("launch"));
  $("#actEdit").addEventListener("click", () => handleAction("edit"));
  $("#actChangeGroup").addEventListener("click", () => handleAction("changeGroup"));
  $("#actFolder").addEventListener("click", () => handleAction("folder"));
  $("#actExport").addEventListener("click", () => toast("Export is a demo feature", "ok"));
  $("#actCopy").addEventListener("click", () => handleAction("copy"));
  $("#actDelete").addEventListener("click", () => handleAction("delete"));
  $("#actShortcut").addEventListener("click", () => handleAction("shortcut"));

  // Add dialog tabs
  $$(".add-tab[data-tab]").forEach(t => t.addEventListener("click", () => switchAddTab(t.dataset.tab)));

  // Add dialog name/group
  $("#addNameInput").addEventListener("input", e => State.addDialog.name = e.target.value);
  $("#addGroupInput").addEventListener("input", e => State.addDialog.group = e.target.value);

  // Version search
  $("#versionSearch").addEventListener("input", e => { State.addDialog.search = e.target.value; renderVersionTable(); });

  // Filters
  $$(".filter-opt input").forEach(cb => cb.addEventListener("change", () => {
    State.addDialog.filters[cb.dataset.filter] = cb.checked;
    renderVersionTable();
  }));

  // Mod loaders
  $$(".loader-opt").forEach(o => o.addEventListener("click", () => {
    State.addDialog.selectedLoader = o.dataset.loader;
    $$(".loader-opt").forEach(x => x.classList.toggle("selected", x === o));
  }));

  // jsdelivr add-version
  $("#customAddBtn").addEventListener("click", addCustomVersionFromInput);
  $("#customUrlInput").addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); addCustomVersionFromInput(); } });

  // Add dialog buttons
  $("#addRefreshBtn").addEventListener("click", () => { renderVersionTable(); toast("Version list refreshed", "ok"); });
  $("#addCancelBtn").addEventListener("click", closeAddDialog);
  $("#addOkBtn").addEventListener("click", confirmAddInstance);
  $("#addHelpLink").addEventListener("click", () => toast("Pick a version on the left, then click OK.", "ok"));
  $("#addDialogClose").addEventListener("click", closeAddDialog);

  // Resource packs
  $("#rpSearchInput").addEventListener("input", e => { State.rpDialog.search = e.target.value; renderResourcePacksAll(); });
  const addSearch = $("#rpSearchInputAdd");
  if (addSearch) addSearch.addEventListener("input", e => { State.rpDialog.search = e.target.value; renderResourcePacksAll(); });
  $("#rpDownloadBtn").addEventListener("click", downloadSelectedPack);
  $("#rpCancelBtn").addEventListener("click", closeResourceDialog);
  $("#rpDialogClose").addEventListener("click", closeResourceDialog);

  // Launch overlay
  $("#launchBackBtn").addEventListener("click", closeLaunch);
  const errBack = $("#launchErrorBack");
  if (errBack) errBack.addEventListener("click", closeLaunch);

  // Window control buttons (cosmetic)
  $$(".win-btn.min").forEach(b => b.addEventListener("click", () => toast("Minimize (demo)", "ok")));
  $$(".win-btn.max").forEach(b => b.addEventListener("click", () => toast("Maximize (demo)", "ok")));
  $$(".win-btn.close").forEach(b => b.addEventListener("click", () => toast("Close (demo) — refresh to reset", "ok")));

  // Escape closes dialogs / launch
  document.addEventListener("keydown", e => {
    if (e.key === "Escape") {
      if ($("#launchOverlay").classList.contains("show")) closeLaunch();
      else if ($("#addOverlay").classList.contains("show")) closeAddDialog();
      else if ($("#resourceOverlay").classList.contains("show")) closeResourceDialog();
    }
  });

  // Seed one demo instance so the window isn't empty
  State.instances.push({
    id: State.nextInstanceId++,
    name: "Eaglercraft",
    group: "No group",
    version: "1.8.8",
    versionType: "release",
    url: "https://cdn.jsdelivr.net/gh/v10letfur/Eaglercraft-X-1.8.8/EaglercraftX_1.8_u53_Offline_Signed.html",
    loader: "curseforge",
    icon: "assets/instance-default.png",
  });

  renderInstances();
  updateActionButtons();
  updateClock();
}

function updateClock() {
  const el = $("#statusPlaytime");
  if (el) el.textContent = "Total playtime: " + (State.playtime > 0 ? State.playtime + "s" : "0s");
}

document.addEventListener("DOMContentLoaded", init);
