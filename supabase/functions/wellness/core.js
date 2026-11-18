// Wellness server: sync API for the Mac app + MCP connector for Claude.
// Plain JavaScript (no imports) so it runs on Supabase (Deno) and in Node tests.

const PROTOCOL = '2025-06-18';
const MEALS = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

// ---------------------------------------------------------------- helpers
const pad = (n) => String(n).padStart(2, '0');
const uid = () => Math.random().toString(36).slice(2, 10);
const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const r1 = (n) => Math.round(n * 10) / 10;
const clone = (o) => JSON.parse(JSON.stringify(o));
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
const fmtKey = (d) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const addDays = (k, n) => { const d = parseKey(k); d.setUTCDate(d.getUTCDate() + n); return fmtKey(d); };
const weekStart = (k) => { const d = parseKey(k); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return fmtKey(d); };
const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const dayName = (k) => DOW[parseKey(k).getUTCDay()];
const mins = (hm) => { if (!hm) return null; const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
const isKey = (k) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k);
const norm = (s) => String(s || '').trim().toLowerCase();

function localToday(tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
}
function resolveDate(input, tz) {
  const today = localToday(tz);
  if (!input) return today;
  const s = norm(input);
  if (s === 'today') return today;
  if (s === 'tomorrow') return addDays(today, 1);
  if (s === 'yesterday') return addDays(today, -1);
  if (isKey(input)) return input;
  throw new Error(`Date must be YYYY-MM-DD, "today", "tomorrow" or "yesterday" (got "${input}")`);
}
function toHM(t) {
  if (t == null || t === '') return '';
  const s = String(t).trim().toLowerCase();
  const m = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(s);
  if (!m) throw new Error(`Time "${t}" should look like 16:00 or 4:00 PM`);
  let h = +m[1]; const mi = +(m[2] || 0);
  if (m[3] === 'pm' && h < 12) h += 12;
  if (m[3] === 'am' && h === 12) h = 0;
  if (h > 23 || mi > 59) throw new Error(`Time "${t}" is not valid`);
  return pad(h) + ':' + pad(mi);
}
function fmtTime(hm) {
  if (!hm) return '';
  const [h, m] = hm.split(':').map(Number);
  return ((h + 11) % 12) + 1 + ':' + pad(m) + ' ' + (h >= 12 ? 'PM' : 'AM');
}
// Workouts: a set is { w: lb (0 = bodyweight), r: reps, t?: seconds held, side?: reps are per side }.
// Bodyweight / timed exercises (all of Abs by default) progress by adding rounds, not +10 lb.
const isBodyweight = (ex) => !!ex && (ex.kind === 'bodyweight' || (!ex.kind && ex.group === 'Abs'));
function setText(s, body) {
  const amount = s.t ? `${s.t} s` : s.r === '' || s.r == null ? '—' : `${s.r}${s.side ? '/side' : ''}`;
  if (!body) return `${s.w} lb × ${amount}`;
  return s.w ? `+${s.w} lb · ${amount}` : amount;
}
const sortBlocks = (bl) => bl.sort((a, b) => (mins(a.start) ?? 1e9) - (mins(b.start) ?? 1e9));

// ---------------------------------------------------------------- data shape
export function emptyDoc() {
  return {
    version: 1,
    settings: { proteinTarget: 70, fiberTarget: 20, currency: '$', bodyKg: 68 },
    choiceLists: [{ id: 'free', name: 'Free time', options: ['Sleep', 'PS5', 'Movie', 'Show', 'Stock research', 'Talk to someone', 'Work', 'Project'], distinct: true }],
    plans: [], days: {}, foodLibrary: [], foods: [], burns: {}, exercises: [], sessions: [], training: {},
    cards: ['AMEX Blue Cash Preferred', 'Zolve', 'Discover', 'Robinhood Gold', 'BILT', 'Apple Card'],
    categories: ['Food & dining', 'Groceries', 'Transport & gas', 'Shopping', 'Entertainment', 'Subscriptions', 'Health & fitness', 'Bills', 'Other'],
    expenses: []
  };
}
const withDefaults = (doc) => Object.assign(emptyDoc(), doc || {});

