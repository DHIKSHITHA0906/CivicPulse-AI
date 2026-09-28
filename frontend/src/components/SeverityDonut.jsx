import { severityColor } from "./mapSeverity";

// Donut chart of the current requests' severity distribution. Purely a
// visualization of data the Dashboard already has in state (CitizenRequest.severity,
// Master Reference Section 2.1) — no new fetch, no new field. Colors come
// from the same ramp the map markers use so the two always agree.
const BUCKETS = [
  { key: "critical", label: "Critical", color: severityColor(5), test: (s) => s >= 5 },
  { key: "high", label: "High", color: severityColor(4), test: (s) => s === 4 },
  { key: "medium", label: "Medium", color: severityColor(3), test: (s) => s === 3 },
  { key: "low", label: "Low", color: severityColor(1), test: (s) => s <= 2 },
];

const SIZE = 132;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const GAP = 3;

export default function SeverityDonut({ requests = [] }) {
  const counts = BUCKETS.map((b) => requests.filter((r) => b.test(r.severity)).length);
  const total = counts.reduce((a, b) => a + b, 0);
  const visible = counts.filter((c) => c > 0).length;

  let offsetAccum = 0;
  const segments = BUCKETS.map((bucket, i) => {
    const count = counts[i];
    const fraction = total ? count / total : 0;
    const full = fraction * CIRCUMFERENCE;
    const length = visible > 1 ? Math.max(0, full - GAP) : full;
    const segment = {
      ...bucket,
      count,
      fraction,
      dasharray: `${length} ${CIRCUMFERENCE - length}`,
      dashoffset: -offsetAccum,
    };
    offsetAccum += full;
    return segment;
  });

  return (
    <section className="panel" aria-labelledby="severity-heading">
      <header className="panel__header">
        <div>
          <h2 id="severity-heading" className="panel__title">
            Severity mix
          </h2>
          <p className="panel__hint">How serious the current reports are.</p>
        </div>
      </header>

      {!total ? (
        <p className="muted panel__empty">No reports to summarize for these filters.</p>
      ) : (
        <div className="severity-donut">
          <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={`${total} reports by severity`}>
            <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} fill="none" stroke="var(--line)" strokeWidth={STROKE} />
            {segments
              .filter((s) => s.count > 0)
              .map((s) => (
                <circle
                  key={s.key}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={STROKE}
                  strokeDasharray={s.dasharray}
                  strokeDashoffset={s.dashoffset}
                  transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
                  style={{ transition: "stroke-dasharray 480ms cubic-bezier(0.16,1,0.3,1)" }}
                />
              ))}
            <text x="50%" y="50%" textAnchor="middle" className="severity-donut__total-value">
              {total}
            </text>
            <text x="50%" y="50%" dy="1.55em" textAnchor="middle" className="severity-donut__total-label">
              reports
            </text>
          </svg>

          <ul className="severity-donut__legend">
            {segments.map((s) => (
              <li key={s.key}>
                <span className="map-legend__dot" style={{ background: s.color }} />
                <span className="severity-donut__legend-label">{s.label}</span>
                <span className="severity-donut__legend-count">{s.count}</span>
                <span className="severity-donut__legend-pct">{total ? Math.round(s.fraction * 100) : 0}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
