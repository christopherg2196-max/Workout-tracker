// Double progression: once every set of an exercise reaches the top of its rep range,
// add `inc` kg for next time. Otherwise keep the weight and keep building reps.
(function () {
  const clean = (n) => Math.round(n * 10000) / 10000; // fine enough that lb steps don't drift

  // reps: array of per-set rep counts (null = not logged). Returns the next working weight (kg).
  // incKg overrides the exercise's own increment (used to get clean steps in lb mode).
  function nextWeight(exercise, sessionWeight, reps, incKg = exercise.inc) {
    const hitTop = reps.length === exercise.sets && reps.every((r) => r !== null && r >= exercise.repMax);
    return hitTop ? clean(sessionWeight + incKg) : clean(sessionWeight);
  }

  // Reps to aim for in each set today, given the program weight and the last time this lift was
  // logged (`last` = { weight, reps } or null). Double progression:
  //  - new or different weight (first time, or the weight just went up): start at the bottom of the range
  //  - same weight: last time's reps + 1 per set, capped at the top of the range
  //  - a set below the bottom of the range counts as failed: aim to repeat it, no +1
  // `step` (exercise.step, default 1) is the size of one rep change; e.g. 5 for a plank in seconds.
  function aim(exercise, weightKg, last) {
    const step = exercise.step || 1;
    const clamp = (v) => Math.min(exercise.repMax, Math.max(1, v));
    if (!last || Math.abs(last.weight - weightKg) > 0.01) return Array(exercise.sets).fill(clamp(exercise.repMin));
    return Array.from({ length: exercise.sets }, (_, i) => {
      const r = last.reps[Math.min(i, last.reps.length - 1)];
      return clamp(r < exercise.repMin ? r : r + step);
    });
  }

  // Order a circle steps through on repeated taps: the aim first, then up to the top of the
  // range (so a rep range max can always be logged), then down through misses to 0, then empty.
  function repCycle(aimReps, repMax, step = 1) {
    const seq = [aimReps];
    for (let v = aimReps; v < repMax;) { v = Math.min(v + step, repMax); seq.push(v); }
    for (let v = aimReps; v > 0;) { v = Math.max(v - step, 0); seq.push(v); }
    return seq;
  }
  // The value after `cur` in the cycle (null = empty circle, which is also where the cycle ends).
  function nextRep(cur, aimReps, repMax, step = 1) {
    const seq = repCycle(aimReps, repMax, step);
    if (cur === null) return seq[0];
    const i = seq.indexOf(cur);
    return i >= 0 && i + 1 < seq.length ? seq[i + 1] : null;
  }

  window.Progression = { nextWeight, aim, repCycle, nextRep };
})();
