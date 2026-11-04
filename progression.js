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

  window.Progression = { nextWeight };
})();
