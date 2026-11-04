// Persistence + seeded program. Data lives in localStorage under one key.
(function () {
  const KEY = "workout-tracker-v1";

  // Default starting program: Upper/Lower x2, kg, double progression.
  // inc = kg added once the top of the rep range is hit on every set.
  const ex = (name, sets, repMin, repMax, weight, inc) => ({ name, sets, repMin, repMax, weight, inc });

  const DEFAULT_PROGRAM = [
    { id: "UA", name: "Upper A", exercises: [
      ex("Bench Press", 4, 6, 8, 60, 2.5),
      ex("Barbell Row", 4, 6, 8, 55, 2.5),
      ex("Overhead Press", 3, 8, 10, 35, 2.5),
      ex("Lat Pulldown", 3, 8, 12, 50, 2.5),
      ex("Triceps Pushdown", 3, 10, 15, 25, 2.5),
    ]},
    { id: "LA", name: "Lower A", exercises: [
      ex("Squat", 4, 6, 8, 80, 5),
      ex("Romanian Deadlift", 3, 8, 10, 70, 5),
      ex("Leg Press", 3, 10, 12, 120, 5),
      ex("Leg Curl", 3, 10, 12, 40, 2.5),
      ex("Calf Raise", 4, 12, 15, 60, 2.5),
    ]},
    { id: "UB", name: "Upper B", exercises: [
      ex("Incline Dumbbell Press", 4, 8, 10, 24, 2),
      ex("Seated Cable Row", 4, 8, 10, 50, 2.5),
      ex("Dumbbell Shoulder Press", 3, 8, 12, 18, 2),
      ex("Pull-up / Assisted", 3, 6, 10, 0, 2.5),
      ex("Biceps Curl", 3, 10, 15, 12, 1),
    ]},
    { id: "LB", name: "Lower B", exercises: [
      ex("Deadlift", 3, 4, 6, 100, 5),
      ex("Front Squat / Hack Squat", 3, 8, 10, 60, 5),
      ex("Walking Lunge", 3, 10, 12, 16, 2),
      ex("Hip Thrust", 3, 8, 12, 80, 5),
      ex("Seated Calf Raise", 4, 12, 15, 40, 2.5),
    ]},
  ];

  function fresh() {
    return {
      program: JSON.parse(JSON.stringify(DEFAULT_PROGRAM)), rotation: 0, sessions: [],
      cycleStart: new Date().toISOString(), settings: { unit: "kg" }, bodyweight: [],
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const d = JSON.parse(raw);
        // Older saves have no cycle start: use the first logged session, else now.
        if (!d.cycleStart) d.cycleStart = (d.sessions && d.sessions[0] && d.sessions[0].date) || new Date().toISOString();
        if (!d.settings) d.settings = { unit: "kg" };
        if (!d.bodyweight) d.bodyweight = [];
        return d;
      }
    } catch (e) { /* storage blocked or corrupt: fall back to fresh */ }
    return fresh();
  }

  const DAY = 86400000;

  let data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  // All weights are stored in kg. Units converts for display/input only, so history stays
  // consistent when you switch kg/lb and nothing is ever rewritten.
  const LB = 2.20462262;
  window.Units = {
    get unit() { return data.settings.unit; },
    get label() { return data.settings.unit; },
    toDisplay(kg) { return data.settings.unit === "lb" ? kg * LB : kg; },
    toKg(v) { return data.settings.unit === "lb" ? v / LB : v; },
    // Display string without the unit label: 1 decimal, trailing .0 dropped.
    show(kg) { const v = Math.round(this.toDisplay(kg) * 10) / 10; return Number.isInteger(v) ? String(v) : v.toFixed(1); },
    // Rounds a kg value to the nearest plate-friendly step in the current unit (0.5 kg / 1 lb).
    roundKg(kg) { const step = data.settings.unit === "lb" ? 1 / LB : 0.5; return Math.round(kg / step) * step; },
    // Increment (kg) to add on progression. In lb mode the kg increment maps to 2.5-lb steps
    // (2.5 kg -> 5 lb, 5 kg -> 10 lb) so weights don't become 5.5-lb jumps.
    incKg(incKg) {
      if (data.settings.unit !== "lb") return incKg;
      return Math.max(2.5, Math.round((incKg * LB) / 2.5) * 2.5) / LB;
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

      const program = arr(d.program, "the program").map((w) => {
        check(w && typeof w.id === "string" && typeof w.name === "string", "Backup has a malformed workout.");
        return {
          id: w.id, name: w.name,
          exercises: arr(w.exercises, "exercises").map((e) => {
            check(e && typeof e.name === "string" && [e.sets, e.repMin, e.repMax, e.weight, e.inc].every(num) && e.weight >= 0,
              "Backup has a malformed exercise.");
            return { name: e.name, sets: e.sets, repMin: e.repMin, repMax: e.repMax, weight: e.weight, inc: e.inc };
          }),
        };
      });
      check(program.length > 0, "Backup has no workouts.");
      check(Number.isInteger(d.rotation) && d.rotation >= 0 && d.rotation < program.length, "Backup has an invalid rotation.");

      const sessions = arr(d.sessions, "the session history").map((s) => {
        check(s && typeof s.date === "string" && !isNaN(Date.parse(s.date)) && typeof s.workoutId === "string", "Backup has a malformed session.");
        return {
          date: s.date, workoutId: s.workoutId,
          exercises: arr(s.exercises, "session exercises").map((e) => {
            check(e && typeof e.name === "string" && num(e.weight) && Array.isArray(e.reps) &&
              e.reps.every((r) => r === null || (num(r) && r >= 0)), "Backup has a malformed logged exercise.");
            return { name: e.name, weight: e.weight, reps: e.reps.slice(), note: typeof e.note === "string" ? e.note : "", skipped: !!e.skipped };
          }),
        };
      });

      const bodyweight = (d.bodyweight === undefined ? [] : arr(d.bodyweight, "body weight")).map((b) => {
        check(b && typeof b.date === "string" && DATE_RE.test(b.date) && num(b.kg) && b.kg > 0, "Backup has a malformed body weight entry.");
        return { date: b.date, kg: b.kg };
      }).sort((a, b) => (a.date < b.date ? -1 : 1));

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

  window.Store = {
    parseBackup,

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

    setUnit(u) { data.settings.unit = u === "lb" ? "lb" : "kg"; save(); },

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
        w.exercises[i].weight = Progression.nextWeight(w.exercises[i], de.weight, de.reps, Units.incKg(w.exercises[i].inc));
      });
      data.sessions.push({ date: new Date().toISOString(), workoutId: d.workoutId, exercises: d.exercises });
      // Continue the rotation from the workout just done (it may not have been the default next one).
      data.rotation = (data.program.findIndex((p) => p.id === d.workoutId) + 1) % data.program.length;
      delete data.draft;
      save();
    },
  };
})();
