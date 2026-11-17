# Wellness

A Mac app for your routine, health and spending, in a spreadsheet style
with Sage colours. Light and dark follow your Mac's appearance.

## Run it

You need Node.js. Check with `node -v` in Terminal; if it's missing,
install it from nodejs.org (the LTS version).

```bash
mv ~/Downloads/wellness ~/wellness   # optional: move it out of Downloads
cd ~/wellness
npm install      # first time only, takes a minute
npm start        # opens the app
```

The first time an alert fires, macOS asks whether Wellness may send
notifications. Click Allow (or turn it on later in System Settings →
Notifications → Wellness). Settings → "Send a test notification" checks it.

## Install it as a real app (once)

```bash
cd ~/wellness
npm run install-app
```

This builds **Wellness.app**, replaces any older copy in /Applications and
opens it. The very first time, macOS may block it because it isn't signed
by Apple: right-click Wellness in Applications → Open → Open. After that,
Terminal isn't needed.

In Settings, turn on **Open Wellness when I log in** so alerts keep coming.
Closing the window keeps it running; quit with ⌘Q.

## Updates

New versions of the screens and features come from GitHub automatically.
In Settings → Updates, enter the repo (for example `your-name/wellness`) and,
only for a private repo, an access token. Wellness checks when it opens and
every few hours, then shows **Reload**. Your data is never touched.
A rare bigger update (to the app's core) asks for `npm run install-app` once.

## How it works

- **Plans**: your day templates. Starts empty. Each plan is a list of blocks:
  *Task* blocks you tick off, *Choice* blocks (like Free time) where you pick
  from a choice list. Choice lists are edited at the bottom of Plans.
- **Week**: put a plan on any day this week, including days that already
  passed. "Fill empty days" drops one plan on every empty day.
- **Today**: the checklist for the day, with a NOW marker, a progress ring,
  free-time picks and notes. "Edit this day" changes only that day.
- **Log**: every planned day with its score, picks and notes.
- **Health**: food log with calories, protein, carbs, fiber and fat, a food
  library (pre-filled from your Food reference), calories burned, daily and
  weekly deficit, and workouts with your +10 lb rule.
- **Spending**: expenses by category for the week and month.
- **Summary**: this week and this month side by side.

## Sync and the Claude connector

See **CONNECTOR.md** for the one-time Supabase setup that syncs your data
and lets Claude log food, spending, plans and recaps for you.

## Your data

Everything is saved in one file:
`~/Library/Application Support/Wellness/wellness-data.json`.
Settings → Export makes a backup copy. This same file is what a Claude
connector will read and write later.
