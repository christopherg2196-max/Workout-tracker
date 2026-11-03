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
    return { program: JSON.parse(JSON.stringify(DEFAULT_PROGRAM)), rotation: 0, sessions: [] };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage blocked or corrupt: fall back to fresh */ }
    return fresh();
  }

  let data = load();

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  window.Store = {
    get data() { return data; },
    save,
    // The workout at `offset` positions after the current rotation index.
    workoutAt(offset) {
      const p = data.program;
      return p[(data.rotation + offset) % p.length];
    },
    reset() { data = fresh(); save(); },

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
        w.exercises[i].weight = Progression.nextWeight(w.exercises[i], de.weight, de.reps);
      });
      data.sessions.push({ date: new Date().toISOString(), workoutId: d.workoutId, exercises: d.exercises });
      data.rotation = (data.rotation + 1) % data.program.length;
      delete data.draft;
      save();
    },
  };
})();
