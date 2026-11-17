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
const money = (n) => (DB.settings.currency || '$') + (Math.round(n * 100) / 100).toFixed(2);
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
    settings: { proteinTarget: 70, fiberTarget: 20, currency: '$' },
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
    categories: ['Food & dining', 'Groceries', 'Transport & gas', 'Shopping', 'Entertainment', 'Subscriptions', 'Health & fitness', 'Bills', 'Other'],
    expenses: []
  };
}

const store = window.api || {
  load: async () => { try { return JSON.parse(localStorage.getItem('wellness-data')); } catch { return null; } },
  save: async (d) => { localStorage.setItem('wellness-data', JSON.stringify(d)); return true; }
};
let DB = null;
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.save(DB), 250); }

const ui = {
  view: 'today', date: todayKey(), open: null, planId: null, editDay: false,
  week: weekStart(todayKey()), month: monthKey(todayKey()), hDate: todayKey(), sMonth: monthKey(todayKey()),
  logEx: null
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
  $('#sidefoot').innerHTML = `Sage · ${dark ? 'Dark' : 'Light'}<br>Follows your Mac’s appearance`;
}
function render() {
  renderNav();
  const v = VIEWS[ui.view] || VIEWS.today;
  const m = $('#main');
  const st = m.scrollTop;
  m.innerHTML = '<div class="topdrag"></div>' + v();
  m.scrollTop = st;
  if (ui.view === 'settings' && window.api) {
    window.api.getOpenAtLogin().then((on) => { const c = $('#loginChk'); if (c) c.checked = on; });
    if (window.api.updateInfo) window.api.updateInfo().then((i) => { const r = $('#updRepo'), v = $('#updVer'); if (r) r.value = i.configured ? i.repo : ''; if (v) v.textContent = 'version ' + i.version; const t = $('#updToken'); if (t && i.hasToken) t.placeholder = 'saved ••••••'; });
  }
}
const go = (v) => { ui.view = v; ui.open = null; render(); $('#main').scrollTop = 0; };

function dateNav(action, label) {
  return `<div class="datenav"><button class="icon-btn" data-a="${action}" data-d="-1" aria-label="Previous">${ic('left')}</button><button class="btn sm" data-a="${action}" data-d="0">${label}</button><button class="icon-btn" data-a="${action}" data-d="1" aria-label="Next">${ic('right')}</button></div>`;
}

