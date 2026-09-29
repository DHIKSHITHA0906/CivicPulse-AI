import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Premium cursor: luminous core + soft halo + trailing ring, with magnetic
// hover and click feedback. Purely presentational.
//
// Robustness notes:
//  - The native cursor is only hidden (html.cp-cursor-on) after the first real
//    mouse/pen movement is received, so if initialization fails or the device is
//    touch-only, the native cursor is never touched.
//  - Listeners are attached in the capture phase on `document`, so Leaflet /
//    MapLibre / modal handlers that stop propagation can never starve it.
//  - The layer is pointer-events:none, so it can never block interaction.
//  - The browser Fullscreen API only paints the fullscreened element's subtree,
//    so while the map is fullscreen the cursor layer is portaled into it
//    (same technique Modal.jsx already uses).

const INTERACTIVE =
  'a[href], button, [role="button"], [role="radio"], [role="tab"], summary, label[for], select, ' +
  ".leaflet-interactive, .maplibregl-marker, .map3d-marker, [data-cursor='hover']";
const TEXT_FIELD =
  'textarea, input:not([type="range"]):not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), [contenteditable="true"]';
// Only controls whose parents do not clip overflow get the small physical pull
// (segmented buttons and map tools sit in overflow containers); the ring still
// wraps every control magnetically.
const MAGNETIC = ".btn, .chip, .top-nav__links a, .modal-card__close, .alert__action";

// Survives portal re-mounts (entering / leaving fullscreen) so the cursor
// never jumps back to the corner.
const P = { x: -200, y: -200, hx: -200, hy: -200, rx: -200, ry: -200, seen: false };

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

