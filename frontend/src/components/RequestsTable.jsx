import { SearchX } from "lucide-react";
import { SkeletonTableRow } from "./Skeleton";
import SeverityMeter from "./SeverityMeter";
import { CATEGORY_LABEL, humanize, timeAgo } from "./labels";

// Surfaces the raw per-request fields (sub_category, confidence,
// needs_review, timestamp) that the map/priority panel don't show —
// same `requests` array Dashboard already fetched via getRequests().
// Most severe first, so the top of the table always matches the map's halos.
export default function RequestsTable({ requests, loading, onSelectRequest }) {
  const all = requests ?? [];
  const rows = [...all]
    .sort((a, b) => (b.severity ?? 0) - (a.severity ?? 0) || new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 8);

  return (
    <section className="panel panel--table" aria-labelledby="requests-heading">
      <header className="panel__header">
        <div>
          <h2 id="requests-heading" className="panel__title">
            Reports needing attention
          </h2>
          <p className="panel__hint">Most severe first. Select a row for the full record.</p>
        </div>
        {!loading && all.length > 0 && (
          <span className="panel__count">
            Top {rows.length} of {all.length}
          </span>
        )}
      </header>

      {!loading && rows.length === 0 && (
        <div className="state-block">
          <SearchX size={22} strokeWidth={1.7} />
          <p className="state-block__title">No reports for these filters</p>
          <p className="muted">Try a different category or district.</p>
        </div>
      )}

      {(loading || rows.length > 0) && (
        <div className="requests-table__scroll">
          <table className="requests-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col">Issue</th>
                <th scope="col">Severity</th>
                <th scope="col">Confidence</th>
                <th scope="col">Reported</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 5 }).map((_, i) => <SkeletonTableRow key={i} />)
                : rows.map((r) => (
                    <tr
                      key={r.request_id}
                      className="requests-table__row"
                      onClick={() => onSelectRequest(r)}
                      tabIndex={0}
                      role="button"
                      aria-label={`${CATEGORY_LABEL[r.category] ?? r.category}, ${humanize(r.sub_category)}, open details`}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelectRequest(r))}
                    >
                      <td className="requests-table__cat">{CATEGORY_LABEL[r.category] ?? r.category}</td>
                      <td className="requests-table__sub">{humanize(r.sub_category)}</td>
                      <td>
                        <SeverityMeter severity={r.severity} showLabel={false} compact />
                        <span className="requests-table__sev-num">{r.severity}/5</span>
                      </td>
                      <td>
                        <span className="conf-bar" aria-hidden="true">
                          <span className="conf-bar__fill" style={{ width: `${Math.round((r.confidence ?? 0) * 100)}%` }} />
                        </span>
                        <span className="requests-table__conf-num">{Math.round((r.confidence ?? 0) * 100)}%</span>
                      </td>
                      <td className="requests-table__time">
                        {timeAgo(r.timestamp)}
                        {r.needs_review && <span className="review-tag">Review</span>}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
