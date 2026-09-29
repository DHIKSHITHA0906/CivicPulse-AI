// Brand mark: a pulse line running through a ring, drawn in the copper accent.
export default function BrandMark({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="14.25" stroke="currentColor" strokeWidth="1.5" opacity="0.55" />
      <path d="M5 17h5.2l2.6-7 4.4 13 2.9-8.2 1.4 2.2H27" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
