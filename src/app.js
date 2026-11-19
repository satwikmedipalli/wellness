'use strict';
/* Wellness — renderer. Plain JS, no build step.
   All data lives in one object (DB) saved through window.api (Electron)
   or localStorage when opened in a normal browser. */

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);
const pad = (n) => String(n).padStart(2, '0');
const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const todayKey = () => dkey(new Date());
const weekStart = (k) => { const d = parseKey(k); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return dkey(d); };
const monthKey = (k) => k.slice(0, 7);
const addMonths = (mk, n) => { const [y, m] = mk.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const shortDay = (k) => { const d = parseKey(k); return DOW[d.getDay()].slice(0, 3) + ' ' + d.getDate(); };
const longDate = (k) => { const d = parseKey(k); return MON[d.getMonth()] + ' ' + d.getDate(); };
const monthLabel = (mk) => { const [y, m] = mk.split('-').map(Number); return MON[m - 1] + ' ' + y; };
const mins = (hm) => { if (!hm) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const nowMins = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
function fmtTime(hm, withAp = true) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  const s = ((h + 11) % 12) + 1 + ':' + pad(m);
  return withAp ? s + ' ' + (h >= 12 ? 'PM' : 'AM') : s;
}
function fmtRange(b) {
  if (!b.start) return 'Any time';
  if (!b.end) return fmtTime(b.start);
  const ap1 = mins(b.start) >= 720 ? 'PM' : 'AM', ap2 = mins(b.end) >= 720 ? 'PM' : 'AM';
  return ap1 === ap2 ? fmtTime(b.start, false) + '–' + fmtTime(b.end) : fmtTime(b.start) + '–' + fmtTime(b.end);
}
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
const money = (n) => (n < 0 ? '−' : '') + (DB.settings.currency || '$') + Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const sortBlocks = (bl) => bl.sort((a, b) => (mins(a.start) ?? 1e9) - (mins(b.start) ?? 1e9));
const PLAN_COLORS = ['#5B8A63', '#C9A227', '#3E7795', '#B5654A', '#8A6BAE', '#7C8B4E', '#C2557A', '#4F8C8C'];

const ICON = {
  today: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
  week: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  plans: '<path d="M4 6h16M4 12h16M4 18h10"/>',
  log: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
  health: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/>',
  spending: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M2 10h20M16 15h2"/>',
  summary: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  left: '<path d="M15 18l-6-6 6-6"/>',
  right: '<path d="M9 18l6-6-6-6"/>',
  check: '<path d="M5 12l5 5L20 7"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  x: '<path d="M18 6L6 18M6 6l12 12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>'
};
const ic = (n, s = 16, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ---------- data ----------
function defaults() {
  const F = (name, serving, cal, f, c, fib, p, note) => ({ id: uid(), name, serving, cal, f, c, fib, p, note: note || '' });
  return {
    version: 1,
    settings: { proteinTarget: 70, fiberTarget: 20, currency: '$', bodyKg: 68 },
    choiceLists: [{ id: 'free', name: 'Free time', options: ['Sleep', 'PS5', 'Movie', 'Show', 'Stock research', 'Talk to someone', 'Work', 'Project'], distinct: true }],
    plans: [],
    days: {},
    foodLibrary: [
      F('Everything Bagel', '1 bagel', 260, 4.5, 46, 4, 9),
      F('Non-fat Greek Yogurt', '170 g', 100, 0, 7, 0, 17),
      F('Philadelphia Cream Cheese', '30 g', 80, 7, 2, 0, 2),
      F('Chilli Oil', '15 g', 120, 13, 1, 0, 0, 'estimate'),
      F("Wendy's Chicken Nuggets", '10 pc', 550, 31, 43, 2, 26),
      F("Wendy's Crispy Chicken Sandwich", '1 sandwich', 340, 17, 32, 1, 15),
      F('Roti', '1 roti', 70, 1.5, 12, 0, 2),
      F('RXBAR protein bar', '1 bar', 180, 6, 24, 6, 12),
      F('Amul Whole Milk', '200 g', 175, 11.5, 9.5, 0, 6.5, 'estimate'),
      F('Mango Pappu', '130 g', 150, 4, 21, 5, 8, 'estimate'),
      F('Mixed veg curry', '50 g', 65, 4.5, 5, 2, 1.5, 'estimate')
    ],
    foods: [],
    burns: {},
    exercises: [],
    sessions: [],
    training: {},
    cards: ['AMEX Blue Cash Preferred', 'Zolve', 'Discover', 'Robinhood Gold', 'BILT', 'Apple Card'],
    categories: ['Food & dining', 'Groceries', 'Transport & gas', 'Shopping', 'Entertainment', 'Subscriptions', 'Health & fitness', 'Bills', 'Other'],
    expenses: []
  };
}

const store = window.api || {
  load: async () => { try { return JSON.parse(localStorage.getItem('wellness-data')); } catch { return null; } },
  save: async (d) => { localStorage.setItem('wellness-data', JSON.stringify(d)); return true; }
};
let DB = null;
let APP_VERSION = null;
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.save(DB), 250); Sync.changed(); }

// ---------- sync with the Wellness server (Supabase) ----------
// Keeps a copy of the last version both sides agreed on ("base") so edits made
// here and edits Claude made on the server are merged instead of overwritten.
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function mergeById(b = [], l = [], s = []) {
  const B = new Map(b.map((x) => [x.id, x])), L = new Map(l.map((x) => [x.id, x])), S = new Map(s.map((x) => [x.id, x]));
  const out = [];
  const pick = (id) => {
    const inB = B.has(id), inL = L.has(id), inS = S.has(id);
    if (inL && inS) return same(L.get(id), B.get(id)) ? S.get(id) : L.get(id);
    if (inL) return inB && same(L.get(id), B.get(id)) ? null : L.get(id);
    if (inS) return inB && same(S.get(id), B.get(id)) ? null : S.get(id);
    return null;
  };
  const seen = new Set();
  for (const x of [...s, ...l]) { if (seen.has(x.id)) continue; seen.add(x.id); const v = pick(x.id); if (v) out.push(v); }
  return out;
}
function mergeMap(b = {}, l = {}, s = {}) {
  const out = {};
  for (const k of new Set([...Object.keys(l), ...Object.keys(s)])) {
    const inL = k in l, inS = k in s, inB = k in b;
    if (inL && inS) out[k] = same(l[k], b[k]) ? s[k] : l[k];
    else if (inL) { if (!(inB && same(l[k], b[k]))) out[k] = l[k]; }
    else if (inS) { if (!(inB && same(s[k], b[k]))) out[k] = s[k]; }
  }
  return out;
}
function mergeSet(b = [], l = [], s = []) {
  const out = s.filter((x) => !(b.includes(x) && !l.includes(x)));
  l.forEach((x) => { if (!b.includes(x) && !out.includes(x)) out.push(x); });
  return out;
}
function merge3(base, local, server) {
  base = base || {};
  const out = {};
  for (const k of new Set([...Object.keys(local), ...Object.keys(server)])) {
    const b = base[k], l = local[k], s = server[k];
    if (l === undefined) { out[k] = s; continue; }
    if (s === undefined) { out[k] = l; continue; }
    if (Array.isArray(l) && Array.isArray(s)) {
      const objs = [...l, ...s].every((x) => x && typeof x === 'object' && 'id' in x);
      out[k] = objs ? mergeById(b, l, s) : mergeSet(b, l, s);
    } else if (l && s && typeof l === 'object' && typeof s === 'object') out[k] = mergeMap(b, l, s);
    else out[k] = same(l, b) ? s : l;
  }
  return out;
}
const Sync = {
  cfg: (() => { try { return JSON.parse(localStorage.getItem('wellness-sync')); } catch { return null; } })(),
  state: (() => { try { return JSON.parse(localStorage.getItem('wellness-sync-state')) || { rev: 0, base: null }; } catch { return { rev: 0, base: null }; } })(),
  pending: false, busy: false, timer: null, last: null, error: null,
  on() { return !!(this.cfg && this.cfg.url && this.cfg.key); },
  url(p) { return this.cfg.url.replace(/\/+$/, '') + p; },
  async req(method, body) {
    const r = await fetch(this.url('/sync'), { method, headers: { Authorization: 'Bearer ' + this.cfg.key, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    if (r.status === 401) throw new Error('The key was rejected');
    if (r.status !== 200 && r.status !== 409) throw new Error('Server said ' + r.status);
    return { status: r.status, data: await r.json() };
  },
  keep() { localStorage.setItem('wellness-sync-state', JSON.stringify(this.state)); },
  adopt(doc, rev) { this.state = { rev, base: JSON.parse(JSON.stringify(doc)) }; this.keep(); },
  changed() { if (!this.on()) return; this.pending = true; clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 800); },
  async push() {
    if (!this.on() || this.busy) return;
    this.busy = true;
    try {
      for (let i = 0; i < 4; i++) {
        const { status, data } = await this.req('PUT', { baseRev: this.state.rev, doc: DB });
        if (status === 200) { this.adopt(DB, data.rev); this.pending = false; break; }
        const merged = Object.assign(defaults(), merge3(this.state.base, DB, data.doc || {}));
        DB = merged; store.save(DB);
        this.state = { rev: data.rev, base: data.doc }; this.keep();
        refreshView();
      }
      this.error = null; this.last = new Date();
    } catch (e) { this.error = e.message; }
    this.busy = false; showSyncStatus();
  },
  async pull() {
    if (!this.on() || this.busy) return;
    if (this.pending) return this.push();
    this.busy = true;
    try {
      const { data } = await this.req('GET');
      if (!data.doc) { this.busy = false; this.pending = true; return this.push(); }
      if (data.rev !== this.state.rev) {
        DB = Object.assign(defaults(), this.state.base ? merge3(this.state.base, DB, data.doc) : merge3({}, DB, data.doc));
        store.save(DB);
        const changedHere = !same(DB, data.doc);
        this.adopt(data.doc, data.rev);
        refreshView();
        if (changedHere) { this.pending = true; this.busy = false; return this.push(); }
      }
      this.error = null; this.last = new Date();
    } catch (e) { this.error = e.message; }
    this.busy = false; showSyncStatus();
  }
};
function refreshView() {
  const active = document.activeElement;
  if (active && active.matches('input,textarea,select') && active.closest('#main')) { refreshView.later = true; return; }
  render();
}
function showSyncStatus() {
  const el = $('#syncMsg'); if (!el) return;
  el.textContent = !Sync.on() ? 'Not connected.' : Sync.error ? 'Problem: ' + Sync.error : Sync.last ? 'Synced ' + Sync.last.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Connecting…';
}

const ui = {
  view: 'today', date: todayKey(), open: null, planId: null, editDay: false,
  week: weekStart(todayKey()), month: monthKey(todayKey()), hDate: todayKey(), sMonth: monthKey(todayKey()),
  logEx: null, logSets: null, ruleEx: null, ab: null, lastCard: undefined
};

function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 1800); }

// ---------- day logic ----------
const listById = (id) => DB.choiceLists.find((l) => l.id === id);
const planById = (id) => DB.plans.find((p) => p.id === id);
function dayScore(day) {
  if (!day || !day.blocks || !day.blocks.length) return null;
  const done = day.blocks.filter((b) => day.done[b.id]).length;
  return { done, total: day.blocks.length, pct: pct(done, day.blocks.length) };
}
function applyPlan(key, planId) {
  const p = planById(planId);
  if (!p) return;
  const old = DB.days[key];
  const hasTicks = old && (Object.values(old.done || {}).some(Boolean) || Object.keys(old.choices || {}).length);
  if (hasTicks && !confirm(`Replace ${shortDay(key)}’s plan? Its ticks and picks will be cleared.`)) return false;
  DB.days[key] = {
    planId: p.id, planName: p.name, color: p.color,
    blocks: p.blocks.map((b) => ({ ...b })), done: {}, choices: {}, notes: old ? old.notes || '' : ''
  };
  save();
  return true;
}
function blockEnd(blocks, i) {
  const b = blocks[i];
  if (b.end) return mins(b.end);
  for (let j = i + 1; j < blocks.length; j++) if (blocks[j].start) return mins(blocks[j].start);
  return mins(b.start) + 60;
}
function nowNext(day) {
  const t = nowMins();
  const bl = day.blocks;
  let now = null, next = null;
  bl.forEach((b, i) => {
    if (!b.start) return;
    const s = mins(b.start), e = blockEnd(bl, i);
    if (s <= t && t < e && !now) now = { b, i, e };
    if (s > t && !next) next = { b, i };
  });
  return { now, next };
}
function choiceWarnings(day) {
  const w = {};
  const seen = {};
  day.blocks.forEach((b) => {
    if (b.kind !== 'choice') return;
    const L = listById(b.listId);
    const v = day.choices[b.id];
    if (!L || !L.distinct || !v) return;
    const k = L.id + '|' + v;
    if (seen[k]) w[b.id] = `Same as ${seen[k]}`;
    else seen[k] = b.title;
  });
  return w;
}

