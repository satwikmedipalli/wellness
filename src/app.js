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
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
  auto: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  cloud: '<path d="M17.5 19H7a5 5 0 1 1 1.2-9.9A6 6 0 0 1 19.6 11 4 4 0 0 1 17.5 19z"/>',
  food: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2.5-3 6s1.4 4 3 4v8"/>',
  dollar: '<path d="M12 2v20M17 6H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>'
};
const ic = (n, s = 16, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ---------- data ----------
function defaults() {
  const F = (name, serving, cal, f, c, fib, p, note) => ({ id: uid(), name, serving, cal, f, c, fib, p, note: note || '' });
  return {
    version: 1,
    settings: { proteinTarget: 70, fiberTarget: 20, currency: '$', bodyKg: 68, deficitGoal: 500, workoutDaysGoal: 5 },
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
    expenses: [],
    income: [], incomeSources: ['Salary', 'Stocks'], pay: { on: false, amount: 0, freq: 'biweekly', next: '' },
    trades: []
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
  logEx: null, logSets: null, ruleEx: null, ab: null, lastCard: undefined,
  biPage: null, biEdit: false, biDraft: null, biEditId: null, biF: []
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
const NAV = [['today', 'Today'], ['week', 'Week'], ['plans', 'Plans'], ['log', 'Log'], ['health', 'Health'], ['spending', 'Money'], ['summary', 'Dashboard'], ['settings', 'Settings']];
// ---------- glass shell: docks, top bar, theme, quick actions ----------
const NAV_DESC = { today: 'Your plan for the day, live', week: 'The week at a glance', plans: 'Day templates and blocks', log: 'Every day, scored', health: 'Food, burn, deficit and workouts', spending: 'Spending and income, net and savings rate', summary: 'Build-your-own dashboards', settings: 'Goals, sync and updates' };
function dockHTML(side) {
  return `<span class="dind" aria-hidden="true"></span>` + NAV.map(([k, l]) => `<button class="dk ${ui.view === k ? 'on' : ''}" data-a="go" data-v="${k}" ${ui.view === k ? 'aria-current="page"' : ''} aria-label="${l}">${ic(k, 17)}${side ? `<span class="dtip">${l}</span>` : `<span class="dtx">${l}</span>`}</button>`).join('');
}
function placeDock(nav) {
  const cur = nav && nav.querySelector('.dk.on'), ind = nav && nav.querySelector('.dind');
  if (!cur || !ind) return;
  ind.style.width = cur.offsetWidth + 'px'; ind.style.height = cur.offsetHeight + 'px';
  ind.style.transform = `translate(${cur.offsetLeft}px,${cur.offsetTop}px)`;
  requestAnimationFrame(() => ind.classList.add('ready'));
}
function askText() {
  const tk = todayKey(), day = DB && DB.days[tk];
  if (day && typeof nowNext === 'function') {
    const { now, next } = nowNext(day), t = nowMins();
    const dur = (m) => { m = Math.max(0, Math.round(m)); const h = Math.floor(m / 60), mm = m % 60; return h ? `${h}h${mm ? ' ' + mm + 'm' : ''}` : `${mm}m`; };
    if (now) return `Now · ${now.b.title} · ${dur(now.e - t)} left`;
    if (next) return `Next · ${next.b.title} at ${fmtTime(next.b.start)}`;
    return 'Day done · search or jump to…';
  }
  return 'Search or jump to…';
}
function themePref() { try { return localStorage.getItem('wellness-theme') || 'auto'; } catch { return 'auto'; } }
function applyTheme() {
  const t = themePref(); if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const b = $('#themeBtn'); if (b) { b.innerHTML = ic(t === 'light' ? 'sun' : t === 'dark' ? 'moon' : 'auto', 17); b.title = t === 'auto' ? 'Theme: follows your Mac' : 'Theme: ' + t; }
}
function applyBg() { const img = $('#bgimg'); if (!img) return; let u = null; try { u = localStorage.getItem('wellness-bg'); } catch {} if (u) { img.src = u; img.hidden = false; document.body.classList.add('photo'); } else { img.hidden = true; img.removeAttribute('src'); document.body.classList.remove('photo'); } }
function renderNav() {
  const a = $('#nav'), b = $('#nav2');
  if (a) a.innerHTML = dockHTML(true);
  if (b) b.innerHTML = dockHTML(false);
  requestAnimationFrame(() => { placeDock(a); placeDock(b); });
  const p = $('#gprompt'); if (p) p.textContent = askText();
  const g = $('#gsub'); if (g) { const d = new Date(); g.textContent = DOW[d.getDay()] + ', ' + MON[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); }
  const sb = $('#syncBtn'); if (sb) { sb.innerHTML = ic('cloud', 17) + `<i class="${Sync.on() ? (Sync.error ? 'bad' : 'ok') : 'off'}"></i>`; sb.title = Sync.on() ? (Sync.error ? 'Sync problem — open Settings' : 'Synced with the Claude connector') : 'Sync is off'; }
  applyTheme();
}
addEventListener('resize', () => { placeDock($('#nav')); placeDock($('#nav2')); });
const CMD_ACTIONS = [
  { k: 'food', label: 'Log food', desc: 'Add something you ate today', run: () => { ui.hDate = todayKey(); go('health'); setTimeout(() => { const f = $('#fName'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } }, 50); } },
  { k: 'dollar', label: 'Add an expense', desc: 'Log a purchase', run: () => { go('spending'); setTimeout(() => { const f = $('#eItem'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } }, 50); } },
  { k: 'dollar', label: 'Add income', desc: 'Log pay or a stock sale', run: () => { ui.mTab = 'income'; go('spending'); setTimeout(() => { const f = $('#iAmt'); if (f) { f.scrollIntoView({ block: 'center' }); f.focus(); } }, 50); } },
  { k: 'health', label: 'Log a workout', desc: 'Open today’s workout', run: () => { ui.hDate = todayKey(); go('health'); setTimeout(() => { const w = document.querySelector('.seg.daytype'); if (w) w.scrollIntoView({ block: 'start' }); }, 50); } }
];
function cmdItems(q) {
  const items = [...CMD_ACTIONS.map((x) => ({ ...x, kind: 'Action' })), ...NAV.map(([k, l]) => ({ k, label: l, desc: NAV_DESC[k] || '', kind: 'Go to', run: () => go(k) }))];
  const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
  return items.filter((x) => terms.every((t) => (x.label + ' ' + x.desc).toLowerCase().includes(t)));
}
function renderCmd() {
  const box = $('#cmd'); if (!box) return;
  if (!ui.cmd) { box.innerHTML = ''; return; }
  const list = cmdItems(ui.cmdQ || '');
  box.innerHTML = `<div class="cmdback" data-a="cmdClose"></div><div class="cmdbox" role="dialog" aria-label="Quick actions"><label class="cmdin">${ic('search', 16)}<input id="cmdQ" placeholder="Search pages or actions…" value="${esc(ui.cmdQ || '')}" data-i="cmdQ" autocomplete="off"><kbd>esc</kbd></label>
    <div class="cmdlist">${list.map((x, i) => `<button class="cmdrow ${i === (ui.cmdSel || 0) ? 'on' : ''}" data-a="cmdRun" data-i="${i}"><span class="cmdic">${ic(x.k, 16)}</span><span><b>${esc(x.label)}</b><small>${esc(x.desc)}</small></span><em>${x.kind}</em></button>`).join('') || '<div class="hint" style="padding:12px">Nothing matches.</div>'}</div></div>`;
  const inp = $('#cmdQ'); if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function render() {
  renderNav();
  const v = VIEWS[ui.view] || VIEWS.today;
  const m = $('#main');
  const st = m.scrollTop;
  m.innerHTML = v();
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
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Drinks'];
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
// 5 workout days: Shoulders & Chest, Arms, Back, Legs, Abs (the bodyweight circuit and the equipment ab moves).
const DAY_TYPES = ['Shoulders & Chest', 'Arms', 'Back', 'Legs', 'Abs', 'Rest'];
const dayGroup = (t) => t; // which lift group a day shows
function trainingOn(k) {
  if (DB.training && DB.training[k]) return { type: DB.training[k] === 'Back & Abs' ? 'Back' : DB.training[k], set: true };
  const ses = DB.sessions.filter((s) => s.date === k).map((s) => DB.exercises.find((e) => e.id === s.exId)).filter(Boolean);
  const lift = ses.find((e) => !isBodyweight(e) && e.group !== 'Abs');
  if (lift) return { type: lift.group, set: false };
  if (ses.length) return { type: 'Abs', set: false };
  return { type: '', set: false };
}
// Weighted lifts for the day: `groups` is one split group or a list of them.
// Abs lifts here are the equipment ab moves (kind 'weights'); the bodyweight circuit has its own card.
function liftsTable(k, groups) {
  const want = [].concat(groups || []);
  const group = want[0] || '';
  const weighted = DB.exercises.filter((ex) => !isBodyweight(ex));
  const loggedIds = new Set(DB.sessions.filter((s) => s.date === k).map((s) => s.exId));
  const show = weighted.filter((ex) => !want.length || want.includes(ex.group) || loggedIds.has(ex.id));
  groups = [...SPLIT, ...new Set(show.map((ex) => ex.group).filter((g) => !SPLIT.includes(g)))];
  const rows = groups.map((g) => {
    const list = show.filter((ex) => ex.group === g);
    if (!list.length) return '';
    return `<tr class="sec"><td class="g"></td><td colspan="4">${esc(g)}</td></tr>` + list.map((ex) => {
      const tw = targetWeights(ex, k);
      const last = lastSession(ex, k);
      const day = DB.sessions.find((s) => s.exId === ex.id && s.date === k);
      let row = `<tr><td class="g"></td><td style="font-weight:600">${esc(ex.name)}</td>
        <td class="mono">${day ? day.sets.map((x) => setText(x, false)).join(' / ') : '<span class="faint">—</span>'}</td>
        <td>${!last && !tw.w.some((x) => num(x)) ? '<span class="mono faint">—</span><span class="unit">your first session sets the starting weights</span>' : `<span class="mono" style="font-weight:600">${tw.w.join(' / ')}</span><span class="unit">${last ? `last ${shortDay(last.date)}: ${last.sets.map((x) => setText(x, false)).join(' / ')} · ` : ''}${esc(tw.why)}</span>`}
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
        if (!ui.logSets) ui.logSets = day ? day.sets.map((x) => ({ ...x })) : tw.w.length ? tw.w.map((w) => ({ w, r: '' })) : [{ w: '', r: '' }, { w: '', r: '' }, { w: '', r: '' }];
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
    <select class="sel" id="exGroup" aria-label="Split day" data-c="exGroup">${SPLIT.filter((g) => g !== 'Abs').map((g) => `<option ${g === group ? 'selected' : ''}>${esc(g)}</option>`).join('')}<option value="Abs|weights">Abs (weights)</option><option value="Abs">Abs (bodyweight circuit)</option></select>
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
  // Ab day: the bodyweight circuit, then the equipment ab moves (weighted Abs lifts) when there are any.
  const hasAbLifts = DB.exercises.some((e) => e.group === 'Abs' && !isBodyweight(e));
  const seg = `<div class="seg daytype" role="group" aria-label="Training for ${shortDay(k)}">${DAY_TYPES.map((t) => `<button class="${tr.type === t ? 'on' : ''}" data-a="setTrain" data-t="${esc(t)}" aria-pressed="${tr.type === t}">${t === 'Abs' ? 'Ab day' : t === 'Rest' ? 'Rest day' : esc(t)}</button>`).join('')}</div>`;
  let body;
  if (tr.type === 'Rest') body = `<div class="restcard"><span class="ttl">Rest day</span><span class="muted">Nothing to log. Recovery is part of the plan.</span></div>`;
  else if (tr.type === 'Abs') body = abCircuit(k) + (hasAbLifts ? `<div style="margin-top:14px">${liftsTable(k, ['Abs'])}</div>` : '');
  else if (tr.type) body = liftsTable(k, dayGroup(tr.type));
  else body = `<div class="restcard"><span class="ttl">What was ${k === todayKey() ? 'today' : DOW[parseKey(k).getDay()]}?</span><span class="muted">Pick the day above: a split day shows its lifts, Ab day shows the circuit, Rest day logs a rest.</span></div>`;
  const wb = workoutBurn(k);
  const burnLine = wb.kcal ? `<div class="burnline"><span class="mono big">~${wb.kcal}</span> kcal burned by this workout <span class="muted">· ${[wb.liftSets ? `${wb.liftSets} set${wb.liftSets === 1 ? '' : 's'} to failure` : '', wb.easySets ? `${wb.easySets} not to failure` : '', wb.abMin ? `${wb.abMin} min of circuit work` : ''].filter(Boolean).join(' + ')} · estimate</span></div>` : '';
  return `<div class="section"><div class="section-head"><h2 class="h2">Workout</h2><span class="hint">Each lift moves up by its own step (tap the chip under a target to change it). Bodyweight ab circuit: add a round when every round feels solid.</span></div>
  ${seg}${burnLine}${body}</div>`;
}

VIEWS.health = () => {
  const k = ui.hDate;
  const t = foodTotals(k);
  const burn = DB.burns[k];
  const S = DB.settings;
  const ws = weekStart(k);
  const { def: wkDef, days: wkDays } = weekDeficit(ws);
  const wg = weekGoal(ws);
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
    <div class="stat"><span class="k">Week deficit · goal ${wg.goal.toLocaleString('en-US')}${wg.carry ? ` (+${wg.carry.toLocaleString('en-US')} carried)` : ''}</span><span class="v">${wkDays ? Math.round(wkDef) : '—'}</span><div class="bar"><i style="width:${Math.min(100, Math.max(0, pct(wkDef, wg.goal)))}%"></i></div></div>
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
const daysIn = (mk) => { const [y, m] = mk.split('-').map(Number); return new Date(y, m, 0).getDate(); };
const moneyShort = (n) => { const c = DB.settings.currency || '$'; return n >= 1000 ? c + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : c + Math.round(n); };
const niceMax = (v) => { if (v <= 10) return 10; const p = Math.pow(10, Math.floor(Math.log10(v))); const s = [1, 2, 2.5, 5, 10].find((x) => x * p >= v); return s * p; };
const sumAmt = (a) => a.reduce((s, e) => s + e.amount, 0);
const cardOf = (e) => (e.card && DB.cards.includes(e.card) ? e.card : 'Cash / other');
const longDay = (k) => { const d = parseKey(k); return DOW[d.getDay()] + ', ' + MON[d.getMonth()].slice(0, 3) + ' ' + d.getDate(); };
const pctTxt = (a, b) => (b ? Math.round((a / b) * 100) + '%' : '—');
const chg = (now, then) => (!then ? (now ? 'new' : '—') : (now >= then ? '▲ ' : '▼ ') + Math.abs(Math.round(((now - then) / then) * 100)) + '%');
// Groups a list of expenses by a key and returns [name, total, count] sorted by total.
const groupBy = (list, key) => { const m = {}; list.forEach((e) => { const k = key(e); m[k] = m[k] || [k, 0, 0]; m[k][1] += e.amount; m[k][2]++; }); return Object.values(m).sort((a, b) => b[1] - a[1]); };

// Hover card content: a title, rows of label/value, and optional sections. Stored escaped in data-tip.
function tip(title, rows, sections = [], foot = '') {
  const tr = (r) => `<tr><td>${r[0]}</td><td>${r[1]}</td></tr>`;
  const html = `<div class="tt-h">${title}</div><table>${rows.map(tr).join('')}</table>${sections.filter((s) => s[1].length).map((s) => `<div class="tt-s">${s[0]}</div><table>${s[1].map(tr).join('')}</table>`).join('')}${foot ? `<div class="tt-f">${foot}</div>` : ''}`;
  return ` data-tip="${esc(html)}"`;
}
const itemRows = (list, n = 5) => [...list].sort((a, b) => b.amount - a.amount).slice(0, n).map((e) => [`${esc(e.item)} <span class="tt-m">· ${esc(cardOf(e))}</span>`, money(e.amount)]);
const more = (list, n = 5) => (list.length > n ? `+ ${list.length - n} more` : '');
const filt = (k, v) => ui.sFilter && ui.sFilter.k === k && ui.sFilter.v === v;

function spendDailyChart(mk, month) {
  const n = daysIn(mk), W = 640, H = 236, L = 44, R = 8, T = 10, B = 24, pw = W - L - R, ph = H - T - B;
  const per = Array.from({ length: n }, (_, i) => month.filter((e) => +e.date.slice(8) === i + 1));
  const max = niceMax(Math.max(...per.map(sumAmt))), slot = pw / n, bw = Math.max(3, Math.min(16, slot - 3));
  const avg = sumAmt(month) / Math.max(1, per.filter((p) => p.length).length);
  const grid = [0, 0.5, 1].map((f) => { const y = T + ph - f * ph; return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="cg"/><text x="${L - 6}" y="${y + 3.5}" class="ct" text-anchor="end">${moneyShort(max * f)}</text>`; }).join('');
  const bars = per.map((list, i) => {
    const v = sumAmt(list), x = L + i * slot + (slot - bw) / 2, h = v ? Math.max(2, (v / max) * ph) : 0, y = T + ph - h, k = `${mk}-${pad(i + 1)}`;
    const t = list.length ? tip(longDay(k), [['Spent', `<b>${money(v)}</b>`], ['Purchases', list.length], ['vs your average day', chg(v, avg)]],
      [['By category', groupBy(list, (e) => e.category).map((g) => [esc(g[0]), money(g[1])])], ['Purchases', itemRows(list)]], more(list) || 'Click to see this day’s purchases') : tip(longDay(k), [['Spent', money(0)]]);
    return `<g class="hit${filt('day', k) ? ' sel' : ''}"${list.length ? ` data-a="sFilt" data-k="day" data-v="${k}"` : ''}${t}><rect x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" fill="transparent"/>${h ? `<path d="M${x},${T + ph} v${-(h - 3)} q0,-3 3,-3 h${bw - 6} q3,0 3,3 v${h - 3} z" class="cb"/>` : ''}</g>`;
  }).join('');
  const ticks = per.map((_, i) => (i === 0 || (i + 1) % 5 === 0) ? `<text x="${L + i * slot + slot / 2}" y="${H - 6}" class="ct" text-anchor="middle">${i + 1}</text>` : '').join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Spending per day in ${monthLabel(mk)}">${grid}${bars}${ticks}</svg>`;
}

function spendPaceChart(mk) {
  const W = 320, H = 170, L = 40, R = 10, T = 12, B = 22, pw = W - L - R, ph = H - T - B;
  const pm = addMonths(mk, -1), tk = todayKey();
  const dayAmt = (m) => { const ex = expensesIn(m + '-01', m + '-31'); return Array.from({ length: daysIn(m) }, (_, i) => sumAmt(ex.filter((e) => +e.date.slice(8) === i + 1))); };
  const cum = (arr, upto) => { let s = 0; return arr.slice(0, upto).map((v) => (s += v)); };
  const upto = monthKey(tk) === mk ? +tk.slice(8) : (mk > monthKey(tk) ? 0 : 31);
  const da = dayAmt(mk), db = dayAmt(pm), a = cum(da, upto), b = cum(db, 31), max = niceMax(Math.max(...a, ...b, 0));
  const X = (d) => L + ((d - 1) / 30) * pw, Y = (v) => T + ph - (v / max) * ph;
  const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${X(i + 1).toFixed(1)},${Y(v).toFixed(1)}`).join('');
  const mA = MON[+mk.slice(5) - 1], mB = MON[+pm.slice(5) - 1];
  const grid = [0, 0.5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" class="cg"/><text x="${L - 6}" y="${Y(max * f) + 3.5}" class="ct" text-anchor="end">${moneyShort(max * f)}</text>`).join('');
  const hits = Array.from({ length: 31 }, (_, i) => {
    const d = i + 1, va = a[i], vb = b[i];
    const rows = [[`${mA} 1–${d}`, va != null ? `<b>${money(va)}</b>` : '—'], [`${mB} 1–${d}`, vb != null ? money(vb) : '—']];
    if (va != null && vb != null) rows.push(['Difference', (va >= vb ? '+' : '−') + money(Math.abs(va - vb)).replace('−', '')]);
    if (va != null) rows.push([`Spent on ${mA.slice(0, 3)} ${d}`, money(da[i] || 0)]);
    return `<g class="hit vline"${tip(`Day ${d}`, rows)}><rect x="${X(d) - pw / 60}" y="${T}" width="${pw / 30}" height="${ph}" fill="transparent"/><line x1="${X(d)}" x2="${X(d)}" y1="${T}" y2="${T + ph}" class="cx"/>${va != null ? `<circle cx="${X(d)}" cy="${Y(va)}" r="4" class="cdot"/>` : ''}${vb != null ? `<circle cx="${X(d)}" cy="${Y(vb)}" r="3.5" class="cdot prev"/>` : ''}</g>`;
  }).join('');
  const endA = a.length ? `<circle cx="${X(a.length)}" cy="${Y(a[a.length - 1])}" r="4" class="cdot"/>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Running total this month versus last month">${grid}
    ${b.length ? `<path d="${path(b)}" class="cl prev"/>` : ''}${a.length ? `<path d="${path(a)}" class="cl"/>` : ''}${endA}
    <text x="${L}" y="${H - 5}" class="ct">1</text><text x="${W - R}" y="${H - 5}" class="ct" text-anchor="end">31</text>${hits}</svg>
    <div class="legend"><span><i class="sw"></i>${mA}</span><span><i class="sw prev"></i>${mB}</span></div>`;
}

function spendMonthsChart(mk) {
  const W = 320, H = 170, L = 40, R = 6, T = 12, B = 22, pw = W - L - R, ph = H - T - B;
  const ms = Array.from({ length: 6 }, (_, i) => addMonths(mk, i - 5));
  const lists = ms.map((m) => expensesIn(m + '-01', m + '-31')), v = lists.map(sumAmt);
  const max = niceMax(Math.max(...v, 0)), slot = pw / 6, bw = Math.min(30, slot - 10), tk = todayKey();
  const grid = [0, 0.5, 1].map((f) => { const y = T + ph - f * ph; return `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="cg"/><text x="${L - 6}" y="${y + 3.5}" class="ct" text-anchor="end">${moneyShort(max * f)}</text>`; }).join('');
  const bars = v.map((x, i) => {
    const bx = L + i * slot + (slot - bw) / 2, h = x ? Math.max(3, (x / max) * ph) : 0, list = lists[i], days = monthKey(tk) === ms[i] ? +tk.slice(8) : daysIn(ms[i]);
    const t = tip(monthLabel(ms[i]), [['Spent', `<b>${money(x)}</b>`], ['Purchases', list.length], ['Daily average', money(x / days)], ['vs month before', chg(x, sumAmt(expensesIn(addMonths(ms[i], -1) + '-01', addMonths(ms[i], -1) + '-31')))]],
      [['Top categories', groupBy(list, (e) => e.category).slice(0, 4).map((g) => [esc(g[0]), money(g[1])])]], i === 5 ? '' : 'Click to open this month');
    return `<g class="hit"${i === 5 ? '' : ` data-a="sGo" data-m="${ms[i]}"`}${t}><rect x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" fill="transparent"/>${h ? `<path d="M${bx},${T + ph} v${-(h - 4)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 v${h - 4} z" class="cb${i === 5 ? '' : ' soft'}"/>` : ''}<text x="${L + i * slot + slot / 2}" y="${H - 6}" class="ct" text-anchor="middle">${MON[+ms[i].slice(5) - 1].slice(0, 3)}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Spending over the last six months">${grid}${bars}</svg>`;
}

// Ranked bars for categories or cards, each with a full hover card; click filters the transactions.
function hbars(kind, month, week, prev, total) {
  const key = kind === 'cat' ? (e) => e.category : cardOf;
  const other = kind === 'cat' ? cardOf : (e) => e.category;
  const items = groupBy(month, key);
  if (!items.length) return '<div class="faint small">No spending this month yet.</div>';
  const max = items[0][1];
  return `<div class="hbars">${items.map(([name, amt, n]) => {
    const list = month.filter((e) => key(e) === name), wk = sumAmt(week.filter((e) => key(e) === name)), pv = sumAmt(prev.filter((e) => key(e) === name));
    const t = tip(esc(name), [['This month', `<b>${money(amt)}</b> <span class="tt-m">· ${pctTxt(amt, total)} of total</span>`], ['This week', money(wk)], ['Purchases', n], ['Average purchase', money(amt / n)], ['Last month', `${money(pv)} <span class="tt-m">· ${chg(amt, pv)}</span>`]],
      [[kind === 'cat' ? 'Paid with' : 'Spent on', groupBy(list, other).slice(0, 4).map((g) => [esc(g[0]), money(g[1])])], ['Biggest purchases', itemRows(list, 3)]], 'Click to show only these purchases');
    return `<div class="hb hit${filt(kind, name) ? ' sel' : ''}" data-a="sFilt" data-k="${kind}" data-v="${esc(name)}"${t}><div class="hb-top"><span class="hb-name">${esc(name)}</span><span class="mono hb-val">${money(amt)}<span class="faint"> · ${pctTxt(amt, total)}</span></span></div><div class="hb-track"><i style="width:${Math.max(2, (amt / max) * 100)}%"></i></div></div>`;
  }).join('')}</div>`;
}

VIEWS.spending = () => {
  const mk = ui.sMonth;
  const tk = todayKey(), ws = weekStart(tk);
  const month = expensesIn(mk + '-01', mk + '-31').sort((a, b) => (a.date < b.date ? 1 : -1));
  const week = expensesIn(ws, addDays(ws, 6));
  const pm = addMonths(mk, -1), prev = expensesIn(pm + '-01', pm + '-31');
  const total = sumAmt(month);
  const cats = groupBy(month, (e) => e.category), top = cats[0];
  const isNow = monthKey(tk) === mk, dayN = isNow ? +tk.slice(8) : daysIn(mk);
  const prevSame = sumAmt(expensesIn(pm + '-01', pm + '-' + pad(Math.min(dayN, daysIn(pm)))));
  const avg = mk > monthKey(tk) ? 0 : total / dayN;
  const biggest = [...month].sort((a, b) => b.amount - a.amount).slice(0, 5);
  const F = ui.sFilter && ui.sFilter.m === mk ? ui.sFilter : null;
  const shown = F ? month.filter((e) => (F.k === 'cat' ? e.category === F.v : F.k === 'card' ? cardOf(e) === F.v : e.date === F.v)) : month;
  const rows = shown.map((e, i) => `<tr${tip(esc(e.item), [['Amount', `<b>${money(e.amount)}</b>`], ['Date', longDay(e.date)], ['Category', esc(e.category)], ['Card', esc(cardOf(e))], ['Share of month', pctTxt(e.amount, total)]])}><td class="g">${i + 1}</td><td class="mono">${shortDay(e.date)}</td><td>${esc(e.item)}</td><td class="small">${esc(e.category)}</td><td class="small">${e.card ? esc(e.card) : '<span class="faint">—</span>'}</td><td class="mono r">${money(e.amount)}</td><td class="c"><button class="icon-btn" data-a="delExp" data-id="${e.id}" aria-label="Remove ${esc(e.item)}">${ic('x', 13)}</button></td></tr>`).join('');
  const fLabel = F ? (F.k === 'day' ? longDay(F.v) : F.v) : '';
  return `<div class="head"><div class="head-title"><span class="kicker">Spending</span><h1 class="h1">${monthLabel(mk).split(' ')[0]}</h1></div>${dateNav('sNav', 'This month')}</div>
  <div class="stats">
    <div class="stat hit"${tip(monthLabel(mk), [['Spent', `<b>${money(total)}</b>`], ['Purchases', month.length], ['Days with spending', new Set(month.map((e) => e.date)).size + ' of ' + dayN]])}><span class="k">${monthLabel(mk)}</span><span class="v">${money(total)}</span></div>
    <div class="stat hit"${tip(`vs ${monthLabel(pm)}`, [[`${MON[+mk.slice(5) - 1].slice(0, 3)} 1–${dayN}`, money(total)], [`${MON[+pm.slice(5) - 1].slice(0, 3)} 1–${Math.min(dayN, daysIn(pm))}`, money(prevSame)], ['Difference', (total >= prevSame ? '+' : '−') + money(Math.abs(total - prevSame)).replace('−', '')], [`All of ${MON[+pm.slice(5) - 1]}`, money(sumAmt(prev))]])}><span class="k">vs ${MON[+pm.slice(5) - 1]}${isNow ? ' · same days' : ''}</span><span class="v">${chg(total, prevSame)}</span><span class="small faint">${prevSame ? money(prevSame) + ' then' : 'nothing logged then'}</span></div>
    <div class="stat hit"${tip('Daily average', [['Per day', `<b>${money(avg)}</b>`], ['Days counted', dayN], ['Per purchase', money(month.length ? total / month.length : 0)], ...(isNow ? [['On pace for the month', money(avg * daysIn(mk))]] : [])])}><span class="k">Daily average</span><span class="v">${money(avg)}</span></div>
    <div class="stat hit"${tip(`Week of ${longDay(ws).split(', ')[1]}`, [['Spent', `<b>${money(sumAmt(week))}</b>`], ['Purchases', week.length]], [['By category', groupBy(week, (e) => e.category).map((g) => [esc(g[0]), money(g[1])])]])}><span class="k">This week</span><span class="v">${money(sumAmt(week))}</span></div>
    <div class="stat hit"${top ? tip(esc(top[0]), [['Spent', `<b>${money(top[1])}</b>`], ['Share of month', pctTxt(top[1], total)], ['Purchases', top[2]]], [['Runner-up', cats.slice(1, 3).map((g) => [esc(g[0]), money(g[1])])]]) : ''}><span class="k">Top category</span><span class="v" style="font-size:17px;font-family:var(--sans);font-weight:600">${top ? esc(top[0]) : '—'}</span>${top ? `<span class="small faint">${money(top[1])} · ${pctTxt(top[1], total)}</span>` : ''}</div>
    <div class="stat"><span class="k">Entries</span><span class="v">${month.length}</span></div>
  </div>
  <div class="dash">
    <section class="dcard span2"><div class="dh"><h2 class="h3">Spending per day</h2><span class="small faint">hover for details · click a bar to filter</span></div>${spendDailyChart(mk, month)}</section>
    <section class="dcard"><div class="dh"><h2 class="h3">By category</h2></div>${hbars('cat', month, week, prev, total)}</section>
    <section class="dcard"><div class="dh"><h2 class="h3">Running total</h2></div>${spendPaceChart(mk)}</section>
    <section class="dcard"><div class="dh"><h2 class="h3">Last 6 months</h2></div>${spendMonthsChart(mk)}</section>
    <section class="dcard"><div class="dh"><h2 class="h3">By card</h2></div>${hbars('card', month, week, prev, total)}</section>
    <section class="dcard span3"><div class="dh"><h2 class="h3">Biggest purchases</h2></div>${biggest.length ? `<div class="bigs">${biggest.map((e, i) => `<div class="big hit"${tip(esc(e.item), [['Amount', `<b>${money(e.amount)}</b>`], ['Date', longDay(e.date)], ['Category', esc(e.category)], ['Card', esc(cardOf(e))], ['Share of month', pctTxt(e.amount, total)]])}><span class="mono faint">${i + 1}</span><span class="big-name">${esc(e.item)}</span><span class="mono small muted">${shortDay(e.date)}</span><span class="small muted">${esc(e.category)}</span><span class="small muted">${esc(cardOf(e))}</span><span class="mono r">${money(e.amount)}</span></div>`).join('')}</div>` : '<div class="faint small">Nothing logged this month.</div>'}</section>
  </div>
  <div class="row-flex" style="margin:22px 0 10px"><h2 class="h2">Transactions</h2>${F ? `<span class="fchip">${esc(fLabel)} · ${shown.length} purchase${shown.length === 1 ? '' : 's'} · ${money(sumAmt(shown))}<button class="icon-btn" data-a="sFiltClear" aria-label="Show all purchases">${ic('x', 12, 2.2)}</button></span>` : ''}</div>
  <div class="sheet"><table><colgroup><col style="width:40px"><col style="width:84px"><col><col style="width:150px"><col style="width:150px"><col style="width:112px"><col style="width:52px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td></td></tr>
    <tr><th class="g">#</th><th>Date</th><th>Item</th><th>Category</th><th>Card</th><th class="r">Amount</th><th></th></tr>
    ${rows || '<tr><td class="g">1</td><td colspan="6" class="faint">No spending logged this month.</td></tr>'}
    ${rows ? `<tr class="total"><td></td><td colspan="4">Total${F ? ' (filtered)' : ''}</td><td class="mono r">${money(sumAmt(shown))}</td><td></td></tr>` : ''}
  </table>
  <div class="addbar"><label class="fld">Date<input class="inp" type="date" id="eDate" value="${tk}"></label><label class="fld" style="flex:1;min-width:160px">Item<input class="inp" id="eItem" placeholder="Lunch, gas, Netflix…"></label><label class="fld">Category<select class="sel" id="eCat">${DB.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label><label class="fld">Card<select class="sel" id="eCard">${DB.cards.map((c) => `<option ${c === ui.lastCard ? 'selected' : ''}>${esc(c)}</option>`).join('')}<option value="" ${ui.lastCard === '' ? 'selected' : ''}>Cash / other</option></select></label><label class="fld">Amount<input class="inp num" id="eAmt" placeholder="0.00"></label><button class="btn primary" data-a="addExp">Add</button></div></div>
  <div class="dash2">
    <details class="box"><summary>Edit cards</summary><div class="inner"><div class="chips">${DB.cards.map((c, i) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px;cursor:default">${esc(c)}<button class="icon-btn" style="width:20px;height:20px;border:none;background:none" data-a="delCard" data-i="${i}" aria-label="Remove ${esc(c)}">${ic('x', 12, 2.2)}</button></span>`).join('')}</div><input class="inp" placeholder="+ Add card" data-c="addCard" aria-label="Add card"></div></details>
    <details class="box"><summary>Edit categories</summary><div class="inner"><div class="chips">${DB.categories.map((c, i) => `<span class="chip" style="display:inline-flex;align-items:center;gap:4px;cursor:default">${esc(c)}<button class="icon-btn" style="width:20px;height:20px;border:none;background:none" data-a="delCat" data-i="${i}" aria-label="Remove ${esc(c)}">${ic('x', 12, 2.2)}</button></span>`).join('')}</div><input class="inp" placeholder="+ Add category" data-c="addCat" aria-label="Add category"></div></details>
  </div>`;
};

// Floating hover card for anything with data-tip (spending dashboard).
const tipEl = (() => { const d = document.createElement('div'); d.className = 'ctip'; d.setAttribute('role', 'tooltip'); (document.body || document.documentElement).appendChild(d); return d; })();
document.addEventListener('mousemove', (e) => {
  const t = e.target.closest && e.target.closest('[data-tip]');
  if (!t) { tipEl.classList.remove('on'); tipEl._src = null; return; }
  if (tipEl._src !== t) { tipEl.innerHTML = t.dataset.tip; tipEl._src = t; }
  tipEl.classList.add('on');
  const r = tipEl.getBoundingClientRect(), pad2 = 14;
  let x = e.clientX + pad2, y = e.clientY + pad2;
  if (x + r.width > innerWidth - 8) x = e.clientX - r.width - pad2;
  if (y + r.height > innerHeight - 8) y = Math.max(8, e.clientY - r.height - pad2);
  tipEl.style.transform = `translate(${x}px,${y}px)`;
});
const hideTip = () => { tipEl.classList.remove('on'); tipEl._src = null; };
document.addEventListener('mouseleave', hideTip);
document.addEventListener('click', hideTip, true);
document.addEventListener('wheel', hideTip, { passive: true });

// ---------- trades (stocks + options) ----------
// A trade is { id, kind: stock|option, symbol, side: long|short, qty, buy, sell, open, close, fees, opt?: {type, strike, expiry} }.
// Long: buy at open, sell at close. Short: sell at open, buy back at close. Options are per contract (× 100).
// P/L = (sell − buy) × qty × multiplier − fees, counted as Stocks income on the close date.
const tradeMult = (t) => (t.kind === 'option' ? 100 : 1);
const isClosed = (t) => t.close && t.sell !== '' && t.sell != null && t.buy !== '' && t.buy != null;
function tradePnl(t) { if (!isClosed(t)) return null; return (num(t.sell) - num(t.buy)) * num(t.qty) * tradeMult(t) - num(t.fees); }
function tradeCost(t) { return (t.side === 'short' ? num(t.sell) : num(t.buy)) * num(t.qty) * tradeMult(t); }
function tradeName(t) { return t.kind === 'option' && t.opt ? `${t.symbol} ${t.opt.strike ? '$' + t.opt.strike + ' ' : ''}${t.opt.type === 'put' ? 'put' : 'call'}${t.opt.expiry ? ' ' + shortDay(t.opt.expiry).replace(/^\w+ /, MON[+t.opt.expiry.slice(5, 7) - 1].slice(0, 3) + ' ') : ''}` : t.symbol; }
const tradeIncome = (from, to) => (DB.trades || []).filter((t) => isClosed(t) && t.close >= from && t.close <= to).map((t) => ({ id: 'trade-' + t.id, date: t.close, source: 'Stocks', item: `${t.side === 'short' ? 'Short ' : ''}${tradeName(t)} · ${num(t.qty)} ${t.kind === 'option' ? 'contract' + (num(t.qty) === 1 ? '' : 's') : 'share' + (num(t.qty) === 1 ? '' : 's')}`, amount: Math.round(tradePnl(t) * 100) / 100, trade: true }));

function tradesSection(mk) {
  const tk = todayKey(), T = DB.trades || [], f = ui.tf || { kind: 'stock', side: 'long' };
  const open = T.filter((t) => !isClosed(t)), closedM = T.filter((t) => isClosed(t) && monthKey(t.close) === mk);
  const pnlM = closedM.reduce((a, t) => a + tradePnl(t), 0), wins = closedM.filter((t) => tradePnl(t) > 0).length;
  const allClosed = T.filter(isClosed), pnlAll = allClosed.reduce((a, t) => a + tradePnl(t), 0);
  const best = [...closedM].sort((a, b) => tradePnl(b) - tradePnl(a))[0], worst = [...closedM].sort((a, b) => tradePnl(a) - tradePnl(b))[0];
  const list = [...open.sort((a, b) => (a.open < b.open ? 1 : -1)), ...T.filter(isClosed).sort((a, b) => (a.close < b.close ? 1 : -1)).filter((t) => monthKey(t.close) === mk || ui.tAll)];
  const row = (t) => {
    const p = tradePnl(t), cost = tradeCost(t), pct = p != null && cost ? (p / cost) * 100 : null, held = dayDiff(t.open, t.close || tk);
    const tp = tip(esc(tradeName(t)), [['Type', `${t.kind === 'option' ? 'Option' : 'Stock'} · ${t.side === 'short' ? 'short' : 'long'}`], ['Quantity', `${num(t.qty)} ${t.kind === 'option' ? 'contracts (× 100)' : 'shares'}`], ['Bought at', t.buy !== '' && t.buy != null ? money(num(t.buy)) : '—'], ['Sold at', t.sell !== '' && t.sell != null ? money(num(t.sell)) : '—'], ['Cost basis', money(cost)], ['Fees', money(num(t.fees))], ['Profit / loss', p == null ? 'open' : `<b>${signed(p)}</b>`], ['Return', pct == null ? '—' : (pct >= 0 ? '+' : '') + r1(pct) + '%'], ['Held', held + ' day' + (held === 1 ? '' : 's')]]);
    return `<tr${tp}><td><b>${esc(tradeName(t))}</b>${t.side === 'short' ? ' <span class="tag-s">short</span>' : ''}</td><td class="small">${t.kind === 'option' ? 'Option' : 'Stock'}</td><td class="mono r">${num(t.qty)}</td><td class="mono r">${t.buy !== '' && t.buy != null ? money(num(t.buy)) : '—'}</td><td class="mono r">${t.sell !== '' && t.sell != null ? money(num(t.sell)) : '—'}</td><td class="mono small">${shortDay(t.open)}${t.close ? ' → ' + shortDay(t.close) : ''}</td>
      <td class="mono r ${p < 0 ? 'neg' : ''}">${p == null ? '<span class="faint">open</span>' : signed(p)}</td><td class="mono r small ${p < 0 ? 'neg' : 'faint'}">${pct == null ? '' : (pct >= 0 ? '+' : '') + r1(pct) + '%'}</td>
      <td class="c">${p == null ? `<button class="btn sm" data-a="tCloseOpen" data-id="${t.id}">Close</button>` : ''}<button class="icon-btn" data-a="tDel" data-id="${t.id}" aria-label="Delete trade">${ic('x', 13)}</button></td></tr>
      ${ui.tClose === t.id ? `<tr class="chiprow"><td colspan="9"><div class="row-flex"><span class="small">${t.side === 'short' ? 'Bought back' : 'Sold'} at</span><input class="inp num" id="tcPrice" placeholder="0.00"><input class="inp" type="date" id="tcDate" value="${tk}"><button class="btn primary sm" data-a="tCloseSave" data-id="${t.id}">Save</button>${t.kind === 'option' ? `<button class="btn sm" data-a="tExpire" data-id="${t.id}">Expired worthless</button>` : ''}<button class="btn ghost sm" data-a="tCloseCancel">Cancel</button></div></td></tr>` : ''}`;
  };
  return `<div class="row-flex" style="margin:26px 0 10px"><h2 class="h2">Trades</h2><span class="small faint">profit / loss is counted as Stocks income on the day you close</span><label class="small" style="margin-left:auto;display:flex;gap:6px;align-items:center"><input type="checkbox" data-c="tAll" ${ui.tAll ? 'checked' : ''}> Show all closed trades</label></div>
  <div class="stats" style="margin-bottom:12px">
    <div class="stat"><span class="k">Realised · ${MON[+mk.slice(5) - 1]}</span><span class="v ${pnlM < 0 ? 'neg' : ''}">${signed(pnlM)}</span><span class="small faint">${closedM.length} closed</span></div>
    <div class="stat"><span class="k">Win rate</span><span class="v">${closedM.length ? Math.round((wins / closedM.length) * 100) + '%' : '—'}</span><span class="small faint">${wins} of ${closedM.length}</span></div>
    <div class="stat hit"${best ? tip(esc(tradeName(best)), [['Profit', signed(tradePnl(best))]]) : ''}><span class="k">Best</span><span class="v">${best ? signed(tradePnl(best)) : '—'}</span><span class="small faint">${best ? esc(tradeName(best)) : ''}</span></div>
    <div class="stat hit"${worst ? tip(esc(tradeName(worst)), [['Result', signed(tradePnl(worst))]]) : ''}><span class="k">Worst</span><span class="v ${worst && tradePnl(worst) < 0 ? 'neg' : ''}">${worst ? signed(tradePnl(worst)) : '—'}</span><span class="small faint">${worst ? esc(tradeName(worst)) : ''}</span></div>
    <div class="stat"><span class="k">Open positions</span><span class="v">${open.length}</span><span class="small faint">${money(open.reduce((a, t) => a + tradeCost(t), 0))} in</span></div>
    <div class="stat"><span class="k">All-time realised</span><span class="v ${pnlAll < 0 ? 'neg' : ''}">${signed(pnlAll)}</span><span class="small faint">${allClosed.length} trades</span></div>
  </div>
  <div class="sheet"><table><colgroup><col><col style="width:80px"><col style="width:70px"><col style="width:104px"><col style="width:104px"><col style="width:150px"><col style="width:116px"><col style="width:84px"><col style="width:120px"></colgroup>
    <tr><th>Trade</th><th>Type</th><th class="r">Qty</th><th class="r">Buy</th><th class="r">Sell</th><th>Dates</th><th class="r">P / L</th><th class="r">Return</th><th></th></tr>
    ${list.map(row).join('') || '<tr><td colspan="9" class="faint">No trades yet. Add one below — leave the closing price empty while it’s still open.</td></tr>'}
  </table>
  <div class="addbar tradebar">
    <div class="seg bi"><button class="${f.kind !== 'option' ? 'on' : ''}" data-a="tSet" data-f="kind" data-v="stock">Stock</button><button class="${f.kind === 'option' ? 'on' : ''}" data-a="tSet" data-f="kind" data-v="option">Option</button></div>
    <div class="seg bi"><button class="${f.side !== 'short' ? 'on' : ''}" data-a="tSet" data-f="side" data-v="long">Long</button><button class="${f.side === 'short' ? 'on' : ''}" data-a="tSet" data-f="side" data-v="short">Short</button></div>
    <label class="fld">Symbol<input class="inp" id="tSym" style="width:90px;text-transform:uppercase" placeholder="NVDA"></label>
    ${f.kind === 'option' ? `<label class="fld">Call / put<select class="sel" id="tOT"><option value="call">Call</option><option value="put">Put</option></select></label><label class="fld">Strike<input class="inp num" id="tStrike" placeholder="0"></label><label class="fld">Expiry<input class="inp" type="date" id="tExp"></label>` : ''}
    <label class="fld">${f.kind === 'option' ? 'Contracts' : 'Shares'}<input class="inp num" id="tQty" placeholder="1"></label>
    <label class="fld">${f.side === 'short' ? 'Sell' : 'Buy'} price${f.kind === 'option' ? ' (per share)' : ''}<input class="inp num" id="tP1" placeholder="0.00"></label>
    <label class="fld">Opened<input class="inp" type="date" id="tD1" value="${tk}"></label>
    <label class="fld">${f.side === 'short' ? 'Buy-back' : 'Sell'} price<input class="inp num" id="tP2" placeholder="open"></label>
    <label class="fld">Closed<input class="inp" type="date" id="tD2"></label>
    <label class="fld">Fees<input class="inp num" id="tFee" placeholder="0"></label>
    <button class="btn primary" data-a="tAdd">Add trade</button></div></div>
  <div class="hint" style="margin-top:8px">Options: enter the premium per share as quoted (e.g. 2.35); it’s multiplied by 100 per contract. Leave the closing price empty for an open position and close it later.</div>`;
}

// ---------- income (Money → Income tab) ----------
// Income entries are { id, date, source, item, amount } (amount can be negative for a stock loss).
// A pay schedule adds each paycheck on its payday; ids are pay-<date> so syncing never doubles one.
const PAY_FREQ = { weekly: 'Every week', biweekly: 'Every 2 weeks', semimonthly: 'Twice a month (15th + last day)', monthly: 'Every month' };
function nextPayday(k, f) {
  if (f === 'weekly') return addDays(k, 7);
  if (f === 'biweekly') return addDays(k, 14);
  const y = +k.slice(0, 4), m = +k.slice(5, 7), d = +k.slice(8, 10);
  if (f === 'semimonthly') { const last = daysIn(k.slice(0, 7)); if (d < 15) return k.slice(0, 8) + '15'; if (d < last) return k.slice(0, 8) + pad(last); const nm = addMonths(k.slice(0, 7), 1); return nm + '-15'; }
  const nm = addMonths(k.slice(0, 7), 1); return nm + '-' + pad(Math.min(d, daysIn(nm)));
}
function runPay() {
  const P = DB.pay; if (!P || !P.on || !P.next || !(num(P.amount) > 0)) return false;
  const tk = todayKey(); let changed = false, guard = 0;
  while (P.next <= tk && guard++ < 60) {
    const id = 'pay-' + P.next;
    if (!DB.income.some((x) => x.id === id)) { DB.income.push({ id, date: P.next, source: 'Salary', item: 'Paycheck', amount: num(P.amount), auto: true }); changed = true; }
    P.next = nextPayday(P.next, P.freq || 'biweekly'); changed = true;
  }
  return changed;
}
const incomeIn = (from, to) => [...(DB.income || []).filter((e) => e.date >= from && e.date <= to), ...tradeIncome(from, to)];
const signed = (n) => (n >= 0 ? '+' : '−') + money(Math.abs(n)).replace('−', '');

function moneyBars(mk) { // earned vs spent, last 6 months, two series side by side
  const W = 640, H = 220, L = 48, R = 8, T = 12, B = 26, pw = W - L - R, ph = H - T - B;
  const ms = Array.from({ length: 6 }, (_, i) => addMonths(mk, i - 5));
  const rows = ms.map((m) => { const inc = incomeIn(m + '-01', m + '-31'), ex = expensesIn(m + '-01', m + '-31'); return { m, e: sumAmt(inc), s: sumAmt(ex), inc, ex }; });
  const max = niceMax(Math.max(10, ...rows.map((r) => Math.max(r.e, r.s)))), slot = pw / 6, bw = Math.min(26, slot / 3);
  const Y = (v) => T + ph - (Math.max(0, v) / max) * ph;
  const grid = [0, .5, 1].map((f) => `<line x1="${L}" x2="${W - R}" y1="${Y(max * f)}" y2="${Y(max * f)}" class="cg"/><text x="${L - 6}" y="${Y(max * f) + 3.5}" class="ct" text-anchor="end">${moneyShort(max * f)}</text>`).join('');
  const bar = (x, v, cls) => { const h = T + ph - Y(v); return h > 0 ? `<path d="M${x},${T + ph} v${-(Math.max(h, 3) - 3)} q0,-3 3,-3 h${bw - 6} q3,0 3,3 v${Math.max(h, 3) - 3} z" class="${cls}"/>` : ''; };
  const g = rows.map((r, i) => { const x0 = L + i * slot + slot / 2 - bw - 2, net = r.e - r.s;
    const t = tip(monthLabel(r.m), [['Earned', `<b>${money(r.e)}</b>`], ['Spent', money(r.s)], ['Net', signed(net)], ['Savings rate', r.e > 0 ? Math.round((net / r.e) * 100) + '%' : '—']],
      [['Earned from', groupBy(r.inc.map((x) => ({ ...x })), (x) => x.source).map((x) => [esc(x[0]), money(x[1])])]], i === 5 ? '' : 'Click to open this month');
    return `<g class="hit"${i === 5 ? '' : ` data-a="sGo" data-m="${r.m}"`}${t}><rect x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" fill="transparent"/>${bar(x0, r.e, 'cb')}${bar(x0 + bw + 4, r.s, 'cb2')}<text x="${L + i * slot + slot / 2}" y="${H - 7}" class="ct" text-anchor="middle">${MON[+r.m.slice(5) - 1].slice(0, 3)}</text></g>`; }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Earned and spent over six months">${grid}${g}</svg><div class="legend"><span><i class="sq"></i>Earned</span><span><i class="sq s2"></i>Spent</span></div>`;
}
function netLine(mk) { // running net for the month: income minus spending, day by day
  const W = 640, H = 200, L = 52, R = 10, T = 12, B = 24, pw = W - L - R, ph = H - T - B, n = daysIn(mk), tk = todayKey();
  const upto = monthKey(tk) === mk ? +tk.slice(8) : mk > monthKey(tk) ? 0 : n;
  const inc = incomeIn(mk + '-01', mk + '-31'), ex = expensesIn(mk + '-01', mk + '-31');
  let run = 0; const pts = [];
  for (let d = 1; d <= upto; d++) { const k = `${mk}-${pad(d)}`, a = sumAmt(inc.filter((x) => x.date === k)), b = sumAmt(ex.filter((x) => x.date === k)); run += a - b; pts.push({ d, k, a, b, run }); }
  const hi = niceMax(Math.max(10, ...pts.map((p) => p.run))), lo = Math.min(0, ...pts.map((p) => p.run)) < 0 ? -niceMax(-Math.min(...pts.map((p) => p.run))) : 0;
  const X = (d) => L + ((d - 1) / Math.max(1, n - 1)) * pw, Y = (v) => T + ((hi - v) / (hi - lo)) * ph;
  const grid = [lo, 0, hi].filter((v, i, a) => a.indexOf(v) === i).map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="${v === 0 ? 'cz' : 'cg'}"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="ct" text-anchor="end">${v < 0 ? '−' + moneyShort(-v) : moneyShort(v)}</text>`).join('');
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.d).toFixed(1)},${Y(p.run).toFixed(1)}`).join('');
  const hits = pts.map((p) => `<g class="hit vline"${tip(longDay(p.k), [['Net so far', `<b>${signed(p.run)}</b>`], ['Earned that day', money(p.a)], ['Spent that day', money(p.b)]])}><rect x="${X(p.d) - pw / n / 2}" y="${T}" width="${pw / n}" height="${ph}" fill="transparent"/><line x1="${X(p.d)}" x2="${X(p.d)}" y1="${T}" y2="${T + ph}" class="cx"/><circle cx="${X(p.d)}" cy="${Y(p.run)}" r="4" class="cdot"/></g>`).join('');
  const last = pts[pts.length - 1];
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Running net this month">${grid}${pts.length ? `<path d="${d}" class="cl"/><circle cx="${X(last.d)}" cy="${Y(last.run)}" r="4.5" class="cdot" style="opacity:1"/>` : ''}<text x="${L}" y="${H - 6}" class="ct">1</text><text x="${W - R}" y="${H - 6}" class="ct" text-anchor="end">${n}</text>${hits}</svg>`;
}
function incomeView() {
  const mk = ui.sMonth, tk = todayKey(), P = DB.pay || {};
  const inc = incomeIn(mk + '-01', mk + '-31').sort((a, b) => (a.date < b.date ? 1 : -1)), ex = expensesIn(mk + '-01', mk + '-31');
  const earned = sumAmt(inc), spent = sumAmt(ex), net = earned - spent;
  const by = (s) => sumAmt(inc.filter((x) => x.source === s));
  const pm = addMonths(mk, -1), pe = sumAmt(incomeIn(pm + '-01', pm + '-31'));
  const srcs = groupBy(inc, (x) => x.source);
  const rows = inc.map((e, i) => `<tr${tip(esc(e.item || e.source), [['Amount', `<b>${signed(e.amount)}</b>`], ['Date', longDay(e.date)], ['Source', esc(e.source)], ['Share of the month', pctTxt(e.amount, earned)]], [], e.auto ? 'Added by your pay schedule' : e.trade ? 'From your Trades list — edit it there' : '')}><td class="g">${i + 1}</td><td class="mono">${shortDay(e.date)}</td><td>${esc(e.item || '')}${e.auto ? ' <span class="faint small">· auto</span>' : ''}</td><td class="small">${esc(e.source)}</td><td class="mono r ${e.amount < 0 ? 'neg' : ''}">${signed(e.amount)}</td><td class="c">${e.trade ? '<span class="faint">—</span>' : `<button class="icon-btn" data-a="delInc" data-id="${e.id}" aria-label="Remove ${esc(e.item || e.source)}">${ic('x', 13)}</button>`}</td></tr>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Money · Income</span><h1 class="h1">${monthLabel(mk).split(' ')[0]}</h1></div>${dateNav('sNav', 'This month')}</div>
  <div class="stats">
    <div class="stat hit"${tip('Earned · ' + monthLabel(mk), [['Total', `<b>${money(earned)}</b>`], [`${MON[+pm.slice(5) - 1]}`, money(pe)], ['Change', chg(earned, pe)], ['Entries', inc.length]])}><span class="k">Earned · ${MON[+mk.slice(5) - 1]}</span><span class="v">${money(earned)}</span><span class="small faint">${pe ? chg(earned, pe) + ' vs ' + MON[+pm.slice(5) - 1].slice(0, 3) : 'nothing logged last month'}</span></div>
    <div class="stat"><span class="k">Spent</span><span class="v">${money(spent)}</span></div>
    <div class="stat hit"${tip('Net', [['Earned', money(earned)], ['Spent', money(spent)], ['Left over', `<b>${signed(net)}</b>`]])}><span class="k">Net</span><span class="v ${net < 0 ? 'neg' : ''}">${signed(net)}</span></div>
    <div class="stat"><span class="k">Savings rate</span><span class="v">${earned > 0 ? Math.round((net / earned) * 100) + '%' : '—'}</span>${earned > 0 ? `<div class="bar"><i style="width:${Math.max(0, Math.min(100, (net / earned) * 100))}%"></i></div>` : ''}</div>
    <div class="stat"><span class="k">From salary</span><span class="v">${money(by('Salary'))}</span></div>
    <div class="stat"><span class="k">From stocks</span><span class="v ${by('Stocks') < 0 ? 'neg' : ''}">${signed(by('Stocks'))}</span></div>
  </div>
  <div class="dash">
    <section class="dcard span2"><div class="dh"><h2 class="h3">Earned vs spent</h2><span class="small faint">last 6 months · hover for details</span></div>${moneyBars(mk)}</section>
    <section class="dcard"><div class="dh"><h2 class="h3">Pay schedule</h2>${P.on ? '<span class="small faint">on</span>' : ''}</div>
      ${P.on && P.next && num(P.amount) > 0 ? `<div class="payday"><span class="small faint">Next payday</span><b class="mono">${longDay(P.next)}</b><span class="mono">${money(num(P.amount))}</span><span class="small faint">in ${Math.max(0, dayDiff(tk, P.next))} day${dayDiff(tk, P.next) === 1 ? '' : 's'} · ${esc(PAY_FREQ[P.freq] || '')}</span></div>` : '<div class="small faint">Set your take-home pay once and each paycheck is added on payday.</div>'}
      <div class="payform"><label class="fld">Take-home pay<input class="inp num" id="payAmt" value="${P.amount ? esc(P.amount) : ''}" placeholder="0.00"></label>
        <label class="fld">How often<select class="sel" id="payFreq">${Object.entries(PAY_FREQ).map(([k, l]) => `<option value="${k}" ${P.freq === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
        <label class="fld">Next payday<input class="inp" type="date" id="payNext" value="${esc(P.next || '')}"></label>
        <div class="row-flex"><button class="btn primary" data-a="paySave">${P.on ? 'Save' : 'Turn on'}</button>${P.on ? '<button class="btn" data-a="payOff">Turn off</button>' : ''}</div></div>
    </section>
    <section class="dcard span2"><div class="dh"><h2 class="h3">Running net</h2><span class="small faint">earned minus spent, day by day</span></div>${netLine(mk)}</section>
    <section class="dcard"><div class="dh"><h2 class="h3">By source</h2></div>${srcs.length ? `<div class="hbars">${srcs.map(([s, a, n]) => `<div class="hb hit"${tip(esc(s), [['This month', `<b>${signed(a)}</b>`], ['Share', pctTxt(a, earned)], ['Entries', n]])}><div class="hb-top"><span class="hb-name">${esc(s)}</span><span class="mono hb-val">${signed(a)}<span class="faint"> · ${pctTxt(a, earned)}</span></span></div><div class="hb-track"><i style="width:${Math.max(2, Math.abs(a) / Math.max(...srcs.map((x) => Math.abs(x[1]))) * 100)}%${a < 0 ? ';background:var(--bad)' : ''}"></i></div></div>`).join('')}</div>` : '<div class="faint small">No income logged this month.</div>'}</section>
  </div>
  <h2 class="h2" style="margin:22px 0 10px">Income</h2>
  <div class="sheet"><table><colgroup><col style="width:40px"><col style="width:84px"><col><col style="width:160px"><col style="width:130px"><col style="width:52px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td></td></tr>
    <tr><th class="g">#</th><th>Date</th><th>What</th><th>Source</th><th class="r">Amount</th><th></th></tr>
    ${rows || '<tr><td class="g">1</td><td colspan="5" class="faint">No income logged this month.</td></tr>'}
    ${rows ? `<tr class="total"><td></td><td colspan="3">Total</td><td class="mono r">${signed(earned)}</td><td></td></tr>` : ''}
  </table>
  <div class="addbar"><label class="fld">Date<input class="inp" type="date" id="iDate" value="${tk}"></label><label class="fld" style="flex:1;min-width:160px">What<input class="inp" id="iItem" placeholder="Paycheck, dividend…"></label><label class="fld">Source<select class="sel" id="iSrc">${(DB.incomeSources || ['Salary', 'Stocks']).map((s) => `<option>${esc(s)}</option>`).join('')}</select></label><label class="fld">Amount<input class="inp num" id="iAmt" placeholder="0.00"></label><button class="btn primary" data-a="addInc">Add</button></div></div>
  <div class="hint" style="margin-top:8px">Amounts are take-home. Trades below add their profit or loss here automatically; log dividends here as Stocks.</div>
  ${tradesSection(mk)}`;
}
const moneyTabs = () => `<div class="bitabs"><div class="seg bi"><button class="${ui.mTab !== 'income' ? 'on' : ''}" data-a="mTab" data-t="spend">Spending</button><button class="${ui.mTab === 'income' ? 'on' : ''}" data-a="mTab" data-t="income">Income</button></div></div>`;
{ const spendView = VIEWS.spending; VIEWS.spending = () => moneyTabs() + (ui.mTab === 'income' ? incomeView() : spendView()); }

// ---------- summary ----------
// ---------- weekly goals ----------
// Deficit goal per week = daily goal × 7, plus whatever the week before fell short of its own goal (carry-over),
// counted from the first week with food logged. Workout days = days with any workout logged, against a weekly goal.
function weekDeficit(ws) {
  let def = 0, days = 0;
  for (let i = 0; i < 7; i++) { const dk = addDays(ws, i); const t = foodTotals(dk); if (DB.burns[dk] != null && t.n) { def += DB.burns[dk] - t.cal; days++; } }
  return { def: Math.round(def), days };
}
function weekGoal(ws) {
  const base = Math.round((num(DB.settings.deficitGoal) || 500) * 7);
  const first = DB.foods.reduce((m, f) => (!m || f.date < m ? f.date : m), null);
  if (!first) return { base, carry: 0, goal: base };
  let w = weekStart(first), carry = 0;
  while (w < ws) { const got = weekDeficit(w).def; carry = Math.max(0, base + carry - got); w = addDays(w, 7); }
  return { base, carry, goal: base + carry };
}
function weekWorkouts(ws) {
  const days = new Set(DB.sessions.filter((s) => s.date >= ws && s.date <= addDays(ws, 6)).map((s) => s.date));
  return { done: days.size, goal: num(DB.settings.workoutDaysGoal) || 5 };
}
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
// ---------- dashboard (the old Summary page): a small Power BI over everything tracked ----------
// Data sets turn the app's records into flat rows with a date, some fields to group or filter by,
// and numbers to measure. Tiles pick a data set, a measure, how to add it up, and what to group by.
const dayDiff = (a, b) => Math.round((parseKey(b) - parseKey(a)) / 864e5);
const exOf = (id) => DB.exercises.find((e) => e.id === id);
const BI_DS = {
  spending: {
    label: 'Spending', fields: { category: 'Category', card: 'Card', item: 'Item' },
    measures: { amount: ['Amount spent', 'money', 'sum'], count: ['Purchases', 'int', 'sum'] },
    rows: (f, t) => expensesIn(f, t).map((e) => ({ date: e.date, category: e.category, card: cardOf(e), item: e.item, amount: e.amount, count: 1 }))
  },
  food: {
    label: 'Food', fields: { meal: 'Meal', food: 'Food' },
    measures: { cal: ['Calories', 'int', 'perday'], p: ['Protein (g)', 'g', 'perday'], c: ['Carbs (g)', 'g', 'perday'], fib: ['Fiber (g)', 'g', 'perday'], f: ['Fat (g)', 'g', 'perday'], count: ['Items eaten', 'int', 'sum'] },
    rows: (f, t) => DB.foods.filter((x) => x.date >= f && x.date <= t).map((x) => ({ date: x.date, meal: x.meal || 'Other', food: x.name, cal: x.cal, p: x.p, c: x.c, fib: x.fib, f: x.f, count: 1 }))
  },
  days: {
    label: 'Daily health', fields: { training: 'Day type', proteinOk: 'Protein goal', fiberOk: 'Fiber goal' },
    measures: { deficit: ['Deficit', 'int', 'sum'], eaten: ['Calories eaten', 'int', 'avg'], burned: ['Calories burned', 'int', 'avg'], p: ['Protein (g)', 'g', 'avg'], fib: ['Fiber (g)', 'g', 'avg'], workout: ['Workout days', 'int', 'sum'], workoutKcal: ['Workout calories', 'int', 'sum'], proteinHit: ['Days protein goal hit', 'int', 'sum'], fiberHit: ['Days fiber goal hit', 'int', 'sum'] },
    rows: (f, t) => {
      const out = [], tk = todayKey(); if (t > tk) t = tk;
      const wdays = new Set(DB.sessions.map((s) => s.date));
      for (let k = f; k <= t; k = addDays(k, 1)) {
        const ft = foodTotals(k), burn = DB.burns[k], w = wdays.has(k), tr = trainingOn(k).type;
        if (!ft.n && burn == null && !w && !tr) continue;
        const pOk = ft.n ? ft.p >= DB.settings.proteinTarget : null, fOk = ft.n ? ft.fib >= DB.settings.fiberTarget : null;
        out.push({ date: k, training: tr === 'Abs' ? 'Ab day' : tr === 'Rest' ? 'Rest day' : tr || 'Not set', proteinOk: pOk == null ? 'No food logged' : pOk ? 'Hit' : 'Missed', fiberOk: fOk == null ? 'No food logged' : fOk ? 'Hit' : 'Missed',
          deficit: ft.n && burn != null ? burn - ft.cal : null, eaten: ft.n ? ft.cal : null, burned: burn ?? null, p: ft.n ? ft.p : null, fib: ft.n ? ft.fib : null,
          workout: w ? 1 : 0, workoutKcal: w ? workoutBurn(k).kcal : 0, proteinHit: pOk ? 1 : 0, fiberHit: fOk ? 1 : 0 });
      }
      return out;
    }
  },
  workouts: {
    label: 'Workouts', fields: { exercise: 'Exercise', group: 'Muscle group', kind: 'Type' },
    measures: { sets: ['Sets', 'int', 'sum'], reps: ['Reps', 'int', 'sum'], volume: ['Volume (lb × reps)', 'int', 'sum'], top: ['Top weight (lb)', 'int', 'max'], done: ['Exercises done', 'int', 'sum'] },
    rows: (f, t) => DB.sessions.filter((s) => s.date >= f && s.date <= t).map((s) => { const ex = exOf(s.exId) || {}; const bw = isBodyweight(ex);
      return { date: s.date, exercise: ex.name || 'Removed exercise', group: ex.group || 'Other', kind: bw ? 'Bodyweight' : 'Weights', sets: s.sets.length,
        reps: s.sets.reduce((a, x) => a + num(x.r) * (x.side ? 2 : 1), 0), volume: bw ? 0 : s.sets.reduce((a, x) => a + num(x.w) * num(x.r), 0), top: bw ? null : Math.max(0, ...s.sets.map((x) => num(x.w))), done: 1 }; })
  },
  income: {
    label: 'Income', fields: { source: 'Source', item: 'What' },
    measures: { amount: ['Amount earned', 'money', 'sum'], count: ['Entries', 'int', 'sum'] },
    rows: (f, t) => incomeIn(f, t).map((e) => ({ date: e.date, source: e.source, item: e.item || e.source, amount: e.amount, count: 1 }))
  },
  trades: {
    label: 'Trades', fields: { symbol: 'Symbol', kind: 'Stock or option', side: 'Long or short', result: 'Win or loss' },
    measures: { pnl: ['Profit / loss', 'money', 'sum'], count: ['Trades closed', 'int', 'sum'], wins: ['Winning trades', 'int', 'sum'] },
    rows: (f, t) => (DB.trades || []).filter((x) => isClosed(x) && x.close >= f && x.close <= t).map((x) => { const p = tradePnl(x); return { date: x.close, symbol: x.symbol, kind: x.kind === 'option' ? 'Option' : 'Stock', side: x.side === 'short' ? 'Short' : 'Long', result: p > 0 ? 'Win' : p < 0 ? 'Loss' : 'Flat', pnl: p, count: 1, wins: p > 0 ? 1 : 0 }; })
  },
  cash: {
    label: 'Cash flow', fields: { dir: 'In or out' },
    measures: { net: ['Net (earned − spent)', 'money', 'sum'], earned: ['Earned', 'money', 'sum'], spent: ['Spent', 'money', 'sum'] },
    rows: (f, t) => [...incomeIn(f, t).map((e) => ({ date: e.date, dir: 'In', net: e.amount, earned: e.amount, spent: 0 })), ...expensesIn(f, t).map((e) => ({ date: e.date, dir: 'Out', net: -e.amount, earned: 0, spent: e.amount }))]
  },
  routine: {
    label: 'Routine', fields: { plan: 'Plan' },
    measures: { score: ['Day score (%)', 'pct', 'avg'], done: ['Blocks done', 'int', 'sum'], total: ['Blocks planned', 'int', 'sum'], days: ['Days planned', 'int', 'sum'] },
    rows: (f, t) => Object.keys(DB.days).filter((k) => k >= f && k <= t && k <= todayKey()).map((k) => { const s = dayScore(DB.days[k]) || { done: 0, total: 0, pct: 0 }; return { date: k, plan: DB.days[k].planName || 'Custom day', score: s.total ? s.pct : null, done: s.done, total: s.total, days: 1 }; })
  },
  picks: {
    label: 'Free-time picks', fields: { list: 'Choice list', pick: 'Pick' },
    measures: { count: ['Times picked', 'int', 'sum'] },
    rows: (f, t) => { const out = []; Object.keys(DB.days).filter((k) => k >= f && k <= t).forEach((k) => { const d = DB.days[k]; d.blocks.forEach((b) => { const v = d.choices && d.choices[b.id]; if (b.kind === 'choice' && v) { const L = listById(b.listId); out.push({ date: k, list: L ? L.name : 'Other', pick: v, count: 1 }); } }); }); return out; }
  }
};
const BI_AGG = { sum: 'Total', avg: 'Average per entry', perday: 'Average per day', max: 'Highest', min: 'Lowest', days: 'Number of days' };
const BI_TIME = { day: 'Day', week: 'Week', month: 'Month', weekday: 'Day of week' };
const BI_VIS = [['kpi', 'Number'], ['column', 'Columns'], ['line', 'Line'], ['bar', 'Bars'], ['donut', 'Donut'], ['table', 'Table']];
const BI_RANGES = { thisWeek: 'This week', lastWeek: 'Last week', last7: 'Last 7 days', thisMonth: 'This month', lastMonth: 'Last month', last30: 'Last 30 days', last90: 'Last 90 days', thisYear: 'This year', all: 'All time' };
const BI_SIZES = [['1', 'S'], ['2', 'M'], ['3', 'L'], ['4', 'Full']];

function biEarliest() {
  const ds = [...DB.expenses.map((e) => e.date), ...(DB.income || []).map((e) => e.date), ...(DB.trades || []).map((t) => t.open), ...DB.foods.map((x) => x.date), ...DB.sessions.map((s) => s.date), ...Object.keys(DB.days), ...Object.keys(DB.burns)];
  return ds.length ? ds.reduce((a, b) => (a < b ? a : b)) : todayKey();
}
function biRange(p) {
  const tk = todayKey(), ws = weekStart(tk), mk = monthKey(tk), lm = addMonths(mk, -1), y = tk.slice(0, 4);
  const r = { thisWeek: [ws, addDays(ws, 6)], lastWeek: [addDays(ws, -7), addDays(ws, -1)], last7: [addDays(tk, -6), tk], thisMonth: [mk + '-01', mk + '-' + daysIn(mk)],
    lastMonth: [lm + '-01', lm + '-' + daysIn(lm)], last30: [addDays(tk, -29), tk], last90: [addDays(tk, -89), tk], thisYear: [y + '-01-01', y + '-12-31'], all: [biEarliest(), tk] }[p] || [mk + '-01', mk + '-' + daysIn(mk)];
  const end = r[1] < tk ? r[1] : tk, len = Math.max(1, dayDiff(r[0], end) + 1);
  return { from: r[0], to: r[1], end, len, prev: [addDays(r[0], -len), addDays(r[0], -1)], label: BI_RANGES[p] || p };
}
const biFmt = (v, f) => (v == null || !isFinite(v) ? '—' : f === 'money' ? money(v) : f === 'pct' ? Math.round(v) + '%' : f === 'g' ? r1(v).toLocaleString('en-US') : Math.round(v).toLocaleString('en-US'));
const biShort = (v, f) => (f === 'money' ? moneyShort(v) : Math.abs(v) >= 10000 ? Math.round(v / 1000) + 'k' : Math.abs(v) >= 1000 ? r1(v / 1000) + 'k' : f === 'g' ? r1(v) : Math.round(v)) + (f === 'pct' ? '%' : '');
function biAgg(rows, m, agg) {
  if (agg === 'days') return new Set(rows.map((r) => r.date)).size;
  const v = rows.map((r) => r[m]).filter((x) => x != null && isFinite(x));
  if (!v.length) return agg === 'sum' ? 0 : null;
  const s = v.reduce((a, b) => a + b, 0);
  if (agg === 'sum') return s;
  if (agg === 'avg') return s / v.length;
  if (agg === 'perday') return s / new Set(rows.filter((r) => r[m] != null).map((r) => r.date)).size;
  if (agg === 'max') return Math.max(...v);
  if (agg === 'min') return Math.min(...v);
  return s;
}
function biTimeKey(k, by) { return by === 'week' ? weekStart(k) : by === 'month' ? monthKey(k) : by === 'weekday' ? String((parseKey(k).getDay() + 6) % 7) : k; }
function biTimeLabel(key, by, long) {
  if (by === 'weekday') return DOW[(+key + 1) % 7].slice(0, long ? 9 : 3);
  if (by === 'month') return long ? monthLabel(key) : MON[+key.slice(5) - 1].slice(0, 3);
  const d = parseKey(key), s = MON[d.getMonth()].slice(0, 3) + ' ' + d.getDate();
  return by === 'week' ? (long ? 'Week of ' + s : s) : long ? longDay(key) : s;
}
// The rows a tile sees: its data set over its date range, its own filter, then the page's click filters.
function biRows(t, R) {
  const ds = BI_DS[t.src]; if (!ds) return [];
  let rows = ds.rows(R.from < biEarliest() ? biEarliest() : R.from, R.to);
  if (t.ff && t.fv) rows = rows.filter((r) => String(r[t.ff]) === t.fv);
  (ui.biF || []).forEach((f) => { if (f.f in ds.fields) rows = rows.filter((r) => String(r[f.f]) === f.v); });
  return rows;
}
function biTileRange(t) { return biRange(t.range && t.range !== 'page' ? t.range : biPage().range || 'thisMonth'); }
function biCompute(t) {
  const ds = BI_DS[t.src], R = biTileRange(t), rows = biRows(t, R);
  const mdef = ds.measures[t.m] || Object.values(ds.measures)[0], agg = t.agg || mdef[2], fmt = mdef[1];
  const total = biAgg(rows, t.m, agg);
  if (!t.by || t.by === 'none') return { R, rows, total, fmt, agg, mlabel: mdef[0] };
  const isTime = t.by in BI_TIME, groups = new Map();
  rows.forEach((r) => { const k = isTime ? biTimeKey(r.date, t.by) : String(r[t.by]); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  if (isTime && t.by !== 'weekday') { // show empty periods too, so gaps are visible
    const start = R.from < biEarliest() ? biEarliest() : R.from;
    for (let k = start; k <= R.end; k = addDays(k, 1)) { const g = biTimeKey(k, t.by); if (!groups.has(g)) groups.set(g, []); }
  }
  if (t.by === 'weekday') for (let i = 0; i < 7; i++) if (!groups.has(String(i))) groups.set(String(i), []);
  let list = [...groups.entries()].map(([k, rs]) => ({ key: k, label: isTime ? biTimeLabel(k, t.by) : k, long: isTime ? biTimeLabel(k, t.by, true) : k, rows: rs, v: biAgg(rs, t.m, agg) }));
  if (isTime) list.sort((a, b) => (t.by === 'weekday' ? +a.key - +b.key : a.key < b.key ? -1 : 1));
  else { list.sort((a, b) => (b.v ?? -Infinity) - (a.v ?? -Infinity)); const n = +t.top || 0; if (n && list.length > n) { const rest = list.slice(n); list = list.slice(0, n); if (t.vis === 'donut') list.push({ key: '__other', label: 'Other', long: `Other (${rest.length})`, rows: rest.flatMap((x) => x.rows), v: biAgg(rest.flatMap((x) => x.rows), t.m, agg) }); } }
  return { R, rows, total, fmt, agg, mlabel: mdef[0], list, isTime };
}
// Goal lines for measures that have one in Settings.
function biGoal(t, R) {
  if (t.target === 'goal') {
    if (t.src === 'days' && t.m === 'deficit' && (t.agg || 'sum') === 'sum') { const ws = weekStart(todayKey()); return R.from === ws && R.len <= 7 ? weekGoal(ws).goal : (num(DB.settings.deficitGoal) || 500) * R.len; }
    if (t.src === 'days' && t.m === 'workout') return Math.round((num(DB.settings.workoutDaysGoal) || 5) * Math.max(1, Math.round(dayDiff(R.from, R.to) + 1) / 7));
    if (t.m === 'p') return DB.settings.proteinTarget;
    if (t.m === 'fib') return DB.settings.fiberTarget;
    return null;
  }
  return t.target != null && t.target !== '' ? num(t.target) : null;
}
// A goal line inside a grouped chart only makes sense for per-day goals (protein, fiber) or a custom number.
function biLineGoal(t, c) { if (t.target === 'goal' && t.src === 'days' && (t.m === 'deficit' || t.m === 'workout')) return null; if (t.target === 'goal' && c.agg === 'sum' && t.by !== 'day') return null; return biGoal(t, c.R); }
function biTipFor(t, c, g) {
  const share = c.total && (c.agg === 'sum') ? ` <span class="tt-m">· ${pctTxt(g.v || 0, c.list.reduce((a, x) => a + (x.v || 0), 0))}</span>` : '';
  const vals = c.list.map((x) => x.v).filter((v) => v != null), avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const rows = [[esc(c.mlabel) + ` <span class="tt-m">(${BI_AGG[c.agg].toLowerCase()})</span>`, `<b>${biFmt(g.v, c.fmt)}</b>${share}`], ['Entries', g.rows.length], ['vs average', avg ? chg(g.v || 0, avg) : '—']];
  const ds = BI_DS[t.src], other = Object.keys(ds.fields).find((f) => f !== t.by && f !== 'item' && f !== 'food');
  const secs = [];
  if (other && g.rows.length) secs.push([`By ${ds.fields[other].toLowerCase()}`, groupBy(g.rows.map((r) => ({ ...r, amount: r[t.m] ?? 0 })), (r) => r[other]).slice(0, 4).map((x) => [esc(x[0]), biFmt(x[1], c.fmt)])]);
  return tip(esc(g.long), rows, secs, !c.isTime && g.key !== '__other' ? 'Click to filter the whole page' : '');
}
const biClick = (t, g, c) => (!c.isTime && g.key !== '__other' ? ` data-a="biF" data-f="${esc(t.by)}" data-v="${esc(g.key)}"` : '');
const biSel = (t, g) => (ui.biF || []).some((f) => f.f === t.by && f.v === g.key);

function biColumn(t, c, W, H) {
  const L = 44, R = 8, T = 10, B = 24, pw = W - L - R, ph = H - T - B, n = c.list.length || 1;
  const goal = biLineGoal(t, c), vmax = Math.max(0, ...c.list.map((g) => g.v || 0), goal || 0), vmin = Math.min(0, ...c.list.map((g) => g.v || 0));
  const max = niceMax(vmax), min = vmin < 0 ? -niceMax(-vmin) : 0, Y = (v) => T + ((max - v) / (max - min)) * ph, slot = pw / n, bw = Math.max(2, Math.min(36, slot * 0.72));
  const grid = [min, min < 0 ? 0 : (max + min) / 2, max].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="cg"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="ct" text-anchor="end">${biShort(v, c.fmt)}</text>`).join('');
  const every = Math.ceil(n / Math.max(1, Math.floor(pw / 42)));
  const bars = c.list.map((g, i) => { const v = g.v || 0, x = L + i * slot + (slot - bw) / 2, y0 = Y(0), y1 = Y(v), h = Math.abs(y1 - y0), r = Math.min(3, bw / 2, h);
    const d = !v ? '' : v > 0 ? `M${x},${y0} V${y1 + r} q0,-${r} ${r},-${r} H${x + bw - r} q${r},0 ${r},${r} V${y0} z` : `M${x},${y0} V${y1 - r} q0,${r} ${r},${r} H${x + bw - r} q${r},0 ${r},-${r} V${y0} z`;
    return `<g class="hit${biSel(t, g) ? ' sel' : ''}"${biClick(t, g, c)}${biTipFor(t, c, g)}><rect x="${L + i * slot}" y="${T}" width="${slot}" height="${ph}" fill="transparent"/>${d ? `<path d="${d}" class="cb${v < 0 ? ' neg' : ''}"/>` : ''}${i % every === 0 ? `<text x="${L + i * slot + slot / 2}" y="${H - 7}" class="ct" text-anchor="middle">${esc(String(g.label).slice(0, 10))}</text>` : ''}</g>`; }).join('');
  const gl = goal != null ? `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" class="cgoal"/><text x="${W - R}" y="${Y(goal) - 4}" class="ct" text-anchor="end">goal ${biShort(goal, c.fmt)}</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${bars}${gl}</svg>`;
}
function biLine(t, c, W, H) {
  const L = 44, R = 10, T = 12, B = 24, pw = W - L - R, ph = H - T - B, n = c.list.length;
  const pts = c.list.map((g) => g.v), vals = pts.filter((v) => v != null), goal = biLineGoal(t, c);
  const max = niceMax(Math.max(0, ...vals, goal || 0)), min = Math.min(0, ...vals) < 0 ? -niceMax(-Math.min(...vals)) : 0;
  const X = (i) => L + (n > 1 ? (i / (n - 1)) * pw : pw / 2), Y = (v) => T + ((max - v) / (max - min)) * ph;
  let d = '', pen = false; pts.forEach((v, i) => { if (v == null) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${Y(v).toFixed(1)}`; pen = true; });
  const grid = [min, (max + min) / 2, max].map((v) => `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="cg"/><text x="${L - 6}" y="${Y(v) + 3.5}" class="ct" text-anchor="end">${biShort(v, c.fmt)}</text>`).join('');
  const every = Math.ceil(n / Math.max(1, Math.floor(pw / 46)));
  const hits = c.list.map((g, i) => `<g class="hit vline"${biTipFor(t, c, g)}><rect x="${X(i) - pw / Math.max(1, n - 1) / 2}" y="${T}" width="${pw / Math.max(1, n - 1)}" height="${ph}" fill="transparent"/><line x1="${X(i)}" x2="${X(i)}" y1="${T}" y2="${T + ph}" class="cx"/>${g.v != null ? `<circle cx="${X(i)}" cy="${Y(g.v)}" r="4" class="cdot"/>` : ''}${i % every === 0 ? `<text x="${X(i)}" y="${H - 7}" class="ct" text-anchor="middle" style="opacity:1">${esc(String(g.label))}</text>` : ''}</g>`).join('');
  const gl = goal != null ? `<line x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" class="cgoal"/><text x="${W - R}" y="${Y(goal) - 4}" class="ct" text-anchor="end">goal ${biShort(goal, c.fmt)}</text>` : '';
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${gl}<path d="${d}" class="cl"/>${hits}</svg>`;
}
function biBars(t, c) {
  const list = c.list.filter((g) => g.v != null); if (!list.length) return '<div class="faint small">Nothing in this range.</div>';
  const max = Math.max(...list.map((g) => Math.abs(g.v))) || 1, sum = list.reduce((a, g) => a + (g.v || 0), 0);
  return `<div class="hbars">${list.map((g) => `<div class="hb hit${biSel(t, g) ? ' sel' : ''}"${biClick(t, g, c)}${biTipFor(t, c, g)}><div class="hb-top"><span class="hb-name">${esc(g.long)}</span><span class="mono hb-val">${biFmt(g.v, c.fmt)}${c.agg === 'sum' && sum ? `<span class="faint"> · ${pctTxt(g.v, sum)}</span>` : ''}</span></div><div class="hb-track"><i style="width:${Math.max(2, (Math.abs(g.v) / max) * 100)}%"></i></div></div>`).join('')}</div>`;
}
function biDonut(t, c) {
  const list = c.list.filter((g) => (g.v || 0) > 0).slice(0, 7), sum = list.reduce((a, g) => a + g.v, 0);
  if (!sum) return '<div class="faint small">Nothing in this range.</div>';
  const R0 = 70, R1 = 44, cx = 80, cy = 80; let a0 = -Math.PI / 2;
  const arcs = list.map((g, i) => { const a1 = a0 + (g.v / sum) * Math.PI * 2 - (list.length > 1 ? 0.02 : 0), big = a1 - a0 > Math.PI ? 1 : 0;
    const p = (r, a) => `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    const d = list.length === 1 ? `M${cx - R0},${cy} a${R0},${R0} 0 1 0 ${R0 * 2},0 a${R0},${R0} 0 1 0 -${R0 * 2},0 M${cx - R1},${cy} a${R1},${R1} 0 1 1 ${R1 * 2},0 a${R1},${R1} 0 1 1 -${R1 * 2},0` : `M${p(R0, a0)} A${R0},${R0} 0 ${big} 1 ${p(R0, a1)} L${p(R1, a1)} A${R1},${R1} 0 ${big} 0 ${p(R1, a0)} z`;
    a0 = a1 + (list.length > 1 ? 0.02 : 0);
    return `<path d="${d}" class="hit sl ${g.key === '__other' ? 's0' : 's' + (i + 1)}${biSel(t, g) ? ' sel' : ''}" fill-rule="evenodd"${biClick(t, g, c)}${biTipFor(t, c, g)}/>`; }).join('');
  return `<div class="donut"><svg viewBox="0 0 160 160" class="chart">${arcs}<text x="80" y="78" text-anchor="middle" class="dv">${biShort(sum, c.fmt)}</text><text x="80" y="94" text-anchor="middle" class="ct">${c.agg === 'sum' ? 'total' : 'combined'}</text></svg>
    <div class="dleg">${list.map((g, i) => `<div class="hit${biSel(t, g) ? ' sel' : ''}"${biClick(t, g, c)}${biTipFor(t, c, g)}><i class="${g.key === '__other' ? 's0' : 's' + (i + 1)}"></i><span class="hb-name">${esc(g.long)}</span><span class="mono">${biFmt(g.v, c.fmt)}</span><span class="mono faint">${pctTxt(g.v, sum)}</span></div>`).join('')}</div></div>`;
}
function biTable(t, c) {
  if (!c.list.length) return '<div class="faint small">Nothing in this range.</div>';
  const sum = c.list.reduce((a, g) => a + (g.v || 0), 0), by = t.by in BI_TIME ? BI_TIME[t.by] : BI_DS[t.src].fields[t.by];
  return `<div class="bitable"><table><tr><th>${esc(by)}</th><th class="r">${esc(c.mlabel)}</th>${c.agg === 'sum' ? '<th class="r">Share</th>' : ''}<th class="r">Entries</th></tr>
    ${c.list.map((g) => `<tr class="hit${biSel(t, g) ? ' sel' : ''}"${biClick(t, g, c)}${biTipFor(t, c, g)}><td>${esc(g.long)}</td><td class="mono r">${biFmt(g.v, c.fmt)}</td>${c.agg === 'sum' ? `<td class="mono r faint">${pctTxt(g.v || 0, sum)}</td>` : ''}<td class="mono r faint">${g.rows.length}</td></tr>`).join('')}
    ${c.agg === 'sum' ? `<tr class="tot"><td>Total</td><td class="mono r">${biFmt(sum, c.fmt)}</td><td></td><td class="mono r">${c.rows.length}</td></tr>` : ''}</table></div>`;
}
function biKpi(t, c) {
  const prevRows = (() => { const ds = BI_DS[t.src]; let r = ds.rows(c.R.prev[0], c.R.prev[1]); if (t.ff && t.fv) r = r.filter((x) => String(x[t.ff]) === t.fv); (ui.biF || []).forEach((f) => { if (f.f in ds.fields) r = r.filter((x) => String(x[f.f]) === f.v); }); return r; })();
  const prev = biAgg(prevRows, t.m, c.agg), goal = biGoal(t, c.R);
  let spark = '';
  if (c.R.len <= 120 && c.R.len > 1) { const days = []; for (let k = c.R.from < biEarliest() ? biEarliest() : c.R.from; k <= c.R.end; k = addDays(k, 1)) days.push(biAgg(c.rows.filter((r) => r.date === k), t.m, c.agg === 'perday' ? 'sum' : c.agg)); const vs = days.map((v) => v || 0), mx = Math.max(1, ...vs.map(Math.abs));
    if (days.length > 1) spark = `<svg viewBox="0 0 200 36" class="spark" preserveAspectRatio="none"><path d="${vs.map((v, i) => `${i ? 'L' : 'M'}${((i / (vs.length - 1)) * 200).toFixed(1)},${(33 - (Math.max(0, v) / mx) * 30).toFixed(1)}`).join('')}" /></svg>`; }
  const p = goal ? Math.max(0, Math.min(100, pct(c.total || 0, goal))) : null;
  const t2 = tip(esc(t.title || c.mlabel), [[c.R.label, `<b>${biFmt(c.total, c.fmt)}</b>`], ['Previous period', biFmt(prev, c.fmt)], ['Change', chg(c.total || 0, prev || 0)], ...(goal != null ? [['Goal', biFmt(goal, c.fmt)], ['Progress', p + '%']] : []), ['Entries', c.rows.length]]);
  return `<div class="kpi hit"${t2}><div class="kv mono">${biFmt(c.total, c.fmt)}</div><div class="kc small"><span class="${prev == null ? 'faint' : ''}">${prev == null ? 'no data before' : chg(c.total || 0, prev) + ' vs previous'}</span>${goal != null ? `<span class="faint"> · goal ${biFmt(goal, c.fmt)}</span>` : ''}</div>${goal != null ? `<div class="bar"><i style="width:${p}%"></i></div>` : ''}${spark}</div>`;
}
function biTileBody(t) {
  const c = biCompute(t), size = +t.size || 1, W = [0, 300, 620, 940, 1260][size], H = t.vis === 'kpi' ? 0 : 210;
  if (t.vis === 'kpi' || !t.by || t.by === 'none') return biKpi(t, c);
  if (t.vis === 'column') return biColumn(t, c, W, H);
  if (t.vis === 'line') return biLine(t, c, W, H);
  if (t.vis === 'bar') return biBars(t, c);
  if (t.vis === 'donut') return biDonut(t, c);
  return biTable(t, c);
}
function biTileHTML(t, editing, preview) {
  const ds = BI_DS[t.src] || {}, m = (ds.measures || {})[t.m] || ['', '', ''], R = biTileRange(t);
  const sub = [m[0] ? `${BI_AGG[t.agg || m[2]]} ${m[0].toLowerCase()}` : '', t.by && t.by !== 'none' ? 'by ' + (BI_TIME[t.by] || ds.fields[t.by] || '').toLowerCase() : '', t.range && t.range !== 'page' ? R.label.toLowerCase() : '', t.ff && t.fv ? `${t.fv} only` : ''].filter(Boolean).join(' · ');
  const tools = editing && !preview ? `<div class="ttools"><button class="icon-btn" data-a="biMove" data-id="${t.id}" data-d="-1" aria-label="Move left">${ic('left', 13)}</button><button class="icon-btn" data-a="biMove" data-id="${t.id}" data-d="1" aria-label="Move right">${ic('right', 13)}</button><button class="btn sm" data-a="biEditTile" data-id="${t.id}">Edit</button><button class="btn sm" data-a="biDup" data-id="${t.id}">Copy</button><button class="icon-btn" data-a="biDel" data-id="${t.id}" aria-label="Delete tile">${ic('x', 13)}</button></div>` : '';
  return `<section class="dcard bt z${preview ? 2 : +t.size || 1}${editing && !preview ? ' editing' : ''}">${tools}<div class="dh"><div><h2 class="h3">${esc(t.title || m[0] || 'New tile')}</h2><div class="small faint">${esc(sub)}</div></div></div>${biTileBody(t)}</section>`;
}

// Starter pages, made once. Everything can be edited, moved or deleted.
let biN = 0;
const biT = (title, vis, src, m, o = {}) => ({ id: 't' + Date.now().toString(36) + (biN++), title, vis, src, m, by: o.by || 'none', agg: o.agg || '', size: String(o.size || (vis === 'kpi' ? 1 : 2)), top: o.top || '', range: o.range || 'page', target: o.target ?? '', ff: '', fv: '' });
function biStarter() {
  return [
    { id: 'd-overview', name: 'Overview', range: 'thisWeek', tiles: [
      biT('Deficit', 'kpi', 'days', 'deficit', { target: 'goal' }), biT('Workout days', 'kpi', 'days', 'workout', { target: 'goal' }), biT('Protein per day', 'kpi', 'food', 'p', { target: 'goal' }), biT('Spent', 'kpi', 'spending', 'amount'),
      biT('Deficit by day', 'column', 'days', 'deficit', { by: 'day', range: 'last30', size: 2 }), biT('Spending by category', 'bar', 'spending', 'amount', { by: 'category', range: 'thisMonth', size: 2 }),
      biT('Calories by meal', 'donut', 'food', 'cal', { by: 'meal', agg: 'sum', size: 2 }), biT('Day score', 'line', 'routine', 'score', { by: 'day', range: 'last30', size: 2 })] },
    { id: 'd-spending', name: 'Spending', range: 'thisMonth', tiles: [
      biT('Spent', 'kpi', 'spending', 'amount'), biT('Purchases', 'kpi', 'spending', 'count'), biT('Average purchase', 'kpi', 'spending', 'amount', { agg: 'avg' }), biT('Biggest purchase', 'kpi', 'spending', 'amount', { agg: 'max' }),
      biT('Spending by day', 'column', 'spending', 'amount', { by: 'day', size: 4 }), biT('By category', 'bar', 'spending', 'amount', { by: 'category', size: 2 }), biT('By card', 'donut', 'spending', 'amount', { by: 'card', size: 2 }),
      biT('By month', 'column', 'spending', 'amount', { by: 'month', range: 'thisYear', size: 2 }), biT('Top items', 'table', 'spending', 'amount', { by: 'item', top: 10, size: 2 })] },
    { id: 'd-health', name: 'Health', range: 'last30', tiles: [
      biT('Calories per day', 'kpi', 'food', 'cal'), biT('Protein per day', 'kpi', 'food', 'p', { target: 'goal' }), biT('Fiber per day', 'kpi', 'food', 'fib', { target: 'goal' }), biT('Total deficit', 'kpi', 'days', 'deficit'),
      biT('Deficit by week', 'column', 'days', 'deficit', { by: 'week', size: 2 }), biT('Protein by day', 'line', 'food', 'p', { by: 'day', agg: 'sum', target: 'goal', size: 2 }),
      biT('Top foods by calories', 'bar', 'food', 'cal', { by: 'food', agg: 'sum', top: 8, size: 2 }), biT('Fiber by day', 'column', 'food', 'fib', { by: 'day', agg: 'sum', target: 'goal', size: 2 }),
      biT('Sets by muscle group', 'donut', 'workouts', 'sets', { by: 'group', size: 2 }), biT('Best lifts', 'table', 'workouts', 'top', { by: 'exercise', size: 2 })] },
    { id: 'd-routine', name: 'Routine', range: 'last30', tiles: [
      biT('Average day score', 'kpi', 'routine', 'score'), biT('Days planned', 'kpi', 'routine', 'days'), biT('Blocks done', 'kpi', 'routine', 'done'), biT('Workout days', 'kpi', 'days', 'workout', { target: 'goal' }),
      biT('Score by day of week', 'column', 'routine', 'score', { by: 'weekday', size: 2 }), biT('Free-time picks', 'bar', 'picks', 'count', { by: 'pick', size: 2 })] }
  ];
}
function biPage() {
  if (!Array.isArray(DB.dashboards) || !DB.dashboards.length) { DB.dashboards = biStarter(); save(); }
  return DB.dashboards.find((d) => d.id === ui.biPage) || DB.dashboards[0];
}
const biTile = (id) => { for (const d of DB.dashboards) { const t = d.tiles.find((x) => x.id === id); if (t) return { d, t }; } return {}; };
function biValues(src, f) { return [...new Set(BI_DS[src].rows(biEarliest(), '9999-12-31').map((r) => String(r[f])))].sort(); }

function biEditor() {
  const t = ui.biDraft, ds = BI_DS[t.src], mdef = ds.measures[t.m] || ['', '', 'sum'];
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${String(cur) === String(v) ? 'selected' : ''}>${esc(l)}</option>`;
  const seg = (name, list, cur) => `<div class="seg bi">${list.map(([v, l]) => `<button class="${String(cur) === v ? 'on' : ''}" data-a="biSet" data-f="${name}" data-v="${v}">${l}</button>`).join('')}</div>`;
  return `<div class="bieditor"><div class="bie-form">
    <div class="row-flex"><h2 class="h3" style="flex:1">${ui.biEditId === 'new' ? 'New tile' : 'Edit tile'}</h2><button class="btn" data-a="biCancel">Cancel</button><button class="btn primary" data-a="biSave">${ui.biEditId === 'new' ? 'Add to page' : 'Save'}</button></div>
    <label class="fld">Title<input class="inp" value="${esc(t.title)}" placeholder="${esc(mdef[0])}" data-c="biIn" data-f="title"></label>
    <label class="fld">Visual${seg('vis', BI_VIS, t.vis)}</label>
    <div class="bie-grid">
      <label class="fld">Data<select class="sel" data-c="biIn" data-f="src">${Object.entries(BI_DS).map(([k, d]) => opt(k, d.label, t.src)).join('')}</select></label>
      <label class="fld">Measure<select class="sel" data-c="biIn" data-f="m">${Object.entries(ds.measures).map(([k, d]) => opt(k, d[0], t.m)).join('')}</select></label>
      <label class="fld">Add it up as<select class="sel" data-c="biIn" data-f="agg">${opt('', 'Default (' + BI_AGG[mdef[2]].toLowerCase() + ')', t.agg)}${Object.entries(BI_AGG).map(([k, l]) => opt(k, l, t.agg)).join('')}</select></label>
      <label class="fld">Group by<select class="sel" data-c="biIn" data-f="by">${opt('none', t.vis === 'kpi' ? 'Nothing (one number)' : 'Nothing', t.by)}<optgroup label="Time">${Object.entries(BI_TIME).map(([k, l]) => opt(k, l, t.by)).join('')}</optgroup><optgroup label="${esc(ds.label)}">${Object.entries(ds.fields).map(([k, l]) => opt(k, l, t.by)).join('')}</optgroup></select></label>
      <label class="fld">Date range<select class="sel" data-c="biIn" data-f="range">${opt('page', 'Same as page', t.range)}${Object.entries(BI_RANGES).map(([k, l]) => opt(k, l, t.range)).join('')}</select></label>
      <label class="fld">Show top<input class="inp num" value="${esc(t.top)}" placeholder="all" data-c="biIn" data-f="top"></label>
      <label class="fld">Only where<select class="sel" data-c="biIn" data-f="ff">${opt('', 'No filter', t.ff)}${Object.entries(ds.fields).map(([k, l]) => opt(k, l, t.ff)).join('')}</select></label>
      ${t.ff ? `<label class="fld">is<select class="sel" data-c="biIn" data-f="fv">${opt('', 'Pick…', t.fv)}${biValues(t.src, t.ff).map((v) => opt(v, v, t.fv)).join('')}</select></label>` : ''}
      <label class="fld">Goal<select class="sel" data-c="biIn" data-f="target">${opt('', 'None', t.target)}${opt('goal', 'From Settings', t.target)}${t.target !== '' && t.target !== 'goal' ? opt(t.target, t.target, t.target) : ''}</select></label>
      <label class="fld">Custom goal<input class="inp num" value="${t.target !== 'goal' ? esc(t.target) : ''}" placeholder="—" data-c="biIn" data-f="target"></label>
    </div>
    <label class="fld">Size${seg('size', BI_SIZES, t.size)}</label>
  </div><div class="bie-prev"><div class="small faint" style="margin-bottom:6px">Preview</div>${biTileHTML(t, false, true)}</div></div>`;
}

VIEWS.summary = () => {
  const P = biPage(), R = biRange(P.range || 'thisMonth'), ed = !!ui.biEdit;
  const tabs = DB.dashboards.map((d) => `<button class="${d.id === P.id ? 'on' : ''}" data-a="biPage" data-id="${d.id}">${esc(d.name)}</button>`).join('');
  const fl = (ui.biF || []).map((f, i) => `<span class="fchip">${esc(f.v)}<button class="icon-btn" data-a="biFClear" data-i="${i}" aria-label="Remove filter">${ic('x', 12, 2.2)}</button></span>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Dashboard</span>${ed ? `<input class="inp h1in" value="${esc(P.name)}" data-c="biPageName" aria-label="Page name">` : `<h1 class="h1">${esc(P.name)}</h1>`}</div>
    <div class="row-flex"><select class="sel" data-c="biRange" aria-label="Date range">${Object.entries(BI_RANGES).map(([k, l]) => `<option value="${k}" ${P.range === k ? 'selected' : ''}>${l}</option>`).join('')}</select><button class="btn ${ed ? 'primary' : ''}" data-a="biEditMode">${ed ? 'Done' : 'Edit dashboard'}</button></div></div>
  <div class="bitabs"><div class="seg bi">${tabs}</div>${ed ? `<button class="btn sm" data-a="biPageAdd">+ Page</button>${DB.dashboards.length > 1 ? `<button class="btn sm danger" data-a="biPageDel">Delete page</button>` : ''}<button class="btn sm primary" data-a="biAdd">+ Add tile</button>` : ''}<span class="small faint" style="margin-left:auto">${esc(R.label)} · ${shortDay(R.from)} – ${shortDay(R.to)}</span></div>
  ${fl ? `<div class="row-flex" style="margin:-4px 0 12px"><span class="small faint">Filtered to</span>${fl}<button class="btn ghost sm" data-a="biFClear" data-i="all">Clear all</button></div>` : ''}
  ${ui.biDraft ? biEditor() : ''}
  <div class="bigrid">${P.tiles.map((t) => biTileHTML(t, ed)).join('') || `<div class="dcard z4"><div class="faint">This page is empty. Click <b>Edit dashboard</b>, then <b>+ Add tile</b>.</div></div>`}</div>
  <div class="hint" style="margin-top:12px">Hover anything for details. Click a bar, slice or row to filter the whole page. Weeks start Monday.</div>`;
};

// ---------- settings ----------
VIEWS.settings = () => {
  const S = DB.settings;
  return `<div class="head"><div class="head-title"><span class="kicker">Settings</span><h1 class="h1">Preferences</h1></div></div>
  <div class="sheet" style="max-width:640px;padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="row-flex"><label class="fld">Protein goal (g)<input class="inp num" value="${S.proteinTarget}" data-c="set" data-f="proteinTarget"></label><label class="fld">Fiber goal (g)<input class="inp num" value="${S.fiberTarget}" data-c="set" data-f="fiberTarget"></label><label class="fld">Body weight (kg)<input class="inp num" value="${S.bodyKg ?? 68}" data-c="set" data-f="bodyKg"></label><label class="fld">Deficit goal / day<input class="inp num" value="${S.deficitGoal ?? 500}" data-c="set" data-f="deficitGoal"></label><label class="fld">Workout days / week<input class="inp num" value="${S.workoutDaysGoal ?? 5}" data-c="set" data-f="workoutDaysGoal"></label><label class="fld">Currency<input class="inp" style="width:70px" value="${esc(S.currency)}" data-c="set" data-f="currency"></label></div>
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
    <div class="row-flex"><b style="margin-right:auto">Background</b><label class="btn" style="cursor:pointer">Choose a photo…<input type="file" accept="image/*" data-c="bgPick" class="sr"></label>${(() => { try { return localStorage.getItem('wellness-bg') ? '<button class="btn" data-a="bgClear">Use the default scene</button>' : ''; } catch { return ''; } })()}</div>
    <div class="hint">The glass panels sit over a background scene. Pick any photo from your Mac to use your own; it stays on this Mac. The sun / moon button at the top switches light, dark, or following your Mac.</div>
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
  tSet: (el) => { ui.tf = { ...(ui.tf || { kind: 'stock', side: 'long' }), [el.dataset.f]: el.dataset.v }; render(); },
  tAdd: () => { const f = ui.tf || { kind: 'stock', side: 'long' }, sym = $('#tSym').value.trim().toUpperCase(), qty = num($('#tQty').value), p1 = $('#tP1').value.trim(), p2 = $('#tP2').value.trim();
    if (!sym) { $('#tSym').focus(); return; } if (!(qty > 0)) { $('#tQty').focus(); return; } if (p1 === '') { $('#tP1').focus(); return; }
    const t = { id: uid(), kind: f.kind, side: f.side, symbol: sym, qty, fees: num($('#tFee').value), open: $('#tD1').value || todayKey(), close: '', buy: '', sell: '' };
    if (f.side === 'short') { t.sell = num(p1); if (p2 !== '') { t.buy = num(p2); t.close = $('#tD2').value || todayKey(); } } else { t.buy = num(p1); if (p2 !== '') { t.sell = num(p2); t.close = $('#tD2').value || todayKey(); } }
    if (f.kind === 'option') t.opt = { type: $('#tOT').value, strike: num($('#tStrike').value) || '', expiry: $('#tExp').value || '' };
    DB.trades = DB.trades || []; DB.trades.push(t); save(); render(); toast(isClosed(t) ? 'Trade added · ' + signed(tradePnl(t)) : 'Open position added'); },
  tCloseOpen: (el) => { ui.tClose = el.dataset.id; render(); setTimeout(() => { const i = $('#tcPrice'); if (i) i.focus(); }, 30); },
  tCloseCancel: () => { ui.tClose = null; render(); },
  tCloseSave: (el) => { const t = (DB.trades || []).find((x) => x.id === el.dataset.id), v = $('#tcPrice').value.trim(); if (!t) return; if (v === '') { $('#tcPrice').focus(); return; }
    if (t.side === 'short') t.buy = num(v); else t.sell = num(v); t.close = $('#tcDate').value || todayKey(); ui.tClose = null; save(); render(); toast('Closed · ' + signed(tradePnl(t))); },
  tExpire: (el) => { const t = (DB.trades || []).find((x) => x.id === el.dataset.id); if (!t) return; if (t.side === 'short') t.buy = 0; else t.sell = 0; t.close = (t.opt && t.opt.expiry && t.opt.expiry <= todayKey()) ? t.opt.expiry : todayKey(); ui.tClose = null; save(); render(); toast('Expired · ' + signed(tradePnl(t))); },
  tDel: (el) => { const t = (DB.trades || []).find((x) => x.id === el.dataset.id); if (!t || !confirm(`Delete the ${tradeName(t)} trade?`)) return; DB.trades = DB.trades.filter((x) => x.id !== t.id); save(); render(); },
  mTab: (el) => { ui.mTab = el.dataset.t; ui.sFilter = null; render(); },
  addInc: () => { const item = $('#iItem').value.trim(), amt = num($('#iAmt').value); if (!amt) { $('#iAmt').focus(); return; } DB.income.push({ id: uid(), date: $('#iDate').value || todayKey(), source: $('#iSrc').value || 'Salary', item: item || $('#iSrc').value, amount: amt }); save(); render(); toast('Added ' + signed(amt)); },
  delInc: (el) => { DB.income = DB.income.filter((x) => x.id !== el.dataset.id); save(); render(); },
  paySave: () => { const amt = num($('#payAmt').value), nx = $('#payNext').value; if (!(amt > 0)) { $('#payAmt').focus(); return; } if (!nx) { $('#payNext').focus(); return; } DB.pay = { on: true, amount: amt, freq: $('#payFreq').value, next: nx }; runPay(); save(); render(); toast('Pay schedule saved'); },
  payOff: () => { DB.pay = { ...DB.pay, on: false }; save(); render(); toast('Pay schedule off'); },
  cmdOpen: () => { ui.cmd = true; ui.cmdQ = ''; ui.cmdSel = 0; renderCmd(); },
  cmdClose: () => { ui.cmd = false; renderCmd(); },
  cmdRun: (el) => { const x = cmdItems(ui.cmdQ || '')[+el.dataset.i]; ui.cmd = false; renderCmd(); if (x) x.run(); },
  themeCycle: () => { const order = ['auto', 'light', 'dark'], t = order[(order.indexOf(themePref()) + 1) % 3]; try { localStorage.setItem('wellness-theme', t); } catch {} applyTheme(); toast(t === 'auto' ? 'Theme follows your Mac' : t === 'light' ? 'Light theme' : 'Dark theme'); },
  bgClear: () => { try { localStorage.removeItem('wellness-bg'); } catch {} applyBg(); render(); toast('Background reset'); },
  biPage: (el) => { ui.biPage = el.dataset.id; ui.biF = []; ui.biDraft = null; render(); },
  biEditMode: () => { ui.biEdit = !ui.biEdit; if (!ui.biEdit) ui.biDraft = null; render(); },
  biPageAdd: () => { const d = { id: 'd' + uid(), name: 'New page', range: 'thisMonth', tiles: [] }; DB.dashboards.push(d); ui.biPage = d.id; save(); render(); },
  biPageDel: () => { const P = biPage(); if (!confirm(`Delete the page “${P.name}” and its ${P.tiles.length} tiles?`)) return; DB.dashboards = DB.dashboards.filter((d) => d.id !== P.id); ui.biPage = null; save(); render(); },
  biAdd: () => { ui.biEditId = 'new'; ui.biDraft = biT('', 'column', 'spending', 'amount', { by: 'day', size: 2 }); render(); },
  biEditTile: (el) => { const { t } = biTile(el.dataset.id); if (!t) return; ui.biEditId = t.id; ui.biDraft = { ...t }; render(); },
  biSet: (el) => { ui.biDraft[el.dataset.f] = el.dataset.v; if (el.dataset.f === 'vis') { if (el.dataset.v === 'kpi') { ui.biDraft.by = 'none'; ui.biDraft.size = '1'; } else if (ui.biDraft.by === 'none') ui.biDraft.by = el.dataset.v === 'column' || el.dataset.v === 'line' ? 'day' : Object.keys(BI_DS[ui.biDraft.src].fields)[0]; } render(); },
  biCancel: () => { ui.biDraft = null; render(); },
  biSave: () => { const t = ui.biDraft, P = biPage(); if (ui.biEditId === 'new') P.tiles.push(t); else { const x = biTile(ui.biEditId); if (x.t) Object.assign(x.t, t); } ui.biDraft = null; save(); render(); toast('Saved tile'); },
  biDup: (el) => { const { d, t } = biTile(el.dataset.id); if (!t) return; d.tiles.splice(d.tiles.indexOf(t) + 1, 0, { ...t, id: 't' + uid(), title: (t.title || '') + ' (copy)' }); save(); render(); },
  biDel: (el) => { const { d, t } = biTile(el.dataset.id); if (!t || !confirm(`Delete “${t.title || 'this tile'}”?`)) return; d.tiles.splice(d.tiles.indexOf(t), 1); save(); render(); },
  biMove: (el) => { const { d, t } = biTile(el.dataset.id); if (!t) return; const i = d.tiles.indexOf(t), j = i + +el.dataset.d; if (j < 0 || j >= d.tiles.length) return; d.tiles.splice(i, 1); d.tiles.splice(j, 0, t); save(); render(); },
  biF: (el) => { ui.biF = ui.biF || []; const i = ui.biF.findIndex((f) => f.f === el.dataset.f && f.v === el.dataset.v); if (i >= 0) ui.biF.splice(i, 1); else { ui.biF = ui.biF.filter((f) => f.f !== el.dataset.f); ui.biF.push({ f: el.dataset.f, v: el.dataset.v }); } render(); },
  biFClear: (el) => { if (el.dataset.i === 'all') ui.biF = []; else ui.biF.splice(+el.dataset.i, 1); render(); },
  sNav: (el) => { const d = +el.dataset.d; ui.sMonth = d === 0 ? monthKey(todayKey()) : addMonths(ui.sMonth, d); ui.sFilter = null; render(); },
  sGo: (el) => { ui.sMonth = el.dataset.m; ui.sFilter = null; render(); },
  sFilt: (el) => { const f = { k: el.dataset.k, v: el.dataset.v, m: ui.sMonth }; ui.sFilter = ui.sFilter && ui.sFilter.k === f.k && ui.sFilter.v === f.v ? null : f; render(); },
  sFiltClear: () => { ui.sFilter = null; render(); },
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
    const [group, forceKind] = $('#exGroup').value.split('|'), body = group === 'Abs' && forceKind !== 'weights';
    DB.exercises.push({ id: uid(), name: n, group, kind: body ? 'bodyweight' : 'weights', start: body ? [] : [$('#exW1').value, $('#exW2').value, $('#exW3').value].filter((v) => v.trim() !== '').map(num), ...(body ? { pos: abMoves().length } : {}) });
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
  bgPick: (el) => { const f = el.files && el.files[0]; if (!f) return; const img = new Image(); const url = URL.createObjectURL(f);
    img.onload = () => { const sc = Math.min(1, 2200 / Math.max(img.width, img.height)), c = document.createElement('canvas'); c.width = Math.round(img.width * sc); c.height = Math.round(img.height * sc); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      try { localStorage.setItem('wellness-bg', c.toDataURL('image/jpeg', 0.84)); toast('Background set'); } catch { toast('That photo is too large — try a smaller one'); } applyBg(); render(); };
    img.src = url; },
  tAll: (el) => { ui.tAll = el.checked; render(); },
  biIn: (el) => { const t = ui.biDraft, f = el.dataset.f; let v = el.value; if (f === 'target' && el.tagName === 'INPUT') v = v.trim() === '' ? '' : String(num(v));
    t[f] = v;
    if (f === 'src') { const ds = BI_DS[v]; t.m = Object.keys(ds.measures)[0]; t.agg = ''; t.ff = ''; t.fv = ''; if (!(t.by in BI_TIME) && t.by !== 'none') t.by = Object.keys(ds.fields)[0]; }
    if (f === 'm') t.agg = '';
    if (f === 'ff') t.fv = '';
    if (f === 'by' && v !== 'none' && t.vis === 'kpi') { t.vis = v in BI_TIME ? 'column' : 'bar'; if (t.size === '1') t.size = '2'; }
    render(); },
  biRange: (el) => { biPage().range = el.value; save(); render(); },
  biPageName: (el) => { const v = el.value.trim(); if (v) { biPage().name = v; save(); render(); } },
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
  cmdQ: (el) => { ui.cmdQ = el.value; ui.cmdSel = 0; const pos = el.selectionStart; renderCmd(); const n = $('#cmdQ'); if (n) n.setSelectionRange(pos, pos); },
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
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); ui.cmd ? A.cmdClose() : A.cmdOpen(); return; }
  if (ui.cmd) {
    const n = cmdItems(ui.cmdQ || '').length;
    if (e.key === 'Escape') { A.cmdClose(); return; }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); ui.cmdSel = ((ui.cmdSel || 0) + (e.key === 'ArrowDown' ? 1 : -1) + n) % Math.max(1, n); renderCmd(); return; }
    if (e.key === 'Enter') { e.preventDefault(); A.cmdRun({ dataset: { i: ui.cmdSel || 0 } }); return; }
  }
  if (e.key === 'Enter' && e.target.matches('#eAmt,#eItem')) A.addExp();
  if (e.key === 'Enter' && e.target.matches('#iAmt,#iItem')) A.addInc();
  if (e.key === 'Enter' && e.target.matches('.tradebar input')) A.tAdd();
  if (e.key === 'Enter' && e.target.matches('#tcPrice')) A.tCloseSave({ dataset: { id: ui.tClose } });
  if (e.key === 'Enter' && e.target.matches('#fName,#fSrv,#fCal,#fP,#fC,#fFib,#fF')) A.addFood();
  if (e.key === 'Escape' && ui.open) { ui.open = null; render(); }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderNav);

// refresh the "now" row every minute and roll over at midnight
let lastDay = todayKey();
setInterval(() => {
  const t = todayKey();
  if (t !== lastDay) { if (runPay()) save(); if (ui.date === lastDay) ui.date = t; if (ui.hDate === lastDay) ui.hDate = t; lastDay = t; }
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
  if (runPay()) save();
  applyBg(); applyTheme();
  render();
  Sync.pull();
  setInterval(() => Sync.pull(), 20 * 1000);
  window.addEventListener('focus', () => Sync.pull());
  document.addEventListener('focusout', () => setTimeout(() => { if (refreshView.later && !(document.activeElement && document.activeElement.matches('input,textarea,select'))) { refreshView.later = false; render(); } }, 50));
  if (window.api && window.api.updateInfo) { try { APP_VERSION = (await window.api.updateInfo()).version; renderNav(); } catch {} }
  if (window.api) { const on = await window.api.getOpenAtLogin(); const c = $('#loginChk'); if (c) c.checked = on; }
})();