export default function CustomCursor() {
  const [fsTarget, setFsTarget] = useState(null);
  const rootRef = useRef(null);
  const coreRef = useRef(null);
  const haloRef = useRef(null);
  const ringRef = useRef(null);

  useEffect(() => {
    const sync = () => setFsTarget(document.fullscreenElement || null);
    sync();
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);

  useEffect(() => {
    let cleanup = () => {};
    try {
      if (typeof window === "undefined" || !window.matchMedia) return undefined;
      // Touch-only device: keep the native cursor, attach nothing.
      if (!window.matchMedia("(any-hover: hover)").matches && !window.matchMedia("(any-pointer: fine)").matches) {
        return undefined;
      }

      const html = document.documentElement;
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const S = { active: false, visible: false, mode: "idle", down: false, hoverEl: null, magnetEl: null, lastTarget: null };
      let raf = 0;
      let lastRoot = null;
      const applied = { visible: "", mode: "", down: "", rw: "", rh: "", rr: "" };

      const resetMagnet = () => {
        if (S.magnetEl) S.magnetEl.style.translate = "";
        S.magnetEl = null;
      };

      const deactivate = () => {
        if (S.active) html.classList.remove("cp-cursor-on");
        S.active = false;
        S.visible = false;
        S.mode = "idle";
        S.hoverEl = null;
        resetMagnet();
      };

      const activate = () => {
        if (!S.active) {
          S.active = true;
          html.classList.add("cp-cursor-on");
        }
      };

      const classify = (t) => {
        const el = t instanceof Element ? t : t && t.parentElement;
        resetMagnet();
        S.hoverEl = null;
        if (!el || !el.closest) {
          S.mode = "idle";
          return;
        }
        if (el.closest(TEXT_FIELD)) {
          S.mode = "text";
          return;
        }
        const hit = el.closest(INTERACTIVE);
        if (hit && !hit.disabled && hit.getAttribute("aria-disabled") !== "true") {
          S.mode = "hover";
          S.hoverEl = hit;
          const magnet = hit.closest(MAGNETIC);
          if (magnet && !reduce) S.magnetEl = magnet;
          return;
        }
        S.mode = "idle";
      };

      const spawnRipple = () => {
        if (reduce || !rootRef.current) return;
        const r = document.createElement("span");
        r.className = "cp-cursor__ripple";
        r.style.left = `${P.x}px`;
        r.style.top = `${P.y}px`;
        r.addEventListener("animationend", () => r.remove(), { once: true });
        rootRef.current.appendChild(r);
      };

      const onMove = (e) => {
        if (e.pointerType === "touch") {
          deactivate();
          return;
        }
        activate();
        P.x = e.clientX;
        P.y = e.clientY;
        if (!P.seen) {
          P.hx = P.rx = P.x;
          P.hy = P.ry = P.y;
          P.seen = true;
        }
        S.visible = true;
        if (e.target !== S.lastTarget) {
          S.lastTarget = e.target;
          classify(e.target);
        }
        if (S.magnetEl) {
          const rect = S.magnetEl.getBoundingClientRect();
          const dx = clamp((P.x - (rect.left + rect.width / 2)) * 0.16, -5, 5);
          const dy = clamp((P.y - (rect.top + rect.height / 2)) * 0.22, -4, 4);
          S.magnetEl.style.translate = `${dx.toFixed(1)}px ${dy.toFixed(1)}px`;
        }
      };

      const onDown = (e) => {
        if (e.pointerType === "touch") {
          deactivate();
          return;
        }
        activate();
        S.down = true;
        spawnRipple();
      };
      const onUp = () => {
        S.down = false;
      };
      const onOut = (e) => {
        if (!e.relatedTarget) {
          S.visible = false;
          S.lastTarget = null;
          resetMagnet();
        }
      };
      const onBlur = () => {
        S.visible = false;
        S.down = false;
      };

      const tick = () => {
        const root = rootRef.current;
        if (root) {
          if (root !== lastRoot) {
            lastRoot = root;
            Object.keys(applied).forEach((k) => (applied[k] = ""));
          }
          const visible = String(S.visible && S.active);
          if (applied.visible !== visible) {
            root.dataset.visible = visible;
            applied.visible = visible;
          }
          if (applied.mode !== S.mode) {
            root.dataset.mode = S.mode;
            applied.mode = S.mode;
          }
          const down = String(S.down);
          if (applied.down !== down) {
            root.dataset.down = down;
            applied.down = down;
          }

          // Ring geometry: magnetic wrap around small controls, larger disc otherwise.
          let tx = P.x;
          let ty = P.y;
          let rw = 34;
          let rh = 34;
          let rr = "50%";
          if (S.mode === "hover" && S.hoverEl && S.hoverEl.isConnected) {
            const rect = S.hoverEl.getBoundingClientRect();
            const small = rect.width <= 220 && rect.height <= 76 && rect.width > 0;
            if (small) {
              const pull = reduce ? 1 : 0.65;
              tx = P.x + (rect.left + rect.width / 2 - P.x) * pull;
              ty = P.y + (rect.top + rect.height / 2 - P.y) * pull;
              rw = Math.round(rect.width + 12);
              rh = Math.round(rect.height + 12);
              rr = `${Math.round(Math.min(Math.min(rw, rh) / 2, 18))}px`;
            } else {
              rw = 46;
              rh = 46;
            }
          } else if (S.mode === "text") {
            rw = 34;
            rh = 34;
          }

          const kRing = reduce ? 1 : 0.17;
          const kHalo = reduce ? 1 : 0.3;
          P.rx += (tx - P.rx) * kRing;
          P.ry += (ty - P.ry) * kRing;
          P.hx += (P.x - P.hx) * kHalo;
          P.hy += (P.y - P.hy) * kHalo;

          if (coreRef.current) coreRef.current.style.transform = `translate3d(${P.x}px, ${P.y}px, 0)`;
          if (haloRef.current) haloRef.current.style.transform = `translate3d(${P.hx}px, ${P.hy}px, 0)`;
          if (ringRef.current) {
            ringRef.current.style.transform = `translate3d(${P.rx}px, ${P.ry}px, 0)`;
            if (applied.rw !== String(rw)) {
              ringRef.current.style.setProperty("--rw", `${rw}px`);
              applied.rw = String(rw);
            }
            if (applied.rh !== String(rh)) {
              ringRef.current.style.setProperty("--rh", `${rh}px`);
              applied.rh = String(rh);
            }
            if (applied.rr !== rr) {
              ringRef.current.style.setProperty("--rr", rr);
              applied.rr = rr;
            }
          }
        }
        raf = requestAnimationFrame(tick);
      };

      const opts = { capture: true, passive: true };
      document.addEventListener("pointermove", onMove, opts);
      document.addEventListener("pointerdown", onDown, opts);
      document.addEventListener("pointerup", onUp, opts);
      document.addEventListener("pointercancel", onUp, opts);
      window.addEventListener("mouseout", onOut, opts);
      window.addEventListener("blur", onBlur);
      raf = requestAnimationFrame(tick);

      cleanup = () => {
        cancelAnimationFrame(raf);
        document.removeEventListener("pointermove", onMove, opts);
        document.removeEventListener("pointerdown", onDown, opts);
        document.removeEventListener("pointerup", onUp, opts);
        document.removeEventListener("pointercancel", onUp, opts);
        window.removeEventListener("mouseout", onOut, opts);
        window.removeEventListener("blur", onBlur);
        deactivate();
      };
    } catch {
      // Any failure: fall back to the native cursor.
      document.documentElement.classList.remove("cp-cursor-on");
    }
    return () => cleanup();
  }, []);

  if (typeof document === "undefined") return null;

  const layer = (
    <div className="cp-cursor" ref={rootRef} aria-hidden="true" data-visible="false" data-mode="idle" data-down="false">
      <div className="cp-cursor__anchor" ref={haloRef}>
        <span className="cp-cursor__halo" />
      </div>
      <div className="cp-cursor__anchor" ref={ringRef}>
        <span className="cp-cursor__ring" />
      </div>
      <div className="cp-cursor__anchor" ref={coreRef}>
        <span className="cp-cursor__core" />
      </div>
    </div>
  );

  return createPortal(layer, fsTarget || document.body);
}