// ---------- shell ----------
const NAV = [['today', 'Today'], ['week', 'Week'], ['plans', 'Plans'], ['log', 'Log'], ['health', 'Health'], ['spending', 'Spending'], ['summary', 'Summary'], ['settings', 'Settings']];
function renderNav() {
  $('#nav').innerHTML = NAV.map(([k, l]) => `<button class="nav ${ui.view === k ? 'on' : ''}" data-a="go" data-v="${k}" ${ui.view === k ? 'aria-current="page"' : ''}>${ic(k, 17)}${l}</button>`).join('');
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  $('#sidefoot').innerHTML = `Sage · ${dark ? 'Dark' : 'Light'}<br>Follows your Mac’s appearance${APP_VERSION ? `<br><span class="mono">v${APP_VERSION}</span>` : ''}`;
}
function render() {
  renderNav();
  const v = VIEWS[ui.view] || VIEWS.today;
  const m = $('#main');
  const st = m.scrollTop;
  m.innerHTML = '<div class="topdrag"></div>' + v();
  m.scrollTop = st;
  if (ui.view === 'settings') showSyncStatus();
  if (ui.view === 'settings' && window.api) {
    window.api.getOpenAtLogin().then((on) => { const c = $('#loginChk'); if (c) c.checked = on; });
    if (window.api.updateInfo) window.api.updateInfo().then((i) => { const r = $('#updRepo'), v = $('#updVer'); if (r) r.value = i.configured ? i.repo : ''; if (v) v.textContent = 'version ' + i.version; const t = $('#updToken'); if (t && i.hasToken) t.placeholder = 'saved ••••••'; });
  }
}
const go = (v) => { if (ui.view === 'plans' || ui.editDay) { pruneAll(); save(); } ui.view = v; ui.open = null; render(); $('#main').scrollTop = 0; };

function dateNav(action, label) {
  return `<div class="datenav"><button class="icon-btn" data-a="${action}" data-d="-1" aria-label="Previous">${ic('left')}</button><button class="btn sm" data-a="${action}" data-d="0">${label}</button><button class="icon-btn" data-a="${action}" data-d="1" aria-label="Next">${ic('right')}</button></div>`;
}

// ---------- block editor (plans + single day) ----------
// Read a typed time: "9", "930", "9:30", "9.30", "4pm", "4 p", "16:00". Returns "HH:MM", "" for empty, or null if unreadable.
// Without am/pm, 1–5 is read as PM and 6–11 as AM (a day plan rarely has 2 AM in it); 12 is noon.
function parseTimeInput(raw) {
  const s = String(raw || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!s) return '';
  const m = /^(\d{1,2})(?:[:.\s]?(\d{2}))?\s*(a|am|a\.m\.|p|pm|p\.m\.)?$/.exec(s);
  if (!m) return null;
  let h = +m[1]; const mi = +(m[2] || 0);
  const ap = m[3] ? m[3][0] : '';
  if (mi > 59) return null;
  if (ap) { if (h < 1 || h > 12) return null; if (ap === 'p' && h < 12) h += 12; if (ap === 'a' && h === 12) h = 0; }
  else if (m[1].length === 2 && m[1][0] === '0') { /* 08:00 → 8 AM as written */ }
  else if (h >= 1 && h <= 5) h += 12;
  if (h > 23) return null;
  return pad(h) + ':' + pad(mi);
}
// Drop blocks with no title (left behind by half-finished edits) and end times equal to the start.
function pruneBlocks(blocks, done) {
  if (!blocks) return blocks;
  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    if (b.end && b.end === b.start) b.end = '';
    if (!String(b.title || '').trim() && !(done && done[b.id])) blocks.splice(i, 1);
  }
  return blocks;
}
function pruneAll() {
  DB.plans.forEach((p) => pruneBlocks(p.blocks));
  Object.values(DB.days).forEach((d) => pruneBlocks(d.blocks, d.done));
}
function blockEditor(scope, blocks) {
  const listOpts = (sel) => DB.choiceLists.map((l) => `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  const rows = blocks.map((b, i) => `
    <tr>
      <td class="g">${i + 1}</td>
      <td><input class="inp time" type="text" autocomplete="off" spellcheck="false" value="${esc(fmtTime(b.start))}" placeholder="any time" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="start" aria-label="Start time"></td>
      <td><input class="inp time" type="text" autocomplete="off" spellcheck="false" value="${esc(fmtTime(b.end))}" placeholder="—" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="end" aria-label="End time"></td>
      <td><input class="inp" value="${esc(b.title)}" placeholder="What happens" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="title" aria-label="Task"></td>
      <td><select class="sel" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="kind" aria-label="Type"><option value="task" ${b.kind !== 'choice' ? 'selected' : ''}>Task</option><option value="choice" ${b.kind === 'choice' ? 'selected' : ''}>Choice</option></select></td>
      <td>${b.kind === 'choice' ? `<select class="sel" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="listId" aria-label="Choice list">${listOpts(b.listId)}</select>` : '<span class="faint">—</span>'}</td>
      <td class="c"><button class="chk ${b.alert ? 'on' : ''}" data-a="blkAlert" data-s="${scope}" data-b="${b.id}" aria-pressed="${b.alert ? 'true' : 'false'}" aria-label="Alert for ${esc(b.title || 'block')}"><span class="box">${b.alert ? ic('check', 13, 3.2) : ''}</span></button></td>
      <td class="c"><button class="icon-btn" data-a="blkDel" data-s="${scope}" data-b="${b.id}" aria-label="Remove ${esc(b.title || 'block')}">${ic('x', 14)}</button></td>
    </tr>`).join('');
  return `<div class="sheet blk-editor" data-s="${scope}"><table>
    <colgroup><col style="width:40px"><col style="width:140px"><col style="width:140px"><col><col style="width:110px"><col style="width:160px"><col style="width:64px"><col style="width:56px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td>F</td><td></td></tr>
    <tr><th class="g">#</th><th>Start</th><th>End</th><th>Task</th><th>Type</th><th>Choice list</th><th class="c">Alert</th><th></th></tr>
    ${rows || `<tr><td class="g">1</td><td colspan="7" class="faint">No blocks yet. Add your first one below.</td></tr>`}
  </table>
  <div class="addbar"><button class="btn" data-a="blkAdd" data-s="${scope}">${ic('plus', 14, 2.2)} Add block</button><span class="hint">Type times like 9, 930, 4pm or 16:00 (1–5 means PM, 6–11 AM, unless you add am/pm). Leave start empty for “any time”. Alerts fire on your Mac when a block starts.</span></div></div>`;
}
function scopeBlocks(scope) {
  if (scope === 'day') return DB.days[ui.date].blocks;
  const p = planById(scope.slice(5));
  return p ? p.blocks : [];
}

// ---------- VIEWS ----------
const VIEWS = {};

VIEWS.today = () => {
  const k = ui.date;
  const day = DB.days[k];
  const d = parseKey(k);
  const isToday = k === todayKey();
  const sc = dayScore(day);
  const ring = (p, done, total) => {
    const C = 226.2, off = (C * (1 - p / 100)).toFixed(1);
    return `<div class="ring"><svg width="88" height="88" viewBox="0 0 88 88" role="img" aria-label="${done} of ${total} done"><circle cx="44" cy="44" r="36" fill="none" stroke="var(--line2)" stroke-width="8"/><circle cx="44" cy="44" r="36" fill="none" stroke="var(--acc)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 44 44)"/></svg><div class="in"><span class="pct">${p}%</span><span class="cnt">${done}/${total}</span></div></div>`;
  };
  let nowCard = '';
  if (day && isToday) {
    const { now, next } = nowNext(day);
    const t = nowMins();
    const dur = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h${mm ? ' ' + mm + 'm' : ''}` : `${mm}m`; };
    if (now) {
      const s = mins(now.b.start), e = now.e;
      const p = Math.min(100, Math.max(0, ((t - s) / Math.max(1, e - s)) * 100));
      nowCard = `<div class="now">
        <div class="now-top"><span class="pulse" aria-hidden="true"></span><span class="now-k">Now</span><span class="now-until">until ${fmtTime(now.b.end || (next ? next.b.start : ''))}</span><span class="now-left mono">${dur(e - t)} left</span></div>
        <div class="now-title">${esc(now.b.title)}</div>
        <div class="now-bar" role="img" aria-label="${Math.round(p)}% of this block done"><i style="width:${p.toFixed(1)}%"></i></div>
        ${next ? `<div class="now-next">Next · <span class="mono">${fmtTime(next.b.start)}</span> ${esc(next.b.title)}</div>` : ''}
      </div>`;
    } else if (next) {
      nowCard = `<div class="now">
        <div class="now-top"><span class="now-k">Up next</span><span class="now-until">at ${fmtTime(next.b.start)}</span><span class="now-left mono">in ${dur(mins(next.b.start) - t)}</span></div>
        <div class="now-title">${esc(next.b.title)}</div>
      </div>`;
    } else {
      nowCard = `<div class="now"><div class="now-top"><span class="now-k">Done for today</span></div><div class="now-title">Nothing else scheduled</div></div>`;
    }
  }
  const head = `<div class="head">
    <div class="head-title">
      <div class="row-flex" style="justify-content:space-between">
        <span class="kicker">${isToday ? 'Today' : (k < todayKey() ? 'Past day' : 'Upcoming')}</span>
        ${dateNav('dayNav', isToday ? 'Today' : 'Go to today')}
      </div>
      <div class="row-flex" style="align-items:baseline;gap:14px"><h1 class="h1">${DOW[d.getDay()]}</h1><span class="h1sub">${longDate(k)}</span></div>
      ${day ? `<div class="row-flex" style="margin-top:6px"><span class="pill"><span class="dotc" style="background:${esc(day.color || 'var(--dot)')}"></span>${esc(day.planName || 'Custom day')}</span>
        <button class="btn ghost sm" data-a="editDay">${ui.editDay ? 'Done editing' : 'Edit this day'}</button>
        <button class="btn ghost sm" data-a="clearDay">Clear plan</button></div>` : ''}
    </div>
    ${nowCard}
    ${sc ? ring(sc.pct, sc.done, sc.total) : ''}
  </div>`;

  if (!day) {
    const opts = DB.plans.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    const body = DB.plans.length
      ? `<p>No plan on ${isToday ? 'today' : shortDay(k)} yet. Pick one of your saved plans; you can still change individual blocks afterwards.</p>
         <div class="row-flex"><select class="sel" id="applySel" aria-label="Plan">${opts}</select><button class="btn primary" data-a="applyHere">Use this plan</button></div>
         <button class="btn ghost sm" data-a="blankDay">or start a blank day</button>`
      : `<p>You haven’t made any plans yet. Create your first plan (a Gym/Work day, a Rest/Work day, anything) and it becomes a template you can drop onto any day.</p>
         <div class="row-flex"><button class="btn primary" data-a="newPlan">${ic('plus', 14, 2.2)} Create your first plan</button><button class="btn" data-a="blankDay">Just plan this day</button></div>`;
    return head + `<div class="cols"><div class="grow"><div class="empty-state"><h2 class="h2">Nothing planned</h2>${body}</div></div>${weekPanel(k)}</div>`;
  }

  if (ui.editDay) {
    return head + `<div class="section" style="margin-top:0"><div class="hint">Changes here only affect ${shortDay(k)}. Your saved plan stays the same.</div>${blockEditor('day', day.blocks)}</div>`;
  }

  const { now } = isToday ? nowNext(day) : { now: null };
  const warns = choiceWarnings(day);
  const rows = day.blocks.map((b, i) => {
    const done = !!day.done[b.id];
    const isNow = now && now.i === i;
    let choice = '<span class="faint">—</span>';
    if (b.kind === 'choice') {
      const v = day.choices[b.id];
      choice = `<button class="pick ${v ? 'set' : ''}" data-a="pickOpen" data-b="${b.id}" aria-expanded="${ui.open === b.id}">${esc(v || 'Choose…')}${ic('down', 12, 2.5)}</button>${warns[b.id] ? `<div class="warn">${esc(warns[b.id])}</div>` : ''}`;
    }
    let row = `<tr class="${isNow ? 'now-row' : ''} ${done ? 'done' : ''}">
      <td class="g">${i + 1}</td>
      <td class="mono" style="font-size:12.5px;color:var(--ink2)">${fmtRange(b)}</td>
      <td class="task" style="${isNow ? 'font-weight:600' : ''}">${esc(b.title || 'Untitled')}${isNow ? '<span class="tag-now">NOW</span>' : ''}</td>
      <td>${choice}</td>
      <td class="c" style="padding:2px"><button class="chk ${done ? 'on' : ''}" data-a="tick" data-b="${b.id}" aria-pressed="${done}" aria-label="${done ? 'Unmark' : 'Mark done'}: ${esc(b.title)}"><span class="box">${done ? ic('check', 13, 3.2) : ''}</span></button></td>
    </tr>`;
    if (ui.open === b.id) {
      const L = listById(b.listId);
      const opts = L ? L.options.map((o) => `<button class="chip ${day.choices[b.id] === o ? 'on' : ''}" data-a="pick" data-b="${b.id}" data-o="${esc(o)}" aria-pressed="${day.choices[b.id] === o}">${esc(o)}</button>`).join('') : '';
      row += `<tr class="chiprow"><td class="g"></td><td colspan="4"><div class="chips" role="group" aria-label="Choose for ${esc(b.title)}">${opts || '<span class="faint">This list has no options yet. Add some under Plans → Choice lists.</span>'}${day.choices[b.id] ? `<button class="chip" data-a="pick" data-b="${b.id}" data-o="">Clear</button>` : ''}</div></td></tr>`;
    }
    return row;
  }).join('');
  const sheet = `<div class="sheet"><table>
    <colgroup><col style="width:40px"><col style="width:150px"><col><col style="width:200px"><col style="width:72px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td></tr>
    <tr><th class="g">#</th><th>Time</th><th>Task</th><th>Choice</th><th class="c">Done</th></tr>
    ${rows || '<tr><td class="g">1</td><td colspan="4" class="faint">No blocks. Use “Edit this day” to add some.</td></tr>'}
  </table></div>
  <div class="section"><label class="fld" for="dayNotes">Notes</label><textarea id="dayNotes" class="inp" rows="3" placeholder="Anything worth remembering about this day" data-c="notes">${esc(day.notes || '')}</textarea></div>`;
  return head + `<div class="cols"><div class="grow">${sheet}</div>${weekPanel(k)}</div>`;
};

