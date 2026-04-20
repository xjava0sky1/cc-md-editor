import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { open as openDialog, save as saveDialog, ask } from "@tauri-apps/plugin-dialog";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "@joplin/turndown-plugin-gfm";
import DOMPurify from "dompurify";

const editor = document.getElementById("editor");
const preview = document.getElementById("preview");
const statWords = document.getElementById("stat-words");
const statChars = document.getElementById("stat-chars");
const statLines = document.getElementById("stat-lines");
const statPath = document.getElementById("stat-path");
const appWindow = getCurrentWindow();
const appWebview = getCurrentWebview();

marked.setOptions({ gfm: true, breaks: false });

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});
turndown.use(gfm);

const tabbar = document.getElementById("tabbar");

let tabs = [];
let activeTabId = null;
let nextTabId = 1;

function activeTab() {
  return tabs.find((t) => t.id === activeTabId) ?? null;
}

function basename(p) {
  if (!p) return "Untitled";
  const parts = p.split("/");
  return parts[parts.length - 1] || p;
}

function tabLabel(tab) {
  return tab.path ? basename(tab.path) : "Untitled";
}

function refreshTitle() {
  const t = activeTab();
  const name = t ? tabLabel(t) : "Untitled";
  const bullet = t && t.dirty ? "• " : "";
  appWindow.setTitle(`${bullet}${name} — MD Editor`);
}

function setDirty(flag) {
  const t = activeTab();
  if (!t || t.dirty === flag) return;
  t.dirty = flag;
  refreshTitle();
  renderTabs();
}

function renderPreview() {
  preview.innerHTML = DOMPurify.sanitize(marked.parse(editor.value || ""));
}

function updateStats() {
  const text = editor.value;
  statChars.textContent = text.length;
  statLines.textContent = text.split("\n").length;
  statWords.textContent = text.match(/\S+/g)?.length ?? 0;
}

const TABS_KEY = "mdeditor.openTabs";

function persistTabs() {
  try {
    const paths = tabs.map((t) => t.path).filter(Boolean);
    const active = activeTab();
    localStorage.setItem(
      TABS_KEY,
      JSON.stringify({ paths, activePath: active?.path ?? null })
    );
  } catch {}
}

function saveEditorStateToTab(tab) {
  if (!tab) return;
  tab.content = editor.value;
  tab.scrollTop = editor.scrollTop;
  tab.selStart = editor.selectionStart;
  tab.selEnd = editor.selectionEnd;
}

function loadTabToEditor(tab) {
  editor.value = tab.content;
  renderPreview();
  updateStats();
  try {
    editor.setSelectionRange(tab.selStart ?? 0, tab.selEnd ?? 0);
  } catch {}
  editor.scrollTop = tab.scrollTop ?? 0;
  statPath.textContent = tab.path ?? "";
  refreshTitle();
}

function createTab({ path = null, content = "" } = {}) {
  const tab = {
    id: nextTabId++,
    path,
    content,
    dirty: false,
    scrollTop: 0,
    selStart: 0,
    selEnd: 0,
  };
  tabs.push(tab);
  return tab;
}

function switchToTab(id) {
  if (id === activeTabId) return;
  saveEditorStateToTab(activeTab());
  activeTabId = id;
  const t = activeTab();
  if (t) loadTabToEditor(t);
  renderTabs();
}

let dragTabId = null;

function clearDropMarkers() {
  tabbar.querySelectorAll(".tab.drop-before, .tab.drop-after").forEach((el) => {
    el.classList.remove("drop-before", "drop-after");
  });
}

function reorderTab(sourceId, targetId, placeAfter) {
  if (sourceId === targetId) return;
  const from = tabs.findIndex((t) => t.id === sourceId);
  if (from === -1) return;
  const [moved] = tabs.splice(from, 1);
  let to = tabs.findIndex((t) => t.id === targetId);
  if (to === -1) {
    tabs.splice(from, 0, moved);
    return;
  }
  if (placeAfter) to += 1;
  tabs.splice(to, 0, moved);
  renderTabs();
  persistTabs();
}

