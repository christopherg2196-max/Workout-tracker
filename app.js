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
      <button class="btn" id="start">${d.draft ? "Resume Workout" : "Start Workout"}</button>
      <div class="upcoming">
        <h2>Upcoming Workouts</h2>
        ${upcoming.map((w) => `
          <div class="head when"><span>${w.name}</span></div>
          <div class="card">${exerciseRows(w)}</div>`).join("")}
      </div>`;
    document.getElementById("start").onclick = () => {
      if (!Store.data.draft) Store.startDraft();
      session();
    };
  }

  // ---- In-session tracker ----
  // Tap an empty circle: logs the top of the rep range. Each further tap lowers it by one
  // (partial/failed reps); after 0 it clears back to empty.
  let showErrors = false; // true after a blocked Finish attempt: outlines untapped circles
  function session() {
    const d = Store.data.draft;
    if (!d) return home();
    document.body.classList.add("in-session");
    const w = Store.data.program.find((p) => p.id === d.workoutId);
    const complete = d.exercises.every((x) => x.reps.every((r) => r !== null));
    if (complete) showErrors = false;

    view.innerHTML = `
      <div class="head">
        <button class="link" id="cancel">&#8249; Back</button>
        <span class="badge">${w.name}</span>
      </div>
      ${d.exercises.map((de, i) => {
        const e = w.exercises[i];
        const range = e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`;
        return `
        <div class="ex">
          <div class="head">
            <strong>${de.name}</strong>
            <span class="target">${e.sets}×${range} @ <input class="wt" type="number" inputmode="decimal" step="0.5" min="0" data-i="${i}" value="${fmt(de.weight)}">kg</span>
          </div>
          <div class="sets">
            ${de.reps.map((r, s) => {
              const done = r !== null;
              const full = done && r >= e.repMax;
              const cls = done ? (full ? "full" : "part") : showErrors ? "err" : "";
              return `<button class="set ${cls}" data-i="${i}" data-s="${s}">${done ? r : e.repMax}</button>`;
            }).join("")}
          </div>
          <textarea class="note" data-i="${i}" rows="1" placeholder="Notes">${de.note}</textarea>
        </div>`;
      }).join("")}
      <button class="btn ${complete ? "" : "blocked"}" id="finish">Finish Workout</button>
      ${showErrors && !complete ? `<p class="errmsg">Tap every set before finishing. Tap a circle again to lower the reps; a 0 counts as failed.</p>` : ""}`;

    const save = () => Store.save();
    view.onclick = (ev) => {
      const b = ev.target.closest(".set");
      if (!b) return;
      const i = +b.dataset.i, s = +b.dataset.s;
      const e = w.exercises[i];
      const cur = d.exercises[i].reps[s];
      d.exercises[i].reps[s] = cur === null ? e.repMax : cur > 0 ? cur - 1 : null;
      save();
      const y = window.scrollY;
      session();
      window.scrollTo(0, y);
    };
    // Weight edits apply to this session and become the base for progression on finish.
    view.onchange = (ev) => {
      if (ev.target.classList.contains("wt")) {
        // Snap the box back to the stored value if the entry was empty/invalid.
        ev.target.value = fmt(d.exercises[+ev.target.dataset.i].weight);
      }
    };
    view.oninput = (ev) => {
      if (ev.target.classList.contains("wt")) {
        const v = parseFloat(ev.target.value);
        if (!isNaN(v) && v >= 0) { d.exercises[+ev.target.dataset.i].weight = v; save(); }
      } else if (ev.target.classList.contains("note")) {
        d.exercises[+ev.target.dataset.i].note = ev.target.value;
        save();
      }
    };
    document.getElementById("cancel").onclick = () => {
      // The draft is kept by default so it can be resumed from Home; OK discards it.
      if (confirm("Discard this workout? (OK discards, Cancel keeps it to resume later.)")) Store.discardDraft();
      leaveSession();
    };
    document.getElementById("finish").onclick = () => {
      if (!complete) {
        showErrors = true;
        session();
        const first = document.querySelector(".set.err");
        if (first) first.scrollIntoView({ block: "center" });
        return;
      }
      Store.finishDraft();
      leaveSession();
    };
  }

  function leaveSession() {
    document.body.classList.remove("in-session");
    showErrors = false;
    view.onclick = view.onchange = view.oninput = null;
    go("home");
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
