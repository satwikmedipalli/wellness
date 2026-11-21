# Wellness

**One Mac app for my routine, my health and my spending.** It looks like a
spreadsheet, in Sage colours, and follows the Mac's light and dark mode.

I built it because my day plan, food log and expenses lived in three
different places. Now each day is one checklist, and Claude can log food,
spending and plans for me through a connector.

**Want something like this on your Mac?** Email me at satwik.medipalli@gmail.com.

## What it does

- **Plans**: day templates made of blocks. *Task* blocks you tick off, and
  *Choice* blocks (like Free time) where you pick from a list.
- **Week**: put a plan on any day this week, including days that already
  passed. "Fill empty days" drops one plan on every empty day.
- **Today**: the checklist for the day, with a NOW marker, a progress ring,
  free-time picks and notes. "Edit this day" changes only that day.
- **Log**: every planned day with its score, picks and notes.
- **Health**: food log with calories, protein, carbs, fiber and fat, a food
  library, calories burned, daily and weekly deficit, and workouts.
- **Spending**: expenses by category for the week and month.
- **Summary**: this week and this month side by side.

## How it works

- **Electron app, local first.** Everything is saved in one file:
  `~/Library/Application Support/Wellness/wellness-data.json`.
  Settings → Export makes a backup copy.
- **Sync and the Claude connector.** A one-time Supabase setup syncs the data
  and lets Claude log food, spending, plans and recaps. See
  **[CONNECTOR.md](CONNECTOR.md)**.
- **Updates itself.** New versions of the screens come from GitHub. The app
  checks when it opens and every few hours, then shows **Reload**. Your data
  is never touched.

Stack: Electron · JavaScript · Supabase · MCP

## Run it yourself

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

### Install it as a real app (once)

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

### Updates

In Settings → Updates, enter the repo (for example `your-name/wellness`) and,
only for a private repo, an access token. A rare bigger update (to the app's
core) asks for `npm run install-app` once.