function renderTabs() {
  tabbar.innerHTML = "";
  for (const t of tabs) {
    const el = document.createElement("div");
    el.className = "tab" + (t.id === activeTabId ? " active" : "") + (t.dirty ? " dirty" : "");
    el.setAttribute("role", "tab");
    el.draggable = true;
    el.dataset.tabId = String(t.id);
    el.title = t.path ?? "Untitled";

    const name = document.createElement("span");
    name.className = "tab-name";
    name.textContent = tabLabel(t);
    el.appendChild(name);

    const close = document.createElement("button");
    close.className = "tab-close";
    close.textContent = "×";
    close.title = "Close (⌘W)";
    close.draggable = false;
    close.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(t.id);
    });
    close.addEventListener("mousedown", (e) => e.stopPropagation());
    el.appendChild(close);

    el.addEventListener("click", () => switchToTab(t.id));
    el.addEventListener("mousedown", (e) => {
      if (e.button === 1) {
        e.preventDefault();
        closeTab(t.id);
      }
    });

    el.addEventListener("dragstart", (e) => {
      dragTabId = t.id;
      el.classList.add("dragging");
      try {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(t.id));
      } catch {}
    });
    el.addEventListener("dragend", () => {
      el.classList.remove("dragging");
      clearDropMarkers();
      dragTabId = null;
    });
    el.addEventListener("dragover", (e) => {
      if (dragTabId === null || dragTabId === t.id) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      const rect = el.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      clearDropMarkers();
      el.classList.add(after ? "drop-after" : "drop-before");
    });
    el.addEventListener("dragleave", () => {
      el.classList.remove("drop-before", "drop-after");
    });
    el.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragTabId === null || dragTabId === t.id) return;
      const rect = el.getBoundingClientRect();
      const after = e.clientX > rect.left + rect.width / 2;
      const src = dragTabId;
      clearDropMarkers();
      reorderTab(src, t.id, after);
    });

    tabbar.appendChild(el);
  }

  const add = document.createElement("button");
  add.className = "tab-new";
  add.textContent = "+";
  add.title = "New tab (⌘T)";
  add.addEventListener("click", () => newTab());
  tabbar.appendChild(add);
}

function newTab() {
  saveEditorStateToTab(activeTab());
  const t = createTab();
  activeTabId = t.id;
  loadTabToEditor(t);
  renderTabs();
  persistTabs();
  editor.focus();
}

async function openFile(path, { silent = false } = {}) {
  const existing = tabs.find((t) => t.path === path);
  if (existing) {
    switchToTab(existing.id);
    return true;
  }
  try {
    const contents = await invoke("read_md_file", { path });
    saveEditorStateToTab(activeTab());
    const tab = createTab({ path, content: contents });
    activeTabId = tab.id;
    loadTabToEditor(tab);
    renderTabs();
    persistTabs();
    return true;
  } catch (e) {
    console.error("Failed to open file:", e);
    if (!silent) alert(`Failed to open file:\n${e}`);
    return false;
  }
}

async function saveFile(saveAs = false) {
  const t = activeTab();
  if (!t) return;
  try {
    let target = t.path;
    if (!target || saveAs) {
      const picked = await saveDialog({
        defaultPath: t.path ?? "Untitled.md",
        filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
      });
      if (!picked) return;
      target = picked;
    }
    await invoke("write_md_file", { path: target, contents: editor.value });
    t.path = target;
    t.content = editor.value;
    t.dirty = false;
    statPath.textContent = target;
    refreshTitle();
    renderTabs();
    persistTabs();
  } catch (e) {
    console.error("Failed to save file:", e);
    alert(`Failed to save file:\n${e}`);
  }
}

async function confirmDiscard(tab) {
  if (!tab.dirty) return true;
  return await ask(`Discard unsaved changes to ${tabLabel(tab)}?`, {
    title: "Unsaved changes",
    kind: "warning",
    okLabel: "Discard",
    cancelLabel: "Cancel",
  });
}

async function requestOpenFile(path) {
  await openFile(path);
}

