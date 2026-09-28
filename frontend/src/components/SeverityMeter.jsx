import { severityTone, severityLabel } from "./labels";

// Five-step meter for CitizenRequest.severity (integer 1–5). Presentation
// only — the raw integer is what gets shown alongside it.
export default function SeverityMeter({ severity, showLabel = true, compact = false }) {
  const tone = severityTone(severity);
  return (
    <span className={`sev-meter sev-meter--${tone}${compact ? " sev-meter--compact" : ""}`} title={`Severity ${severity} of 5, ${severityLabel(severity)}`}>
      <span className="sev-meter__pips" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <span key={n} className={`sev-meter__pip${n <= severity ? " sev-meter__pip--on" : ""}`} />
        ))}
      </span>
      {showLabel ? (
        <span className="sev-meter__label">
          {severity}/5 {severityLabel(severity)}
        </span>
      ) : (
        <span className="sr-only">
          Severity {severity} of 5, {severityLabel(severity)}
        </span>
      )}
    </span>
  );
}
