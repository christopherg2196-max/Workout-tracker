// Double progression: once every set of an exercise reaches the top of its rep range,
// add `inc` kg for next time. Otherwise keep the weight and keep building reps.
(function () {
  const clean = (n) => Math.round(n * 100) / 100;

  // reps: array of per-set rep counts (null = not logged). Returns the next working weight.
  function nextWeight(exercise, sessionWeight, reps) {
    const hitTop = reps.length === exercise.sets && reps.every((r) => r !== null && r >= exercise.repMax);
    return hitTop ? clean(sessionWeight + exercise.inc) : clean(sessionWeight);
  }

  window.Progression = { nextWeight };
})();