function dayScore(day) {
  if (!day || !day.blocks || !day.blocks.length) return null;
  const done = day.blocks.filter((b) => day.done && day.done[b.id]).length;
  return { done, total: day.blocks.length, pct: Math.round((done / day.blocks.length) * 100) };
}
function foodTotals(doc, k) {
  const t = { calories: 0, protein: 0, carbs: 0, fiber: 0, fat: 0, items: 0 };
  doc.foods.filter((x) => x.date === k).forEach((x) => { t.calories += x.cal; t.protein += x.p; t.carbs += x.c; t.fiber += x.fib; t.fat += x.f; t.items++; });
  for (const key of ['calories', 'protein', 'carbs', 'fiber', 'fat']) t[key] = r1(t[key]);
  return t;
}
function findPlan(doc, ref) {
  const r = norm(ref);
  return doc.plans.find((p) => p.id === ref) || doc.plans.find((p) => norm(p.name) === r) || doc.plans.find((p) => norm(p.name).includes(r));
}
function findBlock(day, ref) {
  if (!ref && ref !== 0) return null;
  if (typeof ref === 'number' || /^\d+$/.test(String(ref))) { const i = +ref - 1; return day.blocks[i] || null; }
  const r = norm(ref);
  return day.blocks.find((b) => b.id === ref) || day.blocks.find((b) => norm(b.title) === r) || day.blocks.find((b) => norm(b.title).includes(r)) || day.blocks.find((b) => fmtTime(b.start).toLowerCase() === r);
}
function matchFrom(list, value) {
  const v = norm(value);
  if (!v) return null;
  return list.find((x) => norm(x) === v) || list.find((x) => norm(x).includes(v)) || list.find((x) => v.includes(norm(x))) || null;
}
function applyPlan(doc, k, plan) {
  const old = doc.days[k];
  doc.days[k] = { planId: plan.id, planName: plan.name, color: plan.color, blocks: plan.blocks.map((b) => ({ ...b })), done: {}, choices: {}, notes: old ? old.notes || '' : '' };
}
function targetWeights(doc, ex, k) {
  if (isBodyweight(ex)) {
    const last = doc.sessions.filter((s) => s.exId === ex.id && s.date < k).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
    if (!last) return { rounds: null, reason: 'first session: progress by adding rounds' };
    return { rounds: last.sets.length, reason: `${last.sets.length} rounds on ${last.date}. Add a round once every round is done with good form` };
  }
  const ws = weekStart(k);
  const prev = doc.sessions.filter((s) => s.exId === ex.id && s.date < ws).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  if (!prev) return { weights: ex.start || [], reason: 'starting weights' };
  const w = prev.sets.map((s) => num(s.w));
  const step = num(ex.step) || 10, rule = ex.rule || 'reps15';
  if (rule === 'manual') return { weights: w, reason: 'the user raises this one themselves' };
  if (rule === 'try') return { weights: w.map((x) => x + step), reason: `try +${step} lb; if not even 1 rep is possible, stay at last week’s weights` };
  if (num(prev.sets[0] && prev.sets[0].r) >= 15) return { weights: w.map((x) => x + step), reason: `${prev.sets[0].r} reps on set 1 last week, so +${step} lb` };
  return { weights: w, reason: 'same as last week' };
}
// How a lift progresses. step: lb added to every set when it moves up (default 10).
// rule: reps15 = when set 1 hit 15 reps the week before; try = try a step heavier every week; manual = the user decides.
const RULE_NAMES = ['reps15', 'try', 'manual'];
function setProgression(ex, a) {
  if (a.step != null) { const st = num(a.step); if (!(st > 0)) throw new Error('step must be a positive number of lb'); ex.step = st; }
  if (a.rule != null) { if (!RULE_NAMES.includes(a.rule)) throw new Error(`rule must be one of ${RULE_NAMES.join(', ')}`); ex.rule = a.rule; }
}

// What kind of training day it is: a split day, Abs or Rest. Set explicitly, or read off what was logged.
const DAY_TYPES = ['Shoulders & Chest', 'Arms', 'Back', 'Legs', 'Abs', 'Rest'];
function trainingOn(doc, k) {
  if (doc.training && doc.training[k]) return doc.training[k];
  const ex = doc.sessions.filter((s) => s.date === k).map((s) => doc.exercises.find((e) => e.id === s.exId)).filter(Boolean);
  if (ex.some(isBodyweight)) return 'Abs';
  const lift = ex.find((e) => !isBodyweight(e));
  return lift ? lift.group : null;
}
// Estimated calories a workout burns, on top of the resting day. Sets are taken to failure unless marked otherwise:
// - lifts: vigorous weight training, MET 6 (MET 3.5 for sets not to failure), about 3 min per set including rest;
// - ab circuit: calisthenics at the effort logged for it (hard MET 8, moderate 3.8, easy 2.8), timed from the work (about 2 s a rep; reps per side are quick touches, about 1 s each; plus held seconds).
// kcal = (MET − 1) × body kg × hours; the 1 MET of rest is already in the day's baseline.
// Every lift is taken to failure except the ones marked otherwise; traps (shrugs) and wrist curls default to not.
const toFailure = (ex) => (ex.failure != null ? !!ex.failure : !/trap|shrug|wrist curl/i.test(ex.name || ''));
const AB_MET = { hard: 8, moderate: 3.8, easy: 2.8 }; // how hard the ab circuit felt → MET for the calorie estimate
function workoutBurn(doc, k) {
  const kg = num(doc.settings && doc.settings.bodyKg) || 68;
  let liftSets = 0, easySets = 0, abSecs = 0, abKcal = 0, effort = null;
  doc.sessions.filter((s) => s.date === k).forEach((s) => {
    const ex = doc.exercises.find((e) => e.id === s.exId);
    if (!ex) return;
    if (isBodyweight(ex)) {
      let secs = 0;
      s.sets.forEach((x) => { secs += x.t ? num(x.t) : num(x.r) * 2; });
      abSecs += secs; effort = effort || s.effort || 'hard';
      abKcal += ((AB_MET[s.effort] || AB_MET.hard) - 1) * kg * (secs / 3600);
    }
    else if (toFailure(ex)) liftSets += s.sets.length;
    else easySets += s.sets.length;
  });
  return { kcal: Math.round(5 * kg * (liftSets * 3 / 60) + 2.5 * kg * (easySets * 3 / 60) + abKcal), setsToFailure: liftSets, setsNotToFailure: easySets, circuitMinutes: Math.round(abSecs / 60), ...(effort ? { circuitEffort: effort } : {}), method: 'estimate: lifts MET 6 to failure / 3.5 not, ~3 min per set; ab circuit MET 8 hard / 3.8 moderate / 2.8 easy for work time' };
}
function describeDay(doc, k) {
  const day = doc.days[k];
  const t = foodTotals(doc, k);
  const burn = doc.burns[k];
  const out = { date: k, weekday: dayName(k) };
  if (day) {
    out.plan = day.planName || 'Custom day';
    out.score = dayScore(day);
    out.blocks = day.blocks.map((b, i) => {
      const L = b.kind === 'choice' ? doc.choiceLists.find((l) => l.id === b.listId) : null;
      return {
        n: i + 1, id: b.id, time: b.start ? fmtTime(b.start) + (b.end ? '–' + fmtTime(b.end) : '') : 'any time', title: b.title,
        done: !!day.done[b.id], ...(L ? { choiceList: L.name, choice: day.choices[b.id] || null, options: L.options } : {})
      };
    });
    if (day.notes) out.notes = day.notes;
  } else out.plan = null;
  out.food = {
    totals: t, proteinGoal: doc.settings.proteinTarget, fiberGoal: doc.settings.fiberTarget,
    entries: doc.foods.filter((x) => x.date === k).map((x) => ({ id: x.id, meal: x.meal, name: x.name, qty: x.qty, calories: x.cal, protein: x.p, carbs: x.c, fiber: x.fib, fat: x.f, ...(x.note ? { note: x.note } : {}) }))
  };
  if (burn != null) { out.food.burned = burn; out.food.deficit = Math.round(burn - t.calories); }
  out.training = trainingOn(doc, k);
  const ex = doc.expenses.filter((e) => e.date === k);
  if (ex.length) out.expenses = ex.map((e) => ({ id: e.id, item: e.item, category: e.category, card: e.card || 'Cash / other', amount: e.amount }));
  const exOrder = (s) => { const i = doc.exercises.findIndex((x) => x.id === s.exId); const e = doc.exercises[i]; return isBodyweight(e) ? 1000 + (e.pos ?? i) : i; };
  const ses = doc.sessions.filter((s) => s.date === k).sort((a, b) => exOrder(a) - exOrder(b));
  if (ses.length) out.workoutBurn = workoutBurn(doc, k);
  if (ses.length) out.workouts = ses.map((s) => { const e = doc.exercises.find((x) => x.id === s.exId); return { exercise: e ? e.name : '?', group: e ? e.group : '', sets: s.sets.map((x) => setText(x, isBodyweight(e))), ...(s.note ? { note: s.note } : {}) }; });
  return out;
}

