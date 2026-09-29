import { useEffect, useRef, useState } from "react";

// Animates a displayed number counting up from its previous value to its
// new one. Purely presentational — it never changes what value is shown at
// rest, only how it transitions when the underlying stat (already computed
// by Dashboard.jsx from data it fetched) changes.
function AnimatedValue({ value }) {
  const numericMatch = typeof value === "string" ? value.match(/^(\d+)(%?)$/) : null;
  const isPlainNumber = typeof value === "number";
  const isPercent = !!numericMatch;
  const target = isPlainNumber ? value : isPercent ? Number(numericMatch[1]) : null;

  const [display, setDisplay] = useState(target ?? 0);
  const frameRef = useRef(null);
  const fromRef = useRef(target ?? 0);

  useEffect(() => {
    if (target == null) return undefined;
    const from = fromRef.current;
    const to = target;
    if (from === to) return undefined;

    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(to);
      fromRef.current = to;
      return undefined;
    }

    const duration = 650;
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  if (target == null) return <>{value}</>;
  return <>{isPercent ? `${display}%` : display}</>;
}

// Tiny inline visualizations. Every shape is drawn from numbers Dashboard.jsx
// already derived from its fetched data and hands over in `stat.viz`.
function MiniViz({ viz }) {
  if (!viz) return null;

  if (viz.type === "bars") {
    const max = Math.max(1, ...viz.values);
    const tones = ["low", "medium", "high", "critical"];
    return (
      <div className="kpi-viz kpi-viz--bars" aria-hidden="true">
        {viz.values.map((v, i) => (
          <span key={tones[i]} className={`kpi-viz__bar kpi-viz__bar--${tones[i]}`} style={{ height: `${Math.max(v ? 14 : 6, (v / max) * 100)}%`, opacity: v ? 1 : 0.28 }} />
        ))}
      </div>
    );
  }

  if (viz.type === "range") {
    const pct = (n) => `${Math.round(clamp01(n) * 100)}%`;
    return (
      <div className="kpi-viz kpi-viz--range" aria-hidden="true">
        <span className="kpi-viz__track" />
        <span className="kpi-viz__band" style={{ left: pct(viz.min), width: `calc(${pct(viz.max)} - ${pct(viz.min)})` }} />
        <span className="kpi-viz__tick" style={{ left: pct(viz.value) }} />
      </div>
    );
  }

  if (viz.type === "dots") {
    const max = viz.max ?? 8;
    return (
      <div className="kpi-viz kpi-viz--dots" aria-hidden="true">
        {Array.from({ length: max }).map((_, i) => (
          <span key={i} className={`kpi-viz__dot${i < viz.count ? " kpi-viz__dot--on" : ""}`} />
        ))}
      </div>
    );
  }

  if (viz.type === "meter") {
    return (
      <div className="kpi-viz kpi-viz--meter" aria-hidden="true">
        <span className="kpi-viz__track" />
        <span className="kpi-viz__fill" style={{ width: `${Math.round(clamp01(viz.value) * 100)}%` }} />
      </div>
    );
  }

  return null;
}

function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

// Presentation-only: renders aggregate stats derived by Dashboard.jsx from
// data it already has in state (requests + priority items). No new API calls.
// Each stat: { label, value, note, tone, icon, viz? }.
export default function StatRow({ stats }) {
  // Cursor-following light on each module (CSS variables only).
  function track(e) {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  }

  return (
    <div className="kpi-strip" role="list">
      {stats.map((s, i) => (
        <div className={`kpi kpi--${s.tone ?? "neutral"}`} key={s.label} role="listitem" onPointerMove={track} style={{ "--i": i }}>
          <div className="kpi__label">
            {s.icon}
            {s.label}
          </div>
          <div className="kpi__body">
            <div className="kpi__value">
              <AnimatedValue value={s.value} />
            </div>
            <MiniViz viz={s.viz} />
          </div>
          {s.note && <div className="kpi__note">{s.note}</div>}
        </div>
      ))}
    </div>
  );
}
