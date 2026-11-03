// Views + tiny tab router. Milestone 1: Home screen only; other tabs are placeholders.
(function () {
  const view = document.getElementById("view");
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

  function exerciseRows(w) {
    return w.exercises.map((e) => {
      const reps = e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`;
      return `<div class="row"><span>${e.name}</span><span class="detail">${e.sets}×${reps} ${fmt(e.weight)}kg</span></div>`;
    }).join("");
  }

  function home() {
    const d = Store.data;
    const next = Store.workoutAt(0);
    const upcoming = [1, 2, 3].map((i) => Store.workoutAt(i));
    const last = d.sessions[d.sessions.length - 1];
    const lastText = last ? `Last workout: ${new Date(last.date).toLocaleDateString()}` : "No workouts logged yet";

    view.innerHTML = `
      <div class="sub">Program</div>
      <div class="sub" style="color:var(--text);font-weight:600">Upper / Lower · 4 days</div>
      <div class="head"><h1>Next Workout</h1><span class="badge">${next.name}</span></div>
      <div class="sub">${lastText}</div>
      <div class="card">${exerciseRows(next)}</div>
      <button class="btn" id="start">Start Workout</button>
      <div class="upcoming">
        <h2>Upcoming Workouts</h2>
        ${upcoming.map((w) => `
          <div class="head when"><span>${w.name}</span></div>
          <div class="card">${exerciseRows(w)}</div>`).join("")}
      </div>`;
    document.getElementById("start").onclick = () => alert("Session tracker comes in milestone 2.");
  }

  function placeholder(title) {
    return () => { view.innerHTML = `<h1>${title}</h1><p class="placeholder">Coming soon</p>`; };
  }

  const routes = {
    home,
    history: placeholder("History"),
    progress: placeholder("Progress"),
    settings: placeholder("Settings"),
  };

  function go(tab) {
    document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    routes[tab]();
    window.scrollTo(0, 0);
  }

  document.getElementById("tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) go(b.dataset.tab);
  });

  go("home");
})();