function summarize(doc, from, to, tz) {
  const today = localToday(tz);
  if (to > today) to = today;
  const keys = Object.keys(doc.days).filter((k) => k >= from && k <= to).sort();
  const sc = keys.map((k) => dayScore(doc.days[k])).filter(Boolean);
  const picks = {};
  keys.forEach((k) => { const d = doc.days[k]; d.blocks.forEach((b) => { const v = d.choices && d.choices[b.id]; if (b.kind === 'choice' && v) { const L = doc.choiceLists.find((l) => l.id === b.listId); const ln = L ? L.name : 'Other'; picks[ln] = picks[ln] || {}; picks[ln][v] = (picks[ln][v] || 0) + 1; } }); });
  const foodDays = [];
  for (let k = from; k <= to; k = addDays(k, 1)) { const t = foodTotals(doc, k); if (t.items) foodDays.push({ k, t }); }
  const avg = (f) => (foodDays.length ? r1(foodDays.reduce((a, x) => a + f(x.t), 0) / foodDays.length) : null);
  let def = 0, defDays = 0;
  foodDays.forEach((x) => { if (doc.burns[x.k] != null) { def += doc.burns[x.k] - x.t.calories; defDays++; } });
  const trainingDays = {};
  for (let k = from; k <= to; k = addDays(k, 1)) { const t = trainingOn(doc, k); if (t) trainingDays[t] = (trainingDays[t] || 0) + 1; }
  const ex = doc.expenses.filter((e) => e.date >= from && e.date <= to);
  const byCat = {}, byCard = {};
  ex.forEach((e) => { byCat[e.category] = r1((byCat[e.category] || 0) + e.amount); const c = e.card || 'Cash / other'; byCard[c] = r1((byCard[c] || 0) + e.amount); });
  return {
    from, to,
    routine: { daysPlanned: keys.length, avgScore: sc.length ? Math.round(sc.reduce((a, s) => a + s.pct, 0) / sc.length) : null, blocksDone: sc.reduce((a, s) => a + s.done, 0), blocksTotal: sc.reduce((a, s) => a + s.total, 0), picks, workoutSessions: doc.sessions.filter((s) => s.date >= from && s.date <= to).length, trainingDays },
    health: { daysWithFood: foodDays.length, avgCalories: avg((t) => t.calories), avgProtein: avg((t) => t.protein), avgFiber: avg((t) => t.fiber), daysProteinGoalMet: foodDays.filter((x) => x.t.protein >= doc.settings.proteinTarget).length, totalDeficit: defDays ? Math.round(def) : null, daysWithBurnLogged: defDays },
    spending: { total: r1(ex.reduce((a, e) => a + e.amount, 0)), byCategory: byCat, byCard }
  };
}

