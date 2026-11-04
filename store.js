// Persistence + seeded program. Data lives in localStorage under one key.
(function () {
  const KEY = "workout-tracker-v1";

  // Final program: Upper/Lower x2, kg, double progression. Core lifts first, then assistance.
  // type = "core" | "assistance"; inc = kg added once the top of the rep range is hit on every set;
  // step = how much one tap changes reps (default 1; plank counts seconds, so 5).
  // Starting weights are estimates: change them in-session (the weight box) on day one.
  const ex = (type, name, sets, repMin, repMax, weight, inc, step = 1) => ({ name, type, sets, repMin, repMax, weight, inc, step });
  const C = "core", A = "assistance";

  const DEFAULT_PROGRAM = [
    { id: "UA", name: "Upper A", exercises: [
      ex(C, "Bench Press", 4, 5, 6, 60, 2.5),
      ex(C, "Chest-Supported Row", 4, 6, 8, 50, 2.5),
      ex(C, "Overhead Press", 3, 6, 8, 35, 2.5),
      ex(A, "Pull-ups", 3, 8, 10, 0, 2.5),
      ex(A, "Triceps Pushdown", 3, 10, 12, 25, 2.5),
      ex(A, "Dumbbell Curl", 3, 10, 12, 10, 1),
    ]},
    { id: "LA", name: "Lower A", exercises: [
      ex(C, "Squat", 4, 5, 6, 80, 5),
      ex(C, "Deadlift", 3, 4, 6, 100, 5),
      ex(A, "Standing Calf Raise", 3, 10, 15, 60, 2.5),
      ex(A, "Hip Abduction Machine", 3, 12, 15, 40, 2.5),
      ex(A, "Crunches", 3, 15, 25, 0, 2.5),
    ]},
    { id: "UB", name: "Upper B", exercises: [
      ex(C, "Incline Dumbbell Press", 4, 8, 10, 24, 2),
      ex(C, "Bent Over Row", 4, 8, 10, 50, 2.5),
      ex(A, "Lat Pulldown", 3, 10, 12, 50, 2.5),
      ex(A, "Dumbbell Lateral Raise", 4, 12, 15, 8, 1),
      ex(A, "Face Pulls", 3, 12, 15, 20, 2.5),
      ex(A, "Overhead Triceps Extension", 3, 10, 12, 20, 2.5),
    ]},
    { id: "LB", name: "Lower B", exercises: [
      ex(C, "Leg Press", 4, 8, 10, 120, 5),
      ex(C, "Bulgarian Split Squat (each leg)", 3, 8, 10, 16, 2),
      ex(A, "Leg Extension", 3, 12, 15, 40, 2.5),
      ex(A, "Seated Leg Curl", 3, 12, 15, 40, 2.5),
      ex(A, "Plank (seconds)", 3, 30, 60, 0, 0, 5),
    ]},
  ];

  function fresh() {
    return {
      program: JSON.parse(JSON.stringify(DEFAULT_PROGRAM)), rotation: 0, sessions: [],
      cycleStart: new Date().toISOString(), settings: { unit: "kg" }, bodyweight: [],
    };
  }

  // Reads and validates the saved data (same checks as a backup import). If it can't be used, the raw
  // text is kept under KEY + "-corrupt" (never silently overwritten) and a warning is set for Home.
  let loadWarning = null;
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { return fresh(); } // storage blocked
    if (!raw) return fresh();
    try {
      const d = JSON.parse(raw);
      // Older saves have no cycle start: use the first logged session, else now.
      if (!d.cycleStart) d.cycleStart = (d.sessions && d.sessions[0] && d.sessions[0].date) || new Date().toISOString();
      if (!d.settings) d.settings = { unit: "kg" };
      if (!d.bodyweight) d.bodyweight = [];
      const res = parseBackup(JSON.stringify({ app: "workout-tracker", version: SCHEMA, data: d }));
      if (res.error) throw new Error(res.error);
      const clean = res.data;
      // Keep an in-progress workout only if it still matches the program.
      const dr = d.draft, w = dr && clean.program.find((p) => p.id === dr.workoutId);
      if (w && Array.isArray(dr.exercises) && dr.exercises.length === w.exercises.length &&
          dr.exercises.every((x, i) => x && x.name === w.exercises[i].name && typeof x.weight === "number" && Array.isArray(x.reps) && x.reps.length === w.exercises[i].sets)) {
        clean.draft = dr;
      }
      return clean;
    } catch (e) {
      try { localStorage.setItem(KEY + "-corrupt", raw); } catch (_) { /* ignore */ }
      loadWarning = "Your saved data couldn't be read, so the app started fresh. A copy of the old data was kept on this device.";
      return fresh();
    }
  }

  const DAY = 86400000;

  let data; // set below, once parseBackup and SCHEMA exist

  let saveWarned = false;
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); }
    catch (e) {
      if (!saveWarned) { saveWarned = true; alert("Couldn't save your data on this device (storage is full or blocked). Export a backup from Settings and free some space."); }
    }
  }

  // All weights are stored in kg. Units converts for display/input only, so history stays
  // consistent when you switch kg/lb and nothing is ever rewritten.
  const LB = 2.20462262;
  window.Units = {
    get unit() { return data.settings.unit; },
    get label() { return data.settings.unit; },
    toDisplay(kg) { return data.settings.unit === "lb" ? kg * LB : kg; },
    toKg(v) { return data.settings.unit === "lb" ? v / LB : v; },
    // Display string without the unit label. Lifting weights in lb are always shown to the nearest 5 lb
    // (137.8 -> 140); in kg they show 1 decimal with a trailing .0 dropped. Use showBody for body weight.
    show(kg) {
      if (data.settings.unit === "lb") return String(this.lift(kg));
      return this.showBody(kg);
    },
    // Lifting weight as a number in the current unit: nearest 5 lb in lb mode, unchanged in kg.
    lift(kg) { return data.settings.unit === "lb" ? Math.round((kg * LB) / 5) * 5 : kg; },
    // Snaps a kg weight to a whole 5-lb step in lb mode (so the stored value matches what's shown); no-op in kg.
    snapKg(kg) { return data.settings.unit === "lb" ? this.lift(kg) / LB : kg; },
    // Exact value, 1 decimal (used for body weight, where 5-lb rounding would be wrong).
    showBody(kg) { const v = Math.round(this.toDisplay(kg) * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); },
    // Rounds a kg value to the nearest plate-friendly step in the current unit (0.5 kg / 5 lb).
    roundKg(kg) { const step = data.settings.unit === "lb" ? 5 / LB : 0.5; return Math.round(kg / step) * step; },
    // Increment (kg) to add on progression. In lb mode it is a multiple of 5 lb (2.5 kg -> 5 lb, 5 kg -> 10 lb);
    // 0 stays 0 (e.g. plank).
    incKg(incKg) {
      if (data.settings.unit !== "lb" || incKg <= 0) return Math.max(0, incKg);
      return Math.max(5, Math.round((incKg * LB) / 5) * 5) / LB;
    },
  };

  // ---- Backup file format ----
  // Bump SCHEMA when the saved data shape changes and add a migration step in parseBackup.
  const SCHEMA = 1;
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  // Turns backup text into clean app data, or { error }. Only known fields are copied over,
  // so a hand-edited or corrupted file can't inject anything unexpected.
  function parseBackup(text) {
    const check = (cond, msg) => { if (!cond) throw new Error(msg); };
    const num = (n) => typeof n === "number" && isFinite(n);
    const arr = (a, what) => { check(Array.isArray(a), `Backup is missing ${what}.`); return a; };
    try {
      let obj;
      try { obj = JSON.parse(text); } catch (e) { throw new Error("That file isn't valid JSON."); }
      check(obj && obj.app === "workout-tracker" && num(obj.version) && obj.data && typeof obj.data === "object",
        "This doesn't look like a Workout Tracker backup.");
      check(obj.version <= SCHEMA, "This backup is from a newer version of the app. Update the app first.");
      const d = obj.data; // (older versions would be migrated to the current shape here)

      const int = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
      const program = arr(d.program, "the program").map((w) => {
        check(w && typeof w.id === "string" && typeof w.name === "string", "Backup has a malformed workout.");
        return {
          id: w.id, name: w.name,
          exercises: arr(w.exercises, "exercises").map((e) => {
            check(e && typeof e.name === "string" && [e.sets, e.repMin, e.repMax, e.weight, e.inc].every(num) && e.weight >= 0 && e.inc >= 0 &&
              int(e.sets, 1, 10) && int(e.repMin, 1, 200) && int(e.repMax, e.repMin, 200),
              "Backup has a malformed exercise.");
            return { name: e.name, type: e.type === "assistance" ? "assistance" : "core", sets: e.sets, repMin: e.repMin, repMax: e.repMax, weight: e.weight, inc: e.inc, step: int(e.step, 1, 10) ? e.step : 1 };
          }),
        };
      });
      check(program.length > 0, "Backup has no workouts.");
      check(new Set(program.map((w) => w.id)).size === program.length, "Backup has duplicate workouts.");
      check(program.every((w) => w.exercises.length > 0), "Backup has a workout with no exercises.");
      check(Number.isInteger(d.rotation) && d.rotation >= 0 && d.rotation < program.length, "Backup has an invalid rotation.");

      const sessions = arr(d.sessions, "the session history").map((s) => {
        check(s && typeof s.date === "string" && !isNaN(Date.parse(s.date)) && typeof s.workoutId === "string", "Backup has a malformed session.");
        return {
          date: s.date, workoutId: s.workoutId,
          exercises: arr(s.exercises, "session exercises").map((e) => {
            check(e && typeof e.name === "string" && num(e.weight) && Array.isArray(e.reps) &&
              e.reps.length <= 50 && e.reps.every((r) => r === null || (num(r) && r >= 0)), "Backup has a malformed logged exercise.");
            return { name: e.name, weight: e.weight, reps: e.reps.slice(), note: typeof e.note === "string" ? e.note : "", skipped: !!e.skipped };
          }),
        };
      });

      const bodyweight = (d.bodyweight === undefined ? [] : arr(d.bodyweight, "body weight")).map((b) => {
        check(b && typeof b.date === "string" && DATE_RE.test(b.date) && num(b.kg) && b.kg > 0, "Backup has a malformed body weight entry.");
        return { date: b.date, kg: b.kg };
      });
      // One entry per day: a later duplicate replaces an earlier one.
      const byDate = new Map(bodyweight.map((b) => [b.date, b]));
      bodyweight.length = 0;
      [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1)).forEach((b) => bodyweight.push(b));

      const clean = {
        program, rotation: d.rotation, sessions, bodyweight,
        cycleStart: typeof d.cycleStart === "string" && !isNaN(Date.parse(d.cycleStart)) ? d.cycleStart : new Date().toISOString(),
        settings: { unit: d.settings && d.settings.unit === "lb" ? "lb" : "kg" },
      };
      if (typeof d.lastBackup === "string" && !isNaN(Date.parse(d.lastBackup))) clean.lastBackup = d.lastBackup;

      return {
        data: clean,
        summary: {
          sessions: sessions.length, bodyweight: bodyweight.length,
          lastSession: sessions.length ? sessions[sessions.length - 1].date : null,
          exportedAt: typeof obj.exportedAt === "string" ? obj.exportedAt : null,
        },
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  data = load();
  // Ask the browser not to evict our storage (helps against iOS clearing it); harmless if refused.
  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) { /* ignore */ }

  // Exercise names must be unique across the program (history and charts are keyed by name).
  // Returns `want`, or "want (2)", "want (3)"... if taken by another exercise.
  function uniqueName(want, skipW, skipE) {
    const taken = new Set();
    data.program.forEach((w, wi) => w.exercises.forEach((e, ei) => { if (!(wi === skipW && ei === skipE)) taken.add(e.name); }));
    let name = want, n = 2;
    while (taken.has(name)) name = `${want} (${n++})`;
    return name;
  }

  window.Store = {
    parseBackup,
    // Set if saved data had to be set aside at startup (shown once on Home).
    takeWarning() { const w = loadWarning; loadWarning = null; return w; },

    // Everything except an in-progress workout draft. lastBackup is stamped into the file so a
    // restore also restores "when did I last back up".
    exportData() {
      const copy = JSON.parse(JSON.stringify(data));
      delete copy.draft;
      const now = new Date().toISOString();
      copy.lastBackup = now;
      return { app: "workout-tracker", version: SCHEMA, exportedAt: now, data: copy };
    },
    markBackup() { data.lastBackup = new Date().toISOString(); save(); },
    // Whole days since the last export, or null if there never was one.
    daysSinceBackup() {
      return data.lastBackup ? Math.floor((Date.now() - new Date(data.lastBackup).getTime()) / DAY) : null;
    },
    // Most recent logged (not skipped, fully tapped) result for an exercise: { weight, reps } or null.
    lastLogged(name) {
      for (let i = data.sessions.length - 1; i >= 0; i--) {
        const e = data.sessions[i].exercises.find((x) => x.name === name);
        if (e && !e.skipped && e.reps.length && e.reps.every((r) => r !== null)) return { weight: e.weight, reps: e.reps };
      }
      return null;
    },
    // Replaces all app data with already-validated data from parseBackup. Drops any draft.
    importData(clean) { data = clean; save(); },

    get data() { return data; },
    save,
    // The workout at `offset` positions after the current rotation index.
    workoutAt(offset) {
      const p = data.program;
      return p[(data.rotation + offset) % p.length];
    },
    reset() { data = fresh(); save(); },

    // ---- Program editing (blocked in the UI while a workout is in progress) ----
    // Keeps core lifts above assistance (stable, so the order you chose within each group stays).
    _tidy(wi) {
      data.program[wi].exercises.sort((a, b) => (a.type === "assistance" ? 1 : 0) - (b.type === "assistance" ? 1 : 0));
    },
    // patch: any of name, type, sets, repMin, repMax, weight (kg), inc (kg), step.
    // Renaming also renames the exercise in past sessions, so its history and chart stay joined up.
    editExercise(wi, ei, patch) {
      const e = data.program[wi].exercises[ei];
      if (patch.name !== undefined) patch.name = uniqueName(patch.name, wi, ei);
      if (patch.name !== undefined && patch.name !== e.name) {
        data.sessions.forEach((s) => s.exercises.forEach((x) => { if (x.name === e.name) x.name = patch.name; }));
      }
      Object.assign(e, patch);
      this._tidy(wi);
      save();
    },
    addExercise(wi) {
      data.program[wi].exercises.push({ name: uniqueName("New exercise", -1, -1), type: "assistance", sets: 3, repMin: 8, repMax: 12, weight: 0, inc: 2.5, step: 1 });
      save();
    },
    removeExercise(wi, ei) { data.program[wi].exercises.splice(ei, 1); save(); },
    // dir = -1 (up) or +1 (down); only swaps within the same type group.
    moveExercise(wi, ei, dir) {
      const l = data.program[wi].exercises, j = ei + dir;
      if (j < 0 || j >= l.length || (l[j].type === "assistance") !== (l[ei].type === "assistance")) return;
      [l[ei], l[j]] = [l[j], l[ei]];
      save();
    },

    // Choose which workout is next; Upcoming follows because it is derived from the rotation.
    setNext(index) { data.rotation = index; save(); },

    // Whole weeks since the cycle started, counting the first week as week 1.
    cycleWeek() { return Math.floor((Date.now() - new Date(data.cycleStart).getTime()) / (7 * DAY)) + 1; },
    restartCycle() { data.cycleStart = new Date().toISOString(); save(); },

    // Scale every program weight (default 70%), rounded to 0.5 kg (or 1 lb in lb mode).
    deload(factor = 0.7) {
      data.program.forEach((w) => w.exercises.forEach((e) => { e.weight = Units.roundKg(e.weight * factor); }));
      save();
    },

    // Switching to lb also snaps every program weight to a whole 5 lb, so what you see is what is stored.
    setUnit(u) {
      data.settings.unit = u === "lb" ? "lb" : "kg";
      if (data.settings.unit === "lb") data.program.forEach((w) => w.exercises.forEach((e) => { e.weight = Units.snapKg(e.weight); }));
      save();
    },

    // Erase training history (sessions, body weight, any workout in progress) and restart the cycle.
    // keepProgram = true keeps your exercises and current weights; false restores the default program.
    // The kg/lb setting is always kept.
    resetData(keepProgram) {
      const old = data, d = fresh();
      d.settings = old.settings;
      if (keepProgram) d.program = old.program;
      data = d;
      save();
    },

    // Body weight log: one entry per calendar day (date = "YYYY-MM-DD"), stored in kg, kept sorted.
    addBodyweight(date, kg) {
      data.bodyweight = data.bodyweight.filter((b) => b.date !== date);
      data.bodyweight.push({ date, kg });
      data.bodyweight.sort((a, b) => (a.date < b.date ? -1 : 1));
      save();
    },
    removeBodyweight(date) {
      data.bodyweight = data.bodyweight.filter((b) => b.date !== date);
      save();
    },

    // In-progress session survives reloads: stored as data.draft.
    startDraft() {
      const w = this.workoutAt(0);
      data.draft = {
        workoutId: w.id,
        startedAt: new Date().toISOString(),
        exercises: w.exercises.map((e) => ({
          name: e.name,
          weight: e.weight,
          reps: Array(e.sets).fill(null),
          note: "",
          skipped: false,
        })),
      };
      save();
    },
    discardDraft() { delete data.draft; save(); },

    // Saves the draft as a session, updates program weights, advances the rotation.
    finishDraft() {
      const d = data.draft;
      const w = data.program.find((p) => p.id === d.workoutId);
      d.exercises.forEach((de, i) => {
        if (de.skipped) {
          // Skipped: log nothing and leave the program weight untouched (no progression).
          de.reps = de.reps.map(() => null);
          return;
        }
        w.exercises[i].weight = Units.snapKg(Progression.nextWeight(w.exercises[i], de.weight, de.reps, Units.incKg(w.exercises[i].inc)));
      });
      data.sessions.push({ date: new Date().toISOString(), workoutId: d.workoutId, exercises: d.exercises });
      // Continue the rotation from the workout just done (it may not have been the default next one).
      data.rotation = (data.program.findIndex((p) => p.id === d.workoutId) + 1) % data.program.length;
      delete data.draft;
      save();
    },
  };
})();