async function openViaDialog() {
  try {
    const picked = await openDialog({
      multiple: true,
      directory: false,
      filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
    });
    if (!picked) return;
    const list = Array.isArray(picked) ? picked : [picked];
    for (const item of list) {
      const path = typeof item === "string" ? item : item.path ?? item;
      if (path) await openFile(path);
    }
  } catch (e) {
    console.error("Open dialog failed:", e);
  }
}

function wrap(before, after = before, placeholder = "") {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const selected = editor.value.slice(start, end);
  const inner = selected || placeholder;
  const text = before + inner + after;
  editor.setRangeText(text, start, end, "end");
  if (selected) {
    editor.selectionStart = start + before.length;
    editor.selectionEnd = start + before.length + inner.length;
  } else {
    const caret = start + before.length + placeholder.length;
    editor.selectionStart = caret;
    editor.selectionEnd = caret;
  }
  editor.focus();
  editor.dispatchEvent(new Event("input"));
}

function linePrefix(prefix) {
  const value = editor.value;
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd === -1) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const newBlock = block
    .split("\n")
    .map((l) => prefix + l)
    .join("\n");
  editor.setRangeText(newBlock, lineStart, lineEnd, "end");
  editor.selectionStart = lineStart;
  editor.selectionEnd = lineStart + newBlock.length;
  editor.focus();
  editor.dispatchEvent(new Event("input"));
}

function insertBlock(text) {
  const start = editor.selectionStart;
  const end = editor.selectionEnd;
  const value = editor.value;
  const atLineStart = start === 0 || value[start - 1] === "\n";
  const prefix = atLineStart ? "" : "\n\n";
  const suffix = value[end] === "\n" || end === value.length ? "\n" : "\n\n";
  const insert = prefix + text + suffix;
  editor.setRangeText(insert, start, end, "end");
  editor.focus();
  editor.dispatchEvent(new Event("input"));
}

const ACTIONS = {
  h1: () => linePrefix("# "),
  h2: () => linePrefix("## "),
  h3: () => linePrefix("### "),
  bold: () => wrap("**", "**", "bold"),
  italic: () => wrap("*", "*", "italic"),
  code: () => wrap("`", "`", "code"),
  link: () => {
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const selected = editor.value.slice(start, end) || "text";
    const text = `[${selected}](url)`;
    editor.setRangeText(text, start, end, "end");
    const urlStart = start + selected.length + 3;
    editor.selectionStart = urlStart;
    editor.selectionEnd = urlStart + 3;
    editor.focus();
    editor.dispatchEvent(new Event("input"));
  },
  list: () => linePrefix("- "),
  quote: () => linePrefix("> "),
  table: () =>
    insertBlock("| Header | Header |\n|--------|--------|\n| Cell   | Cell   |"),
  hr: () => insertBlock("---"),
};

document.querySelectorAll("[data-action]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const action = btn.dataset.action;
    const fn = ACTIONS[action];
    if (fn) fn();
  });
});

document.getElementById("btn-open").addEventListener("click", openViaDialog);
document.getElementById("btn-save").addEventListener("click", () => saveFile(false));
document.getElementById("btn-close").addEventListener("click", () => {
  const t = activeTab();
  if (t) closeTab(t.id);
});

async function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;
  const tab = tabs[idx];
  if (id === activeTabId) saveEditorStateToTab(tab);
  if (!(await confirmDiscard(tab))) return;
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    if (tabs.length === 0) {
      const fresh = createTab();
      activeTabId = fresh.id;
      loadTabToEditor(fresh);
    } else {
      const next = tabs[Math.min(idx, tabs.length - 1)];
      activeTabId = next.id;
      loadTabToEditor(next);
    }
  }
  renderTabs();
  persistTabs();
  editor.focus();
}

editor.addEventListener("input", () => {
  renderPreview();
  updateStats();
  setDirty(true);
});

let previewSyncTimer = null;
let previewDirty = false;

function syncPreviewToEditor() {
  try {
    const md = turndown.turndown(preview.innerHTML);
    const scrollTop = editor.scrollTop;
    editor.value = md;
    editor.scrollTop = scrollTop;
    previewDirty = false;
    updateStats();
    setDirty(true);
  } catch (e) {
    console.error("Turndown failed:", e);
  }
}