// ---------------------------------------------------------------- tools
const dateProp = { type: 'string', description: 'YYYY-MM-DD, or "today" / "tomorrow" / "yesterday". Defaults to today in the user’s time zone.' };
const TOOLS = [
  {
    name: 'get_day',
    description: 'Read one day from Wellness: its plan and blocks (with done ticks and choice picks), food log with totals vs goals, calories burned and deficit, expenses and workouts. Use before updating a day.',
    inputSchema: { type: 'object', properties: { date: dateProp } },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'get_summary',
    description: 'Summary for this week (Mon–Sun) or this month, up to today: average day score, choice picks, health averages and deficit, spending by category and by card.',
    inputSchema: { type: 'object', properties: { period: { type: 'string', enum: ['week', 'month'] }, date: { ...dateProp, description: 'Any date inside the week or month. Defaults to today.' } }, required: ['period'] },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'get_setup',
    description: 'List the user’s saved plans (with blocks), choice lists, spending categories, cards, food library and exercises. Use it to pick exact names before writing.',
    inputSchema: { type: 'object', properties: {} },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'list_expenses',
    description: 'List expenses between two dates, optionally for one card or category.',
    inputSchema: { type: 'object', properties: { from: dateProp, to: dateProp, card: { type: 'string' }, category: { type: 'string' } }, required: ['from', 'to'] },
    annotations: { readOnlyHint: true }
  },
  {
    name: 'log_food',
    description: 'Add foods to the Health log. For each item give either library_name (+ servings) from the food library, or name + macros. For foods without a label, estimate calories/protein/carbs/fiber/fat yourself and set estimate=true. save_to_library stores the item per serving for next time.',
    inputSchema: {
      type: 'object',
      properties: {
        date: dateProp,
        meal: { type: 'string', enum: MEALS },
        items: {
          type: 'array', minItems: 1,
          items: {
            type: 'object',
            properties: {
              library_name: { type: 'string', description: 'Exact or close name of a food-library item' },
              servings: { type: 'number', description: 'Multiplier for library items (default 1)' },
              name: { type: 'string' }, qty: { type: 'string', description: 'e.g. "2 slices", "130 g"' },
              calories: { type: 'number' }, protein: { type: 'number' }, carbs: { type: 'number' }, fiber: { type: 'number' }, fat: { type: 'number' },
              estimate: { type: 'boolean' }, save_to_library: { type: 'boolean' }
            }
          }
        }
      },
      required: ['meal', 'items']
    }
  },
  {
    name: 'log_expenses',
    description: 'Add one or more expenses. category should be one of the user’s categories and card one of their cards (see get_setup); close matches are accepted.',
    inputSchema: {
      type: 'object',
      properties: { entries: { type: 'array', minItems: 1, items: { type: 'object', properties: { date: dateProp, item: { type: 'string' }, amount: { type: 'number' }, category: { type: 'string' }, card: { type: 'string', description: 'Card name, or "cash"' } }, required: ['item', 'amount'] } } },
      required: ['entries']
    }
  },
  {
    name: 'set_calories_burned',
    description: 'Set total calories burned for a day (from a watch or estimate). Used for the daily and weekly deficit.',
    inputSchema: { type: 'object', properties: { date: dateProp, calories: { type: 'number' } }, required: ['calories'] }
  },
  {
    name: 'plan_day',
    description: 'Put one of the user’s saved plans on a day (any day, past or future). Optionally adjust that day’s blocks afterwards (changes only that day, not the saved plan). Refuses to replace a day that already has ticks unless replace=true.',
    inputSchema: {
      type: 'object',
      properties: {
        date: dateProp,
        plan: { type: 'string', description: 'Plan name (see get_setup)' },
        replace: { type: 'boolean' },
        change_blocks: { type: 'array', items: { type: 'object', properties: { block: { type: 'string', description: 'Block title or number' }, start: { type: 'string' }, end: { type: 'string' }, title: { type: 'string' }, remove: { type: 'boolean' } }, required: ['block'] } },
        add_blocks: { type: 'array', items: { type: 'object', properties: { start: { type: 'string' }, end: { type: 'string' }, title: { type: 'string' }, choice_list: { type: 'string' }, alert: { type: 'boolean' } }, required: ['title'] } }
      },
      required: ['plan']
    }
  },
  {
    name: 'update_day',
    description: 'Record how a day went: tick blocks done (or undo), pick choices for choice blocks (e.g. Free time → PS5), and add a note. Blocks can be referred to by title, number or start time.',
    inputSchema: {
      type: 'object',
      properties: {
        date: dateProp,
        done: { type: 'array', items: { type: 'string' } },
        not_done: { type: 'array', items: { type: 'string' } },
        choices: { type: 'array', items: { type: 'object', properties: { block: { type: 'string' }, option: { type: 'string' } }, required: ['block', 'option'] } },
        note: { type: 'string', description: 'Added to the day’s notes' }
      }
    }
  },
  {
    name: 'log_workout',
    description: 'Log sets for an exercise. Weighted lifts: weight in lb + reps; returns next week’s weights by the user’s +10 lb rule. Bodyweight or timed moves (all Abs by default): leave weight out and give reps, or seconds for holds like a plank; per_side=true when reps are counted on each side. One set per round of a circuit. Bodyweight moves progress by adding rounds. Logging the same exercise on the same day again replaces that day’s sets.',
    inputSchema: {
      type: 'object',
      properties: {
        date: dateProp,
        exercise: { type: 'string' },
        group: { type: 'string', description: 'Split day for a new exercise: Shoulders & Chest, Arms, Back, Legs, Abs' },
        kind: { type: 'string', enum: ['weights', 'bodyweight'], description: 'For a new exercise. Defaults to bodyweight for Abs, weights otherwise.' },
        sets: { type: 'array', minItems: 1, items: { type: 'object', properties: { weight: { type: 'number', description: 'lb; leave out or 0 for bodyweight' }, reps: { type: 'number' }, seconds: { type: 'number', description: 'For timed holds, e.g. 30 for a 30-second plank' }, per_side: { type: 'boolean', description: 'Reps are per side (e.g. Russian twists 50 each side)' } } } },
        note: { type: 'string', description: 'Optional note for this session, e.g. "circuit, 5 min rest between rounds"' },
        position: { type: 'number', description: 'Bodyweight only: this move’s place in the ab circuit, 1 = first. Other moves shift to make room.' },
        effort: { type: 'string', enum: ['hard', 'moderate', 'easy'], description: 'Bodyweight only: how hard the circuit felt; sets the calorie estimate (default hard). Ask the user after each ab session.' },
        step: { type: 'number', description: 'Weighted only: lb added to every set when the lift moves up (default 10). Saved on the exercise.' },
        rule: { type: 'string', enum: ['reps15', 'try', 'manual'], description: 'Weighted only: reps15 = up a step when set 1 hit 15 reps (default); try = try a step heavier every week, stay if not even 1 rep; manual = the user raises it. Saved on the exercise.' }
      },
      required: ['exercise', 'sets']
    }
  },
  {
    name: 'set_exercise',
    description: 'Change how a weighted lift progresses without logging a session: step (lb added to every set when it moves up) and rule (reps15, try or manual). Also renames or moves it to another split day.',
    inputSchema: { type: 'object', properties: { exercise: { type: 'string' }, step: { type: 'number' }, rule: { type: 'string', enum: ['reps15', 'try', 'manual'] }, to_failure: { type: 'boolean', description: 'Whether its sets go to failure (default true; traps/shrugs and wrist curls default false). Used for the calorie estimate.' }, group: { type: 'string' }, rename: { type: 'string' } }, required: ['exercise'] }
  },
  {
    name: 'set_training_day',
    description: 'Say what kind of training day a date is: one of the split days (Shoulders & Chest, Arms, Back, Legs), Abs, or Rest. Shown in the Health view’s day picker. day=null clears it.',
    inputSchema: { type: 'object', properties: { date: dateProp, day: { type: ['string', 'null'], enum: [...DAY_TYPES, null] } }, required: ['day'] }
  },
  {
    name: 'remove_entries',
    description: 'Delete food or expense entries by id (ids come from get_day or list_expenses).',
    inputSchema: { type: 'object', properties: { food_ids: { type: 'array', items: { type: 'string' } }, expense_ids: { type: 'array', items: { type: 'string' } } } },
    annotations: { destructiveHint: true }
  }
];

