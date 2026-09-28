// Presentation-only section marker used to give the dashboard its
// overview → map → priorities → details reading order.
export default function SectionDivider({ index, label, hint }) {
  return (
    <div className="section-divider reveal" role="presentation">
      <span className="section-divider__index">{index}</span>
      <span className="section-divider__label">{label}</span>
      {hint && <span className="section-divider__hint">{hint}</span>}
      <i className="section-divider__line" aria-hidden="true" />
    </div>
  );
}
