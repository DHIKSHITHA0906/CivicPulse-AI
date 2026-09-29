import { CATEGORY_LABEL, RECOMMENDATION_LABEL, severityLabel } from "./labels";
import { severityColor } from "./mapSeverity";

// Compact district situation overview. Everything shown is derived from the
// `requests` and `priorities` arrays Dashboard.jsx already fetched — no new
// calls, no new fields.
const BUCKETS = [
  { key: "critical", label: "Critical", severity: 5, test: (s) => s >= 5 },
  { key: "high", label: "High", severity: 4, test: (s) => s === 4 },
  { key: "medium", label: "Medium", severity: 3, test: (s) => s === 3 },
  { key: "low", label: "Low", severity: 1, test: (s) => s <= 2 },
];

export default function SituationOverview({ requests = [], priorities = [], loading = false, focusCategory = null, onSelectCategory }) {
  const total = requests.length;
  const counts = BUCKETS.map((b) => requests.filter((r) => b.test(r.severity)).length);
  const avgSeverity = total ? requests.reduce((s, r) => s + (r.severity ?? 0), 0) / total : 0;
  const avgRounded = Math.round(avgSeverity);

  const byCategory = new Map();
  for (const r of requests) byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const maxCat = categoryRows[0]?.[1] ?? 1;

  const lead = priorities[0];

  if (loading) {
    return (
      <section className="situation reveal" aria-busy="true" aria-label="District situation">
        <div className="situation__cell">
          <span className="skeleton-block" style={{ width: "40%", height: 12 }} />
          <span className="skeleton-block" style={{ width: "100%", height: 10, marginTop: 14 }} />
        </div>
        <div className="situation__cell">
          <span className="skeleton-block" style={{ width: "40%", height: 12 }} />
          <span className="skeleton-block" style={{ width: "100%", height: 10, marginTop: 14 }} />
        </div>
        <div className="situation__cell">
          <span className="skeleton-block" style={{ width: "40%", height: 12 }} />
          <span className="skeleton-block" style={{ width: "100%", height: 10, marginTop: 14 }} />
        </div>
      </section>
    );
  }

  return (
    <section className="situation reveal" aria-label="District situation">
      <div className="situation__cell">
        <h2 className="situation__title">Severity profile</h2>
        {total ? (
          <>
            <div className="situation__stack" role="img" aria-label={BUCKETS.map((b, i) => `${counts[i]} ${b.label.toLowerCase()}`).join(", ")}>
              {BUCKETS.slice()
                .reverse()
                .map((b) => {
                  const c = counts[BUCKETS.indexOf(b)];
                  return c ? <span key={b.key} style={{ flexGrow: c, background: severityColor(b.severity) }} title={`${b.label}: ${c}`} /> : null;
                })}
            </div>
            <p className="situation__line">
              Average severity <strong>{avgSeverity.toFixed(1)}</strong> of 5
              <span className="situation__chip" style={{ "--chip": severityColor(avgRounded) }}>
                {severityLabel(avgRounded)}
              </span>
            </p>
          </>
        ) : (
          <p className="muted">No reports for these filters.</p>
        )}
      </div>

      <div className="situation__cell">
        <h2 className="situation__title">Where reports cluster</h2>
        {categoryRows.length ? (
          <ul className="situation__bars">
            {categoryRows.map(([cat, n]) => (
              <li key={cat}>
                <button
                  type="button"
                  className={`situation__bar${focusCategory === cat ? " situation__bar--active" : ""}`}
                  onClick={() => onSelectCategory?.(focusCategory === cat ? null : cat)}
                  aria-pressed={focusCategory === cat}
                >
                  <span className="situation__bar-label">{CATEGORY_LABEL[cat] ?? cat}</span>
                  <span className="situation__bar-track">
                    <span style={{ width: `${(n / maxCat) * 100}%` }} />
                  </span>
                  <span className="situation__bar-count">{n}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">Nothing reported yet.</p>
        )}
      </div>

      <div className="situation__cell">
        <h2 className="situation__title">Recommended focus</h2>
        {lead ? (
          <>
            <p className="situation__focus">{CATEGORY_LABEL[lead.category] ?? lead.category}</p>
            <p className="situation__line">
              {RECOMMENDATION_LABEL[lead.recommendation_type] ?? lead.recommendation_type}
              <span className="situation__dim"> · score {lead.priority_score.toFixed(2)}</span>
            </p>
            <p className="situation__reason">{lead.reason_text}</p>
          </>
        ) : (
          <p className="muted">No priority scores yet.</p>
        )}
      </div>
    </section>
  );
}