function runTool(name, args, doc, tz) {
  const a = args || {};
  const S = doc.settings;
  switch (name) {
    case 'get_day': return { write: false, result: describeDay(doc, resolveDate(a.date, tz)) };
    case 'get_summary': {
      const k = resolveDate(a.date, tz);
      const from = a.period === 'month' ? k.slice(0, 8) + '01' : weekStart(k);
      const to = a.period === 'month' ? lastOfMonth(k) : addDays(from, 6);
      return { write: false, result: summarize(doc, from, to, tz) };
    }
    case 'get_setup': return {
      write: false,
      result: {
        plans: doc.plans.map((p) => ({ name: p.name, blocks: p.blocks.map((b) => `${b.start ? fmtTime(b.start) + (b.end ? '–' + fmtTime(b.end) : '') : 'any time'} ${b.title}${b.kind === 'choice' ? ' [choice]' : ''}`) })),
        choiceLists: doc.choiceLists.map((l) => ({ name: l.name, options: l.options, noRepeatInOneDay: !!l.distinct })),
        categories: doc.categories, cards: doc.cards,
        foodLibrary: doc.foodLibrary.map((f) => `${f.name} (${f.serving}: ${f.cal} cal, ${f.p} P, ${f.c} C, ${f.fib} fib, ${f.f} F)`),
        exercises: doc.exercises.map((e) => `${e.name} (${e.group}${isBodyweight(e) ? ', bodyweight' : `, +${num(e.step) || 10} lb step, rule ${e.rule || 'reps15'}`})`),
        goals: { proteinG: S.proteinTarget, fiberG: S.fiberTarget }
      }
    };
    case 'list_expenses': {
      const from = resolveDate(a.from, tz), to = resolveDate(a.to, tz);
      let ex = doc.expenses.filter((e) => e.date >= from && e.date <= to);
      if (a.card) { const c = norm(a.card); ex = ex.filter((e) => norm(e.card || 'cash').includes(c)); }
      if (a.category) { const c = norm(a.category); ex = ex.filter((e) => norm(e.category).includes(c)); }
      ex.sort((x, y) => (x.date < y.date ? -1 : 1));
      return { write: false, result: { from, to, count: ex.length, total: r1(ex.reduce((s, e) => s + e.amount, 0)), entries: ex.map((e) => ({ id: e.id, date: e.date, item: e.item, category: e.category, card: e.card || 'Cash / other', amount: e.amount })) } };
    }
    case 'log_food': {
      const k = resolveDate(a.date, tz);
      const meal = MEALS.find((m) => norm(m) === norm(a.meal)) || 'Snack';
      const added = [];
      for (const it of a.items || []) {
        let entry;
        if (it.library_name) {
          const lib = doc.foodLibrary.find((f) => norm(f.name) === norm(it.library_name)) || doc.foodLibrary.find((f) => norm(f.name).includes(norm(it.library_name)));
          if (!lib) throw new Error(`"${it.library_name}" isn’t in the food library. Give name + macros instead.`);
          const s = num(it.servings) || 1;
          const m = /^([\d.]+)\s*(.*)$/.exec(lib.serving || '');
          const qty = s === 1 ? lib.serving : m ? `${r1(s * num(m[1]))} ${m[2]}` : `${s} × ${lib.serving}`;
          entry = { name: lib.name, qty, cal: Math.round(lib.cal * s), p: r1(lib.p * s), c: r1(lib.c * s), fib: r1(lib.fib * s), f: r1(lib.f * s), note: lib.note || '' };
        } else {
          if (!it.name) throw new Error('Each food needs library_name or name.');
          entry = { name: it.name, qty: it.qty || '1 serving', cal: Math.round(num(it.calories)), p: r1(num(it.protein)), c: r1(num(it.carbs)), fib: r1(num(it.fiber)), f: r1(num(it.fat)), note: it.estimate ? 'estimate' : '' };
          if (it.save_to_library && !doc.foodLibrary.some((f) => norm(f.name) === norm(it.name))) {
            doc.foodLibrary.push({ id: uid(), name: it.name, serving: it.qty || '1 serving', cal: entry.cal, p: entry.p, c: entry.c, fib: entry.fib, f: entry.f, note: entry.note });
          }
        }
        const rec = { id: uid(), date: k, meal, ...entry };
        doc.foods.push(rec);
        added.push(rec);
      }
      const t = foodTotals(doc, k);
      return { write: true, result: { added: added.map((x) => `${x.name} (${x.qty}): ${x.cal} cal, ${x.p} g protein, ${x.fib} g fiber${x.note ? ' — ' + x.note : ''}`), dayTotals: t, proteinLeft: Math.max(0, r1(S.proteinTarget - t.protein)), fiberLeft: Math.max(0, r1(S.fiberTarget - t.fiber)) } };
    }
    case 'log_expenses': {
      const added = [], notes = [];
      for (const e of a.entries || []) {
        const amount = r1(num(e.amount));
        if (!e.item || !amount) throw new Error('Each expense needs an item and a non-zero amount.');
        let category = matchFrom(doc.categories, e.category) || 'Other';
        if (e.category && !matchFrom(doc.categories, e.category)) notes.push(`Category "${e.category}" isn’t one of yours, so "${e.item}" went under Other.`);
        let card = '';
        if (e.card && !['cash', 'cash / other', 'other', 'debit'].includes(norm(e.card))) {
          card = matchFrom(doc.cards, e.card) || '';
          if (!card) notes.push(`Card "${e.card}" isn’t one of yours, so "${e.item}" is under Cash / other.`);
        }
        const rec = { id: uid(), date: resolveDate(e.date, tz), item: e.item, category, card, amount };
        doc.expenses.push(rec);
        added.push(rec);
      }
      return { write: true, result: { added: added.map((x) => `${x.date} ${x.item}: ${S.currency || '$'}${x.amount.toFixed(2)} · ${x.category} · ${x.card || 'Cash / other'}`), notes } };
    }
    case 'set_calories_burned': {
      const k = resolveDate(a.date, tz);
      doc.burns[k] = Math.round(num(a.calories));
      const t = foodTotals(doc, k);
      return { write: true, result: { date: k, burned: doc.burns[k], eaten: t.calories, deficit: Math.round(doc.burns[k] - t.calories) } };
    }
    case 'plan_day': {
      const k = resolveDate(a.date, tz);
      const plan = findPlan(doc, a.plan);
      if (!plan) throw new Error(`No plan called "${a.plan}". Saved plans: ${doc.plans.map((p) => p.name).join(', ') || 'none yet'}.`);
      const old = doc.days[k];
      const hasTicks = old && (Object.values(old.done || {}).some(Boolean) || Object.keys(old.choices || {}).length);
      if (hasTicks && !a.replace) throw new Error(`${dayName(k)} ${k} already has ticks or picks. Ask the user, then call again with replace=true.`);
      applyPlan(doc, k, plan);
      const day = doc.days[k];
      const notes = [];
      for (const ch of a.change_blocks || []) {
        const b = findBlock(day, ch.block);
        if (!b) { notes.push(`No block "${ch.block}" to change.`); continue; }
        if (ch.remove) { day.blocks = day.blocks.filter((x) => x !== b); continue; }
        if (ch.start != null) b.start = toHM(ch.start);
        if (ch.end != null) b.end = toHM(ch.end);
        if (ch.title) b.title = ch.title;
      }
      for (const nb of a.add_blocks || []) {
        const L = nb.choice_list ? doc.choiceLists.find((l) => norm(l.name) === norm(nb.choice_list)) : null;
        day.blocks.push({ id: uid(), start: toHM(nb.start), end: toHM(nb.end), title: nb.title, kind: L ? 'choice' : 'task', listId: L ? L.id : (doc.choiceLists[0] ? doc.choiceLists[0].id : null), alert: nb.alert !== false });
      }
      sortBlocks(day.blocks);
      return { write: true, result: { ...describeDay(doc, k), notes } };
    }
    case 'update_day': {
      const k = resolveDate(a.date, tz);
      const day = doc.days[k];
      if (!day) throw new Error(`${dayName(k)} ${k} has no plan yet. Use plan_day first.`);
      const notes = [];
      for (const ref of a.done || []) { const b = findBlock(day, ref); if (b) day.done[b.id] = true; else notes.push(`No block "${ref}".`); }
      for (const ref of a.not_done || []) { const b = findBlock(day, ref); if (b) delete day.done[b.id]; else notes.push(`No block "${ref}".`); }
      for (const c of a.choices || []) {
        const b = findBlock(day, c.block);
        if (!b || b.kind !== 'choice') { notes.push(`"${c.block}" isn’t a choice block.`); continue; }
        const L = doc.choiceLists.find((l) => l.id === b.listId);
        const opt = L ? matchFrom(L.options, c.option) : null;
        if (!opt) { notes.push(`"${c.option}" isn’t an option for ${b.title}${L ? ` (options: ${L.options.join(', ')})` : ''}.`); continue; }
        day.choices[b.id] = opt;
      }
      if (a.note) day.notes = day.notes ? day.notes.trim() + '\n' + a.note : a.note;
      const seen = {};
      day.blocks.forEach((b) => { const L = doc.choiceLists.find((l) => l.id === b.listId); const v = day.choices[b.id]; if (b.kind === 'choice' && L && L.distinct && v) { if (seen[v]) notes.push(`${b.title} repeats "${v}" from ${seen[v]}, which their rule says to avoid.`); else seen[v] = b.title; } });
      return { write: true, result: { ...describeDay(doc, k), notes } };
    }
    case 'log_workout': {
      const k = resolveDate(a.date, tz);
      let ex = doc.exercises.find((e) => norm(e.name) === norm(a.exercise)) || doc.exercises.find((e) => norm(e.name).includes(norm(a.exercise)));
      const sets = (a.sets || []).map((s) => {
        const set = { w: num(s.weight), r: s.reps == null ? '' : num(s.reps) };
        if (s.seconds != null && num(s.seconds) > 0) set.t = num(s.seconds);
        if (s.per_side) set.side = true;
        return set;
      });
      if (!sets.length) throw new Error('Give at least one set.');
      if (!ex) {
        const group = a.group || 'Other';
        const kind = a.kind === 'weights' || a.kind === 'bodyweight' ? a.kind : group === 'Abs' ? 'bodyweight' : 'weights';
        ex = { id: uid(), name: a.exercise, group, kind, start: kind === 'bodyweight' ? [] : sets.map((s) => s.w) };
        doc.exercises.push(ex);
      }
      const body = isBodyweight(ex);
      if (!body) setProgression(ex, a);
      if (body && a.position != null) {
        const moves = doc.exercises.map((e, i) => ({ e, i })).filter((x) => isBodyweight(x.e)).sort((x, y) => (x.e.pos ?? x.i) - (y.e.pos ?? y.i)).map((x) => x.e).filter((e) => e !== ex);
        moves.splice(Math.max(0, Math.min(moves.length, Math.round(num(a.position)) - 1)), 0, ex);
        moves.forEach((e, n) => { e.pos = n; });
      }
      if (!body && sets.some((s) => s.t)) throw new Error(`${ex.name} is a weighted exercise; seconds are for bodyweight or timed moves.`);
      const prior = doc.sessions.find((s) => s.exId === ex.id && s.date === k);
      doc.sessions = doc.sessions.filter((s) => !(s.exId === ex.id && s.date === k));
      const session = { id: prior ? prior.id : uid(), exId: ex.id, date: k, sets };
      const note = a.note != null ? String(a.note) : prior && prior.note;
      if (body) { const eff = a.effort || (prior && prior.effort); if (eff) { if (!AB_MET[eff]) throw new Error('effort must be hard, moderate or easy'); session.effort = eff; } }
      if (note) session.note = note;
      doc.sessions.push(session);
      const next = body ? { rounds: sets.length, reason: `${sets.length} rounds today. Add a round once every round is done with good form` } : targetWeights(doc, ex, addDays(weekStart(k), 7));
      return { write: true, result: { exercise: ex.name, kind: body ? 'bodyweight' : 'weights', date: k, sets: sets.map((s) => setText(s, body)), ...(session.note ? { note: session.note } : {}), [body ? 'next' : 'nextWeek']: next } };
    }
    case 'set_exercise': {
      const ex = doc.exercises.find((e) => norm(e.name) === norm(a.exercise)) || doc.exercises.find((e) => norm(e.name).includes(norm(a.exercise)));
      if (!ex) throw new Error(`No exercise called "${a.exercise}". Exercises: ${doc.exercises.map((e) => e.name).join(', ')}.`);
      if (isBodyweight(ex) && (a.step != null || a.rule != null)) throw new Error(`${ex.name} is part of the ab circuit; it progresses by rounds.`);
      setProgression(ex, a);
      if (a.to_failure != null) ex.failure = !!a.to_failure;
      if (a.group) ex.group = a.group;
      if (a.rename) ex.name = a.rename;
      return { write: true, result: { exercise: ex.name, group: ex.group, step: num(ex.step) || 10, rule: ex.rule || 'reps15', toFailure: toFailure(ex), nextWeek: isBodyweight(ex) ? null : targetWeights(doc, ex, addDays(weekStart(localToday(tz)), 7)) } };
    }
    case 'set_training_day': {
      const k = resolveDate(a.date, tz);
      doc.training = doc.training || {};
      if (a.day == null || a.day === '') { delete doc.training[k]; return { write: true, result: { date: k, training: trainingOn(doc, k), cleared: true } }; }
      const day = DAY_TYPES.find((t) => norm(t) === norm(a.day)) || DAY_TYPES.find((t) => norm(t).includes(norm(a.day)) || norm(a.day).includes(norm(t)));
      if (!day) throw new Error(`Day must be one of: ${DAY_TYPES.join(', ')}.`);
      doc.training[k] = day;
      return { write: true, result: { date: k, training: day } };
    }
    case 'remove_entries': {
      const fi = new Set(a.food_ids || []), ei = new Set(a.expense_ids || []);
      const nf = doc.foods.length, ne = doc.expenses.length;
      doc.foods = doc.foods.filter((x) => !fi.has(x.id));
      doc.expenses = doc.expenses.filter((x) => !ei.has(x.id));
      return { write: true, result: { removedFoods: nf - doc.foods.length, removedExpenses: ne - doc.expenses.length } };
    }
    default: throw new Error(`Unknown tool ${name}`);
  }
}
function lastOfMonth(k) { const [y, m] = k.split('-').map(Number); return fmtKey(new Date(Date.UTC(y, m, 0))); }

