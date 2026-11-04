// Views + tiny tab router. Milestone 1: Home screen only; other tabs are placeholders.
(function () {
  const view = document.getElementById("view");
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

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

    const started = new Date(d.cycleStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });

    view.innerHTML = `
      <div class="sub">Program</div>
      <div class="sub" style="color:var(--text);font-weight:600">Upper / Lower · 4 days</div>
      <div class="cycle">
        <span><strong>Week ${Store.cycleWeek()}</strong> of this cycle <span class="sub">· since ${started}</span></span>
        <button class="link small" id="restart">Restart</button>
      </div>
      <div class="head"><h1>Next Workout</h1>
        <select class="badge pick" id="pick" aria-label="Choose next workout" ${d.draft ? "disabled" : ""}>
          ${d.program.map((w, i) => `<option value="${i}" ${i === d.rotation ? "selected" : ""}>${w.name}</option>`).join("")}
        </select>
      </div>
      <div class="sub">${lastText}</div>
      <div class="card">${exerciseRows(next)}</div>
      <button class="btn" id="start">${d.draft ? "Resume Workout" : "Start Workout"}</button>
      <button class="btn secondary" id="deload">Deload (70% of all weights)</button>
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
    document.getElementById("pick").onchange = (ev) => { Store.setNext(+ev.target.value); home(); };
    document.getElementById("restart").onclick = () => {
      if (confirm("Restart the cycle counter at week 1, starting today?")) { Store.restartCycle(); home(); }
    };
    document.getElementById("deload").onclick = () => {
      if (Store.data.draft) return alert("Finish or discard your current workout before deloading.");
      const e = next.exercises[0];
      const after = Math.round(e.weight * 0.7 * 2) / 2;
      if (!confirm(`Drop every exercise to 70% of its current weight?\n\nExample: ${e.name} ${fmt(e.weight)}kg → ${fmt(after)}kg.\nThis can't be undone.`)) return;
      Store.deload(0.7);
      home();
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
    // Every exercise is either skipped or fully tapped; at least one must actually be done.
    const complete = d.exercises.every((x) => x.skipped || x.reps.every((r) => r !== null));
    const hasWork = d.exercises.some((x) => !x.skipped);
    const canFinish = complete && hasWork;
    if (canFinish) showErrors = false;

    view.innerHTML = `
      <div class="head">
        <button class="link" id="cancel">&#8249; Back</button>
        <span class="badge">${w.name}</span>
      </div>
      ${d.exercises.map((de, i) => {
        const e = w.exercises[i];
        const range = e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`;
        return `
        <div class="ex ${de.skipped ? "skipped" : ""}">
          <div class="head">
            <strong>${de.name}</strong>
            <span class="target">${e.sets}×${range} @ <input class="wt" type="number" inputmode="decimal" step="0.5" min="0" data-i="${i}" value="${fmt(de.weight)}" ${de.skipped ? "disabled" : ""}>kg</span>
          </div>
          <label class="skip"><input type="checkbox" class="skipcb" data-i="${i}" ${de.skipped ? "checked" : ""}> Skip this exercise</label>
          <div class="sets">
            ${de.reps.map((r, s) => {
              const done = r !== null;
              const full = done && r >= e.repMax;
              const cls = done ? (full ? "full" : "part") : showErrors && !de.skipped ? "err" : "";
              return `<button class="set ${cls}" data-i="${i}" data-s="${s}" ${de.skipped ? "disabled" : ""}>${done ? r : e.repMax}</button>`;
            }).join("")}
          </div>
          <textarea class="note" data-i="${i}" rows="1" placeholder="Notes">${esc(de.note)}</textarea>
        </div>`;
      }).join("")}
      <button class="btn ${canFinish ? "" : "blocked"}" id="finish">Finish Workout</button>
      ${showErrors && !canFinish ? `<p class="errmsg">${hasWork
        ? "Tap every set, or tick Skip, before finishing. Tap a circle again to lower the reps; a 0 counts as failed."
        : "You skipped every exercise. Log at least one to finish."}</p>` : ""}`;

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
      if (ev.target.classList.contains("skipcb")) {
        d.exercises[+ev.target.dataset.i].skipped = ev.target.checked;
        save();
        const y = window.scrollY;
        session();
        window.scrollTo(0, y);
      } else if (ev.target.classList.contains("wt")) {
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
      if (!canFinish) {
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

  // ---- History ----
  // Month calendar: days with a logged session are filled red; tap a day to see its workout(s).
  const cal = { y: null, m: null, sel: null };
  const dayKey = (dt) => `${dt.getFullYear()}-${dt.getMonth() + 1}-${dt.getDate()}`; // local time

  function history() {
    const today = new Date();
    if (cal.y === null) { cal.y = today.getFullYear(); cal.m = today.getMonth(); cal.sel = dayKey(today); }
    const names = Object.fromEntries(Store.data.program.map((p) => [p.id, p.name]));

    const byDay = {};
    Store.data.sessions.forEach((s) => { (byDay[dayKey(new Date(s.date))] ||= []).push(s); });

    const first = new Date(cal.y, cal.m, 1);
    const lead = (first.getDay() + 6) % 7; // weeks start on Monday
    const dim = new Date(cal.y, cal.m + 1, 0).getDate();
    let monthCount = 0;
    let cells = "";
    for (let i = 0; i < lead; i++) cells += `<span class="day empty"></span>`;
    for (let n = 1; n <= dim; n++) {
      const key = `${cal.y}-${cal.m + 1}-${n}`;
      const trained = byDay[key];
      if (trained) monthCount += trained.length;
      const cls = ["day", trained ? "trained" : "", key === dayKey(today) ? "today" : "", key === cal.sel ? "sel" : ""].join(" ");
      cells += `<button class="${cls}" data-k="${key}">${n}</button>`;
    }

    const title = first.toLocaleDateString(undefined, { month: "long", year: "numeric" });
    const picked = byDay[cal.sel] || [];
    const [py, pm, pd] = cal.sel.split("-").map(Number);
    const pickedTitle = new Date(py, pm - 1, pd).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

    view.innerHTML = `
      <h1>History</h1>
      <div class="card calbox">
        <div class="head calnav">
          <button class="link" id="prev" aria-label="Previous month">&#8249;</button>
          <strong>${title}</strong>
          <button class="link" id="next" aria-label="Next month">&#8250;</button>
        </div>
        <div class="grid dow"><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span><span>S</span></div>
        <div class="grid">${cells}</div>
        <div class="sub" style="text-align:center;padding:8px 0">${monthCount} workout${monthCount === 1 ? "" : "s"} this month</div>
      </div>
      <h2>${pickedTitle}</h2>
      ${picked.length ? picked.map((s) => `
        <div class="card hist">
          <div class="row"><strong>${esc(names[s.workoutId] || s.workoutId)}</strong><span class="sub">${new Date(s.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span></div>
          ${s.exercises.map((e) => `
            <div class="row"><span>${esc(e.name)}${e.note ? `<br><span class="sub">${esc(e.note)}</span>` : ""}</span>
            <span class="detail">${e.skipped ? "Skipped" : `${fmt(e.weight)}kg × ${e.reps.map((r) => (r === null ? "–" : r)).join(", ")}`}</span></div>`).join("")}
        </div>`).join("") : `<p class="sub">No workout logged this day.</p>`}`;

    const shift = (d) => { const dt = new Date(cal.y, cal.m + d, 1); cal.y = dt.getFullYear(); cal.m = dt.getMonth(); history(); };
    document.getElementById("prev").onclick = () => shift(-1);
    document.getElementById("next").onclick = () => shift(1);
    view.querySelectorAll(".day[data-k]").forEach((b) => (b.onclick = () => { cal.sel = b.dataset.k; history(); }));
  }

  // ---- Progress ----
  const RANGES = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365, All: Infinity };
  const prog = { ex: null, range: "3M", e1rm: false };

  // Epley estimate from the best set of a session.
  const e1rmOf = (e) => Math.max(0, ...e.reps.filter((r) => r > 0).map((r) => e.weight * (1 + r / 30)));

  function progress() {
    const names = [...new Set(Store.data.program.flatMap((p) => p.exercises.map((e) => e.name)))];
    if (!prog.ex) prog.ex = names[0];
    const cutoff = RANGES[prog.range] === Infinity ? 0 : Date.now() - RANGES[prog.range] * 86400000;

    const rows = [];
    Store.data.sessions.forEach((s) => {
      const e = s.exercises.find((x) => x.name === prog.ex);
      if (e && e.reps.some((r) => r !== null)) rows.push({ t: new Date(s.date).getTime(), e });
    });
    const inRange = rows.filter((r) => r.t >= cutoff);
    const series = [{ label: "Weight", color: "#f08a1c", points: inRange.map((r) => ({ t: r.t, v: r.e.weight })) }];
    if (prog.e1rm) series.push({ label: "e1RM", color: "#e10613", points: inRange.filter((r) => e1rmOf(r.e) > 0).map((r) => ({ t: r.t, v: +e1rmOf(r.e).toFixed(1) })) });

    const latest = rows[rows.length - 1];
    view.innerHTML = `
      <h1>Progress</h1>
      <select id="exsel">${names.map((n) => `<option ${n === prog.ex ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <div class="chips">${Object.keys(RANGES).map((r) => `<button data-r="${r}" class="${r === prog.range ? "on" : ""}">${r}</button>`).join("")}</div>
      <div class="big">${latest ? fmt(latest.e.weight) + "kg" : "–"}</div>
      <div class="sub">${latest ? "Last: " + new Date(latest.t).toLocaleDateString() : "No sessions for this exercise yet"}</div>
      <div class="card" style="padding:12px">${Chart.line(series)}</div>
      <label class="tog"><span><i class="dot" style="background:#f08a1c"></i>Weight</span><span class="sub">always shown</span></label>
      <label class="tog"><span><i class="dot" style="background:#e10613"></i>e1RM</span><input type="checkbox" id="e1" ${prog.e1rm ? "checked" : ""}></label>`;

    document.getElementById("exsel").onchange = (ev) => { prog.ex = ev.target.value; progress(); };
    document.getElementById("e1").onchange = (ev) => { prog.e1rm = ev.target.checked; progress(); };
    view.querySelectorAll(".chips button").forEach((b) => (b.onclick = () => { prog.range = b.dataset.r; progress(); }));
  }

  const routes = {
    home,
    history,
    progress,
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