function weekPanel(k) {
  const ws = weekStart(k);
  const rows = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const dk = addDays(ws, i);
    const day = DB.days[dk];
    const sc = dayScore(day);
    return `<button class="wk ${dk === k ? 'cur' : ''}" data-a="openDay" data-k="${dk}"><span class="mono">${shortDay(dk)}</span><span class="${day ? '' : 'empty'}">${day ? `<span class="sw" style="background:${esc(day.color || 'var(--dot)')};margin-right:6px"></span>${esc(day.planName || 'Custom')}` : '+ Add plan'}</span><span class="mono" style="text-align:right">${sc ? sc.pct + '%' : ''}</span></button>`;
  }).join('');
  return `<aside class="panel" aria-label="This week"><h2 class="h2" style="font-size:22px">This week</h2><div class="sheet">${rows}</div><div class="hint">Click a day to open it. Past days can be planned and ticked too.</div></aside>`;
}

VIEWS.week = () => {
  const ws = ui.week;
  const we = addDays(ws, 6);
  const planOpts = (sel) => `<option value="">— None —</option>` + DB.plans.map((p) => `<option value="${p.id}" ${p.id === sel ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  const rows = [0, 1, 2, 3, 4, 5, 6].map((i) => {
    const k = addDays(ws, i);
    const day = DB.days[k];
    const sc = dayScore(day);
    const custom = day && !planById(day.planId);
    const picks = day ? day.blocks.filter((b) => b.kind === 'choice' && day.choices[b.id]).map((b) => day.choices[b.id]) : [];
    return `<tr class="${k === todayKey() ? 'today' : ''}">
      <td class="g">${i + 1}</td>
      <td><span style="font-weight:600">${DOW[parseKey(k).getDay()]}</span> <span class="mono muted" style="font-size:12px">${longDate(k).replace(/^\w+/, (m) => m.slice(0, 3))}</span></td>
      <td><select class="sel" data-c="weekPlan" data-k="${k}" aria-label="Plan for ${shortDay(k)}">${custom ? `<option value="__custom" selected>${esc(day.planName || 'Custom day')}</option>` : ''}${planOpts(day && !custom ? day.planId : '')}</select></td>
      <td class="mono r">${sc ? sc.done + '/' + sc.total : ''}</td>
      <td class="mono r">${sc ? sc.pct + '%' : ''}</td>
      <td class="small">${esc(picks.join(', '))}</td>
      <td class="c"><button class="btn sm" data-a="openDay" data-k="${k}">Open</button></td>
    </tr>`;
  }).join('');
  const fillOpts = DB.plans.map((p) => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Week</span><div class="row-flex" style="align-items:baseline;gap:14px"><h1 class="h1">${MON[parseKey(ws).getMonth()]} ${parseKey(ws).getDate()}</h1><span class="h1sub">to ${longDate(we)}</span></div></div>${dateNav('weekNav', 'This week')}</div>
  ${DB.plans.length ? '' : `<div class="empty-state" style="margin-bottom:18px"><p>Make a plan first, then drop it onto any day here, including days that already happened.</p><button class="btn primary" data-a="newPlan">${ic('plus', 14, 2.2)} Create a plan</button></div>`}
  <div class="sheet"><table>
    <colgroup><col style="width:40px"><col style="width:190px"><col style="width:220px"><col style="width:80px"><col style="width:76px"><col><col style="width:86px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td></td></tr>
    <tr><th class="g">#</th><th>Day</th><th>Plan</th><th class="r">Done</th><th class="r">Score</th><th>Picks</th><th></th></tr>
    ${rows}
  </table>
  ${DB.plans.length ? `<div class="addbar"><span class="small muted">Fill every empty day this week with</span><select class="sel" id="fillSel" aria-label="Plan to fill">${fillOpts}</select><button class="btn" data-a="fillWeek">Fill empty days</button></div>` : ''}</div>`;
};

VIEWS.plans = () => {
  if (!ui.planId || !planById(ui.planId)) ui.planId = DB.plans[0] ? DB.plans[0].id : null;
  const p = planById(ui.planId);
  const list = DB.plans.map((x) => `<button class="plan-item ${x.id === ui.planId ? 'on' : ''}" data-a="selPlan" data-p="${x.id}"><span class="sw" style="background:${esc(x.color)}"></span>${esc(x.name)}<span class="cnt">${x.blocks.length}</span></button>`).join('');
  let editor;
  if (!p) {
    editor = `<div class="empty-state"><h2 class="h2">No plans yet</h2><p>A plan is a day template: a list of timed blocks. Tasks you tick off, and choice blocks (like Free time) where you pick what you’ll do from a list.</p><button class="btn primary" data-a="newPlan">${ic('plus', 14, 2.2)} New plan</button></div>`;
  } else {
    const colors = PLAN_COLORS.map((c) => `<button class="icon-btn" style="width:26px;height:26px;border-radius:50%;background:${c};border:2px solid ${c === p.color ? 'var(--ink)' : 'transparent'}" data-a="planColor" data-col="${c}" aria-label="Colour ${c}" aria-pressed="${c === p.color}"></button>`).join('');
    editor = `<div style="display:flex;flex-direction:column;gap:12px">
      <div class="row-flex"><label class="sr" for="planName">Plan name</label><input id="planName" class="inp" style="font-family:var(--serif);font-size:24px;font-weight:600;height:42px;width:300px" value="${esc(p.name)}" data-c="planName">
        <div class="row-flex" style="gap:6px">${colors}</div>
        <span style="flex:1"></span>
        <button class="btn" data-a="applyPlanToday">Use for today</button>
        <button class="btn" data-a="dupPlan">Duplicate</button>
        <button class="btn danger" data-a="delPlan">Delete</button></div>
      ${blockEditor('plan:' + p.id, p.blocks)}
    </div>`;
  }
  const lists = DB.choiceLists.map((L) => `
    <div class="sheet" style="padding:12px 14px;display:flex;flex-direction:column;gap:10px">
      <div class="row-flex"><input class="inp" style="font-weight:600;width:220px" value="${esc(L.name)}" data-c="listName" data-l="${L.id}" aria-label="List name">
        <label class="row-flex small" style="gap:6px"><input type="checkbox" ${L.distinct ? 'checked' : ''} data-c="listDistinct" data-l="${L.id}"> Don’t repeat the same pick in one day</label>
        <span style="flex:1"></span><button class="btn danger sm" data-a="delList" data-l="${L.id}">Delete list</button></div>
      <div class="chips">${L.options.map((o, i) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px;cursor:default">${esc(o)}<button class="icon-btn" style="width:20px;height:20px;border:none;background:none" data-a="delOpt" data-l="${L.id}" data-i="${i}" aria-label="Remove ${esc(o)}">${ic('x', 12, 2.2)}</button></span>`).join('')}
        <input class="inp" style="width:170px;height:30px;border-radius:999px" placeholder="+ Add option" data-c="addOpt" data-l="${L.id}" aria-label="Add option to ${esc(L.name)}"></div>
    </div>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Plans</span><h1 class="h1">Your day templates</h1></div></div>
  <div class="plan-tabs">${list}<button class="btn ghost" data-a="newPlan">${ic('plus', 14, 2.2)} New plan</button></div>
  <div style="margin-top:14px">${editor}</div>
  <div class="section"><div class="section-head"><h2 class="h2">Choice lists</h2><button class="btn" data-a="newList">${ic('plus', 14, 2.2)} New list</button></div>
  <div class="hint">A choice block picks from one of these lists. Free time is the first; add others like Learning or Workout.</div>${lists}</div>`;
};

VIEWS.log = () => {
  const mk = ui.month;
  const keys = Object.keys(DB.days).filter((k) => monthKey(k) === mk).sort();
  const rows = keys.map((k, i) => {
    const day = DB.days[k];
    const sc = dayScore(day) || { done: 0, total: 0, pct: 0 };
    const picks = day.blocks.filter((b) => b.kind === 'choice' && day.choices[b.id]).map((b) => `${esc(b.title)}: <b>${esc(day.choices[b.id])}</b>`).join(' · ');
    return `<tr class="click ${k === todayKey() ? 'today' : ''}" data-a="openDay" data-k="${k}"><td class="g">${i + 1}</td><td class="mono">${shortDay(k)}</td><td><span class="sw" style="background:${esc(day.color || 'var(--dot)')};margin-right:6px"></span>${esc(day.planName || 'Custom')}</td><td class="mono r">${sc.done}/${sc.total}</td><td class="mono r" style="font-weight:600">${sc.pct}%</td><td class="small">${picks}</td><td class="small muted">${esc(day.notes || '')}</td></tr>`;
  }).join('');
  const scores = keys.map((k) => dayScore(DB.days[k])).filter(Boolean);
  const avg = scores.length ? Math.round(scores.reduce((a, s) => a + s.pct, 0) / scores.length) : 0;
  return `<div class="head"><div class="head-title"><span class="kicker">Daily log</span><h1 class="h1">${monthLabel(mk).split(' ')[0]}</h1></div>${dateNav('monthNav', 'This month')}</div>
  <div class="stats"><div class="stat"><span class="k">Days planned</span><span class="v">${keys.length}</span></div><div class="stat"><span class="k">Average score</span><span class="v">${avg}%</span></div><div class="stat"><span class="k">Blocks done</span><span class="v">${scores.reduce((a, s) => a + s.done, 0)}</span></div></div>
  <div class="sheet"><table><colgroup><col style="width:40px"><col style="width:90px"><col style="width:180px"><col style="width:76px"><col style="width:72px"><col><col style="width:220px"></colgroup>
  <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td>F</td></tr>
  <tr><th class="g">#</th><th>Date</th><th>Plan</th><th class="r">Done</th><th class="r">Score</th><th>Picks</th><th>Notes</th></tr>
  ${rows || '<tr><td class="g">1</td><td colspan="6" class="faint">Nothing logged this month yet. Days show up here once they have a plan.</td></tr>'}</table></div>`;
};

// ---------- health ----------
function qtyText(srv, serving) {
  if (srv === 1) return serving;
  const m = /^([\d.]+)\s*(.*)$/.exec(serving);
  if (m) return r1(srv * num(m[1])) + ' ' + m[2];
  return srv + ' × ' + serving;
}
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];
function foodTotals(k) {
  const t = { cal: 0, p: 0, c: 0, fib: 0, f: 0, n: 0 };
  DB.foods.filter((x) => x.date === k).forEach((x) => { t.cal += x.cal; t.p += x.p; t.c += x.c; t.fib += x.fib; t.f += x.f; t.n++; });
  return t;
}
// A set is { w: lb (0 = bodyweight), r: reps, t?: seconds held, side?: reps per side }.
// Bodyweight / timed exercises (all of Abs by default) progress by adding rounds, not +10 lb.
const isBodyweight = (ex) => !!ex && (ex.kind === 'bodyweight' || (!ex.kind && ex.group === 'Abs'));
function setText(s, body) {
  const amount = s.t ? `${s.t} s` : s.r === '' || s.r == null ? '—' : `${s.r}${s.side ? '/side' : ''}`;
  if (!body) return `${s.w}×${amount}`;
  return s.w ? `+${s.w} lb · ${amount}` : amount;
}
function lastSession(ex, before) {
  return DB.sessions.filter((s) => s.exId === ex.id && (!before || s.date < before)).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}
function targetWeights(ex, k) {
  if (isBodyweight(ex)) {
    const prev = lastSession(ex, k);
    return prev ? { w: [], rounds: prev.sets.length, why: `${prev.sets.length} rounds last time · add one when every round feels solid` } : { w: [], rounds: null, why: 'progress by adding rounds' };
  }
  const ws = weekStart(k);
  const prev = DB.sessions.filter((s) => s.exId === ex.id && s.date < ws).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!prev) return { w: (ex.start || []).slice(), why: 'starting weights' };
  const w = prev.sets.map((s) => num(s.w));
  const step = exStep(ex), rule = ex.rule || 'reps15';
  if (rule === 'manual') return { w, why: 'you raise this one yourself' };
  if (rule === 'try') return { w: w.map((x) => x + step), why: `try +${step} lb; if you can’t get 1 rep, stay at last week’s` };
  if (num(prev.sets[0].r) >= 15) return { w: w.map((x) => x + step), why: `${prev.sets[0].r} reps on set 1 last week → +${step} lb` };
  return { w, why: 'same as last week' };
}
// How each lift progresses: step = lb added to every set when it moves up; rule = when it moves up.
const RULES = { reps15: '15 reps on set 1 → up a step', try: 'Try a step heavier each week', manual: 'I raise it myself' };
const exStep = (ex) => num(ex.step) || 10;
// ---------- ab circuit ----------
// The Abs exercises are done as one circuit: every move back to back, then rest. Each round is one set
// in each exercise's session for that day; the grid below shows moves as rows and rounds as columns.
const SPLIT = ['Shoulders & Chest', 'Arms', 'Back', 'Legs', 'Abs'];
const UNIT = { reps: 'reps', side: 'reps each side', sec: 'seconds' };
const abMoves = () => DB.exercises.map((e, i) => ({ e, i })).filter((x) => isBodyweight(x.e)).sort((a, b) => (a.e.pos ?? a.i) - (b.e.pos ?? b.i)).map((x) => x.e);
function abUnit(ex) {
  if (ex.unit) return ex.unit;
  const f = (lastSession(ex) || { sets: [] }).sets[0];
  return f && f.t ? 'sec' : f && f.side ? 'side' : 'reps';
}
function abDates() {
  const ids = new Set(abMoves().map((e) => e.id));
  return [...new Set(DB.sessions.filter((s) => ids.has(s.exId)).map((s) => s.date))].sort().reverse();
}
function circuitOn(date) {
  const rows = abMoves().map((ex) => ({ ex, unit: abUnit(ex), s: DB.sessions.find((x) => x.exId === ex.id && x.date === date) }));
  const done = rows.filter((r) => r.s);
  return { date, rows, rounds: Math.max(0, ...done.map((r) => r.s.sets.length)), note: (done.find((r) => r.s.note) || { s: {} }).s.note || '', effort: (done.find((r) => r.s.effort) || { s: {} }).s.effort || 'hard' };
}
const setVal = (x, unit) => (unit === 'sec' ? x.t || '' : x.r ?? '');
const fmtSecs = (n) => (n >= 60 ? `${Math.floor(n / 60)}:${pad(Math.round(n % 60))}` : `${n} s`);
function abTotal(sets, unit) {
  const n = sets.reduce((a, x) => a + num(setVal(x, unit)), 0);
  if (!n) return '—';
  return unit === 'sec' ? fmtSecs(n) : unit === 'side' ? `${n} <span class="faint">/side</span>` : String(n);
}
function abCircuit(k) {
  const moves = abMoves();
  if (!moves.length) return `<div class="empty-state" style="padding:22px"><p>Add your ab moves below with split day “Abs (circuit)”. They’ll show here as one circuit: moves down the side, rounds across.</p></div>`;
  const dates = abDates();
  const E = ui.ab;
  const c = circuitOn(k);
  const logged = c.rounds > 0;
  const prev = dates.find((d) => d < k);
  const prevRounds = prev ? circuitOn(prev).rounds : 0;
  const rounds = E ? E.rounds : c.rounds;
  const nextRounds = (logged ? c.rounds : prevRounds) || null;
  const dayLabel = k === todayKey() ? 'Today' : shortDay(k);
  const cols = Math.max(rounds || prevRounds, 1);
  const head = `<div class="cbar">
      <span class="ttl">Ab circuit</span>
      <span class="pill">${esc(dayLabel)}</span>
      ${rounds ? `<span class="pill mono">${rounds} round${rounds === 1 ? '' : 's'}</span>` : E ? '' : '<span class="pill faint">Not logged</span>'}
      ${!E && logged ? `<span class="pill">${c.effort[0].toUpperCase() + c.effort.slice(1)}</span>` : ''}
      ${!E && c.note ? `<span class="pill">${esc(c.note)}</span>` : ''}
      <span class="next">${nextRounds ? `Next time <b>${nextRounds + 1}</b> rounds, once all ${nextRounds} feel solid` : 'Progress by adding a round'}</span>
      ${E ? '' : `<button class="btn ${logged ? '' : 'primary'} sm" data-a="abEdit">${logged ? 'Edit' : 'Log circuit'}</button>`}
    </div>`;
  const colgroup = `<colgroup><col style="width:40px"><col style="width:${E ? 250 : 210}px">${Array.from({ length: cols }, () => '<col>').join('')}<col style="width:110px"></colgroup>`;
  const thead = `<tr><th class="g">#</th><th>Move</th>${Array.from({ length: cols }, (_, i) => `<th class="rd">R${i + 1}</th>`).join('')}<th class="r">Total</th></tr>`;
  let body;
  if (E) {
    body = moves.map((ex, mi) => {
      const unit = E.units[ex.id];
      const vals = E.vals[ex.id];
      const sets = vals.map((v) => (unit === 'sec' ? { t: num(v) } : { r: v === '' ? '' : num(v) }));
      return `<tr><td class="g">${mi + 1}</td>
        <td><div class="row-flex" style="gap:6px;flex-wrap:nowrap"><span style="font-weight:600;flex:1">${esc(ex.name)}</span>
          <button class="icon-btn sm" data-a="abMove" data-id="${ex.id}" data-d="-1" aria-label="Move ${esc(ex.name)} up" ${mi ? '' : 'disabled'}>↑</button><button class="icon-btn sm" data-a="abMove" data-id="${ex.id}" data-d="1" aria-label="Move ${esc(ex.name)} down" ${mi < moves.length - 1 ? '' : 'disabled'}>↓</button></div>
          <select class="sel unitsel" data-c="abUnit" data-id="${ex.id}" aria-label="${esc(ex.name)} counted in">${Object.entries(UNIT).map(([u, l]) => `<option value="${u}" ${u === unit ? 'selected' : ''}>${l}</option>`).join('')}</select></td>
        ${vals.map((v, ri) => `<td class="rd"><input class="inp num cell" value="${esc(v)}" data-i="abCell" data-id="${ex.id}" data-r="${ri}" inputmode="numeric" aria-label="${esc(ex.name)} round ${ri + 1}"></td>`).join('')}
        <td class="tot" id="abTot-${ex.id}">${abTotal(sets, unit)}</td></tr>`;
    }).join('');
  } else if (logged) {
    body = c.rows.map((r, mi) => {
      const sets = r.s ? r.s.sets : [];
      return `<tr><td class="g">${mi + 1}</td><td><span style="font-weight:600">${esc(r.ex.name)}</span><span class="unit">${UNIT[r.unit]}</span></td>
        ${Array.from({ length: cols }, (_, i) => `<td class="rd">${sets[i] ? `${esc(setVal(sets[i], r.unit))}${r.unit === 'sec' ? '<span class="faint"> s</span>' : ''}` : '<span class="faint">—</span>'}</td>`).join('')}
        <td class="tot">${abTotal(sets, r.unit)}</td></tr>`;
    }).join('');
  } else {
    body = moves.map((ex, mi) => `<tr><td class="g">${mi + 1}</td><td><span style="font-weight:600">${esc(ex.name)}</span><span class="unit">${UNIT[abUnit(ex)]}</span></td>${Array.from({ length: cols }, () => '<td class="rd faint">—</td>').join('')}<td class="tot faint">—</td></tr>`).join('');
  }
  const foot = E
    ? `<div class="addbar"><button class="btn sm" data-a="abRound" data-d="1">${ic('plus', 12, 2.2)} Round</button><button class="btn ghost sm" data-a="abRound" data-d="-1" ${E.rounds > 1 ? '' : 'disabled'}>− Round</button>
        <label class="fld">How hard was it?<select class="sel" data-c="abEffort" aria-label="How hard the circuit felt">${['hard', 'moderate', 'easy'].map((e) => `<option value="${e}" ${E.effort === e ? 'selected' : ''}>${e[0].toUpperCase() + e.slice(1)}</option>`).join('')}</select></label>
        <label class="fld" style="flex:1;min-width:220px">Note<input class="inp" value="${esc(E.note)}" data-i="abNote" placeholder="e.g. 5 min rest between rounds"></label>
        <button class="btn ghost" data-a="abCancel">Cancel</button><button class="btn primary" data-a="abSave">Save circuit</button></div>`
    : dates.length ? `<div class="hist"><span class="small muted">Recent</span>${dates.slice(0, 8).map((d) => `<button class="chip ${d === k ? 'on' : ''}" data-a="hGo" data-k="${d}">${shortDay(d)} · <span class="mono">${circuitOn(d).rounds}</span></button>`).join('')}</div>` : '';
  return `<div class="sheet circuit">${head}<table>${colgroup}${thead}${body}</table>${foot}</div>`;
}

