import { t } from "../i18n/strings";

// Spec Section 2 & 9: "Persistent synthetic-data disclosure banner" that
// must remain visible — it is never dismissible/closable by design.
export default function SyntheticBanner({ lang = "en" }) {
  return (
    <div className="synthetic-banner" role="status">
      <span className="synthetic-banner__dot" aria-hidden="true" />
      <span>
        <strong>Demo mode.</strong> {t(lang, "syntheticBanner")}
      </span>
    </div>
  );
}
