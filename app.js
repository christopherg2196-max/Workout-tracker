// Views + tiny tab router: Home, session tracker, History (calendar), Progress (+ body weight), Settings.
// Weights are stored in kg; always display through Units.show / Units.label.
(function () {
  const view = document.getElementById("view");
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  // Small heading shown whenever the exercise type changes (core lifts come first in the program).
  const typeLabel = (e) => (e.type === "assistance" ? "Assistance" : "Core");
  const typeHead = (list, i) => (i === 0 || typeLabel(list[i - 1]) !== typeLabel(list[i])
    ? `<div class="grp">${typeLabel(list[i])}</div>` : "");

  function exerciseRows(w) {
    return w.exercises.map((e, i) => {
      const reps = e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`;
      return `${typeHead(w.exercises, i)}<div class="row"><span>${esc(e.name)}</span><span class="detail">${e.sets}×${reps} ${Units.show(e.weight)}${Units.label}</span></div>`;
    }).join("");
  }

  function home() {
    const d = Store.data;
    const next = Store.workoutAt(0);
    const upcoming = [1, 2, 3].map((i) => Store.workoutAt(i));
    const last = d.sessions[d.sessions.length - 1];
    const lastText = last ? `Last workout: ${new Date(last.date).toLocaleDateString()}` : "No workouts logged yet";
    const warn = Store.takeWarning();

    const started = new Date(d.cycleStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    // Quiet nudge: only once there is something worth losing, and only after a month without a backup.
    const backupDays = Store.daysSinceBackup();
    const since = Store.sessionsSinceBackup();
    // Nudge after 14 days, or 5 workouts, without a backup (only once there is something worth losing).
    const backupDue = d.sessions.length > 0 && (backupDays === null || backupDays >= 14 || since >= 5);
    const backupText = backupDays === null ? "You haven't backed up your data yet." : since >= 5 ? `${since} workouts since your last backup.` : `Last backup was ${backupDays} days ago.`;

    view.innerHTML = `
      <div class="sub">Program</div>
      <div class="sub" style="color:var(--text);font-weight:600">Upper / Lower · 4 days</div>
      <div class="cycle">
        <span><strong>Week ${Store.cycleWeek()}</strong> of this cycle <span class="sub">· since ${started}</span></span>
        <button class="link small" id="restart">Restart</button>
      </div>
      <div class="head"><h1>Next Workout</h1>
        <select class="badge pick" id="pick" aria-label="Choose next workout" ${d.draft ? "disabled" : ""}>
          ${d.program.map((w, i) => `<option value="${i}" ${i === d.rotation ? "selected" : ""}>${esc(w.name)}</option>`).join("")}
        </select>
      </div>
      ${warn ? `<p class="errmsg">${esc(warn)}</p>` : ""}
      <div class="sub">${lastText}</div>
      <div class="card">${exerciseRows(next)}</div>
      <button class="btn" id="start">${d.draft ? "Resume Workout" : "Start Workout"}</button>
      <button class="btn secondary" id="deload">Deload (70% of all weights)</button>
      ${backupDue ? `<div class="remind"><span>${backupText}</span><button class="link small" id="gobackup">Back up</button></div>` : ""}
      <div class="upcoming">
        <h2>Upcoming Workouts</h2>
        ${upcoming.map((w) => `
          <div class="head when"><span>${esc(w.name)}</span></div>
          <div class="card">${exerciseRows(w)}</div>`).join("")}
      </div>`;
    document.getElementById("start").onclick = () => {
      if (!Store.data.draft) Store.startDraft();
      session();
    };
    document.getElementById("pick").onchange = (ev) => { Store.setNext(+ev.target.value); home(); };
    const gb = document.getElementById("gobackup");
    if (gb) gb.onclick = () => go("settings");
    document.getElementById("restart").onclick = () => {
      if (confirm("Restart the cycle counter at week 1, starting today?")) { Store.restartCycle(); home(); }
    };
    document.getElementById("deload").onclick = () => {
      if (Store.data.draft) return alert("Finish or discard your current workout before deloading.");
      const e = next.exercises[0];
      const after = Units.roundKg(e.weight * 0.7);
      if (!confirm(`Drop every exercise to 70% of its current weight?\n\nExample: ${e.name} ${Units.show(e.weight)}${Units.label} → ${Units.show(after)}${Units.label}.\nThis can't be undone.`)) return;
      Store.deload(0.7);
      home();
    };
  }

  // ---- In-session tracker ----
  // Tap an empty circle: logs the aim for that set (see Progression.aim). Further taps step through
  // Progression.repCycle: up to the top of the rep range, then down to 0 (failed), then empty.
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
    // Reps to aim for per set. Based on the program weight (not the weight box), so the aims stay
    // put while you edit a weight or tap circles.
    const aims = d.exercises.map((de, i) => Progression.aim(w.exercises[i], w.exercises[i].weight, Store.lastLogged(de.name)));
    const aimText = (a) => (a.every((v) => v === a[0]) ? `${a[0]} reps per set` : `${a.join(", ")} reps`);

    view.innerHTML = `
      <div class="head">
        <button class="link" id="cancel">&#8249; Back</button>
        <span class="badge">${esc(w.name)}</span>
      </div>
      ${d.exercises.map((de, i) => {
        const e = w.exercises[i];
        const range = e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`;
        return `${typeHead(w.exercises, i)}
        <div class="ex ${de.skipped ? "skipped" : ""}">
          <div class="head">
            <strong>${esc(de.name)}</strong>
            <span class="target">${e.sets}×${range} @ <input class="wt" type="number" inputmode="decimal" step="${Units.unit === "lb" ? 5 : 0.5}" min="0" data-i="${i}" value="${Units.show(de.weight)}" ${de.skipped ? "disabled" : ""}>${Units.label}</span>
          </div>
          <div class="aim">Aim: <strong>${aimText(aims[i])}</strong>${e.bar ? ` <button class="link small plates-btn" data-i="${i}">Plates</button>` : ""}</div>
          <label class="skip"><input type="checkbox" class="skipcb" data-i="${i}" ${de.skipped ? "checked" : ""}> Skip this exercise</label>
          <div class="setsrow">
          <div class="sets">
            ${de.reps.map((r, s) => {
              const done = r !== null;
              const full = done && r >= aims[i][s]; // solid red = met or beat the aim; light red = fell short
              const cls = done ? (full ? "full" : "part") : showErrors && !de.skipped ? "err" : "";
              return `<button class="set ${cls}" data-i="${i}" data-s="${s}" ${de.skipped ? "disabled" : ""}>${done ? r : aims[i][s]}</button>`;
            }).join("")}
          </div>
          <label class="donecb" title="Complete all sets at the aim"><input type="checkbox" class="donecb-in" data-i="${i}" aria-label="Complete all sets of ${esc(de.name)}" ${de.reps.every((r) => r !== null) ? "checked" : ""} ${de.skipped ? "disabled" : ""}></label>
          </div>
          <textarea class="note" data-i="${i}" rows="1" placeholder="Notes">${esc(de.note)}</textarea>
        </div>`;
      }).join("")}
      <button class="btn ${canFinish ? "" : "blocked"}" id="finish">Finish Workout</button>
      ${showErrors && !canFinish ? `<p class="errmsg">${hasWork
        ? "Tap every set, or tick Skip, before finishing. Keep tapping a circle to change its reps; a 0 counts as failed."
        : "You skipped every exercise. Log at least one to finish."}</p>` : ""}`;

    const save = () => Store.save();
    view.onclick = (ev) => {
      const pb = ev.target.closest(".plates-btn");
      if (pb) return plateDialog(d.exercises[+pb.dataset.i].name, d.exercises[+pb.dataset.i].weight);
      const b = ev.target.closest(".set");
      if (!b) return;
      const i = +b.dataset.i, s = +b.dataset.s;
      const e = w.exercises[i];
      const cur = d.exercises[i].reps[s];
      d.exercises[i].reps[s] = Progression.nextRep(cur, aims[i][s], e.repMax, e.step || 1);
      if (d.exercises[i].reps[s] !== null) startRest(e.type); // a logged set starts the rest timer
      save();
      const y = window.scrollY;
      session();
      window.scrollTo(0, y);
    };
    // Weight edits apply to this session and become the base for progression on finish.
    view.onchange = (ev) => {
      if (ev.target.classList.contains("donecb-in")) {
        // Tick: log the aim for every empty circle (circles you already tapped keep their value). Untick: clear them all.
        const i = +ev.target.dataset.i, de = d.exercises[i];
        de.reps = ev.target.checked ? de.reps.map((r, s) => (r === null ? aims[i][s] : r)) : de.reps.map(() => null);
        if (ev.target.checked) startRest(w.exercises[i].type);
        save();
        const y = window.scrollY;
        session();
        window.scrollTo(0, y);
      } else if (ev.target.classList.contains("skipcb")) {
        d.exercises[+ev.target.dataset.i].skipped = ev.target.checked;
        save();
        const y = window.scrollY;
        session();
        window.scrollTo(0, y);
      } else if (ev.target.classList.contains("wt")) {
        // Snap the box back to the stored value if the entry was empty/invalid.
        const di = +ev.target.dataset.i, typed = parseFloat(ev.target.value);
        if (!isNaN(typed) && typed >= 0) d.exercises[di].weight = Units.snapKg(Units.toKg(typed)); // lb: whole 5 lb
        ev.target.value = Units.show(d.exercises[di].weight);
        save();
      }
    };
    view.oninput = (ev) => {
      if (ev.target.classList.contains("wt")) {
        const v = parseFloat(ev.target.value);
        // The box shows the chosen unit; the draft is stored in kg.
        if (!isNaN(v) && v >= 0) { d.exercises[+ev.target.dataset.i].weight = Units.toKg(v); save(); }
      } else if (ev.target.classList.contains("note")) {
        d.exercises[+ev.target.dataset.i].note = ev.target.value;
        save();
      }
    };
    document.getElementById("cancel").onclick = () => showDialog({
      title: "Leave this workout?",
      html: `<p>Your sets are saved as you go, so you can pick the workout up again from Home. Or discard it completely.</p>`,
      buttons: [
        { label: "Leave, resume later", fn: leaveSession },
        { label: "Discard workout", cls: "danger-solid", fn: () => { Store.discardDraft(); leaveSession(); } },
        { label: "Stay", cls: "secondary" },
      ],
    });
    document.getElementById("finish").onclick = () => {
      if (!canFinish) {
        showErrors = true;
        session();
        const first = document.querySelector(".set.err");
        if (first) first.scrollIntoView({ block: "center" });
        return;
      }
      Store.finishDraft();
      const prs = computePRs().pop();
      leaveSession();
      if (prs && prs.length) {
        showDialog({
          title: "New personal best!",
          html: prs.map((h) => `<p><strong>${esc(h.name)}</strong><br><span class="sub">Estimated 1RM ${Units.showBody(h.e1rm)}${Units.label} (was ${Units.showBody(h.prev)}${Units.label})</span></p>`).join(""),
          buttons: [{ label: "Nice!" }],
        });
      }
    };
  }

  function leaveSession() {
    stopRest();
    document.body.classList.remove("in-session");
    showErrors = false;
    view.onclick = view.onchange = view.oninput = null;
    go("home");
  }

  // ---- Rest timer ----
  // The bar lives on <body> (not inside the re-rendered session view) so it keeps counting across taps.
  // Phones cannot buzz or notify from an installed web app while locked, so it beeps and flashes while the app is open.
  let rest = null; // { endsAt, over, hideAt }
  let restTimer = null;
  let audioCtx = null;
  function beep() {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === "suspended") audioCtx.resume();
      [0, 0.25].forEach((t) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain();
        o.frequency.value = 880; g.gain.value = 0.2;
        o.connect(g); g.connect(audioCtx.destination);
        o.start(audioCtx.currentTime + t); o.stop(audioCtx.currentTime + t + 0.18);
      });
    } catch (e) { /* no audio available: the bar still flashes */ }
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) { /* iOS has no vibration */ }
  }
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  function restBar() {
    let el = document.getElementById("restbar");
    if (!rest) { if (el) el.remove(); document.body.classList.remove("has-rest"); return; }
    if (!el) {
      el = document.createElement("div");
      el.id = "restbar";
      el.innerHTML = `<span id="resttext"></span><span class="restbtns"><button data-r="-15">&minus;15s</button><button data-r="15">+15s</button><button data-r="skip">Skip</button></span>`;
      el.onclick = (ev) => {
        const b = ev.target.closest("[data-r]");
        if (!b || !rest) return;
        if (b.dataset.r === "skip") return stopRest();
        rest.endsAt += +b.dataset.r * 1000;
        rest.over = false;
        tickRest();
      };
      document.body.appendChild(el);
    }
    document.body.classList.add("has-rest");
  }
  function tickRest() {
    if (!rest) return;
    const left = Math.ceil((rest.endsAt - Date.now()) / 1000);
    const el = document.getElementById("restbar"), txt = document.getElementById("resttext");
    if (left > 0) {
      rest.over = false;
      if (txt) txt.textContent = `Rest ${mmss(left)}`;
      if (el) el.classList.remove("over");
      return;
    }
    if (!rest.over) { rest.over = true; rest.hideAt = Date.now() + 20000; beep(); }
    if (txt) txt.textContent = "Rest over: go!";
    if (el) el.classList.add("over");
    if (Date.now() > rest.hideAt) stopRest();
  }
  // type = "core" | "assistance" picks the rest length from Settings.
  function startRest(type) {
    const s = Store.data.settings;
    if (!s.restOn) return;
    rest = { endsAt: Date.now() + (type === "assistance" ? s.restAssist : s.restCore) * 1000, over: false, hideAt: 0 };
    restBar();
    clearInterval(restTimer);
    restTimer = setInterval(tickRest, 250);
    tickRest();
    // Unlock audio from this tap so the beep is allowed later (iOS only allows sound after a tap).
    try { audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)(); audioCtx.resume(); } catch (e) { /* ignore */ }
  }
  function stopRest() { rest = null; clearInterval(restTimer); restTimer = null; restBar(); }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tickRest(); });

  // ---- Plate calculator ----
  const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25], lb: [45, 35, 25, 10, 5, 2.5] };
  // Plates for each side of the bar for a target total (all in the same unit). `short` = total weight that cannot be made.
  function platesFor(total, bar, unit) {
    let per = (total - bar) / 2;
    if (per < 0) return { under: true, plates: [], short: 0 };
    const plates = [];
    for (const p of PLATES[unit]) {
      const n = Math.floor((per + 1e-9) / p);
      if (n > 0) { plates.push([p, n]); per -= n * p; }
    }
    return { under: false, plates, short: Math.round(per * 2 * 100) / 100 };
  }
  function plateDialog(name, weightKg) {
    const unit = Units.unit, key = unit === "lb" ? "barLb" : "barKg";
    const box = showDialog({
      title: `Plates: ${name}`,
      html: `<div class="platein">
          <label>Weight (${unit})<input id="pcw" type="number" inputmode="decimal" step="any" value="${Units.show(weightKg)}"></label>
          <label>Empty bar (${unit})<input id="pcb" type="number" inputmode="decimal" step="any" value="${Store.data.settings[key]}"></label>
        </div><div id="pcout"></div>`,
      buttons: [{ label: "Close", cls: "secondary" }],
    });
    const out = box.querySelector("#pcout"), w = box.querySelector("#pcw"), b = box.querySelector("#pcb");
    const draw = () => {
      const total = parseFloat(w.value), bar = parseFloat(b.value);
      if (isNaN(total) || isNaN(bar)) { out.innerHTML = `<p class="sub">Enter a weight and the bar weight.</p>`; return; }
      const r = platesFor(total, bar, unit);
      out.innerHTML = r.under
        ? `<p>That is lighter than the bar (${bar}${unit}).</p>`
        : (r.plates.length
          ? `<p class="sub">On each side of the bar:</p><div class="plates">${r.plates.map(([p, n]) => `<span class="plate"><strong>${p}</strong> &times; ${n}</span>`).join("")}</div>`
          : `<p>Just the empty bar.</p>`) +
          (r.short > 0.01 ? `<p class="errmsg">Can't make exactly ${total}${unit} with these plates: ${r.short}${unit} short.</p>` : "");
    };
    w.oninput = b.oninput = draw;
    b.onchange = () => { const v = parseFloat(b.value); if (!isNaN(v)) Store.setSetting(key, v); }; // remembered for next time
    draw();
  }

  // ---- Personal records ----
  // A session is a PR for a lift if its best estimated 1RM beats every earlier session of that lift
  // (the very first time you do a lift is not a PR). Returns an array parallel to sessions: [{ name, e1rm, prev }].
  function computePRs() {
    const best = {};
    return Store.data.sessions.map((s) => {
      const hits = [];
      s.exercises.forEach((e) => {
        if (e.skipped || e.weight <= 0) return;
        const v = e1rmOf(e);
        if (v <= 0) return;
        if (best[e.name] !== undefined && v > best[e.name] + 1e-6) hits.push({ name: e.name, e1rm: v, prev: best[e.name] });
        best[e.name] = Math.max(best[e.name] || 0, v);
      });
      return hits;
    });
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
    const prs = computePRs(); // per session index; used for the PR badges
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
            <div class="row"><span>${esc(e.name)}${prs[Store.data.sessions.indexOf(s)].some((h) => h.name === e.name) ? ` <span class="pr">PR</span>` : ""}${e.note ? `<br><span class="sub">${esc(e.note)}</span>` : ""}</span>
            <span class="detail">${e.skipped ? "Skipped" : `${Units.show(e.weight)}${Units.label} × ${e.reps.map((r) => (r === null ? "–" : r)).join(", ")}`}</span></div>`).join("")}
          <div class="btnrow histbtns">
            <button class="btn secondary small" data-edit="${Store.data.sessions.indexOf(s)}">Edit</button>
            <button class="btn secondary small danger" data-del="${Store.data.sessions.indexOf(s)}">Delete</button>
          </div>
        </div>`).join("") : `<p class="sub">No workout logged this day.</p>`}`;

    const shift = (d) => { const dt = new Date(cal.y, cal.m + d, 1); cal.y = dt.getFullYear(); cal.m = dt.getMonth(); history(); };
    document.getElementById("prev").onclick = () => shift(-1);
    document.getElementById("next").onclick = () => shift(1);
    view.querySelectorAll("[data-edit]").forEach((b) => (b.onclick = () => sessionEditor(+b.dataset.edit)));
    view.querySelectorAll("[data-del]").forEach((b) => (b.onclick = () => deleteSessionDialog(+b.dataset.del)));
    view.querySelectorAll(".day[data-k]").forEach((b) => (b.onclick = () => { cal.sel = b.dataset.k; history(); }));
  }

  // ---- Edit a past session (History > Edit) ----
  // Works on a copy; nothing changes until Save. Only fixes the record: current program weights are not recalculated.
  let sesEdit = null; // { dirty() } while the editor is open, so tab changes can ask before throwing edits away
  function sessionEditor(idx) {
    const orig = Store.data.sessions[idx];
    if (!orig) return history();
    const names = Object.fromEntries(Store.data.program.map((p) => [p.id, p.name]));
    const work = JSON.parse(JSON.stringify(orig));
    const origDate = localDate(new Date(orig.date));
    let dateStr = origDate;
    let err = "";
    sesEdit = { dirty: () => JSON.stringify(work) !== JSON.stringify(orig) || dateStr !== origDate };

    const draw = () => {
      view.innerHTML = `
        <div class="head"><button class="link" id="seback">&#8249; History</button></div>
        <h1>Edit workout</h1>
        <p class="sub"><strong>${esc(names[work.workoutId] || work.workoutId)}</strong>. This only corrects the record; your current program weights are not recalculated.</p>
        <div class="bwrow"><label>Date<span class="datebox"><span class="dateshow" id="sedshow">${esc(bwDateText(dateStr))}</span><input type="date" id="seddate" value="${dateStr}"></span></label></div>
        ${work.exercises.map((e, i) => `
          <div class="ex edx">
            <div class="head"><strong>${esc(e.name)}</strong>
              <label class="skip"><input type="checkbox" class="sk" data-i="${i}" ${e.skipped ? "checked" : ""}> Skipped</label></div>
            ${e.skipped ? "" : `<div class="grid">
              <label class="f"><span>Weight (${Units.label})</span><input class="sw" data-i="${i}" inputmode="decimal" value="${Units.show(e.weight)}"></label>
              ${e.reps.map((r, s) => `<label class="f"><span>Set ${s + 1}</span><input class="sr" data-i="${i}" data-s="${s}" inputmode="numeric" value="${r === null ? "" : r}"></label>`).join("")}
            </div>`}
            <textarea class="note sn" data-i="${i}" rows="1" placeholder="Notes">${esc(e.note || "")}</textarea>
          </div>`).join("")}
        ${err ? `<p class="errmsg">${esc(err)}</p>` : ""}
        <button class="btn" id="sesave">Save changes</button>
        <button class="btn secondary danger" id="sedel">Delete this workout</button>`;

      document.getElementById("seback").onclick = back;
      document.getElementById("sedel").onclick = () => deleteSessionDialog(idx);
      document.getElementById("sesave").onclick = save;
      view.onchange = (ev) => {
        const t = ev.target, i = +t.dataset.i;
        if (t.classList.contains("sk")) { work.exercises[i].skipped = t.checked; err = ""; const y = window.scrollY; draw(); window.scrollTo(0, y); }
        else if (t.id === "seddate") { dateStr = t.value; document.getElementById("sedshow").textContent = bwDateText(dateStr); }
        else if (t.classList.contains("sw")) {
          const v = parseFloat(t.value);
          if (!isNaN(v) && v >= 0) work.exercises[i].weight = Units.snapKg(Units.toKg(v));
          t.value = Units.show(work.exercises[i].weight);
        } else if (t.classList.contains("sr")) {
          const s = +t.dataset.s, v = t.value.trim() === "" ? null : Number(t.value);
          if (v === null || (Number.isInteger(v) && v >= 0 && v <= 200)) work.exercises[i].reps[s] = v;
          else t.value = work.exercises[i].reps[s] === null ? "" : work.exercises[i].reps[s];
        }
      };
      view.oninput = (ev) => { if (ev.target.classList.contains("sn")) work.exercises[+ev.target.dataset.i].note = ev.target.value; };
    };

    const back = () => {
      const leave = () => { sesEdit = null; history(); };
      if (!sesEdit.dirty()) return leave();
      showDialog({
        title: "Discard changes?",
        html: `<p>You have unsaved edits to this workout. If you go back now, <strong>all of them will be discarded</strong>.</p>`,
        buttons: [{ label: "Discard changes and go back", cls: "danger-solid", fn: leave }, { label: "Keep editing", cls: "secondary" }],
      });
    };
    const save = () => {
      if (!dateStr) { err = "Pick a date."; return draw(); }
      if (work.exercises.some((e) => !e.skipped && e.reps.some((r) => r === null))) { err = "Fill in every set (use 0 for a failed set), or tick Skipped."; return draw(); }
      if (work.exercises.every((e) => e.skipped)) { err = "At least one exercise must be done. To remove the whole workout, delete it instead."; return draw(); }
      showDialog({
        title: "Save changes?",
        html: `<p>This updates the saved record of this workout.</p>`,
        buttons: [{
          label: "Yes, save changes",
          fn: () => {
            const t = new Date(orig.date), [y, m, d] = dateStr.split("-").map(Number);
            const iso = new Date(y, m - 1, d, t.getHours(), t.getMinutes(), t.getSeconds()).toISOString();
            Store.updateSession(idx, { date: iso, exercises: work.exercises });
            sesEdit = null;
            cal.y = y; cal.m = m - 1; cal.sel = `${y}-${m}-${d}`;
            history();
          },
        }, { label: "Keep editing", cls: "secondary" }],
      });
    };
    draw();
    window.scrollTo(0, 0);
  }

  function deleteSessionDialog(idx) {
    const s = Store.data.sessions[idx];
    if (!s) return;
    const name = (Store.data.program.find((p) => p.id === s.workoutId) || {}).name || s.workoutId;
    showDialog({
      title: "Delete this workout?",
      html: `<p><strong>${esc(name)}</strong> on ${esc(new Date(s.date).toLocaleDateString())} will be permanently removed from your history. <strong>This cannot be undone.</strong></p>`,
      buttons: [
        { label: "Delete workout", cls: "danger-solid", fn: () => { Store.deleteSession(idx); sesEdit = null; history(); } },
        { label: "Cancel", cls: "secondary" },
      ],
    });
  }

  // ---- Weekly summary (top of the Progress tab) ----
  // Weeks run Monday to Sunday. Volume = sum of weight x reps over finished sets.
  function weeklyCard() {
    const sessions = Store.data.sessions;
    if (!sessions.length) return "";
    const mondayOf = (dt) => { const x = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
    const weeks = [];
    const base = mondayOf(new Date());
    for (let i = 7; i >= 0; i--) { const s = new Date(base); s.setDate(s.getDate() - 7 * i); weeks.push({ start: s, key: s.getTime(), n: 0, vol: 0 }); }
    const byKey = Object.fromEntries(weeks.map((w) => [w.key, w]));
    sessions.forEach((s) => {
      const w = byKey[mondayOf(new Date(s.date)).getTime()];
      if (!w) return;
      w.n += 1;
      s.exercises.forEach((e) => { if (!e.skipped) e.reps.forEach((r) => { if (r > 0) w.vol += e.weight * r; }); });
    });
    const cur = weeks[weeks.length - 1], prev = weeks[weeks.length - 2];
    const fmt = (kg) => Math.round(Units.toDisplay(kg)).toLocaleString();
    const delta = prev.vol > 0 ? Math.round(((cur.vol - prev.vol) / prev.vol) * 100) : null;
    const max = Math.max(4, ...weeks.map((w) => w.n));
    return `
      <div class="card wk">
        <div class="head"><strong>This week</strong><span class="sub">Mon&ndash;Sun</span></div>
        <div class="wkstats">
          <div><span class="big2">${cur.n}</span><span class="sub">workout${cur.n === 1 ? "" : "s"}</span></div>
          <div><span class="big2">${fmt(cur.vol)}</span><span class="sub">${Units.label} lifted</span></div>
        </div>
        ${delta === null ? "" : `<div class="sub">${delta >= 0 ? "+" : ""}${delta}% volume vs last week (${fmt(prev.vol)} ${Units.label})</div>`}
        <div class="wkbars" aria-label="Workouts per week, last 8 weeks">
          ${weeks.map((w, i) => `<div class="wkbar ${i === weeks.length - 1 ? "now" : ""}"><span class="cnt">${w.n || ""}</span><div class="fill" style="height:${(w.n / max) * 100}%"></div><em>${w.start.toLocaleDateString(undefined, { day: "numeric", month: "short" })}</em></div>`).join("")}
        </div>
      </div>`;
  }

  // ---- Progress ----
  const RANGES = { "1M": 30, "3M": 91, "6M": 182, "1Y": 365, All: Infinity };
  const prog = { ex: null, range: "3M", e1rm: false };

  // Epley estimate from the best set of a session.
  const e1rmOf = (e) => Math.max(0, ...e.reps.filter((r) => r > 0).map((r) => e.weight * (1 + r / 30)));

  function progress() {
    const names = [...new Set(Store.data.program.flatMap((p) => p.exercises.map((e) => e.name)))];
    if (!names.includes(prog.ex)) prog.ex = names[0];
    const cutoff = RANGES[prog.range] === Infinity ? 0 : Date.now() - RANGES[prog.range] * 86400000;

    const rows = [];
    Store.data.sessions.forEach((s) => {
      const e = s.exercises.find((x) => x.name === prog.ex);
      if (e && e.reps.some((r) => r !== null)) rows.push({ t: new Date(s.date).getTime(), e });
    });
    const inRange = rows.filter((r) => r.t >= cutoff);
    const series = [{ label: "Weight", color: "#f08a1c", points: inRange.map((r) => ({ t: r.t, v: +Units.lift(r.e.weight).toFixed(1) })) }];
    if (prog.e1rm) series.push({ label: "e1RM", color: "#e10613", points: inRange.filter((r) => e1rmOf(r.e) > 0).map((r) => ({ t: r.t, v: +Units.toDisplay(e1rmOf(r.e)).toFixed(1) })) });

    const latest = rows[rows.length - 1];
    view.innerHTML = `
      <h1>Progress</h1>
      ${weeklyCard()}
      <select id="exsel">${names.map((n) => `<option value="${esc(n)}" ${n === prog.ex ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <div class="chips">${Object.keys(RANGES).map((r) => `<button data-r="${r}" class="${r === prog.range ? "on" : ""}">${r}</button>`).join("")}</div>
      <div class="big">${latest ? Units.show(latest.e.weight) + Units.label : "–"}</div>
      <div class="sub">${latest ? "Last: " + new Date(latest.t).toLocaleDateString() : "No sessions for this exercise yet"}</div>
      <div class="card" style="padding:12px">${Chart.line(series)}</div>
      <label class="tog"><span><i class="dot" style="background:#f08a1c"></i>Weight</span><span class="sub">always shown</span></label>
      <label class="tog"><span><i class="dot" style="background:#e10613"></i>e1RM</span><input type="checkbox" id="e1" ${prog.e1rm ? "checked" : ""}></label>
      ${bodyweightSection()}`;

    document.getElementById("exsel").onchange = (ev) => { prog.ex = ev.target.value; progress(); };
    document.getElementById("e1").onchange = (ev) => { prog.e1rm = ev.target.checked; progress(); };
    view.querySelectorAll(".chips button[data-r]").forEach((b) => (b.onclick = () => { prog.range = b.dataset.r; progress(); }));
    bodyweightBind();
  }

  // ---- Body weight tracker (lives under the lift chart on the Progress tab) ----
  const localDate = (dt = new Date()) =>
    `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  const dateMs = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d, 12).getTime(); };
  const bwDateText = (s) => (s ? new Date(dateMs(s)).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "Pick a date");
  const bw = { range: "3M", date: null, val: "", err: "" };

  function bodyweightSection() {
    if (!bw.date) bw.date = localDate();
    const all = Store.data.bodyweight;
    const cutoff = RANGES[bw.range] === Infinity ? 0 : Date.now() - RANGES[bw.range] * 86400000;
    const pts = all.filter((b) => dateMs(b.date) >= cutoff).map((b) => ({ t: dateMs(b.date), v: +Units.toDisplay(b.kg).toFixed(1) }));
    const latest = all[all.length - 1], prev = all[all.length - 2];
    let delta = "";
    if (latest && prev) {
      const dv = Units.toDisplay(latest.kg) - Units.toDisplay(prev.kg);
      delta = ` · ${dv > 0 ? "+" : dv < 0 ? "−" : ""}${Math.abs(dv).toFixed(1)}${Units.label} since previous entry`;
    }
    const fmtDate = (s) => new Date(dateMs(s)).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

    return `
      <h2>Body Weight</h2>
      <div class="card bwform">
        <div class="bwrow">
          <label>Date<span class="datebox"><span class="dateshow" id="bwshow">${esc(bwDateText(bw.date))}</span><input type="date" id="bwdate" value="${bw.date}"></span></label>
          <label>Weight (${Units.label})<input type="number" id="bwval" inputmode="decimal" step="0.1" min="0" placeholder="0.0" value="${esc(bw.val)}"></label>
        </div>
        <button class="btn" id="bwadd">Save weight</button>
        ${bw.err ? `<p class="errmsg">${esc(bw.err)}</p>` : ""}
      </div>
      <div class="chips">${Object.keys(RANGES).map((r) => `<button data-b="${r}" class="${r === bw.range ? "on" : ""}">${r}</button>`).join("")}</div>
      <div class="big">${latest ? Units.showBody(latest.kg) + Units.label : "–"}</div>
      <div class="sub">${latest ? `Last: ${fmtDate(latest.date)}${delta}` : "No body weight logged yet"}</div>
      <div class="card" style="padding:12px">${Chart.line([{ label: "Body weight", color: "#2f7de1", points: pts }])}</div>
      ${all.length ? `<div class="card">${all.slice().reverse().slice(0, 10).map((b) => `
        <div class="row"><span>${fmtDate(b.date)}</span>
        <span class="detail">${Units.showBody(b.kg)}${Units.label} <button class="link small bwdel" data-d="${b.date}" aria-label="Delete entry">✕</button></span></div>`).join("")}
        ${all.length > 10 ? `<div class="sub" style="padding:8px 0">Showing latest 10 of ${all.length}</div>` : ""}</div>` : ""}`;
  }

  function bodyweightBind() {
    // The visible text is our own span (vertically centred like the weight box); the real date input sits invisibly on top and opens the picker.
    document.getElementById("bwdate").onchange = document.getElementById("bwdate").oninput = (ev) => { bw.date = ev.target.value; document.getElementById("bwshow").textContent = bwDateText(bw.date); };
    document.getElementById("bwval").oninput = (ev) => { bw.val = ev.target.value; };
    document.getElementById("bwadd").onclick = () => {
      const v = parseFloat(bw.val);
      if (!bw.date) bw.err = "Pick a date.";
      else if (isNaN(v) || v <= 0 || v > 1000) bw.err = "Enter your weight as a positive number.";
      else {
        Store.addBodyweight(bw.date, Units.toKg(v));
        bw.val = "";
        bw.date = localDate(); // next entry defaults to today again
        bw.err = "";
      }
      progress();
    };
    view.querySelectorAll(".chips button[data-b]").forEach((b) => (b.onclick = () => { bw.range = b.dataset.b; progress(); }));
    view.querySelectorAll(".bwdel").forEach((b) => (b.onclick = () => {
      if (confirm("Delete this body weight entry?")) { Store.removeBodyweight(b.dataset.d); progress(); }
    }));
  }

  // ---- Settings ----
  function settings() {
    const u = Units.unit;
    view.innerHTML = `
      <h1>Settings</h1>
      <h2>Program</h2>
      <button class="btn secondary" id="editprog">Edit program</button>
      <p class="sub">Change exercises, sets, rep ranges, weights and order.</p>

      <h2>Rest timer</h2>
      <label class="skip"><input type="checkbox" id="reston" ${Store.data.settings.restOn ? "checked" : ""}> Start a rest timer when I log a set</label>
      <div class="bwrow resttimes">
        <label>Core lifts (seconds)<input type="number" id="restcore" inputmode="numeric" min="10" max="900" value="${Store.data.settings.restCore}"></label>
        <label>Assistance (seconds)<input type="number" id="restassist" inputmode="numeric" min="10" max="900" value="${Store.data.settings.restAssist}"></label>
      </div>
      <p class="sub">A bar at the bottom of the workout screen counts down, then beeps. Phones can't buzz or notify from an installed web app, so keep the screen on while you rest.</p>

      <h2>Units</h2>
      <div class="seg" role="group" aria-label="Weight units">
        <button data-u="kg" class="${u === "kg" ? "on" : ""}">kg</button>
        <button data-u="lb" class="${u === "lb" ? "on" : ""}">lb</button>
      </div>
      <p class="sub">Applies everywhere. Your logged data isn't changed, only how it's shown. In lb mode, weights go up in 5 or 10 lb steps.</p>

      <h2>Backup</h2>
      <p class="sub">Your data is stored only on this device. Export a copy to Files, iCloud, AirDrop or email, and import it to restore.</p>
      <p class="sub"><strong>${lastBackupText()}</strong></p>
      <div class="btnrow">
        <button class="btn secondary" id="export">Export backup</button>
        <button class="btn secondary" id="import">Import backup</button>
      </div>
      <input type="file" id="importfile" accept=".json,application/json" hidden>
      ${backupMsg ? `<p class="${backupMsg.ok ? "okmsg" : "errmsg"}">${esc(backupMsg.text)}</p>` : ""}

      <h2>Reset</h2>
      <p class="sub">Erase your logged workouts and body weight to start over, for example after testing.</p>
      <button class="btn secondary danger" id="reset">Reset app data</button>`;
    backupMsg = null; // shown once

    document.getElementById("reston").onchange = (ev) => Store.setSetting("restOn", ev.target.checked);
    for (const [id, key] of [["restcore", "restCore"], ["restassist", "restAssist"]]) {
      document.getElementById(id).onchange = (ev) => {
        const v = parseInt(ev.target.value, 10);
        if (v >= 10 && v <= 900) Store.setSetting(key, v);
        ev.target.value = Store.data.settings[key]; // snap back if invalid
      };
    }
    view.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { Store.setUnit(b.dataset.u); settings(); }));
    document.getElementById("editprog").onclick = () => { edDraft = null; edArmed = -1; editor(); };
    document.getElementById("export").onclick = exportBackup;
    document.getElementById("import").onclick = () => document.getElementById("importfile").click();
    document.getElementById("importfile").onchange = importBackup;
    document.getElementById("reset").onclick = resetDialog;
  }

  // ---- Popup dialog (in-app; the browser's own confirm() is blocked in some browsers) ----
  // buttons: [{ label, cls, fn }]. Tapping outside the box closes it without running anything.
  function showDialog({ title, html, buttons }) {
    const box = document.createElement("div");
    box.className = "modal";
    box.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlgtitle">
        <h2 id="dlgtitle">${esc(title)}</h2>
        ${html}
        ${buttons.map((b, i) => `<button class="btn ${b.cls || ""}" data-b="${i}">${esc(b.label)}</button>`).join("")}
      </div>`;
    document.body.appendChild(box);
    box.addEventListener("click", (ev) => {
      if (ev.target === box) return box.remove();
      const b = ev.target.closest("[data-b]");
      if (!b) return;
      box.remove();
      if (buttons[+b.dataset.b].fn) buttons[+b.dataset.b].fn();
    });
    return box;
  }

  // ---- Program editor (Settings > Edit program) ----
  // Edits go to edDraft, a private copy of the program. The real program changes only when you press
  // Save and confirm; leaving any other way (after a confirmation if you changed something) throws the copy away.
  let edDraft = null;
  let edWorkout = 0; // index of the workout being edited
  let edArmed = -1;  // exercise index whose Remove button is waiting for a second tap
  // Increment shown in the current unit.
  const incShow = (kg) => (kg <= 0 ? "0" : Units.showBody(Units.incKg(kg)));

  function editor() {
    const d = Store.data;
    const locked = !!d.draft;
    if (!locked && !edDraft) edDraft = Store.cloneProgram();
    const prog = edDraft || d.program; // while locked nothing is editable, so show the saved program
    if (edWorkout >= prog.length) edWorkout = 0;
    const w = prog[edWorkout];
    const dirty = !locked && Store.programChanged(prog);
    const field = (label, i, key, val, extra = "") =>
      `<label class="f"><span>${label}</span><input data-i="${i}" data-k="${key}" inputmode="decimal" value="${esc(val)}" ${extra}></label>`;
    view.innerHTML = `
      <div class="head"><button class="link" id="edback">&#8249; Settings</button></div>
      <h1>Edit program</h1>
      ${locked ? `<p class="errmsg">Finish or discard your current workout before editing the program. <button class="link small" id="eddiscard">${edArmed === -2 ? "Tap again to discard it" : "Discard it now"}</button></p>` : ""}
      <select class="badge pick" id="edw" aria-label="Workout to edit">
        ${prog.map((p, i) => `<option value="${i}" ${i === edWorkout ? "selected" : ""}>${esc(p.name)}</option>`).join("")}
      </select>
      <p class="sub">Nothing is saved until you press Save changes at the bottom. Renaming an exercise also renames it in your history. Weights are in ${Units.label}.</p>
      ${w.exercises.map((e, i) => `${typeHead(w.exercises, i)}
        <div class="ex edx">
          ${field("Name", i, "name", e.name, 'class="nm" inputmode="text"')}
          <div class="grid">
            <label class="f"><span>Type</span><select data-i="${i}" data-k="type"><option value="core" ${e.type !== "assistance" ? "selected" : ""}>Core</option><option value="assistance" ${e.type === "assistance" ? "selected" : ""}>Assistance</option></select></label>
            ${field("Sets", i, "sets", e.sets)}
            ${field("Min reps", i, "repMin", e.repMin)}
            ${field("Max reps", i, "repMax", e.repMax)}
            ${field("Weight", i, "weight", Units.show(e.weight))}
            ${field("Add when top hit", i, "inc", incShow(e.inc))}
            ${field("Reps per tap", i, "step", e.step || 1)}
            <label class="f"><span>Barbell</span><select data-i="${i}" data-k="bar"><option value="no" ${e.bar ? "" : "selected"}>No</option><option value="yes" ${e.bar ? "selected" : ""}>Yes (plates)</option></select></label>
          </div>
          <div class="btnrow">
            <button class="btn secondary small" data-act="up" data-i="${i}" aria-label="Move up">&#9650;</button>
            <button class="btn secondary small" data-act="down" data-i="${i}" aria-label="Move down">&#9660;</button>
            <button class="btn ${edArmed === i ? "" : "secondary"} small" data-act="del" data-i="${i}">${edArmed === i ? "Tap again to remove" : "Remove"}</button>
          </div>
        </div>`).join("")}
      <button class="btn secondary" id="edadd">Add exercise</button>
      <button class="btn" id="edsave" ${dirty ? "" : "disabled"}>${dirty ? "Save changes" : "No changes to save"}</button>`;

    document.getElementById("edback").onclick = () => leaveEditor(settings);
    document.getElementById("edw").onchange = (ev) => { edWorkout = +ev.target.value; edArmed = -1; editor(); };
    if (locked) {
      document.getElementById("eddiscard").onclick = () => { if (edArmed === -2) { edArmed = -1; Store.discardDraft(); } else edArmed = -2; editor(); };
      view.querySelectorAll("input, select:not(#edw), button.btn").forEach((el) => (el.disabled = true));
      return;
    }
    document.getElementById("edadd").onclick = () => { edArmed = -1; Store.addExercise(prog, edWorkout); editor(); window.scrollTo(0, document.body.scrollHeight); };
    document.getElementById("edsave").onclick = () => showDialog({
      title: "Save changes?",
      html: `<p>Your edits will replace the current program and apply from your next workout. Renamed exercises are also renamed in your history.</p>`,
      buttons: [
        { label: "Yes, save changes", fn: () => {
          if (Store.commitProgram(prog)) { edDraft = null; backupMsg = { ok: true, text: "Program saved." }; settings(); }
        } },
        { label: "Keep editing", cls: "secondary" },
      ],
    });

    view.onclick = (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      const i = +b.dataset.i;
      const act = b.dataset.act;
      if (act === "up") { edArmed = -1; Store.moveExercise(prog, edWorkout, i, -1); }
      else if (act === "down") { edArmed = -1; Store.moveExercise(prog, edWorkout, i, 1); }
      else if (w.exercises.length <= 1) { edArmed = -1; alert("A workout needs at least one exercise. Add another before removing this one."); }
      else if (edArmed === i) { edArmed = -1; Store.removeExercise(prog, edWorkout, i); } // second tap: past sessions stay in history
      else edArmed = i; // first tap: arm it
      const y = window.scrollY; editor(); window.scrollTo(0, y);
    };
    // Validate each field when you leave it; a bad value snaps back to what it was.
    view.onchange = (ev) => {
      const el = ev.target, k = el.dataset.k;
      if (!k) return;
      edArmed = -1;
      const i = +el.dataset.i, e = w.exercises[i];
      const v = k === "name" || k === "type" || k === "bar" ? el.value.trim() : parseFloat(el.value);
      let patch = null;
      if (k === "name") { if (v) patch = { name: v }; }
      else if (k === "bar") patch = { bar: v === "yes" };
      else if (k === "type") patch = { type: v === "assistance" ? "assistance" : "core" };
      else if (isNaN(v)) { /* snap back */ }
      else if (k === "sets") { if (Number.isInteger(v) && v >= 1 && v <= 10) patch = { sets: v }; }
      else if (k === "repMin") { if (Number.isInteger(v) && v >= 1 && v <= 200) patch = { repMin: v, repMax: Math.max(e.repMax, v) }; } // keeps min <= max
      else if (k === "repMax") { if (Number.isInteger(v) && v >= 1 && v <= 200) patch = { repMax: v, repMin: Math.min(e.repMin, v) }; }
      else if (k === "step") { if (Number.isInteger(v) && v >= 1 && v <= 10) patch = { step: v }; }
      else if (k === "weight") { if (v >= 0) patch = { weight: Math.round(Units.snapKg(Units.toKg(v)) * 10000) / 10000 }; }
      else if (k === "inc") { if (v >= 0) patch = { inc: Math.round(Units.toKg(v) * 10000) / 10000 }; }
      if (patch) Store.editExercise(prog, edWorkout, i, patch);
      const y = window.scrollY; editor(); window.scrollTo(0, y);
    };
  }

  // Runs `next` (e.g. back to Settings, another tab) and drops the editor copy. If there are unsaved
  // changes, asks first because leaving throws them away.
  function leaveEditor(next) {
    const proceed = () => { edDraft = null; edArmed = -1; next(); };
    if (edDraft && Store.programChanged(edDraft)) {
      showDialog({
        title: "Discard changes?",
        html: `<p>You have unsaved edits to your program. If you go back now, <strong>all of them will be discarded</strong>.</p>`,
        buttons: [
          { label: "Discard changes and go back", cls: "danger-solid", fn: proceed },
          { label: "Keep editing", cls: "secondary" },
        ],
      });
    } else proceed();
  }

  // In-app popup (more reliable than the browser's confirm(), which some browsers block).
  function resetDialog() {
    const n = Store.data.sessions.length, bwN = Store.data.bodyweight.length;
    const box = document.createElement("div");
    box.className = "modal";
    box.innerHTML = `
      <div class="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlgtitle">
        <h2 id="dlgtitle">Erase your data?</h2>
        <p>This permanently deletes <strong>${n} logged workout${n === 1 ? "" : "s"}</strong> and <strong>${bwN} body weight entr${bwN === 1 ? "y" : "ies"}</strong>, and any workout in progress. The cycle counter restarts at week 1.</p>
        <p><strong>This cannot be undone.</strong> Export a backup first if you might want this data again.</p>
        <button class="btn danger-solid" data-r="keep">Erase history, keep my program</button>
        <button class="btn danger-solid" data-r="all">Erase everything (default program)</button>
        <button class="btn secondary" data-r="backup">Export a backup first</button>
        <button class="btn secondary" data-r="cancel">Cancel</button>
      </div>`;
    document.body.appendChild(box);
    const close = () => box.remove();
    box.addEventListener("click", (ev) => {
      if (ev.target === box) return close(); // tap outside = cancel
      const r = ev.target.closest("[data-r]") && ev.target.closest("[data-r]").dataset.r;
      if (!r) return;
      close();
      if (r === "backup") return exportBackup();
      if (r === "keep" || r === "all") {
        Store.resetData(r === "keep");
        backupMsg = { ok: true, text: r === "keep" ? "History erased. Your program and weights were kept." : "All data erased. The default program was restored." };
        settings();
      }
    });
  }

  let backupMsg = null; // { ok, text } feedback shown under the Backup buttons
  const lastBackupText = () => {
    const days = Store.daysSinceBackup();
    return days === null ? "Last backup: never" : days === 0 ? "Last backup: today" : `Last backup: ${days} day${days === 1 ? "" : "s"} ago`;
  };

  function exportBackup() {
    const file = new File([JSON.stringify(Store.exportData(), null, 2)], `workout-backup-${localDate()}.json`, { type: "application/json" });
    const done = (text) => { Store.markBackup(); backupMsg = { ok: true, text }; settings(); };
    const download = () => {
      const url = URL.createObjectURL(file);
      const a = document.createElement("a");
      a.href = url; a.download = file.name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      done(`Backup downloaded as ${file.name}.`);
    };
    // Share sheet on iPhone (Save to Files / AirDrop / Mail); plain download elsewhere.
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: "Workout backup" })
        .then(() => done("Backup saved."))
        .catch((e) => { if (e && e.name !== "AbortError") download(); }); // AbortError = you closed the sheet
    } else {
      download();
    }
  }

  async function importBackup(ev) {
    const input = ev.target, file = input.files[0];
    input.value = ""; // lets the same file be picked again later
    if (!file) return;
    const fail = (text) => { backupMsg = { ok: false, text }; settings(); };
    if (file.size > 10 * 1024 * 1024) return fail("That file is too large to be a backup.");

    let text;
    try { text = await file.text(); } catch (e) { return fail("Couldn't read that file. Your data was not changed."); }
    const res = Store.parseBackup(text);
    if (res.error) return fail(`Not imported: ${res.error} Your data was not changed.`);

    const s = res.summary, day = (iso) => new Date(iso).toLocaleDateString();
    const msg = `Replace ALL data on this device with this backup?\n\n` +
      `${s.sessions} logged workout${s.sessions === 1 ? "" : "s"}, ${s.bodyweight} body weight entr${s.bodyweight === 1 ? "y" : "ies"}` +
      (s.lastSession ? `, last workout ${day(s.lastSession)}` : "") + `.\n` +
      (s.exportedAt ? `Backup made ${day(s.exportedAt)}.\n` : "") +
      `\nWhat's on this device now will be lost. This can't be undone.`;
    if (!confirm(msg)) return;

    Store.importData(res.data);
    backupMsg = { ok: true, text: `Backup restored: ${s.sessions} workout${s.sessions === 1 ? "" : "s"} and ${s.bodyweight} body weight entr${s.bodyweight === 1 ? "y" : "ies"}.` };
    settings();
  }

  const routes = {
    home,
    history,
    progress,
    settings,
  };

  function go(tab) {
    if (edDraft) { leaveEditor(() => go(tab)); return; } // leaving the program editor: confirm if there are unsaved edits
    if (sesEdit) { // leaving the past-session editor
      const leave = () => { sesEdit = null; go(tab); };
      if (!sesEdit.dirty()) return leave();
      showDialog({
        title: "Discard changes?",
        html: `<p>You have unsaved edits to a workout. If you leave now, <strong>all of them will be discarded</strong>.</p>`,
        buttons: [{ label: "Discard changes and leave", cls: "danger-solid", fn: leave }, { label: "Keep editing", cls: "secondary" }],
      });
      return;
    }
    document.querySelectorAll("#tabbar button").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    view.onclick = view.onchange = view.oninput = null; // drop handlers left by the session/editor views
    routes[tab]();
    window.scrollTo(0, 0);
  }

  document.getElementById("tabbar").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (b) go(b.dataset.tab);
  });

  go("home");
})();
