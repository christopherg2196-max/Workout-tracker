# Workout Tracker PWA

## Context
Personal workout tracker that feels like StrongLifts 5×5 (mockups in project folder: `1. Home.png`, `2. In Session Tracker.png`, `3. Progress Tracker.png`), adapted to a 4-day Upper/Lower split. End goal: runs on the user's iPhone. Starting as a PWA (plain HTML/CSS/JS): no Mac, no Apple developer fee, installs via Safari "Add to Home Screen", works offline, can be wrapped natively later (Capacitor).

## Decisions
- Platform: PWA, vanilla HTML/CSS/JS, no build step. Hosted free (GitHub Pages).
- Data: on-device only (IndexedDB/localStorage) + JSON export/import backup (iOS can evict storage).
- Split: Upper A / Lower A / Upper B / Lower B, **flexible rotation** (no fixed weekdays; next workout = next in cycle).
- Progression: **double progression** (rep range per exercise; add weight once top of range hit on all sets).
- Units: kg or lb, switchable in Settings. All weights are stored in kg and converted only for display/input (`Units` in `store.js`), so history never changes when switching. kg mode is never rounded (user has dumbbell pairs, e.g. 2 x 8 = 16, so steps/increments are free; deload rounds to 0.5 kg). lb mode snaps lifting weights to 5 lb (137.8 -> 140), increments are multiples of 5 lb (min 5, 0 for plank), and program weights snap when switching to lb (`Units.lift/snapKg`). A 2.5 kg plate-step rule was tried and rolled back (Nov 2026). Body weight is exempt (1 decimal, `Units.showBody`). Style: clean red/white like mockups, dark mode supported.
- v1 session features: tap-circle sets with fail/partial reps (tap cycles reps down, e.g. 8→7→…→0), editable weight and notes per exercise.
- Out of v1 (later): rest timer, warmup tab, cloud sync, native wrap.
- **Workout editor: built (Settings > Edit program)**. Originally skipped (Nov 2026), then the user asked for it. Per exercise: name, type, sets, min/max reps, weight, increment, reps per tap, reorder (within core/assistance), remove, add. Edits go to a private copy; nothing is saved until "Save changes" (confirmation popup). Back/tab-bar with unsaved edits asks to discard (popup). Blocked while a workout is in progress. Renaming (applied on save) also renames the exercise in past sessions so history/charts stay joined. `DEFAULT_PROGRAM` in `store.js` only seeds a fresh install.

## Screens
1. **Home**: next workout card (name, exercises with sets×reps @ kg), Start Workout button, upcoming workouts list. Next workout is selectable (dropdown; upcoming follows). "Week N of this cycle" tracker with Restart. Deload button drops all weights to 70% (rounded to 0.5 kg, confirm first). Bottom tab bar: Home, History, Progress, Settings.
2. **In-session**: workout name header, exercise list, set circles per exercise, tap-to-edit weight, notes field, Finish Workout (saves, runs progression). Each exercise shows an **Aim** line and the empty circles show the aim per set (`Progression.aim`): same weight as last logged time → last reps +1 per set (capped at rep max; a set below rep min counts as failed and is repeated, no +1); new/changed weight (first time, or weight just went up, or deload) → bottom of the rep range. Skipped sessions are ignored. A circle's first tap logs its aim; further taps go up to rep max (so the top can always be logged and trigger a weight increase), then down through misses to 0, then empty (`Progression.repCycle`). Solid red = met/beat the aim, light red = fell short. No "last time" line (user decision). A checkbox right of the circles completes the exercise (logs the aim for every empty circle; unticking clears them all).
3. **Progress**: pick an exercise, line chart of weight over time, range chips (1M/3M/6M/1Y/All); e1RM toggle. Below it, a **Body Weight** section: date + weight inputs, one entry per day (same date overwrites), range chips, line chart, latest value with change vs previous, last 10 entries with delete.
5. **Settings**: Edit program; kg / lb switch; Backup section (export, import, last backup date); Reset app data (in-app popup; erase history but keep program, or erase everything; kg/lb kept).
4. **History**: month calendar with trained days marked; tap a day to see that day's workout details.

