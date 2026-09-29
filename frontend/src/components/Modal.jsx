import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function Modal({ open, onClose, title, subtitle, children, icon }) {
  const cardRef = useRef(null);
  // The browser's native Fullscreen API only paints the fullscreened
  // element's own subtree. This modal normally lives at the Dashboard
  // level (outside the map card), so when the map is fullscreen — e.g. a
  // marker was just clicked — it needs to be portaled *into* that
  // fullscreened element instead, or it simply wouldn't be shown.
  const [fullscreenTarget, setFullscreenTarget] = useState(null);

  useEffect(() => {
    function syncFullscreenTarget() {
      setFullscreenTarget(document.fullscreenElement || null);
    }
    syncFullscreenTarget();
    document.addEventListener("fullscreenchange", syncFullscreenTarget);
    return () => document.removeEventListener("fullscreenchange", syncFullscreenTarget);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const previouslyFocused = document.activeElement;
    cardRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const modal = (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="modal-card fade-in"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={cardRef}
      >
        <div className="modal-card__header">
          <div className="modal-card__title">
            {icon && <span className="modal-card__icon">{icon}</span>}
            <div>
              <h3>{title}</h3>
              {subtitle && <p className="modal-card__subtitle">{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="modal-card__close" onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2.2} />
          </button>
        </div>
        <div className="modal-card__body">{children}</div>
      </div>
    </div>
  );

  return fullscreenTarget ? createPortal(modal, fullscreenTarget) : modal;
}
