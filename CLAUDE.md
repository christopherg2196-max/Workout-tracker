# Workout Tracker PWA

## Context
Personal workout tracker that feels like StrongLifts 5×5 (mockups in project folder: `1. Home.png`, `2. In Session Tracker.png`, `3. Progress Tracker.png`), adapted to a 4-day Upper/Lower split. End goal: runs on the user's iPhone. Starting as a PWA (plain HTML/CSS/JS): no Mac, no Apple developer fee, installs via Safari "Add to Home Screen", works offline, can be wrapped natively later (Capacitor).

## Decisions
- Platform: PWA, vanilla HTML/CSS/JS, no build step. Hosted free (GitHub Pages).
- Data: on-device only (IndexedDB/localStorage) + JSON export/import backup (iOS can evict storage).
- Split: Upper A / Lower A / Upper B / Lower B, **flexible rotation** (no fixed weekdays; next workout = next in cycle).
- Progression: **double progression** (rep range per exercise; add weight once top of range hit on all sets).
- Units: kg or lb, switchable in Settings. All weights are stored in kg and converted only for display/input (`Units` in `store.js`), so history never changes when switching. In lb mode progression steps are 5/10 lb and deload rounds to 1 lb. Style: clean red/white like mockups, dark mode supported.
- v1 session features: tap-circle sets with fail/partial reps (tap cycles reps down, e.g. 8→7→…→0), editable weight and notes per exercise.
- Out of v1 (later): rest timer, warmup tab, cloud sync, Programs editor UI, native wrap.

## Screens
1. **Home**: next workout card (name, exercises with sets×reps @ kg), Start Workout button, upcoming workouts list. Next workout is selectable (dropdown; upcoming follows). "Week N of this cycle" tracker with Restart. Deload button drops all weights to 70% (rounded to 0.5 kg, confirm first). Bottom tab bar: Home, History, Progress, Settings.
2. **In-session**: workout name header, exercise list, set circles per exercise, tap-to-edit weight, notes field, Finish Workout (saves, runs progression).
3. **Progress**: pick an exercise, line chart of weight over time, range chips (1M/3M/6M/1Y/All); e1RM toggle. Below it, a **Body Weight** section: date + weight inputs, one entry per day (same date overwrites), range chips, line chart, latest value with change vs previous, last 10 entries with delete.
5. **Settings**: kg / lb switch.
4. **History**: month calendar with trained days marked; tap a day to see that day's workout details.

## Data model
- `program`: 4 workouts, each with exercises `{name, sets, repMin, repMax, weight, increment}`.
- `state`: rotation index, `cycleStart` (ISO date, drives the weeks counter), `settings: {unit}`, `bodyweight: [{date:"YYYY-MM-DD", kg}]` (sorted).
- `sessions[]`: `{date, workoutId, exercises:[{name, weight, reps:[...], note, skipped}]}`. Skipped exercises log no reps and get no progression. At least one exercise must be done to finish.

## Files
- `index.html`, `styles.css`, `app.js` (router/views), `store.js` (persistence, export/import), `progression.js` (double progression), `chart.js` (dependency-free line chart)
- `manifest.webmanifest`, `sw.js` (offline cache), icons (180/512 px)

## Open items
- Exact exercise list, rep ranges, starting weights for the 4 workouts (propose defaults, user edits).
- Default increments (e.g. +2.5 kg upper, +5 kg lower).

## Checklist
- [x] 1. Static shell + Home screen with seeded program
- [x] 2. In-session tracker + save session + progression
- [x] 3. Progress chart + History
- [ ] 4. PWA install bits (manifest, service worker, icons)
- [ ] 5. Export/import backup
- [ ] 6. Deploy to GitHub Pages, install on iPhone
- [x] 7. Calendar view in History tab (trained days marked, tap a day for details)
- [x] 8. Choose next workout; cycle-week tracker; deload (70%) button; skip-exercise checkbox
- [x] 9. kg/lb setting; body weight tracker in Progress tab

## Verification
- Serve locally (`python -m http.server`), test at mobile viewport: complete a workout, rotation advances, weight increases only when top reps hit on all sets, chart updates.
- Reload and go offline: data persists, app loads.
- On iPhone Safari: Add to Home Screen, run a full session.
