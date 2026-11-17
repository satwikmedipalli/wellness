# Wellness server + Claude connector — one-time setup

This puts your Wellness data in your own Supabase project, keeps the Mac app
in sync with it, and lets Claude read and write it through a custom connector.
About 10 minutes.

## 1. Create a Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, click **New project**.
2. Name it `wellness`, pick a strong database password (save it in your
   password manager), choose the region closest to you, keep the Free plan.
3. When it's ready, copy the **Project ref**: it's the part of the project URL
   after `/project/` (looks like `abcdefghijklmnop`).

## 2. Create your secret key

```bash
cd ~/wellness
npm run new-key
```

Copy the long key it prints and save it in your password manager as
"Wellness key". Anyone with this key can read and change your Wellness data.

## 3. Deploy the server

Replace `YOUR_REF` and `YOUR_KEY` below:

```bash
cd ~/wellness
supabase login                                   # opens the browser once
supabase link --project-ref YOUR_REF             # asks for the database password
supabase db push                                 # creates the private data table
supabase secrets set WELLNESS_KEY=YOUR_KEY
supabase functions deploy wellness --no-verify-jwt
```

Your server address is:
`https://YOUR_REF.supabase.co/functions/v1/wellness`

Quick check: opening that address with `/health` on the end should show
`{"ok":true,"service":"wellness"}`.

> If `supabase db push` gives you trouble, open your project → **SQL Editor**,
> paste the contents of `supabase/migrations/20261117000000_wellness_doc.sql`,
> and click **Run**. Same result.

## 4. Connect the Wellness app

Wellness → **Settings → Sync & Claude connector**:
- Server URL: `https://YOUR_REF.supabase.co/functions/v1/wellness`
- Key: your Wellness key

Click **Connect**. The app uploads everything you have so far, then keeps
syncing every 20 seconds and whenever you switch back to it. It still works
offline and catches up later.

## 5. Add the connector to Claude

Claude → **Settings → Connectors → Add custom connector**:
- Name: `Wellness`
- URL: `https://YOUR_REF.supabase.co/functions/v1/wellness/mcp`

Then, for authentication:
- If you see a **Request headers** section: add header `Authorization` with
  value `Bearer YOUR_KEY`. (Best option: the key isn't in the URL.)
- If you don't see it: use this URL instead and choose no authentication:
  `https://YOUR_REF.supabase.co/functions/v1/wellness/mcp/YOUR_KEY`
  Treat that URL like a password.

## What Claude can do with it

| Tool | What it does |
|---|---|
| get_day | Read a day: plan, ticks, picks, food, deficit, spending, workouts |
| get_summary | This week or month: scores, picks, health averages, spending by category and card |
| get_setup | Your plans, choice lists, categories, cards, food library, exercises |
| list_expenses | Expenses between dates, by card or category |
| log_food | Add food, from your library or with estimated macros |
| log_expenses | Add spending with category and card |
| set_calories_burned | Calories burned for the deficit |
| plan_day | Put a saved plan on a day, with one-day changes |
| update_day | Tick blocks, pick free-time choices, add notes |
| log_workout | Log sets (weights, or reps / seconds / per side for the ab circuit); returns the next target |
| set_training_day | Mark a date as a split day, Ab day or Rest day |
| remove_entries | Delete food or expense entries |

## Updating the server later

When the server code changes:
```bash
cd ~/wellness && supabase functions deploy wellness --no-verify-jwt
```