// What kind of day it is for training: one of the split days, Abs or Rest. Set by the person;
// until then it is read off what was logged that day.
// 5 workout days: Shoulders & Chest, Arms, Back & Abs (Back lifts + the ab circuit), Legs, Abs.
const DAY_TYPES = ['Shoulders & Chest', 'Arms', 'Back & Abs', 'Legs', 'Abs', 'Rest'];
const dayGroup = (t) => (t === 'Back & Abs' ? 'Back' : t); // which lift group a day shows
function trainingOn(k) {
  if (DB.training && DB.training[k]) return { type: DB.training[k] === 'Back' ? 'Back & Abs' : DB.training[k], set: true };
  const ses = DB.sessions.filter((s) => s.date === k).map((s) => DB.exercises.find((e) => e.id === s.exId)).filter(Boolean);
  const lift = ses.find((e) => !isBodyweight(e));
  const abs = ses.some(isBodyweight);
  if (lift && lift.group === 'Back') return { type: 'Back & Abs', set: false };
  if (abs) return { type: 'Abs', set: false };
  return { type: lift ? lift.group : '', set: false };
}
function liftsTable(k, group) {
  const weighted = DB.exercises.filter((ex) => !isBodyweight(ex));
  const loggedIds = new Set(DB.sessions.filter((s) => s.date === k).map((s) => s.exId));
  const show = weighted.filter((ex) => !group || ex.group === group || loggedIds.has(ex.id));
  const groups = [...SPLIT.filter((g) => g !== 'Abs'), ...new Set(show.map((ex) => ex.group).filter((g) => !SPLIT.includes(g)))];
  const rows = groups.map((g) => {
    const list = show.filter((ex) => ex.group === g);
    if (!list.length) return '';
    return `<tr class="sec"><td class="g"></td><td colspan="4">${esc(g)}</td></tr>` + list.map((ex) => {
      const tw = targetWeights(ex, k);
      const last = lastSession(ex, k);
      const day = DB.sessions.find((s) => s.exId === ex.id && s.date === k);
      let row = `<tr><td class="g"></td><td style="font-weight:600">${esc(ex.name)}</td>
        <td class="mono">${day ? day.sets.map((x) => setText(x, false)).join(' / ') : '<span class="faint">—</span>'}</td>
        <td><span class="mono" style="font-weight:600">${tw.w.join(' / ')}</span><span class="unit">${last ? `last ${shortDay(last.date)}: ${last.sets.map((x) => setText(x, false)).join(' / ')} · ` : ''}${esc(tw.why)}</span>
          <button class="rulechip" data-a="exRuleOpen" data-id="${ex.id}" aria-expanded="${ui.ruleEx === ex.id}" title="How this lift moves up">${ex.rule === 'manual' ? 'manual' : `+${exStep(ex)} lb${ex.rule === 'try' ? ' · try' : ''}`}${toFailure(ex) ? '' : ' · not to failure'}</button></td>
        <td class="c"><button class="btn sm ${day ? '' : 'primary'}" data-a="logEx" data-id="${ex.id}">${day ? 'Edit' : 'Log'}</button></td></tr>`;
      if (ui.ruleEx === ex.id) {
        row += `<tr class="chiprow"><td class="g"></td><td colspan="4"><div class="row-flex ruleedit">
          <span class="small muted">${esc(ex.name)} moves up by</span><input class="inp num" id="ruleStep" value="${exStep(ex)}" aria-label="Step in lb"><span class="faint">lb per set, when</span>
          <select class="sel" id="ruleKind" aria-label="Rule">${Object.entries(RULES).map(([r, l]) => `<option value="${r}" ${r === (ex.rule || 'reps15') ? 'selected' : ''}>${l}</option>`).join('')}</select>
          <label class="row-flex small" style="gap:6px"><input type="checkbox" id="ruleFail" ${toFailure(ex) ? 'checked' : ''}> Sets to failure</label>
          <button class="btn primary sm" data-a="exRuleSave" data-id="${ex.id}">Save</button><button class="btn ghost sm" data-a="exRuleOpen" data-id="${ex.id}">Cancel</button></div></td></tr>`;
      }
      if (ui.logEx === ex.id) {
        if (!ui.logSets) ui.logSets = day ? day.sets.map((x) => ({ ...x })) : tw.w.map((w) => ({ w, r: '' }));
        const sets = ui.logSets;
        const heads = sets.map((_, i) => `<th>Set ${i + 1}</th>`).join('');
        const wRow = sets.map((x, i) => `<td><input class="inp num" id="w${i}" value="${esc(x.w)}" inputmode="decimal" aria-label="Set ${i + 1} weight in lb"></td>`).join('');
        const rRow = sets.map((x, i) => `<td><input class="inp num" id="r${i}" value="${esc(x.r)}" placeholder="—" inputmode="numeric" aria-label="Set ${i + 1} reps"></td>`).join('');
        row += `<tr class="chiprow"><td class="g"></td><td colspan="4"><div class="liftedit">
          <table class="setgrid"><tr><th></th>${heads}</tr><tr><th>Weight (lb)</th>${wRow}</tr><tr><th>Reps</th>${rRow}</tr></table>
          <div class="row-flex"><button class="btn sm" data-a="liftSet" data-d="1">${ic('plus', 12, 2.2)} Set</button>${sets.length > 1 ? '<button class="btn ghost sm" data-a="liftSet" data-d="-1">− Set</button>' : ''}<span style="flex:1"></span><button class="btn ghost sm" data-a="logEx" data-id="${ex.id}">Cancel</button><button class="btn primary sm" data-a="saveEx" data-id="${ex.id}">Save</button></div>
        </div></td></tr>`;
      }
      return row;
    }).join('');
  }).join('');
  const empty = group ? `No ${esc(group)} lifts yet. Add them below.` : 'Add the lifts from your split below.';
  return `<div class="sheet"><table><colgroup><col style="width:40px"><col style="width:200px"><col><col style="width:290px"><col style="width:80px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td></td></tr>
    <tr><th class="g">#</th><th>Lift</th><th>${k === todayKey() ? 'Today' : shortDay(k)} (lb × reps)</th><th>Target this week (lb)</th><th></th></tr>
    ${rows || `<tr><td class="g">1</td><td colspan="4" class="faint">${empty}</td></tr>`}
  </table>
  <div class="addbar"><input class="inp" id="exName" placeholder="Exercise, e.g. Lat pulldown" style="flex:1;min-width:180px" aria-label="Exercise name">
    <select class="sel" id="exGroup" aria-label="Split day" data-c="exGroup">${SPLIT.filter((g) => g !== 'Abs').map((g) => `<option ${g === group ? 'selected' : ''}>${esc(g)}</option>`).join('')}<option value="Abs">Abs (circuit)</option></select>
    <span id="exWts" class="row-flex" style="gap:8px"><span class="small muted">Start (lb)</span><input class="inp num" id="exW1" placeholder="Set 1" aria-label="Set 1 weight"><input class="inp num" id="exW2" placeholder="Set 2" aria-label="Set 2 weight"><input class="inp num" id="exW3" placeholder="Set 3" aria-label="Set 3 weight"></span>
    <button class="btn" data-a="addEx">Add exercise</button></div></div>`;
}
// Estimated calories a workout burns, on top of the resting day. Sets are taken to failure unless marked otherwise:
// - lifts: vigorous weight training, MET 6 (MET 3.5 for sets not to failure), about 3 min per set including rest;
// - ab circuit: calisthenics at the effort logged for it (hard MET 8, moderate 3.8, easy 2.8), timed from the work (about 2 s a rep; reps per side are quick touches, about 1 s each; plus held seconds).
// kcal = (MET − 1) × body kg × hours; the 1 MET of rest is already in the day's baseline.
// Every lift is taken to failure except the ones marked otherwise; traps (shrugs) and wrist curls default to not.
const toFailure = (ex) => (ex.failure != null ? !!ex.failure : !/trap|shrug|wrist curl/i.test(ex.name || ''));
const AB_MET = { hard: 8, moderate: 3.8, easy: 2.8 }; // how hard the ab circuit felt → MET for the calorie estimate
function workoutBurn(k) {
  const kg = num(DB.settings.bodyKg) || 68;
  let liftSets = 0, easySets = 0, abSecs = 0, abKcal = 0;
  DB.sessions.filter((s) => s.date === k).forEach((s) => {
    const ex = DB.exercises.find((e) => e.id === s.exId);
    if (!ex) return;
    if (isBodyweight(ex)) {
      let secs = 0;
      s.sets.forEach((x) => { secs += x.t ? num(x.t) : num(x.r) * 2; });
      abSecs += secs; abKcal += ((AB_MET[s.effort] || AB_MET.hard) - 1) * kg * (secs / 3600);
    }
    else if (toFailure(ex)) liftSets += s.sets.length;
    else easySets += s.sets.length;
  });
  const abMin = abSecs / 60;
  const kcal = Math.round(5 * kg * (liftSets * 3 / 60) + 2.5 * kg * (easySets * 3 / 60) + abKcal);
  return { kcal, liftSets, easySets, abMin: Math.round(abMin), mins: Math.round((liftSets + easySets) * 3 + abMin) };
}
function workoutsSection(k) {
  const tr = trainingOn(k);
  const seg = `<div class="seg daytype" role="group" aria-label="Training for ${shortDay(k)}">${DAY_TYPES.map((t) => `<button class="${tr.type === t ? 'on' : ''}" data-a="setTrain" data-t="${esc(t)}" aria-pressed="${tr.type === t}">${t === 'Abs' ? 'Ab day' : t === 'Rest' ? 'Rest day' : esc(t)}</button>`).join('')}</div>`;
  let body;
  if (tr.type === 'Rest') body = `<div class="restcard"><span class="ttl">Rest day</span><span class="muted">Nothing to log. Recovery is part of the plan.</span></div>`;
  else if (tr.type === 'Abs') body = abCircuit(k);
  else if (tr.type === 'Back & Abs') body = liftsTable(k, 'Back') + `<div style="margin-top:14px">${abCircuit(k)}</div>`;
  else if (tr.type) body = liftsTable(k, dayGroup(tr.type));
  else body = `<div class="restcard"><span class="ttl">What was ${k === todayKey() ? 'today' : DOW[parseKey(k).getDay()]}?</span><span class="muted">Pick the day above: a split day shows its lifts, Ab day shows the circuit, Rest day logs a rest.</span></div>`;
  const wb = workoutBurn(k);
  const burnLine = wb.kcal ? `<div class="burnline"><span class="mono big">~${wb.kcal}</span> kcal burned by this workout <span class="muted">· ${[wb.liftSets ? `${wb.liftSets} set${wb.liftSets === 1 ? '' : 's'} to failure` : '', wb.easySets ? `${wb.easySets} not to failure` : '', wb.abMin ? `${wb.abMin} min of circuit work` : ''].filter(Boolean).join(' + ')} · estimate</span></div>` : '';
  return `<div class="section"><div class="section-head"><h2 class="h2">Workout</h2><span class="hint">Each lift moves up by its own step (tap the chip under a target to change it). Ab circuit: add a round when every round feels solid.</span></div>
  ${seg}${burnLine}${body}</div>`;
}