preview.addEventListener("input", () => {
  previewDirty = true;
  clearTimeout(previewSyncTimer);
  previewSyncTimer = setTimeout(syncPreviewToEditor, 150);
});

preview.addEventListener("paste", (e) => {
  e.preventDefault();
  const text = e.clipboardData?.getData("text/plain") ?? "";
  document.execCommand("insertText", false, text);
});

preview.addEventListener("blur", () => {
  clearTimeout(previewSyncTimer);
  if (previewDirty) {
    syncPreviewToEditor();
    renderPreview();
  }
});

document.addEventListener("keydown", (e) => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  const k = e.key.toLowerCase();
  if (k === "o") { e.preventDefault(); openViaDialog(); }
  else if (k === "s" && e.shiftKey) { e.preventDefault(); saveFile(true); }
  else if (k === "s") { e.preventDefault(); saveFile(false); }
  else if (k === "f") { e.preventDefault(); openFindBar(); }
  else if (k === "t") { e.preventDefault(); newTab(); }
  else if (k === "w") {
    e.preventDefault();
    const t = activeTab();
    if (t) closeTab(t.id);
  }
  else if (k === "tab") {
    e.preventDefault();
    cycleTab(e.shiftKey ? -1 : 1);
  }
  else if (/^[1-9]$/.test(e.key)) {
    e.preventDefault();
    const n = parseInt(e.key, 10) - 1;
    if (tabs[n]) switchToTab(tabs[n].id);
  }
  else if (k === "=" || k === "+") { e.preventDefault(); setZoom(zoomLevel + ZOOM_STEP); }
  else if (k === "-") { e.preventDefault(); setZoom(zoomLevel - ZOOM_STEP); }
  else if (k === "0") { e.preventDefault(); setZoom(1.0); }
  else if (k === "b") { e.preventDefault(); ACTIONS.bold(); }
  else if (k === "i") { e.preventDefault(); ACTIONS.italic(); }
  else if (k === "k") { e.preventDefault(); ACTIONS.link(); }
});

function cycleTab(delta) {
  if (tabs.length < 2) return;
  const idx = tabs.findIndex((t) => t.id === activeTabId);
  const next = tabs[(idx + delta + tabs.length) % tabs.length];
  switchToTab(next.id);
}

const findBar = document.getElementById("find-bar");
const findInput = document.getElementById("find-input");
const findCount = document.getElementById("find-count");
const findPrev = document.getElementById("find-prev");
const findNext = document.getElementById("find-next");
const findClose = document.getElementById("find-close");

let findMatches = [];
let findIndex = -1;

function computeMatches(query) {
  findMatches = [];
  if (!query) return;
  const haystack = editor.value.toLowerCase();
  const needle = query.toLowerCase();
  let idx = 0;
  while (idx <= haystack.length) {
    const pos = haystack.indexOf(needle, idx);
    if (pos === -1) break;
    findMatches.push(pos);
    idx = pos + needle.length;
  }
}

function renderFindCount() {
  const n = findMatches.length;
  const hasQuery = findInput.value.length > 0;
  findCount.textContent = n === 0
    ? (hasQuery ? "0/0" : "")
    : `${findIndex + 1}/${n}`;
  findCount.classList.toggle("no-match", hasQuery && n === 0);
  findPrev.disabled = n < 2;
  findNext.disabled = n < 2;
}

let editorMetrics = null;
function getEditorMetrics() {
  if (!editorMetrics) {
    const s = getComputedStyle(editor);
    editorMetrics = {
      lineHeight: parseFloat(s.lineHeight) || 20,
      padTop: parseFloat(s.paddingTop) || 0,
    };
  }
  return editorMetrics;
}

function scrollEditorToOffset(offset) {
  const { lineHeight, padTop } = getEditorMetrics();
  const line = editor.value.slice(0, offset).split("\n").length - 1;
  const target = padTop + line * lineHeight;
  const visibleTop = editor.scrollTop;
  const visibleBottom = visibleTop + editor.clientHeight;
  if (target < visibleTop + lineHeight * 2 || target > visibleBottom - lineHeight * 2) {
    editor.scrollTop = Math.max(0, target - editor.clientHeight / 2);
  }
}

