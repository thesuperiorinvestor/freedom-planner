# Freedom Planner — Weekly Planner + Goal Tracker

A self-contained personal planning web app: weekly tasks, layered long-term goals, habit streaks, a
lifetime "Freedom Number" milestone tracker, and an **AI weekly review** powered by Claude. One HTML
file, vanilla JavaScript, no build step — with optional cross-device cloud sync.

> Built end-to-end with **Claude Code**. Front end is a single hand-tuned HTML/JS file; the AI review
> runs on a **Netlify serverless function** so the API key never touches the browser.

**Live:** deployed on Netlify · **Cloud sync:** Firebase (Firestore + Email/Password auth)

---

## Features

- **Weekly view** — per-day tasks and notes, weekly goals, with arrow navigation between weeks.
- **Layered long-term goals** — monthly / quarterly / annual goals keyed to the viewed period.
  Unfinished goals **auto-carry** into the next period, tagged `↪`.
- **Habit / consistency tracker** — 7-day toggles with current streaks and all-time totals.
- **Freedom Number tracker** — a lifetime target on an evenly-spaced milestone track, from the first
  milestone all the way to the 🏁 finish line.
- **Daily Kill List** — one "not-to-do" per day with Held / Slipped accountability and a streak.
- **AI Weekly Review** — one click summarizes the viewed week and returns structured coaching from
  Claude.
- **Light / dark mode**, JSON export/import backup, and a live sync-status indicator.

## Tech stack

| Layer | Choice |
|---|---|
| Front end | Single self-contained HTML file, vanilla JS, no framework, no build |
| Storage | `localStorage` (local-first) |
| Cloud sync | Firebase Firestore + Email/Password auth (live `onSnapshot`, debounced writes) |
| AI review | Netlify serverless function → Anthropic Claude Messages API |
| Hosting | Netlify |

## How it works

- `index.html` — the entire app: UI, state, rendering, and Firebase sync logic.
- `netlify/functions/review.mjs` — server-side endpoint that builds the prompt and calls Claude, so
  the `ANTHROPIC_API_KEY` stays out of the client. Gated by an optional shared review key.
- `netlify.toml` — build/functions configuration.

The Firebase **web config** in the page is public by design (Firebase secures data through Firestore
Security Rules, not by hiding this config). The Anthropic key lives only in a Netlify env var.

## Run locally

It's a static file — open `index.html` in a browser, or serve the folder:

```bash
npx serve .
```

For the AI review and cloud sync you'll want the Netlify environment (`ANTHROPIC_API_KEY` env var)
and your own Firebase project config.

## Why I built it

I wanted one place that connected the daily grind to the long-term target — tasks and habits on one
end, a lifetime freedom goal on the other — plus an AI coach that reads my week back to me. It's a
study in shipping a genuinely useful tool as a single, dependency-free file.