## Data model
- `program`: 4 workouts, each with exercises `{name, type: "core"|"assistance", sets, repMin, repMax, weight, inc, step}`. Core lifts are listed first; Home and the session show Core / Assistance headings. `step` = reps per tap (default 1; plank is seconds, step 5).
- `state`: rotation index, `cycleStart` (ISO date, drives the weeks counter), `settings: {unit}`, `bodyweight: [{date:"YYYY-MM-DD", kg}]` (sorted).
- `sessions[]`: `{date, workoutId, exercises:[{name, weight, reps:[...], note, skipped}]}`. Skipped exercises log no reps and get no progression. At least one exercise must be done to finish.

## Files
- `index.html`, `styles.css`, `app.js` (router/views), `store.js` (persistence, export/import), `progression.js` (double progression), `chart.js` (dependency-free line chart)
- `manifest.webmanifest`, `sw.js` (offline cache), icons (180/512 px)

## Open items
- Final exercise list and rep ranges are in `DEFAULT_PROGRAM` (user-supplied). Starting weights are my estimates: correct them in the weight box on first use.
- Default increments (e.g. +2.5 kg upper, +5 kg lower).

## Checklist
- [x] 1. Static shell + Home screen with seeded program
- [x] 2. In-session tracker + save session + progression
- [x] 3. Progress chart + History
- [x] 4. PWA install bits (manifest, service worker, icons). Service worker is network-first with cache fallback, so updates arrive when online. **When adding a new app file, add it to `SHELL` in `sw.js`** so a first offline launch has it. Real SW registration is untestable in the Claude browser pane; verify on localhost in Chrome or on the deployed https site.
- [x] 5. Export/import backup (Settings tab). Export = share sheet on iPhone, download elsewhere; file is `{app, version, exportedAt, data}` (current `SCHEMA = 1` in `store.js`). Import validates strictly (`Store.parseBackup`), shows a summary, asks before replacing, and never changes data on a bad file. **If the data shape changes, bump `SCHEMA` and add a migration in `parseBackup`**, and keep the new fields in its whitelist or they will be dropped on import. Home shows a quiet reminder after 30 days without a backup.
- [x] 6. Deploy to GitHub Pages, install on iPhone (live at https://christopherg2196-max.github.io/Workout-tracker/; installed on the user's iPhone, Nov 2026; real-gym test pending)
- [x] 7. Calendar view in History tab (trained days marked, tap a day for details)
- [x] 8. Choose next workout; cycle-week tracker; deload (70%) button; skip-exercise checkbox
- [x] 9. kg/lb setting; body weight tracker in Progress tab

## Verification
- Serve locally (`python -m http.server`), test at mobile viewport: complete a workout, rotation advances, weight increases only when top reps hit on all sets, chart updates.
- Reload and go offline: data persists, app loads.
- On iPhone Safari: Add to Home Screen, run a full session.

## Added after launch (Nov 2026, user-requested)
- **Rest timer**: logging a set (circle tap, or ticking the complete checkbox) starts a countdown bar fixed at the bottom of the workout screen (`#restbar` on `<body>`, so it survives re-renders). Core 180 s, assistance 90 s by default; on/off and lengths in Settings (`settings.restOn/restCore/restAssist`). Beeps (WebAudio, unlocked by the tap) and flashes at zero; iOS web apps cannot vibrate or notify while locked.
- **Plate calculator**: exercises with `bar: true` show a "Plates" link; dialog lists plates per side for the draft weight. Plates kg 25/20/15/10/5/2.5/1.25, lb 45/35/25/10/5/2.5. Empty bar weight is remembered (`settings.barKg` 20 / `barLb` 45). The Barbell flag is a field in Edit program; older saves infer it by name from the defaults.
- **Personal records**: a session is a PR for a lift if its best Epley e1RM beats all earlier sessions (first time ever is not a PR). `computePRs()`; popup after finishing, "PR" badge in History.
- **Weekly summary**: top of the Progress tab; this week's workouts and volume (weight x reps), % vs last week, 8-week bar chart (weeks Mon-Sun).
- **Backup reminder**: Home nags after 14 days or 5 workouts since the last export (`Store.sessionsSinceBackup`).
- **Edit/delete past sessions**: buttons on each History card. Edit works on a copy (date, weights, reps, skipped, notes) with Save/discard popups; it only fixes the record and does not recalculate program weights. Delete asks first.
- Popups are in-app (`showDialog`), not `confirm()`. `settings` is always passed through `normalizeSettings` (also inside `parseBackup`), so new settings must be added there or they are dropped on load/import.