function selectCurrentMatch() {
  if (findIndex < 0 || !findMatches.length) return;
  const pos = findMatches[findIndex];
  const len = findInput.value.length;
  editor.setSelectionRange(pos, pos + len);
  scrollEditorToOffset(pos);
}

function openFindBar() {
  findBar.classList.remove("hidden");
  const sel = editor.value.slice(editor.selectionStart, editor.selectionEnd);
  if (sel && sel.length < 80 && !sel.includes("\n")) findInput.value = sel;
  findInput.focus();
  findInput.select();
  updateFind();
}

function closeFindBar() {
  findBar.classList.add("hidden");
  findMatches = [];
  findIndex = -1;
  editor.focus();
}

function updateFind() {
  const q = findInput.value;
  computeMatches(q);
  if (findMatches.length === 0) {
    findIndex = -1;
  } else {
    const caret = editor.selectionStart;
    findIndex = findMatches.findIndex((p) => p >= caret);
    if (findIndex === -1) findIndex = 0;
  }
  renderFindCount();
  selectCurrentMatch();
}

function stepFind(delta) {
  if (!findMatches.length) return;
  findIndex = (findIndex + delta + findMatches.length) % findMatches.length;
  renderFindCount();
  selectCurrentMatch();
}

findInput.addEventListener("input", updateFind);
findInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") { e.preventDefault(); stepFind(e.shiftKey ? -1 : 1); }
  else if (e.key === "Escape") { e.preventDefault(); closeFindBar(); }
});
findPrev.addEventListener("click", () => stepFind(-1));
findNext.addEventListener("click", () => stepFind(1));
findClose.addEventListener("click", closeFindBar);

listen("open-file", (event) => {
  const path = event.payload;
  if (typeof path === "string" && path) requestOpenFile(path);
});

appWebview.onDragDropEvent((event) => {
  if (event.payload.type === "drop") {
    const paths = event.payload.paths || [];
    const md = paths.find((p) => /\.(md|markdown)$/i.test(p));
    if (md) requestOpenFile(md);
  }
});

const ZOOM_KEY = "mdeditor.zoom";
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3.0;
const ZOOM_STEP = 0.1;
let zoomLevel = 1.0;

function setZoom(level) {
  zoomLevel = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, level)) * 10) / 10;
  appWebview.setZoom(zoomLevel).catch((e) => console.error("setZoom failed:", e));
  editorMetrics = null;
  try { localStorage.setItem(ZOOM_KEY, String(zoomLevel)); } catch {}
}

const savedZoom = parseFloat(localStorage.getItem(ZOOM_KEY) ?? "1");
if (Number.isFinite(savedZoom) && savedZoom !== 1.0) setZoom(savedZoom);

function ensureAtLeastOneTab() {
  if (tabs.length === 0) {
    const t = createTab();
    activeTabId = t.id;
    loadTabToEditor(t);
  }
  renderTabs();
}

ensureAtLeastOneTab();
renderPreview();
updateStats();
refreshTitle();

function dropInitialBlankIfEmpty() {
  if (tabs.length === 1) {
    const only = tabs[0];
    if (!only.path && !only.dirty && (only.content ?? "") === "") {
      tabs = [];
      activeTabId = null;
    }
  }
}

async function restoreSession(initialPath) {
  if (typeof initialPath === "string" && initialPath) {
    dropInitialBlankIfEmpty();
    await openFile(initialPath);
    ensureAtLeastOneTab();
    return;
  }
  let saved = null;
  try {
    const raw = localStorage.getItem(TABS_KEY);
    if (raw) saved = JSON.parse(raw);
  } catch {}
  if (saved && Array.isArray(saved.paths) && saved.paths.length > 0) {
    dropInitialBlankIfEmpty();
    for (const p of saved.paths) {
      await openFile(p, { silent: true });
    }
    if (saved.activePath) {
      const match = tabs.find((t) => t.path === saved.activePath);
      if (match) switchToTab(match.id);
    }
  }
  ensureAtLeastOneTab();
  renderTabs();
  persistTabs();
}

invoke("take_initial_file")
  .then((path) => restoreSession(path))
  .catch(() => restoreSession(null));

