import { Sparkles, TrendingUp, Rocket, Eye, ArrowLeftRight, FlagOff, ChevronDown } from "lucide-react";
import ConfidenceGauge from "./ConfidenceGauge";
import { CATEGORY_LABEL, RECOMMENDATION_LABEL, severityTone } from "./labels";

// frontend/src/components/PriorityPanel.jsx — reads priority_score,
// confidence, explanation_text, recommendation_type, reason_text directly
// from /api/priority/{district_id}'s merged response (Master Reference
// Section 5.2 / 6.2). No client-side renaming or reshaping of these fields.
// `requests` is optional and only used to show how many reports on the map
// back the selected category (data the dashboard already fetched).

const RECOMMENDATION_ICON = {
  NEW_INTERVENTION: Sparkles,
  ACCELERATE: Rocket,
  REVIEW_EXPAND: TrendingUp,
  MONITOR: Eye,
  CONSIDER_REDIRECT: ArrowLeftRight,
  NO_ACTION_FLAGGED: FlagOff,
};

const RECOMMENDATION_TONE = {
  NEW_INTERVENTION: "critical",
  ACCELERATE: "high",
  REVIEW_EXPAND: "high",
  MONITOR: "medium",
  CONSIDER_REDIRECT: "medium",
  NO_ACTION_FLAGGED: "muted",
};

function scoreTone(priority_score) {
  // priority_score is a 0.0–1.0 float (Section 2.4) — bucketed here purely
  // for color, never rewritten or sent anywhere.
  if (priority_score >= 0.66) return "critical";
  if (priority_score >= 0.4) return "high";
  return "low";
}

function BriefRow({ item, requests }) {
  const Icon = RECOMMENDATION_ICON[item.recommendation_type] ?? Sparkles;
  const tone = RECOMMENDATION_TONE[item.recommendation_type] ?? "muted";
  const related = (requests ?? []).filter((r) => r.category === item.category);
  const avgSeverity = related.length ? related.reduce((s, r) => s + (r.severity ?? 0), 0) / related.length : null;

  return (
    <div className="brief fade-in">
      <div className="brief__figures">
        <div className="brief__figure">
          <span className="brief__value">{item.priority_score.toFixed(2)}</span>
          <span className="brief__caption">Priority score</span>
        </div>
        <div className="brief__figure brief__figure--gauge">
          <ConfidenceGauge value={item.confidence} label="Confidence" size={52} />
          <span className="brief__caption">Confidence</span>
        </div>
        {related.length > 0 && (
          <div className="brief__figure">
            <span className="brief__value brief__value--small">{related.length}</span>
            <span className="brief__caption">
              {related.length === 1 ? "report" : "reports"} on the map
              {avgSeverity != null && `, avg. severity ${avgSeverity.toFixed(1)}`}
            </span>
          </div>
        )}
      </div>

      <p className="brief__text">{item.explanation_text}</p>

      <div className={`recommendation-badge recommendation-badge--${tone}`}>
        <Icon size={14} strokeWidth={2.3} />
        {RECOMMENDATION_LABEL[item.recommendation_type] ?? item.recommendation_type}
      </div>

      <div className="brief__reason">
        <span className="brief__reason-label">Why</span>
        <p>{item.reason_text}</p>
      </div>
    </div>
  );
}

// hoverCategory / onHoverCategory are optional: they only drive the two-way
// highlight between a ranking row and its markers on the map.
export default function PriorityPanel({ priorities, selectedCategory, onSelect, requests, hoverCategory = null, onHoverCategory }) {
  const items = priorities ?? [];

  return (
    <section className="panel priority-panel" aria-labelledby="priority-heading">
      <header className="panel__header">
        <div>
          <h2 id="priority-heading" className="panel__title">
            Priority ranking
          </h2>
          <p className="panel__hint">Ranked by need. Select a category to read the brief and spotlight its reports on the map.</p>
        </div>
      </header>

      {!items.length && <p className="muted priority-panel__empty">No priority scores are available for this district yet.</p>}

      <ol className="priority-list">
        {items.map((item, idx) => {
          const tone = scoreTone(item.priority_score);
          const active = item.category === selectedCategory;
          const linked = !active && item.category === hoverCategory;
          const recTone = RECOMMENDATION_TONE[item.recommendation_type] ?? "muted";
          return (
            <li key={item.category} className={`priority-item${active ? " priority-item--active" : ""}${linked ? " priority-item--linked" : ""}`}>
              <button
                type="button"
                className={`priority-row${active ? " priority-row--active" : ""}`}
                onClick={() => onSelect(active ? null : item.category)}
                onMouseEnter={() => onHoverCategory?.(item.category)}
                onMouseLeave={() => onHoverCategory?.(null)}
                onFocus={() => onHoverCategory?.(item.category)}
                onBlur={() => onHoverCategory?.(null)}
                aria-expanded={active}
              >
                <span className="priority-row__rank">{idx + 1}</span>
                <span className="priority-row__main">
                  <span className="priority-row__top">
                    <span className="priority-row__label">{CATEGORY_LABEL[item.category] ?? item.category}</span>
                    <span className={`priority-row__score priority-row__score--${tone}`}>{item.priority_score.toFixed(2)}</span>
                  </span>
                  <span className="priority-row__bar-track">
                    <span
                      className={`priority-row__bar-fill priority-row__bar-fill--${tone}`}
                      style={{ width: `${item.priority_score * 100}%` }}
                    />
                  </span>
                  <span className="priority-row__meta">
                    <span className={`priority-row__rec priority-row__rec--${recTone}`}>
                      {RECOMMENDATION_LABEL[item.recommendation_type] ?? item.recommendation_type}
                    </span>
                    <span className="priority-row__confidence">{Math.round(item.confidence * 100)}% confidence</span>
                  </span>
                </span>
                <ChevronDown size={15} strokeWidth={2.2} className="priority-row__chevron" aria-hidden="true" />
              </button>
              {active && <BriefRow item={item} requests={requests} />}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
