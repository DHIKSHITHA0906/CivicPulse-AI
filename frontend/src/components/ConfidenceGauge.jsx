// Small SVG arc gauge — pure presentation, takes a 0–1 confidence value
// that's already present on priority/recommendation records from the API.
const SIZE = 54;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function toneFor(value) {
  if (value >= 0.85) return "var(--low)";
  if (value >= 0.7) return "var(--medium)";
  return "var(--high)";
}

export default function ConfidenceGauge({ value, size = SIZE, label }) {
  const pct = Math.max(0, Math.min(1, value ?? 0));
  const offset = CIRCUMFERENCE * (1 - pct);
  const scale = size / SIZE;

  return (
    <div className="confidence-gauge" role="img" aria-label={`${label ?? "Confidence"}: ${Math.round(pct * 100)}%`}>
      <svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={toneFor(pct)}
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          style={{ transition: "stroke-dashoffset 480ms cubic-bezier(0.16,1,0.3,1)" }}
        />
      </svg>
      <span className="confidence-gauge__value" style={{ fontSize: 11 * scale + 4 }}>
        {Math.round(pct * 100)}%
      </span>
    </div>
  );
}
