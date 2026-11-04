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
      return `${typeHead(w.exercises, i)}<div class="row"><span>${e.name}</span><span class="detail">${e.sets}×${reps} ${Units.show(e.weight)}${Units.label}</span></div>`;
    }).join("");
  }

  function home() {
    const d = Store.data;
    const next = Store.workoutAt(0);
    const upcoming = [1, 2, 3].map((i) => Store.workoutAt(i));
    const last = d.sessions[d.sessions.length - 1];
    const lastText = last ? `Last workout: ${new Date(last.date).toLocaleDateString()}` : "No workouts logged yet";

    const started = new Date(d.cycleStart).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    // Quiet nudge: only once there is something worth losing, and only after a month without a backup.
    const backupDays = Store.daysSinceBackup();
    const backupDue = d.sessions.length > 0 && (backupDays === null || backupDays >= 30);

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
      ${backupDue ? `<div class="remind"><span>${backupDays === null ? "You haven't backed up your data yet." : `Last backup was ${backupDays} days ago.`}</span><button class="link small" id="gobackup">Back up</button></div>` : ""}
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
        <span class="badge">${w.name}</span>
      </div>
      ${d.exercises.map((de, i) => {
        const e = w.exercises[i];
        const range = e.repMin === e.repMax ? e.repMax : `${e.repMin}-${e.repMax}`;
        return `${typeHead(w.exercises, i)}
        <div class="ex ${de.skipped ? "skipped" : ""}">
          <div class="head">
            <strong>${de.name}</strong>
            <span class="target">${e.sets}×${range} @ <input class="wt" type="number" inputmode="decimal" step="0.5" min="0" data-i="${i}" value="${Units.show(de.weight)}" ${de.skipped ? "disabled" : ""}>${Units.label}</span>
          </div>
          <div class="aim">Aim: <strong>${aimText(aims[i])}</strong></div>
          <label class="skip"><input type="checkbox" class="skipcb" data-i="${i}" ${de.skipped ? "checked" : ""}> Skip this exercise</label>
          <div class="sets">
            ${de.reps.map((r, s) => {
              const done = r !== null;
              const full = done && r >= aims[i][s]; // solid red = met or beat the aim; light red = fell short
              const cls = done ? (full ? "full" : "part") : showErrors && !de.skipped ? "err" : "";
              return `<button class="set ${cls}" data-i="${i}" data-s="${s}" ${de.skipped ? "disabled" : ""}>${done ? r : aims[i][s]}</button>`;
            }).join("")}
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
      const b = ev.target.closest(".set");
      if (!b) return;
      const i = +b.dataset.i, s = +b.dataset.s;
      const e = w.exercises[i];
      const cur = d.exercises[i].reps[s];
      d.exercises[i].reps[s] = Progression.nextRep(cur, aims[i][s], e.repMax, e.step || 1);
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
        ev.target.value = Units.show(d.exercises[+ev.target.dataset.i].weight);
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
            <span class="detail">${e.skipped ? "Skipped" : `${Units.show(e.weight)}${Units.label} × ${e.reps.map((r) => (r === null ? "–" : r)).join(", ")}`}</span></div>`).join("")}
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
    const series = [{ label: "Weight", color: "#f08a1c", points: inRange.map((r) => ({ t: r.t, v: +Units.toDisplay(r.e.weight).toFixed(1) })) }];
    if (prog.e1rm) series.push({ label: "e1RM", color: "#e10613", points: inRange.filter((r) => e1rmOf(r.e) > 0).map((r) => ({ t: r.t, v: +Units.toDisplay(e1rmOf(r.e)).toFixed(1) })) });

    const latest = rows[rows.length - 1];
    view.innerHTML = `
      <h1>Progress</h1>
      <select id="exsel">${names.map((n) => `<option ${n === prog.ex ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
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
          <label>Date<input type="date" id="bwdate" value="${bw.date}"></label>
          <label>Weight (${Units.label})<input type="number" id="bwval" inputmode="decimal" step="0.1" min="0" placeholder="0.0" value="${esc(bw.val)}"></label>
        </div>
        <button class="btn" id="bwadd">Save weight</button>
        ${bw.err ? `<p class="errmsg">${esc(bw.err)}</p>` : ""}
      </div>
      <div class="chips">${Object.keys(RANGES).map((r) => `<button data-b="${r}" class="${r === bw.range ? "on" : ""}">${r}</button>`).join("")}</div>
      <div class="big">${latest ? Units.show(latest.kg) + Units.label : "–"}</div>
      <div class="sub">${latest ? `Last: ${fmtDate(latest.date)}${delta}` : "No body weight logged yet"}</div>
      <div class="card" style="padding:12px">${Chart.line([{ label: "Body weight", color: "#2f7de1", points: pts }])}</div>
      ${all.length ? `<div class="card">${all.slice().reverse().slice(0, 10).map((b) => `
        <div class="row"><span>${fmtDate(b.date)}</span>
        <span class="detail">${Units.show(b.kg)}${Units.label} <button class="link small bwdel" data-d="${b.date}" aria-label="Delete entry">✕</button></span></div>`).join("")}
        ${all.length > 10 ? `<div class="sub" style="padding:8px 0">Showing latest 10 of ${all.length}</div>` : ""}</div>` : ""}`;
  }

  function bodyweightBind() {
    document.getElementById("bwdate").oninput = (ev) => { bw.date = ev.target.value; };
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
      ${backupMsg ? `<p class="${backupMsg.ok ? "okmsg" : "errmsg"}">${esc(backupMsg.text)}</p>` : ""}`;
    backupMsg = null; // shown once

    view.querySelectorAll(".seg button").forEach((b) => (b.onclick = () => { Store.setUnit(b.dataset.u); settings(); }));
    document.getElementById("export").onclick = exportBackup;
    document.getElementById("import").onclick = () => document.getElementById("importfile").click();
    document.getElementById("importfile").onchange = importBackup;
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

    const res = Store.parseBackup(await file.text());
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
