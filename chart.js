// Minimal SVG line chart. series: [{ label, color, points: [{ t: ms, v: number }] }]
(function () {
  const W = 340, H = 220, PL = 38, PR = 12, PT = 12, PB = 26;

  function niceStep(range, ticks) {
    const raw = range / ticks;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * mag;
  }

  function line(series) {
    const all = series.flatMap((s) => s.points);
    if (!all.length) return `<p class="placeholder" style="margin:40px 0">No data in this range yet</p>`;

    let tMin = Math.min(...all.map((p) => p.t)), tMax = Math.max(...all.map((p) => p.t));
    if (tMin === tMax) { tMin -= 86400000; tMax += 86400000; }
    let vMin = Math.min(...all.map((p) => p.v)), vMax = Math.max(...all.map((p) => p.v));
    if (vMin === vMax) { vMin -= 5; vMax += 5; }
    const step = niceStep(vMax - vMin, 4);
    const lo = Math.floor(vMin / step) * step, hi = Math.ceil(vMax / step) * step;

    const x = (t) => PL + ((t - tMin) / (tMax - tMin)) * (W - PL - PR);
    const y = (v) => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB);

    let grid = "";
    for (let v = lo; v <= hi + 1e-9; v += step) {
      grid += `<line x1="${PL}" x2="${W - PR}" y1="${y(v)}" y2="${y(v)}" class="gl"/>` +
              `<text x="${PL - 6}" y="${y(v) + 4}" text-anchor="end" class="gt">${+v.toFixed(1)}</text>`;
    }
    const d = (t) => new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const xl = `<text x="${PL}" y="${H - 6}" class="gt">${d(tMin)}</text>` +
               `<text x="${W - PR}" y="${H - 6}" text-anchor="end" class="gt">${d(tMax)}</text>`;

    const paths = series.map((s, i) => {
      const pts = s.points.map((p) => `${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`);
      const area = i === 0 && s.points.length > 1
        ? `<polygon points="${x(s.points[0].t)},${H - PB} ${pts.join(" ")} ${x(s.points[s.points.length - 1].t)},${H - PB}" fill="${s.color}" opacity=".12"/>`
        : "";
      return area +
        (s.points.length > 1 ? `<polyline points="${pts.join(" ")}" fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round"/>` : "") +
        s.points.map((p) => `<circle cx="${x(p.t).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" fill="${s.color}"/>`).join("");
    }).join("");

    return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img">${grid}${xl}${paths}</svg>`;
  }

  window.Chart = { line };
})();