// ---------------------------------------------------------------- storage (PostgREST)
function store(env, fetchImpl) {
  const base = env.SUPABASE_URL.replace(/\/$/, '') + '/rest/v1/wellness_doc';
  const H = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' };
  return {
    async load() {
      const r = await fetchImpl(base + '?id=eq.1&select=doc,rev', { headers: H });
      if (!r.ok) throw new Error('Database read failed (' + r.status + ')');
      const rows = await r.json();
      return rows[0] || null;
    },
    // returns new rev, or null if someone else saved first
    async save(doc, baseRev) {
      if (!baseRev) {
        const r = await fetchImpl(base, { method: 'POST', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ id: 1, doc, rev: 1 }) });
        if (r.status === 409) return null;
        if (!r.ok) throw new Error('Database write failed (' + r.status + ')');
        return 1;
      }
      const r = await fetchImpl(base + '?id=eq.1&rev=eq.' + baseRev, { method: 'PATCH', headers: { ...H, Prefer: 'return=representation' }, body: JSON.stringify({ doc, rev: baseRev + 1, updated_at: new Date().toISOString() }) });
      if (!r.ok) throw new Error('Database write failed (' + r.status + ')');
      const rows = await r.json();
      return rows.length ? baseRev + 1 : null;
    }
  };
}