VIEWS.health = () => {
  const k = ui.hDate;
  const t = foodTotals(k);
  const burn = DB.burns[k];
  const S = DB.settings;
  const ws = weekStart(k);
  let wkDef = 0, wkDays = 0;
  for (let i = 0; i < 7; i++) { const dk = addDays(ws, i); if (DB.burns[dk] != null && foodTotals(dk).n) { wkDef += DB.burns[dk] - foodTotals(dk).cal; wkDays++; } }
  const foods = DB.foods.filter((x) => x.date === k);
  const body = MEALS.map((m) => {
    const items = foods.filter((x) => x.meal === m);
    if (!items.length) return '';
    return `<tr class="sec"><td class="g"></td><td colspan="8">${m}</td></tr>` + items.map((x) => `<tr><td class="g"></td><td>${esc(x.name)}${x.note ? ` <span class="faint small">· ${esc(x.note)}</span>` : ''}</td><td class="mono small muted">${esc(x.qty)}</td><td class="mono r">${Math.round(x.cal)}</td><td class="mono r">${r1(x.p)}</td><td class="mono r">${r1(x.c)}</td><td class="mono r">${r1(x.fib)}</td><td class="mono r">${r1(x.f)}</td><td class="c"><button class="icon-btn" data-a="delFood" data-id="${x.id}" aria-label="Remove ${esc(x.name)}">${ic('x', 13)}</button></td></tr>`).join('');
  }).join('');
  const lib = DB.foodLibrary.map((f) => `<option value="${esc(f.name)}">${esc(f.serving)} · ${f.cal} cal</option>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Health</span><div class="row-flex" style="align-items:baseline;gap:14px"><h1 class="h1">${DOW[parseKey(k).getDay()]}</h1><span class="h1sub">${longDate(k)}</span></div></div>${dateNav('hNav', k === todayKey() ? 'Today' : 'Go to today')}</div>
  <div class="stats">
    <div class="stat"><span class="k">Eaten</span><span class="v">${Math.round(t.cal)}</span></div>
    <div class="stat"><span class="k">Burned</span><input class="inp num" style="width:110px;height:34px;font-size:18px" value="${burn ?? ''}" placeholder="enter" data-c="burn" aria-label="Calories burned"></div>
    <div class="stat"><span class="k">Deficit</span><span class="v">${burn != null ? Math.round(burn - t.cal) : '—'}</span></div>
    <div class="stat"><span class="k">Protein · ${S.proteinTarget} g goal</span><span class="v">${r1(t.p)}</span><div class="bar"><i style="width:${Math.min(100, pct(t.p, S.proteinTarget))}%"></i></div></div>
    <div class="stat"><span class="k">Fiber · ${S.fiberTarget} g goal</span><span class="v">${r1(t.fib)}</span><div class="bar alt"><i style="width:${Math.min(100, pct(t.fib, S.fiberTarget))}%"></i></div></div>
    <div class="stat"><span class="k">Week deficit · ${wkDays} day${wkDays === 1 ? '' : 's'}</span><span class="v">${wkDays ? Math.round(wkDef) : '—'}</span></div>
  </div>
  <div class="sheet"><table><colgroup><col style="width:40px"><col><col style="width:120px"><col style="width:70px"><col style="width:84px"><col style="width:74px"><col style="width:74px"><col style="width:62px"><col style="width:52px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td>F</td><td>G</td><td></td></tr>
    <tr><th class="g">#</th><th>Food</th><th>Qty</th><th class="r">Cal</th><th class="r">Protein</th><th class="r">Carbs</th><th class="r">Fiber</th><th class="r">Fat</th><th></th></tr>
    ${body || '<tr><td class="g">1</td><td colspan="8" class="faint">Nothing logged yet for this day.</td></tr>'}
    <tr class="total"><td class="g"></td><td>Total</td><td></td><td class="mono r">${Math.round(t.cal)}</td><td class="mono r">${r1(t.p)}</td><td class="mono r">${r1(t.c)}</td><td class="mono r">${r1(t.fib)}</td><td class="mono r">${r1(t.f)}</td><td></td></tr>
  </table>
  <div class="addbar">
    <label class="fld">Meal<select class="sel" id="fMeal">${MEALS.map((m) => `<option>${m}</option>`).join('')}</select></label>
    <label class="fld" style="flex:1;min-width:200px">Food<input class="inp" id="fName" list="foodlib" placeholder="Pick from library or type" data-i="foodPick"></label>
    <datalist id="foodlib">${lib}</datalist>
    <label class="fld">Servings<input class="inp num" id="fSrv" value="1" data-i="foodPick"></label>
    <label class="fld">Cal<input class="inp num" id="fCal"></label>
    <label class="fld">Protein<input class="inp num" id="fP"></label>
    <label class="fld">Carbs<input class="inp num" id="fC"></label>
    <label class="fld">Fiber<input class="inp num" id="fFib"></label>
    <label class="fld">Fat<input class="inp num" id="fF"></label>
    <button class="btn primary" data-a="addFood">Add</button>
  </div></div>
  <details class="box" style="margin-top:12px"><summary>Food library (${DB.foodLibrary.length})</summary><div class="inner"><div class="hint">Values are per serving. Add new foods with the row at the bottom; anything marked “estimate” is a guess you can correct.</div>
    <div class="sheet"><table><colgroup><col><col style="width:110px"><col style="width:66px"><col style="width:84px"><col style="width:74px"><col style="width:74px"><col style="width:62px"><col style="width:52px"></colgroup>
    <tr><th>Food</th><th>Serving</th><th class="r">Cal</th><th class="r">Protein</th><th class="r">Carbs</th><th class="r">Fiber</th><th class="r">Fat</th><th></th></tr>
    ${DB.foodLibrary.map((f) => `<tr><td>${esc(f.name)}${f.note ? ` <span class="faint small">· ${esc(f.note)}</span>` : ''}</td><td class="small muted">${esc(f.serving)}</td><td class="mono r">${f.cal}</td><td class="mono r">${f.p}</td><td class="mono r">${f.c}</td><td class="mono r">${f.fib}</td><td class="mono r">${f.f}</td><td class="c"><button class="icon-btn" data-a="delLib" data-id="${f.id}" aria-label="Remove ${esc(f.name)}">${ic('x', 13)}</button></td></tr>`).join('')}
    </table><div class="addbar"><input class="inp" id="lName" placeholder="Food" style="flex:1;min-width:160px" aria-label="Food name"><input class="inp" id="lSrv" placeholder="Serving" style="width:110px" aria-label="Serving"><input class="inp num" id="lCal" placeholder="Cal" aria-label="Calories"><input class="inp num" id="lP" placeholder="P" aria-label="Protein"><input class="inp num" id="lC" placeholder="C" aria-label="Carbs"><input class="inp num" id="lFib" placeholder="Fib" aria-label="Fiber"><input class="inp num" id="lF" placeholder="F" aria-label="Fat"><button class="btn" data-a="addLib">Add to library</button></div></div></div></details>

  ${workoutsSection(k)}`;
};

// ---------- spending ----------
function expensesIn(from, to) { return DB.expenses.filter((e) => e.date >= from && e.date <= to); }
VIEWS.spending = () => {
  const mk = ui.sMonth;
  const mFrom = mk + '-01', mTo = mk + '-31';
  const tk = todayKey(), ws = weekStart(tk);
  const month = expensesIn(mFrom, mTo).sort((a, b) => (a.date < b.date ? 1 : -1));
  const week = expensesIn(ws, addDays(ws, 6));
  const sum = (a) => a.reduce((s, e) => s + e.amount, 0);
  const byCat = DB.categories.map((c) => ({ c, w: sum(week.filter((e) => e.category === c)), m: sum(month.filter((e) => e.category === c)) }));
  const top = byCat.filter((x) => x.m > 0).sort((a, b) => b.m - a.m)[0];
  const byCard = DB.cards.map((c) => ({ c, w: sum(week.filter((e) => e.card === c)), m: sum(month.filter((e) => e.card === c)) }));
  const noCard = { w: sum(week.filter((e) => !e.card || !DB.cards.includes(e.card))), m: sum(month.filter((e) => !e.card || !DB.cards.includes(e.card))) };
  const rows = month.map((e, i) => `<tr><td class="g">${i + 1}</td><td class="mono">${shortDay(e.date)}</td><td>${esc(e.item)}</td><td class="small">${esc(e.category)}</td><td class="small">${e.card ? esc(e.card) : '<span class="faint">—</span>'}</td><td class="mono r">${money(e.amount)}</td><td class="c"><button class="icon-btn" data-a="delExp" data-id="${e.id}" aria-label="Remove ${esc(e.item)}">${ic('x', 13)}</button></td></tr>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Spending</span><h1 class="h1">${monthLabel(mk).split(' ')[0]}</h1></div>${dateNav('sNav', 'This month')}</div>
  <div class="stats"><div class="stat"><span class="k">This week</span><span class="v">${money(sum(week))}</span></div><div class="stat"><span class="k">${monthLabel(mk)}</span><span class="v">${money(sum(month))}</span></div><div class="stat"><span class="k">Top category</span><span class="v" style="font-size:17px;font-family:var(--sans);font-weight:600">${top ? esc(top.c) : '—'}</span></div><div class="stat"><span class="k">Entries</span><span class="v">${month.length}</span></div></div>
  <div class="cols"><div class="grow"><div class="sheet"><table><colgroup><col style="width:40px"><col style="width:84px"><col><col style="width:130px"><col style="width:150px"><col style="width:112px"><col style="width:52px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td></td></tr>
    <tr><th class="g">#</th><th>Date</th><th>Item</th><th>Category</th><th>Card</th><th class="r">Amount</th><th></th></tr>
    ${rows || '<tr><td class="g">1</td><td colspan="6" class="faint">No spending logged this month.</td></tr>'}
  </table>
  <div class="addbar"><label class="fld">Date<input class="inp" type="date" id="eDate" value="${tk}"></label><label class="fld" style="flex:1;min-width:160px">Item<input class="inp" id="eItem" placeholder="Lunch, gas, Netflix…"></label><label class="fld">Category<select class="sel" id="eCat">${DB.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label><label class="fld">Card<select class="sel" id="eCard">${DB.cards.map((c) => `<option ${c === ui.lastCard ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="" ${ui.lastCard === '' ? 'selected' : ''}>Cash / other</option></select></label><label class="fld">Amount<input class="inp num" id="eAmt" placeholder="0.00"></label><button class="btn primary" data-a="addExp">Add</button></div></div></div>
  <aside class="panel" style="width:310px"><h2 class="h2" style="font-size:22px">By category</h2><div class="sheet"><table><colgroup><col><col style="width:96px"><col style="width:96px"></colgroup><tr><th>Category</th><th class="r">Week</th><th class="r">Month</th></tr>
    ${byCat.map((x) => `<tr><td class="small">${esc(x.c)}</td><td class="mono r small ${x.w ? '' : 'faint'}">${money(x.w)}</td><td class="mono r small ${x.m ? '' : 'faint'}">${money(x.m)}</td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="mono r small">${money(sum(week))}</td><td class="mono r small">${money(sum(month))}</td></tr></table></div>
    <h2 class="h2" style="font-size:22px;margin-top:8px">By card</h2><div class="sheet"><table><colgroup><col><col style="width:96px"><col style="width:96px"></colgroup><tr><th>Card</th><th class="r">Week</th><th class="r">Month</th></tr>
    ${byCard.map((x) => `<tr><td class="small">${esc(x.c)}</td><td class="mono r small ${x.w ? '' : 'faint'}">${money(x.w)}</td><td class="mono r small ${x.m ? '' : 'faint'}">${money(x.m)}</td></tr>`).join('')}
    ${noCard.m || noCard.w ? `<tr><td class="small muted">Cash / other</td><td class="mono r small">${money(noCard.w)}</td><td class="mono r small">${money(noCard.m)}</td></tr>` : ''}</table></div>
    <details class="box"><summary>Edit cards</summary><div class="inner"><div class="chips">${DB.cards.map((c, i) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px;cursor:default">${esc(c)}<button class="icon-btn" style="width:20px;height:20px;border:none;background:none" data-a="delCard" data-i="${i}" aria-label="Remove ${esc(c)}">${ic('x', 12, 2.2)}</button></span>`).join('')}</div><input class="inp" placeholder="+ Add card" data-c="addCard" aria-label="Add card"></div></details>
    <details class="box"><summary>Edit categories</summary><div class="inner"><div class="chips">${DB.categories.map((c, i) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px;cursor:default">${esc(c)}<button class="icon-btn" style="width:20px;height:20px;border:none;background:none" data-a="delCat" data-i="${i}" aria-label="Remove ${esc(c)}">${ic('x', 12, 2.2)}</button></span>`).join('')}</div><input class="inp" placeholder="+ Add category" data-c="addCat" aria-label="Add category"></div></details>
  </aside></div>`;
};

// ---------- summary ----------
function summarize(from, to) {
  const tk = todayKey();
  if (to > tk) to = tk;
  const keys = Object.keys(DB.days).filter((k) => k >= from && k <= to).sort();
  const sc = keys.map((k) => dayScore(DB.days[k])).filter(Boolean);
  const picks = {};
  keys.forEach((k) => { const d = DB.days[k]; d.blocks.forEach((b) => { const v = d.choices[b.id]; if (b.kind === 'choice' && v) { const L = listById(b.listId); const ln = L ? L.name : 'Other'; picks[ln] = picks[ln] || {}; picks[ln][v] = (picks[ln][v] || 0) + 1; } }); });
  const foodDays = [];
  for (let k = from; k <= to; k = addDays(k, 1)) { const t = foodTotals(k); if (t.n) foodDays.push({ k, t }); }
  const avg = (f) => (foodDays.length ? foodDays.reduce((a, x) => a + f(x.t), 0) / foodDays.length : null);
  let def = 0, defDays = 0;
  foodDays.forEach((x) => { if (DB.burns[x.k] != null) { def += DB.burns[x.k] - x.t.cal; defDays++; } });
  const ex = expensesIn(from, to);
  const spend = ex.reduce((a, e) => a + e.amount, 0);
  const cats = {}, cardsT = {};
  ex.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; const k = e.card || 'Cash / other'; cardsT[k] = (cardsT[k] || 0) + e.amount; });
  return {
    planned: keys.length, avgScore: sc.length ? Math.round(sc.reduce((a, s) => a + s.pct, 0) / sc.length) : null,
    blocksDone: sc.reduce((a, s) => a + s.done, 0), blocksTotal: sc.reduce((a, s) => a + s.total, 0), picks,
    foodDays: foodDays.length, avgCal: avg((t) => t.cal), avgP: avg((t) => t.p), avgFib: avg((t) => t.fib),
    proteinHit: foodDays.filter((x) => x.t.p >= DB.settings.proteinTarget).length, def, defDays, spend, cats, cardsT,
    workouts: DB.sessions.filter((s) => s.date >= from && s.date <= to).length
  };
}
VIEWS.summary = () => {
  const tk = todayKey(), ws = weekStart(tk), ms = monthKey(tk) + '-01';
  const W = summarize(ws, addDays(ws, 6)), M = summarize(ms, monthKey(tk) + '-31');
  const row = (label, a, b) => `<tr><td>${label}</td><td class="mono r">${a ?? '—'}</td><td class="mono r">${b ?? '—'}</td></tr>`;
  const sec = (t) => `<tr class="sec"><td colspan="3">${t}</td></tr>`;
  const f0 = (v) => (v == null ? '—' : Math.round(v));
  const lists = new Set([...Object.keys(W.picks), ...Object.keys(M.picks)]);
  let pickRows = '';
  lists.forEach((ln) => {
    pickRows += sec(esc(ln));
    const opts = new Set([...Object.keys(W.picks[ln] || {}), ...Object.keys(M.picks[ln] || {})]);
    [...opts].sort((a, b) => ((M.picks[ln] || {})[b] || 0) - ((M.picks[ln] || {})[a] || 0)).forEach((o) => { pickRows += row(esc(o), (W.picks[ln] || {})[o] || 0, (M.picks[ln] || {})[o] || 0); });
  });
  const cats = new Set([...Object.keys(W.cats), ...Object.keys(M.cats)]);
  return `<div class="head"><div class="head-title"><span class="kicker">Summary · so far</span><h1 class="h1">How it’s going</h1></div></div>
  <div class="stats"><div class="stat"><span class="k">Avg score · this week</span><span class="v" style="color:var(--accT)">${W.avgScore ?? '—'}${W.avgScore != null ? '%' : ''}</span></div><div class="stat"><span class="k">Avg score · ${MON[parseKey(tk).getMonth()]}</span><span class="v" style="color:var(--accT)">${M.avgScore ?? '—'}${M.avgScore != null ? '%' : ''}</span></div><div class="stat"><span class="k">Spent · this week</span><span class="v">${money(W.spend)}</span></div><div class="stat"><span class="k">Spent · ${MON[parseKey(tk).getMonth()]}</span><span class="v">${money(M.spend)}</span></div></div>
  <div class="sheet" style="max-width:760px"><table><colgroup><col><col style="width:140px"><col style="width:140px"></colgroup>
    <tr><th>Metric</th><th class="r">This week</th><th class="r">This month</th></tr>
    ${sec('Routine')}${row('Days planned', W.planned, M.planned)}${row('Average day score', W.avgScore != null ? W.avgScore + '%' : '—', M.avgScore != null ? M.avgScore + '%' : '—')}${row('Blocks done', `${W.blocksDone}/${W.blocksTotal}`, `${M.blocksDone}/${M.blocksTotal}`)}${row('Workout sessions logged', W.workouts, M.workouts)}
    ${pickRows}
    ${sec('Health')}${row('Days with food logged', W.foodDays, M.foodDays)}${row('Avg calories', f0(W.avgCal), f0(M.avgCal))}${row('Avg protein (g)', f0(W.avgP), f0(M.avgP))}${row('Avg fiber (g)', f0(W.avgFib), f0(M.avgFib))}${row(`Days protein ≥ ${DB.settings.proteinTarget} g`, W.proteinHit, M.proteinHit)}${row('Total deficit (cal)', W.defDays ? Math.round(W.def) : '—', M.defDays ? Math.round(M.def) : '—')}
    ${sec('Spending')}${row('Total', money(W.spend), money(M.spend))}${[...cats].sort((a, b) => (M.cats[b] || 0) - (M.cats[a] || 0)).map((c) => row(esc(c), money(W.cats[c] || 0), money(M.cats[c] || 0))).join('')}
    ${(() => { const cs = new Set([...Object.keys(W.cardsT), ...Object.keys(M.cardsT)]); return cs.size ? sec('Spending by card') + [...cs].sort((a, b) => (M.cardsT[b] || 0) - (M.cardsT[a] || 0)).map((c) => row(esc(c), money(W.cardsT[c] || 0), money(M.cardsT[c] || 0))).join('') : ''; })()}
  </table></div><div class="hint" style="margin-top:10px">Week starts Monday. Only days up to today count.</div>`;
};

// ---------- settings ----------
VIEWS.settings = () => {
  const S = DB.settings;
  return `<div class="head"><div class="head-title"><span class="kicker">Settings</span><h1 class="h1">Preferences</h1></div></div>
  <div class="sheet" style="max-width:640px;padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="row-flex"><label class="fld">Protein goal (g)<input class="inp num" value="${S.proteinTarget}" data-c="set" data-f="proteinTarget"></label><label class="fld">Fiber goal (g)<input class="inp num" value="${S.fiberTarget}" data-c="set" data-f="fiberTarget"></label><label class="fld">Body weight (kg)<input class="inp num" value="${S.bodyKg ?? 68}" data-c="set" data-f="bodyKg"></label><label class="fld">Currency<input class="inp" style="width:70px" value="${esc(S.currency)}" data-c="set" data-f="currency"></label></div>
    ${window.api ? `<label class="row-flex small"><input type="checkbox" id="loginChk" data-c="login"> Open Wellness when I log in (so alerts keep coming)</label>
    <div class="row-flex"><button class="btn" data-a="testNote">Send a test notification</button><span class="hint">If nothing shows, allow Wellness in System Settings → Notifications.</span></div>` : '<div class="hint">Running in a browser preview: notifications and open-at-login work in the Mac app.</div>'}
    ${window.api && window.api.updateInfo ? `<div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">
      <div class="row-flex" style="justify-content:space-between"><b>Updates</b><span class="mono small muted" id="updVer"></span></div>
      <div class="row-flex"><label class="fld" style="flex:1">GitHub repo (owner/name)<input class="inp" id="updRepo" placeholder="your-name/wellness"></label>
        <label class="fld" style="flex:1">Access token (private repos only)<input class="inp" id="updToken" type="password" placeholder="leave empty for public"></label></div>
      <div class="row-flex"><button class="btn" data-a="updSave">Save</button><button class="btn primary" data-a="updCheck">Check for updates</button><span class="hint" id="updMsg">Wellness also checks by itself when it opens and every few hours.</span></div>
    </div>` : ''}
    <div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">
      <b>Sync &amp; Claude connector</b>
      <div class="row-flex"><label class="fld" style="flex:2">Server URL<input class="inp" id="syncUrl" placeholder="https://xxxx.supabase.co/functions/v1/wellness" value="${esc(Sync.cfg ? Sync.cfg.url : '')}"></label>
        <label class="fld" style="flex:1">Key<input class="inp" id="syncKey" type="password" placeholder="${Sync.cfg && Sync.cfg.key ? 'saved ••••••' : 'your Wellness key'}"></label></div>
      <div class="row-flex"><button class="btn primary" data-a="syncSave">${Sync.on() ? 'Save & sync now' : 'Connect'}</button>${Sync.on() ? '<button class="btn danger" data-a="syncOff">Disconnect</button>' : ''}<span class="hint" id="syncMsg"></span></div>
    </div>
    <div class="row-flex"><button class="btn" data-a="export">Export my data (JSON)</button><label class="btn" style="cursor:pointer">Import data<input type="file" accept="application/json" data-c="import" class="sr"></label></div>
    <div class="hint">Light and dark follow your Mac’s appearance (System Settings → Appearance).</div>
  </div>`;
};

// ---------- actions ----------
function readLogSets(sets) {
  const val = (id) => { const el = $('#' + id); return el ? el.value.trim() : null; };
  sets.forEach((s, i) => {
    const w = val('w' + i), r = val('r' + i), t = val('t' + i);
    if (w !== null) s.w = num(w);
    if (r !== null) s.r = r === '' ? '' : num(r);
    if (t !== null) { if (t === '' || !num(t)) delete s.t; else s.t = num(t); }
  });
}
const A = {
  go: (el) => go(el.dataset.v),
  dayNav: (el) => { const d = +el.dataset.d; ui.date = d === 0 ? todayKey() : addDays(ui.date, d); ui.open = null; ui.editDay = false; render(); },
  weekNav: (el) => { const d = +el.dataset.d; ui.week = d === 0 ? weekStart(todayKey()) : addDays(ui.week, 7 * d); render(); },
  monthNav: (el) => { const d = +el.dataset.d; ui.month = d === 0 ? monthKey(todayKey()) : addMonths(ui.month, d); render(); },
  hNav: (el) => { const d = +el.dataset.d; ui.hDate = d === 0 ? todayKey() : addDays(ui.hDate, d); ui.logEx = null; ui.logSets = null; ui.ab = null; render(); },
  sNav: (el) => { const d = +el.dataset.d; ui.sMonth = d === 0 ? monthKey(todayKey()) : addMonths(ui.sMonth, d); render(); },
  openDay: (el) => { ui.date = el.dataset.k; ui.view = 'today'; ui.open = null; ui.editDay = false; render(); },
  tick: (el) => { const d = DB.days[ui.date]; d.done[el.dataset.b] = !d.done[el.dataset.b]; save(); render(); },
  pickOpen: (el) => { ui.open = ui.open === el.dataset.b ? null : el.dataset.b; render(); },
  pick: (el) => { const d = DB.days[ui.date]; if (el.dataset.o) d.choices[el.dataset.b] = el.dataset.o; else delete d.choices[el.dataset.b]; ui.open = null; save(); render(); },
  applyHere: () => { const id = $('#applySel').value; if (applyPlan(ui.date, id)) render(); },
  blankDay: () => { DB.days[ui.date] = { planId: null, planName: 'Custom day', color: '#7C8B4E', blocks: [], done: {}, choices: {}, notes: '' }; ui.editDay = true; save(); render(); },
  editDay: () => { ui.editDay = !ui.editDay; if (!ui.editDay) { pruneBlocks(DB.days[ui.date].blocks, DB.days[ui.date].done); sortBlocks(DB.days[ui.date].blocks); } save(); render(); },
  clearDay: () => { if (confirm(`Remove the plan from ${shortDay(ui.date)}? Ticks and picks for that day are deleted.`)) { delete DB.days[ui.date]; ui.editDay = false; save(); render(); } },
  newPlan: () => {
    const p = { id: uid(), name: 'New plan', color: PLAN_COLORS[DB.plans.length % PLAN_COLORS.length], blocks: [] };
    DB.plans.push(p); ui.planId = p.id; ui.view = 'plans'; save(); render();
    const n = $('#planName'); if (n) { n.focus(); n.select(); }
  },
  selPlan: (el) => { ui.planId = el.dataset.p; render(); },
  planColor: (el) => { planById(ui.planId).color = el.dataset.col; save(); render(); },
  dupPlan: () => { const p = planById(ui.planId); const c = { ...p, id: uid(), name: p.name + ' copy', blocks: p.blocks.map((b) => ({ ...b, id: uid() })) }; DB.plans.push(c); ui.planId = c.id; save(); render(); },
  delPlan: () => { const p = planById(ui.planId); if (confirm(`Delete the plan “${p.name}”? Days that already use it keep their blocks.`)) { DB.plans = DB.plans.filter((x) => x !== p); ui.planId = null; save(); render(); } },
  applyPlanToday: () => { if (applyPlan(todayKey(), ui.planId)) { ui.date = todayKey(); toast('Applied to today'); go('today'); } },
  blkAdd: (el) => {
    const bl = scopeBlocks(el.dataset.s);
    const last = bl.filter((b) => b.end || b.start).slice(-1)[0];
    bl.push({ id: uid(), start: last ? last.end || '' : '', end: '', title: '', kind: 'task', listId: DB.choiceLists[0] ? DB.choiceLists[0].id : null, alert: true });
    save(); render();
    const ins = document.querySelectorAll(`[data-s="${el.dataset.s}"][data-f="title"]`); if (ins.length) ins[ins.length - 1].focus();
  },
  blkDel: (el) => { const bl = scopeBlocks(el.dataset.s); const i = bl.findIndex((b) => b.id === el.dataset.b); bl.splice(i, 1); if (el.dataset.s === 'day') delete DB.days[ui.date].done[el.dataset.b]; save(); render(); },
  blkAlert: (el) => { const b = scopeBlocks(el.dataset.s).find((x) => x.id === el.dataset.b); b.alert = !b.alert; save(); render(); },
  newList: () => { DB.choiceLists.push({ id: uid(), name: 'New list', options: [], distinct: false }); save(); render(); },
  delList: (el) => { const L = listById(el.dataset.l); if (confirm(`Delete the list “${L.name}”?`)) { DB.choiceLists = DB.choiceLists.filter((x) => x !== L); save(); render(); } },
  delOpt: (el) => { listById(el.dataset.l).options.splice(+el.dataset.i, 1); save(); render(); },
  fillWeek: () => { const id = $('#fillSel').value; let n = 0; for (let i = 0; i < 7; i++) { const k = addDays(ui.week, i); if (!DB.days[k]) { applyPlan(k, id); n++; } } toast(n ? `Filled ${n} day${n === 1 ? '' : 's'}` : 'No empty days'); render(); },
  addFood: () => {
    const name = $('#fName').value.trim(); if (!name) { $('#fName').focus(); return; }
    const srv = num($('#fSrv').value) || 1;
    const lib = DB.foodLibrary.find((f) => f.name.toLowerCase() === name.toLowerCase());
    DB.foods.push({ id: uid(), date: ui.hDate, meal: $('#fMeal').value, name, qty: lib ? qtyText(srv, lib.serving) : (srv === 1 ? '1 serving' : srv + ' servings'), cal: num($('#fCal').value), p: num($('#fP').value), c: num($('#fC').value), fib: num($('#fFib').value), f: num($('#fF').value), note: lib ? lib.note : '' });
    save(); render(); toast('Added ' + name);
  },
  delFood: (el) => { DB.foods = DB.foods.filter((x) => x.id !== el.dataset.id); save(); render(); },
  addLib: () => { const n = $('#lName').value.trim(); if (!n) return; DB.foodLibrary.push({ id: uid(), name: n, serving: $('#lSrv').value.trim() || '1 serving', cal: num($('#lCal').value), p: num($('#lP').value), c: num($('#lC').value), fib: num($('#lFib').value), f: num($('#lF').value), note: '' }); save(); render(); },
  delLib: (el) => { DB.foodLibrary = DB.foodLibrary.filter((x) => x.id !== el.dataset.id); save(); render(); },
  addEx: () => {
    const n = $('#exName').value.trim(); if (!n) return;
    const group = $('#exGroup').value, body = group === 'Abs';
    DB.exercises.push({ id: uid(), name: n, group, kind: body ? 'bodyweight' : 'weights', start: body ? [] : [num($('#exW1').value), num($('#exW2').value), num($('#exW3').value)], ...(body ? { pos: abMoves().length } : {}) });
    save(); render();
  },
  logEx: (el) => { ui.logEx = ui.logEx === el.dataset.id ? null : el.dataset.id; ui.logSets = null; ui.ruleEx = null; render(); },
  liftSet: (el) => {
    const sets = ui.logSets; if (!sets) return;
    readLogSets(sets);
    if (+el.dataset.d > 0) { const last = sets[sets.length - 1] || { w: 0, r: '' }; sets.push({ w: last.w, r: '' }); } else if (sets.length > 1) sets.pop();
    render();
  },
  exRuleOpen: (el) => { ui.ruleEx = ui.ruleEx === el.dataset.id ? null : el.dataset.id; ui.logEx = null; render(); },
  exRuleSave: (el) => {
    const ex = DB.exercises.find((e) => e.id === el.dataset.id); if (!ex) return;
    ex.step = num($('#ruleStep').value) || 10; ex.rule = $('#ruleKind').value; ex.failure = $('#ruleFail').checked;
    ui.ruleEx = null; save(); render(); toast('Saved how ' + ex.name + ' moves up');
  },
  setTrain: (el) => {
    const k = ui.hDate, t = el.dataset.t;
    DB.training = DB.training || {};
    if (DB.training[k] === t) delete DB.training[k]; else DB.training[k] = t;
    ui.ab = null; ui.logEx = null; ui.logSets = null; save(); render();
  },
  hGo: (el) => { ui.hDate = el.dataset.k; ui.ab = null; ui.logEx = null; render(); },
  abEdit: () => {
    const k = ui.hDate, dates = abDates();
    const src = dates.includes(k) ? k : dates.find((d) => d < k);
    const c = src ? circuitOn(src) : null;
    const rounds = (c && c.rounds) || 1;
    const vals = {}, units = {};
    abMoves().forEach((ex) => {
      units[ex.id] = abUnit(ex);
      const row = c && c.rows.find((r) => r.ex.id === ex.id);
      const sets = row && row.s ? row.s.sets : [];
      vals[ex.id] = Array.from({ length: rounds }, (_, i) => (sets[i] ? String(setVal(sets[i], units[ex.id])) : sets.length ? String(setVal(sets[sets.length - 1], units[ex.id])) : ''));
    });
    ui.ab = { date: k, rounds, vals, units, note: c ? c.note : '', effort: c && c.rounds && c.date === k ? c.effort : 'hard' };
    render();
  },
  abRound: (el) => {
    const E = ui.ab; if (!E) return;
    if (+el.dataset.d > 0) { E.rounds++; Object.values(E.vals).forEach((v) => v.push(v.length ? v[v.length - 1] : '')); }
    else if (E.rounds > 1) { E.rounds--; Object.values(E.vals).forEach((v) => v.pop()); }
    render();
  },
  abMove: (el) => {
    const moves = abMoves();
    const i = moves.findIndex((e) => e.id === el.dataset.id), j = i + +el.dataset.d;
    if (i < 0 || j < 0 || j >= moves.length) return;
    [moves[i], moves[j]] = [moves[j], moves[i]];
    moves.forEach((e, n) => { e.pos = n; });
    save(); render();
  },
  abCancel: () => { ui.ab = null; render(); },
  abSave: () => {
    const E = ui.ab; if (!E) return;
    let logged = 0;
    abMoves().forEach((ex) => {
      const unit = E.units[ex.id];
      ex.unit = unit;
      const sets = E.vals[ex.id].filter((v) => String(v).trim() !== '' && num(v) > 0)
        .map((v) => (unit === 'sec' ? { w: 0, r: '', t: num(v) } : { w: 0, r: num(v), ...(unit === 'side' ? { side: true } : {}) }));
      const prior = DB.sessions.find((s) => s.exId === ex.id && s.date === E.date);
      DB.sessions = DB.sessions.filter((s) => !(s.exId === ex.id && s.date === E.date));
      if (!sets.length) return;
      const ses = { ...(prior || {}), id: prior ? prior.id : uid(), exId: ex.id, date: E.date, sets };
      if (E.note.trim()) ses.note = E.note.trim(); else delete ses.note;
      ses.effort = E.effort || 'hard';
      DB.sessions.push(ses);
      logged++;
    });
    if (logged && DB.training && !DB.training[E.date]) DB.training[E.date] = trainingOn(E.date).type || 'Abs';
    ui.ab = null; save(); render(); toast(logged ? 'Circuit saved' : 'Circuit cleared');
  },
  saveEx: (el) => {
    const sets = ui.logSets || [];
    readLogSets(sets);
    const prior = DB.sessions.find((s) => s.exId === el.dataset.id && s.date === ui.hDate);
    DB.sessions = DB.sessions.filter((s) => !(s.exId === el.dataset.id && s.date === ui.hDate));
    DB.sessions.push({ ...(prior || {}), id: prior ? prior.id : uid(), exId: el.dataset.id, date: ui.hDate, sets: sets.map((s) => ({ ...s })) });
    ui.logEx = null; ui.logSets = null; save(); render(); toast('Workout saved');
  },
  addExp: () => { const item = $('#eItem').value.trim(); const amt = num($('#eAmt').value); if (!item || !amt) { (item ? $('#eAmt') : $('#eItem')).focus(); return; } ui.lastCard = $('#eCard').value; DB.expenses.push({ id: uid(), date: $('#eDate').value || todayKey(), item, category: $('#eCat').value, card: ui.lastCard, amount: amt }); save(); render(); toast('Added ' + money(amt)); },
  delExp: (el) => { DB.expenses = DB.expenses.filter((x) => x.id !== el.dataset.id); save(); render(); },
  delCard: (el) => { DB.cards.splice(+el.dataset.i, 1); save(); render(); },
  delCat: (el) => { DB.categories.splice(+el.dataset.i, 1); save(); render(); },
  syncSave: async () => {
    const url = $('#syncUrl').value.trim(), key = $('#syncKey').value.trim() || (Sync.cfg && Sync.cfg.key) || '';
    if (!/^https:\/\//.test(url) || !key) { $('#syncMsg').textContent = 'Enter the server URL (https://…) and your key.'; return; }
    if (!Sync.cfg || Sync.cfg.url !== url) { Sync.state = { rev: 0, base: null }; Sync.keep(); }
    Sync.cfg = { url, key }; localStorage.setItem('wellness-sync', JSON.stringify(Sync.cfg));
    $('#syncKey').value = ''; $('#syncMsg').textContent = 'Connecting…';
    await Sync.pull(); render(); showSyncStatus();
  },
  syncOff: () => { if (!confirm('Stop syncing? Your data stays on this Mac.')) return; Sync.cfg = null; localStorage.removeItem('wellness-sync'); render(); },
  updSave: async () => { const i = await window.api.updateSet({ repo: $('#updRepo').value, token: $('#updToken').value }); $('#updToken').value = ''; toast(i.configured ? 'Saved' : 'Repo should look like owner/name'); },
  updCheck: async () => {
    const m = $('#updMsg'); m.textContent = 'Checking…';
    const r = await window.api.updateCheck();
    const msg = { current: 'You’re on the latest version.', updated: 'Updated to version ' + r.version + '. Reloading…', 'not-configured': 'Add the GitHub repo first, then Save.', 'needs-rebuild': 'A bigger update needs a one-time rebuild (npm run install-app).', busy: 'Already checking…', error: 'Couldn’t check: ' + r.error }[r.status];
    m.textContent = msg;
    if (r.status === 'updated') setTimeout(() => window.api.reload(), 800);
  },
  updReload: () => window.api.reload(),
  testNote: async () => { const ok = await window.api.testNotification(); toast(ok ? 'Sent — check the top-right of your screen' : 'Notifications not supported'); },
  export: () => { const blob = new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `wellness-${todayKey()}.json`; a.click(); }
};

const C = {
  abEffort: (el) => { if (ui.ab) ui.ab.effort = el.value; },
  abUnit: (el) => { if (ui.ab) { ui.ab.units[el.dataset.id] = el.value; render(); } },
  exGroup: (el) => { const w = $('#exWts'); if (w) w.style.display = el.value === 'Abs' ? 'none' : ''; },
  blk: (el) => {
    const b = scopeBlocks(el.dataset.s).find((x) => x.id === el.dataset.b);
    if (!b) return;
    const f = el.dataset.f;
    if (f === 'start' || f === 'end') {
      // Read the whole typed time when the box loses focus; never redraw mid-typing.
      const hm = parseTimeInput(el.value);
      if (hm === null) { toast(`Couldn’t read “${el.value}”. Try 9, 930, 4pm or 16:00`); el.value = fmtTime(b[f]); return; }
      b[f] = hm;
      el.value = fmtTime(hm);
      ui.blkResort = el.dataset.s;
      save();
      return;
    }
    b[f] = el.value;
    if (f === 'kind' && el.value === 'choice' && !b.listId && DB.choiceLists[0]) b.listId = DB.choiceLists[0].id;
    save();
    if (f !== 'title') render();
  },
  notes: (el) => { DB.days[ui.date].notes = el.value; save(); },
  planName: (el) => { planById(ui.planId).name = el.value.trim() || 'Untitled plan'; save(); render(); },
  weekPlan: (el) => {
    const k = el.dataset.k;
    if (el.value === '__custom') return;
    if (!el.value) { if (DB.days[k] && confirm(`Remove the plan from ${shortDay(k)}?`)) { delete DB.days[k]; save(); } render(); return; }
    applyPlan(k, el.value); render();
  },
  listName: (el) => { listById(el.dataset.l).name = el.value.trim() || 'Untitled list'; save(); render(); },
  listDistinct: (el) => { listById(el.dataset.l).distinct = el.checked; save(); },
  addOpt: (el) => { const v = el.value.trim(); if (v) { listById(el.dataset.l).options.push(v); save(); render(); const n = document.querySelector(`[data-c="addOpt"][data-l="${el.dataset.l}"]`); if (n) n.focus(); } },
  burn: (el) => { if (el.value.trim() === '') delete DB.burns[ui.hDate]; else DB.burns[ui.hDate] = num(el.value); save(); render(); },
  addCard: (el) => { const v = el.value.trim(); if (v && !DB.cards.includes(v)) { DB.cards.push(v); save(); render(); } },
  addCat: (el) => { const v = el.value.trim(); if (v && !DB.categories.includes(v)) { DB.categories.push(v); save(); render(); } },
  set: (el) => { const f = el.dataset.f; DB.settings[f] = f === 'currency' ? el.value : num(el.value); save(); },
  login: async (el) => { const on = await window.api.setOpenAtLogin(el.checked); el.checked = on; },
  import: (el) => {
    const file = el.files[0]; if (!file) return;
    file.text().then((t) => { try { const d = JSON.parse(t); if (!d || !d.days || !d.plans) throw 0; if (!confirm('Replace all your current data with this file?')) return; DB = Object.assign(defaults(), d); save(); render(); toast('Data imported'); } catch { alert('That file doesn’t look like a Wellness export.'); } });
  }
};

// food autofill from library
const I = {
  abCell: (el) => {
    const E = ui.ab; if (!E) return;
    E.vals[el.dataset.id][+el.dataset.r] = el.value.trim();
    const unit = E.units[el.dataset.id];
    const t = $('#abTot-' + el.dataset.id);
    if (t) t.innerHTML = abTotal(E.vals[el.dataset.id].map((v) => (unit === 'sec' ? { t: num(v) } : { r: num(v) })), unit);
  },
  abNote: (el) => { if (ui.ab) ui.ab.note = el.value; },
  foodPick: () => {
    const name = $('#fName').value.trim().toLowerCase();
    const lib = DB.foodLibrary.find((f) => f.name.toLowerCase() === name);
    if (!lib) return;
    const s = num($('#fSrv').value) || 1;
    $('#fCal').value = Math.round(lib.cal * s); $('#fP').value = r1(lib.p * s); $('#fC').value = r1(lib.c * s); $('#fFib').value = r1(lib.fib * s); $('#fF').value = r1(lib.f * s);
  }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-a]');
  if (!el) return;
  const fn = A[el.dataset.a];
  if (fn) { e.preventDefault(); fn(el); }
});
// Clicking into a time box selects what's there, so typing replaces it.
let timeJustFocused = null;
document.addEventListener('focusin', (e) => { if (e.target.matches && e.target.matches('.blk-editor .inp.time')) { timeJustFocused = e.target; e.target.select(); } });
document.addEventListener('mouseup', (e) => { if (timeJustFocused && e.target === timeJustFocused) { e.preventDefault(); timeJustFocused.select(); } timeJustFocused = null; });
// Re-sort blocks by time only once focus leaves the block editor, so typing is never interrupted.
document.addEventListener('focusout', (e) => {
  const ed = e.target.closest && e.target.closest('.blk-editor');
  if (!ed) return;
  setTimeout(() => {
    if (ed.contains(document.activeElement)) return;
    if (ui.blkResort) { const bl = scopeBlocks(ui.blkResort); ui.blkResort = null; if (bl) { sortBlocks(bl); save(); render(); } }
  }, 120);
});
document.addEventListener('change', (e) => { const el = e.target.closest('[data-c]'); if (el && C[el.dataset.c]) C[el.dataset.c](el); });
document.addEventListener('input', (e) => { const el = e.target.closest('[data-i]'); if (el && I[el.dataset.i]) I[el.dataset.i](el); });
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.matches('#eAmt,#eItem')) A.addExp();
  if (e.key === 'Enter' && e.target.matches('#fName,#fSrv,#fCal,#fP,#fC,#fFib,#fF')) A.addFood();
  if (e.key === 'Escape' && ui.open) { ui.open = null; render(); }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderNav);

// refresh the "now" row every minute and roll over at midnight
let lastDay = todayKey();
setInterval(() => {
  const t = todayKey();
  if (t !== lastDay) { if (ui.date === lastDay) ui.date = t; if (ui.hDate === lastDay) ui.hDate = t; lastDay = t; }
  const active = document.activeElement;
  if (ui.view === 'today' && !ui.editDay && !(active && active.matches('input,textarea,select'))) render();
}, 60 * 1000);

if (window.api && window.api.onUpdateReady) window.api.onUpdateReady((r) => {
  const t = $('#toast');
  t.innerHTML = `Wellness updated to version ${r.version}. <button class="btn sm" style="margin-left:10px" data-a="updReload">Reload</button>`;
  t.style.pointerEvents = 'auto'; t.classList.add('show');
});

(async function init() {
  const saved = await store.load();
  DB = saved ? Object.assign(defaults(), saved) : defaults();
  const before = JSON.stringify(DB);
  pruneAll();
  if (saved && JSON.stringify(DB) !== before) save();
  if (!saved) save();
  render();
  Sync.pull();
  setInterval(() => Sync.pull(), 20 * 1000);
  window.addEventListener('focus', () => Sync.pull());
  document.addEventListener('focusout', () => setTimeout(() => { if (refreshView.later && !(document.activeElement && document.activeElement.matches('input,textarea,select'))) { refreshView.later = false; render(); } }, 50));
  if (window.api && window.api.updateInfo) { try { APP_VERSION = (await window.api.updateInfo()).version; renderNav(); } catch {} }
  if (window.api) { const on = await window.api.getOpenAtLogin(); const c = $('#loginChk'); if (c) c.checked = on; }
})();
