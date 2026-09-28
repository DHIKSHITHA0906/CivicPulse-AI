import { useState } from "react";
import { FileText, ShieldAlert, MapPin, Copy, Check } from "lucide-react";
import Modal from "./Modal";
import SeverityMeter from "./SeverityMeter";
import ConfidenceGauge from "./ConfidenceGauge";
import { CATEGORY_LABEL, humanize, formatCoord } from "./labels";

const LANGUAGE_NAME = { ta: "Tamil", kn: "Kannada", hi: "Hindi", en: "English" };

// Renders the full CitizenRequest shape (Master Reference Section 2.1) —
// every field here already exists on records returned by getRequests();
// this just gives them somewhere to be seen individually instead of only
// as an aggregated map dot or table row.
export default function RequestDetailModal({ request, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copyId() {
    try {
      await navigator.clipboard.writeText(request.request_id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Clipboard can be blocked; the ID stays selectable on screen. */
    }
  }

  return (
    <Modal
      open={!!request}
      onClose={onClose}
      title={request ? `${CATEGORY_LABEL[request.category] ?? request.category} report` : "Request details"}
      subtitle={request ? humanize(request.sub_category) : undefined}
      icon={<FileText size={17} strokeWidth={2} />}
    >
      {request && (
        <>
          {request.needs_review && (
            <div className="alert alert--notice" role="status">
              <ShieldAlert size={16} strokeWidth={2.2} />
              <span>Flagged for manual review. Extraction confidence was below the threshold.</span>
            </div>
          )}

          {request.original_text && (
            <figure className="report-quote">
              <figcaption>Original report</figcaption>
              <blockquote>{request.original_text}</blockquote>
              {request.translated_text && request.translated_text !== request.original_text && (
                <p className="report-quote__translation">
                  <span>English</span>
                  {request.translated_text}
                </p>
              )}
            </figure>
          )}

          <div className="detail-figures">
            <div className="detail-figure">
              <span className="detail-figure__label">Severity</span>
              <SeverityMeter severity={request.severity} />
            </div>
            <div className="detail-figure">
              <span className="detail-figure__label">People affected</span>
              <span className="detail-figure__value">
                {request.affected_population != null ? request.affected_population.toLocaleString() : "Not estimated"}
              </span>
            </div>
            <div className="detail-figure detail-figure--gauge">
              <ConfidenceGauge value={request.confidence} label="Confidence" size={46} />
              <span className="detail-figure__label">Confidence</span>
            </div>
          </div>

          <dl className="result-grid">
            <dt>District</dt>
            <dd>
              <MapPin size={13} strokeWidth={2.2} className="inline-icon" />
              {request.district}
            </dd>
            <dt>Location</dt>
            <dd>{formatCoord(request.latitude, request.longitude) || "Not available"}</dd>
            <dt>Language</dt>
            <dd>{LANGUAGE_NAME[request.language] ?? request.language?.toUpperCase()}</dd>
            <dt>Reported</dt>
            <dd>{new Date(request.timestamp).toLocaleString()}</dd>
          </dl>

          <div className="ref-line">
            <span className="ref-line__label">Reference</span>
            <code className="ref-line__id">{request.request_id}</code>
            <button type="button" className="btn btn--ghost btn--small" onClick={copyId} aria-label="Copy reference ID">
              {copied ? <Check size={14} strokeWidth={2.4} /> : <Copy size={14} strokeWidth={2.2} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