// ---------------------------------------------------------------- HTTP
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-api-key, content-type, mcp-protocol-version, mcp-session-id', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' };
const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...CORS, ...extra } });

function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}

export function makeHandler({ env, fetchImpl = fetch }) {
  const db = store(env, fetchImpl);
  const tz = env.WELLNESS_TZ || 'America/New_York';

  async function mutate(fn) {
    for (let i = 0; i < 5; i++) {
      const row = await db.load();
      const doc = withDefaults(row && row.doc);
      const out = fn(doc);
      if (!out.write) return out.result;
      const rev = await db.save(doc, row ? Number(row.rev) : 0);
      if (rev) return out.result;
    }
    throw new Error('Wellness was busy saving; please try again.');
  }

  async function handleMcp(req) {
    if (req.method === 'GET') return new Response('Use POST for MCP requests.', { status: 405, headers: { Allow: 'POST', ...CORS } });
    if (req.method === 'DELETE') return new Response(null, { status: 204, headers: CORS });
    let body;
    try { body = await req.json(); } catch { return json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400); }
    const msgs = Array.isArray(body) ? body : [body];
    const replies = [];
    for (const m of msgs) {
      if (!m || m.id === undefined || m.id === null) continue; // notifications
      replies.push(await rpc(m));
    }
    if (!replies.length) return new Response(null, { status: 202, headers: CORS });
    return json(Array.isArray(body) ? replies : replies[0]);
  }

  async function rpc(m) {
    const ok = (result) => ({ jsonrpc: '2.0', id: m.id, result });
    try {
      switch (m.method) {
        case 'initialize':
          return ok({
            protocolVersion: (m.params && m.params.protocolVersion) || PROTOCOL,
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'wellness', title: 'Wellness', version: '1.0.0' },
            instructions: 'Wellness is the user’s personal tracker for daily routine (plans made of timed blocks, ticks and free-time choices), health (food with calories/protein/carbs/fiber/fat, calories burned, workouts) and spending (by category and credit card). Dates are in the user’s local time zone. Call get_setup to see exact plan, category and card names before writing. When logging food without a label, estimate macros sensibly and set estimate=true. After writing, tell the user briefly what was logged.'
          });
        case 'ping': return ok({});
        case 'tools/list': return ok({ tools: TOOLS });
        case 'tools/call': {
          const { name, arguments: args } = m.params || {};
          if (!TOOLS.some((t) => t.name === name)) return { jsonrpc: '2.0', id: m.id, error: { code: -32602, message: 'Unknown tool: ' + name } };
          try {
            const result = await mutate((doc) => runTool(name, args, doc, tz));
            return ok({ content: [{ type: 'text', text: JSON.stringify(result, null, 1) }], structuredContent: result });
          } catch (e) {
            return ok({ content: [{ type: 'text', text: String(e.message || e) }], isError: true });
          }
        }
        default: return { jsonrpc: '2.0', id: m.id, error: { code: -32601, message: 'Method not found: ' + m.method } };
      }
    } catch (e) {
      return { jsonrpc: '2.0', id: m.id, error: { code: -32603, message: String(e.message || e) } };
    }
  }

  async function handleSync(req) {
    if (req.method === 'GET') {
      const row = await db.load();
      return json({ rev: row ? Number(row.rev) : 0, doc: row ? row.doc : null });
    }
    if (req.method === 'PUT') {
      let body;
      try { body = await req.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
      if (!body || typeof body.doc !== 'object' || !body.doc) return json({ error: 'Missing doc' }, 400);
      const rev = await db.save(body.doc, Number(body.baseRev) || 0);
      if (rev) return json({ rev });
      const row = await db.load();
      return json({ conflict: true, rev: row ? Number(row.rev) : 0, doc: row ? row.doc : null }, 409);
    }
    return json({ error: 'Method not allowed' }, 405);
  }

  return async function handler(req) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const at = parts.indexOf('wellness');
    const rest = at >= 0 ? parts.slice(at + 1) : parts;
    const route = rest[0] || '';
    if (route === '' || route === 'health') return json({ ok: true, service: 'wellness' });
    // No OAuth here: answer sign-in discovery probes with a plain 404 so Claude
    // doesn't try to register with a sign-in service that doesn't exist.
    if (route.startsWith('.well-known') || parts.includes('.well-known') || ['register', 'authorize', 'token'].includes(route)) return json({ error: 'Not found' }, 404);
    if (!env.WELLNESS_KEY || env.WELLNESS_KEY.length < 24) return json({ error: 'Server key not set. Run: supabase secrets set WELLNESS_KEY=…' }, 500);

    const auth = req.headers.get('authorization') || '';
    const headerKey = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : (req.headers.get('x-api-key') || '').trim();
    const pathKey = route === 'mcp' && rest[1] ? decodeURIComponent(rest[1]) : '';
    if (!safeEqual(headerKey, env.WELLNESS_KEY) && !safeEqual(pathKey, env.WELLNESS_KEY)) {
      // A wrong key in the URL looks like a missing page; no auth challenge,
      // so clients don't start an OAuth flow.
      if (pathKey) return json({ error: 'Not found' }, 404);
      return json({ error: 'Unauthorized' }, 401);
    }
    try {
      if (route === 'mcp') return await handleMcp(req);
      if (route === 'sync') return await handleSync(req);
      return json({ error: 'Not found' }, 404);
    } catch (e) {
      return json({ error: String(e.message || e) }, 500);
    }
  };
}

export const _test = { runTool, summarize, describeDay, emptyDoc, resolveDate, toHM, setText, isBodyweight };