// ---------- block editor (plans + single day) ----------
function blockEditor(scope, blocks) {
  const listOpts = (sel) => DB.choiceLists.map((l) => `<option value="${l.id}" ${l.id === sel ? 'selected' : ''}>${esc(l.name)}</option>`).join('');
  const rows = blocks.map((b, i) => `
    <tr>
      <td class="g">${i + 1}</td>
      <td><input class="inp time" type="time" value="${esc(b.start)}" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="start" aria-label="Start time"></td>
      <td><input class="inp time" type="time" value="${esc(b.end)}" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="end" aria-label="End time"></td>
      <td><input class="inp" value="${esc(b.title)}" placeholder="What happens" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="title" aria-label="Task"></td>
      <td><select class="sel" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="kind" aria-label="Type"><option value="task" ${b.kind !== 'choice' ? 'selected' : ''}>Task</option><option value="choice" ${b.kind === 'choice' ? 'selected' : ''}>Choice</option></select></td>
      <td>${b.kind === 'choice' ? `<select class="sel" data-c="blk" data-s="${scope}" data-b="${b.id}" data-f="listId" aria-label="Choice list">${listOpts(b.listId)}</select>` : '<span class="faint">—</span>'}</td>
      <td class="c"><button class="chk ${b.alert ? 'on' : ''}" data-a="blkAlert" data-s="${scope}" data-b="${b.id}" aria-pressed="${b.alert ? 'true' : 'false'}" aria-label="Alert for ${esc(b.title || 'block')}"><span class="box">${b.alert ? ic('check', 13, 3.2) : ''}</span></button></td>
      <td class="c"><button class="icon-btn" data-a="blkDel" data-s="${scope}" data-b="${b.id}" aria-label="Remove ${esc(b.title || 'block')}">${ic('x', 14)}</button></td>
    </tr>`).join('');
  return `<div class="sheet"><table>
    <colgroup><col style="width:40px"><col style="width:140px"><col style="width:140px"><col><col style="width:110px"><col style="width:160px"><col style="width:64px"><col style="width:56px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td>E</td><td>F</td><td></td></tr>
    <tr><th class="g">#</th><th>Start</th><th>End</th><th>Task</th><th>Type</th><th>Choice list</th><th class="c">Alert</th><th></th></tr>
    ${rows || `<tr><td class="g">1</td><td colspan="7" class="faint">No blocks yet. Add your first one below.</td></tr>`}
  </table>
  <div class="addbar"><button class="btn" data-a="blkAdd" data-s="${scope}">${ic('plus', 14, 2.2)} Add block</button><span class="hint">Leave start empty for “any time” tasks. Alerts fire on your Mac when a block starts.</span></div></div>`;
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
    if (now || next) {
      const cur = now ? now.b : next.b;
      nowCard = `<div class="now">${ic('clock', 20, 2)}<div><div class="k">${now ? 'Now · until ' + fmtTime(now.b.end || (next ? next.b.start : '') ) : 'Next · ' + fmtTime(cur.start)}</div><div class="v">${esc(cur.title)}</div></div>${now && next ? `<div class="n">next<br>${esc(next.b.title)}</div>` : ''}</div>`;
    } else nowCard = `<div class="now">${ic('clock', 20, 2)}<div><div class="k">Nothing scheduled</div><div class="v">Rest of the day is yours</div></div></div>`;
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
function targetWeights(ex, k) {
  const ws = weekStart(k);
  const prev = DB.sessions.filter((s) => s.exId === ex.id && s.date < ws).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!prev) return { w: ex.start.slice(), why: 'starting weights' };
  const w = prev.sets.map((s) => num(s.w));
  if (num(prev.sets[0].r) >= 15) return { w: w.map((x) => x + 10), why: `${prev.sets[0].r} reps on set 1 last time → +10 lb` };
  return { w, why: 'same as last week' };
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
  const exRows = DB.exercises.map((ex) => {
    const tw = targetWeights(ex, k);
    const last = DB.sessions.filter((s) => s.exId === ex.id).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    const today = DB.sessions.find((s) => s.exId === ex.id && s.date === k);
    let row = `<tr><td class="g"></td><td style="font-weight:600">${esc(ex.name)}</td><td class="small muted">${esc(ex.group)}</td>
      <td class="mono small">${last ? `${shortDay(last.date)} · ${last.sets.map((s) => `${s.w}×${s.r || '—'}`).join(' / ')}` : '<span class="faint">—</span>'}</td>
      <td class="mono" style="font-weight:600">${tw.w.join(' / ')} <span class="faint small" style="font-family:var(--sans);font-weight:400">· ${esc(tw.why)}</span></td>
      <td class="c"><button class="btn sm" data-a="logEx" data-id="${ex.id}">${today ? 'Edit' : 'Log'}</button></td></tr>`;
    if (ui.logEx === ex.id) {
      const sets = today ? today.sets : tw.w.map((w) => ({ w, r: '' }));
      row += `<tr class="chiprow"><td class="g"></td><td colspan="5"><div class="row-flex">${sets.map((s, i) => `<span class="small muted">Set ${i + 1}</span><input class="inp num" id="w${i}" value="${esc(s.w)}" aria-label="Set ${i + 1} weight"><span class="faint">lb ×</span><input class="inp num" id="r${i}" value="${esc(s.r)}" placeholder="reps" aria-label="Set ${i + 1} reps">`).join('')}<button class="btn primary sm" data-a="saveEx" data-id="${ex.id}">Save</button></div></td></tr>`;
    }
    return row;
  }).join('');
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

  <div class="section"><div class="section-head"><h2 class="h2">Workouts</h2><span class="hint">Rule: 15 reps on set 1 moves every set up 10 lb next week — once per week.</span></div>
  <div class="sheet"><table><colgroup><col style="width:40px"><col style="width:180px"><col style="width:130px"><col><col><col style="width:80px"></colgroup>
    <tr><th class="g">#</th><th>Exercise</th><th>Day</th><th>Last session</th><th>This week’s weights</th><th></th></tr>
    ${exRows || '<tr><td class="g">1</td><td colspan="5" class="faint">Add the exercises from your split (Shoulders & Chest, Arms, Back, Legs).</td></tr>'}
  </table>
  <div class="addbar"><input class="inp" id="exName" placeholder="Exercise, e.g. Lat pulldown" style="flex:1;min-width:180px" aria-label="Exercise name">
    <select class="sel" id="exGroup" aria-label="Split day"><option>Shoulders & Chest</option><option>Arms</option><option>Back</option><option>Legs</option><option>Abs</option></select>
    <span class="small muted">Start (lb)</span><input class="inp num" id="exW1" placeholder="Set 1" aria-label="Set 1 weight"><input class="inp num" id="exW2" placeholder="Set 2" aria-label="Set 2 weight"><input class="inp num" id="exW3" placeholder="Set 3" aria-label="Set 3 weight">
    <button class="btn" data-a="addEx">Add exercise</button></div></div></div>`;
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
  const rows = month.map((e, i) => `<tr><td class="g">${i + 1}</td><td class="mono">${shortDay(e.date)}</td><td>${esc(e.item)}</td><td class="small">${esc(e.category)}</td><td class="mono r">${money(e.amount)}</td><td class="c"><button class="icon-btn" data-a="delExp" data-id="${e.id}" aria-label="Remove ${esc(e.item)}">${ic('x', 13)}</button></td></tr>`).join('');
  return `<div class="head"><div class="head-title"><span class="kicker">Spending</span><h1 class="h1">${monthLabel(mk).split(' ')[0]}</h1></div>${dateNav('sNav', 'This month')}</div>
  <div class="stats"><div class="stat"><span class="k">This week</span><span class="v">${money(sum(week))}</span></div><div class="stat"><span class="k">${monthLabel(mk)}</span><span class="v">${money(sum(month))}</span></div><div class="stat"><span class="k">Top category</span><span class="v" style="font-size:17px;font-family:var(--sans);font-weight:600">${top ? esc(top.c) : '—'}</span></div><div class="stat"><span class="k">Entries</span><span class="v">${month.length}</span></div></div>
  <div class="cols"><div class="grow"><div class="sheet"><table><colgroup><col style="width:40px"><col style="width:90px"><col><col style="width:160px"><col style="width:100px"><col style="width:52px"></colgroup>
    <tr class="letters"><td></td><td>A</td><td>B</td><td>C</td><td>D</td><td></td></tr>
    <tr><th class="g">#</th><th>Date</th><th>Item</th><th>Category</th><th class="r">Amount</th><th></th></tr>
    ${rows || '<tr><td class="g">1</td><td colspan="5" class="faint">No spending logged this month.</td></tr>'}
  </table>
  <div class="addbar"><label class="fld">Date<input class="inp" type="date" id="eDate" value="${tk}"></label><label class="fld" style="flex:1;min-width:160px">Item<input class="inp" id="eItem" placeholder="Lunch, gas, Netflix…"></label><label class="fld">Category<select class="sel" id="eCat">${DB.categories.map((c) => `<option>${esc(c)}</option>`).join('')}</select></label><label class="fld">Amount<input class="inp num" id="eAmt" placeholder="0.00"></label><button class="btn primary" data-a="addExp">Add</button></div></div></div>
  <aside class="panel" style="width:300px"><h2 class="h2" style="font-size:22px">By category</h2><div class="sheet"><table><colgroup><col><col style="width:84px"><col style="width:84px"></colgroup><tr><th>Category</th><th class="r">Week</th><th class="r">Month</th></tr>
    ${byCat.map((x) => `<tr><td class="small">${esc(x.c)}</td><td class="mono r small ${x.w ? '' : 'faint'}">${money(x.w)}</td><td class="mono r small ${x.m ? '' : 'faint'}">${money(x.m)}</td></tr>`).join('')}
    <tr class="total"><td>Total</td><td class="mono r small">${money(sum(week))}</td><td class="mono r small">${money(sum(month))}</td></tr></table></div>
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
  const cats = {};
  ex.forEach((e) => { cats[e.category] = (cats[e.category] || 0) + e.amount; });
  return {
    planned: keys.length, avgScore: sc.length ? Math.round(sc.reduce((a, s) => a + s.pct, 0) / sc.length) : null,
    blocksDone: sc.reduce((a, s) => a + s.done, 0), blocksTotal: sc.reduce((a, s) => a + s.total, 0), picks,
    foodDays: foodDays.length, avgCal: avg((t) => t.cal), avgP: avg((t) => t.p), avgFib: avg((t) => t.fib),
    proteinHit: foodDays.filter((x) => x.t.p >= DB.settings.proteinTarget).length, def, defDays, spend, cats,
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
  </table></div><div class="hint" style="margin-top:10px">Week starts Monday. Only days up to today count.</div>`;
};

// ---------- settings ----------
VIEWS.settings = () => {
  const S = DB.settings;
  return `<div class="head"><div class="head-title"><span class="kicker">Settings</span><h1 class="h1">Preferences</h1></div></div>
  <div class="sheet" style="max-width:640px;padding:16px;display:flex;flex-direction:column;gap:14px">
    <div class="row-flex"><label class="fld">Protein goal (g)<input class="inp num" value="${S.proteinTarget}" data-c="set" data-f="proteinTarget"></label><label class="fld">Fiber goal (g)<input class="inp num" value="${S.fiberTarget}" data-c="set" data-f="fiberTarget"></label><label class="fld">Currency<input class="inp" style="width:70px" value="${esc(S.currency)}" data-c="set" data-f="currency"></label></div>
    ${window.api ? `<label class="row-flex small"><input type="checkbox" id="loginChk" data-c="login"> Open Wellness when I log in (so alerts keep coming)</label>
    <div class="row-flex"><button class="btn" data-a="testNote">Send a test notification</button><span class="hint">If nothing shows, allow Wellness in System Settings → Notifications.</span></div>` : '<div class="hint">Running in a browser preview: notifications and open-at-login work in the Mac app.</div>'}
    ${window.api && window.api.updateInfo ? `<div style="border-top:1px solid var(--line);padding-top:14px;display:flex;flex-direction:column;gap:10px">
      <div class="row-flex" style="justify-content:space-between"><b>Updates</b><span class="mono small muted" id="updVer"></span></div>
      <div class="row-flex"><label class="fld" style="flex:1">GitHub repo (owner/name)<input class="inp" id="updRepo" placeholder="your-name/wellness"></label>
        <label class="fld" style="flex:1">Access token (private repos only)<input class="inp" id="updToken" type="password" placeholder="leave empty for public"></label></div>
      <div class="row-flex"><button class="btn" data-a="updSave">Save</button><button class="btn primary" data-a="updCheck">Check for updates</button><span class="hint" id="updMsg">Wellness also checks by itself when it opens and every few hours.</span></div>
    </div>` : ''}
    <div class="row-flex"><button class="btn" data-a="export">Export my data (JSON)</button><label class="btn" style="cursor:pointer">Import data<input type="file" accept="application/json" data-c="import" class="sr"></label></div>
    <div class="hint">Light and dark follow your Mac’s appearance (System Settings → Appearance).</div>
  </div>`;
};

// ---------- actions ----------
const A = {
  go: (el) => go(el.dataset.v),
  dayNav: (el) => { const d = +el.dataset.d; ui.date = d === 0 ? todayKey() : addDays(ui.date, d); ui.open = null; ui.editDay = false; render(); },
  weekNav: (el) => { const d = +el.dataset.d; ui.week = d === 0 ? weekStart(todayKey()) : addDays(ui.week, 7 * d); render(); },
  monthNav: (el) => { const d = +el.dataset.d; ui.month = d === 0 ? monthKey(todayKey()) : addMonths(ui.month, d); render(); },
  hNav: (el) => { const d = +el.dataset.d; ui.hDate = d === 0 ? todayKey() : addDays(ui.hDate, d); ui.logEx = null; render(); },
  sNav: (el) => { const d = +el.dataset.d; ui.sMonth = d === 0 ? monthKey(todayKey()) : addMonths(ui.sMonth, d); render(); },
  openDay: (el) => { ui.date = el.dataset.k; ui.view = 'today'; ui.open = null; ui.editDay = false; render(); },
  tick: (el) => { const d = DB.days[ui.date]; d.done[el.dataset.b] = !d.done[el.dataset.b]; save(); render(); },
  pickOpen: (el) => { ui.open = ui.open === el.dataset.b ? null : el.dataset.b; render(); },
  pick: (el) => { const d = DB.days[ui.date]; if (el.dataset.o) d.choices[el.dataset.b] = el.dataset.o; else delete d.choices[el.dataset.b]; ui.open = null; save(); render(); },
  applyHere: () => { const id = $('#applySel').value; if (applyPlan(ui.date, id)) render(); },
  blankDay: () => { DB.days[ui.date] = { planId: null, planName: 'Custom day', color: '#7C8B4E', blocks: [], done: {}, choices: {}, notes: '' }; ui.editDay = true; save(); render(); },
  editDay: () => { ui.editDay = !ui.editDay; if (!ui.editDay) sortBlocks(DB.days[ui.date].blocks); save(); render(); },
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
  addEx: () => { const n = $('#exName').value.trim(); if (!n) return; DB.exercises.push({ id: uid(), name: n, group: $('#exGroup').value, start: [num($('#exW1').value), num($('#exW2').value), num($('#exW3').value)] }); save(); render(); },
  logEx: (el) => { ui.logEx = ui.logEx === el.dataset.id ? null : el.dataset.id; render(); },
  saveEx: (el) => {
    const sets = [0, 1, 2].map((i) => ({ w: num($('#w' + i).value), r: $('#r' + i).value.trim() === '' ? '' : num($('#r' + i).value) }));
    DB.sessions = DB.sessions.filter((s) => !(s.exId === el.dataset.id && s.date === ui.hDate));
    DB.sessions.push({ id: uid(), exId: el.dataset.id, date: ui.hDate, sets });
    ui.logEx = null; save(); render(); toast('Workout saved');
  },
  addExp: () => { const item = $('#eItem').value.trim(); const amt = num($('#eAmt').value); if (!item || !amt) { (item ? $('#eAmt') : $('#eItem')).focus(); return; } DB.expenses.push({ id: uid(), date: $('#eDate').value || todayKey(), item, category: $('#eCat').value, amount: amt }); save(); render(); toast('Added ' + money(amt)); },
  delExp: (el) => { DB.expenses = DB.expenses.filter((x) => x.id !== el.dataset.id); save(); render(); },
  delCat: (el) => { DB.categories.splice(+el.dataset.i, 1); save(); render(); },
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
  blk: (el) => {
    const b = scopeBlocks(el.dataset.s).find((x) => x.id === el.dataset.b);
    b[el.dataset.f] = el.value;
    if (el.dataset.f === 'kind' && el.value === 'choice' && !b.listId && DB.choiceLists[0]) b.listId = DB.choiceLists[0].id;
    if (el.dataset.f === 'start' || el.dataset.f === 'end') sortBlocks(scopeBlocks(el.dataset.s));
    save();
    if (el.dataset.f !== 'title') render();
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
  if (!saved) save();
  render();
  if (window.api) { const on = await window.api.getOpenAtLogin(); const c = $('#loginChk'); if (c) c.checked = on; }
})();
