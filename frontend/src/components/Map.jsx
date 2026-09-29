import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, ScaleControl, useMap, useMapEvents } from "react-leaflet";
import { Maximize2, Minimize2, Box, Plus, Minus, Crosshair, X, Layers } from "lucide-react";
import "leaflet/dist/leaflet.css";
import Map3D from "./Map3D";
import { severityColor, severityRadius, toHotspots } from "./mapSeverity";
import { CATEGORY_LABEL, severityLabel, humanize } from "./labels";

function FitToRequests({ items }) {
  const map = useMap();
  useMemo(() => {
    if (!items?.length) return;
    const lats = items.map((i) => i.latitude);
    const lngs = items.map((i) => i.longitude);
    const bounds = [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
    // maxZoom raised + padding tightened so a cluster of nearby requests
    // fills the frame instead of leaving a lot of empty land/ocean visible.
    map.fitBounds(bounds, { padding: [48, 48], maxZoom: 16 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, map]);
  return null;
}

// Leaflet reads its container's size at construction time. When the map
// mounts inside a flex/grid layout (or right after a skeleton swap), the
// container can still report a stale or zero size for a frame, which is
// what produced the "broken" grey/partial-tile bug. Re-measuring on mount,
// on window resize, and whenever the container itself resizes (ResizeObserver
// — which also fires on fullscreen enter/exit) keeps the tile grid correctly
// sized in every case.
function MapAutoResize() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const invalidate = () => map.invalidateSize();

    invalidate();
    const raf = requestAnimationFrame(invalidate);
    const timeout = setTimeout(invalidate, 250);

    const resizeObserver = new ResizeObserver(() => invalidate());
    resizeObserver.observe(container);
    window.addEventListener("resize", invalidate);

    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
      resizeObserver.disconnect();
      window.removeEventListener("resize", invalidate);
    };
  }, [map]);
  return null;
}

// Live coordinate / zoom readout drawn as part of the map HUD. Lives inside
// the MapContainer so it can subscribe to map events; it owns its own tiny
// state, so mouse movement never re-renders the markers.
function MapReadout() {
  const [pos, setPos] = useState({ lat: null, lng: null });
  const [zoom, setZoom] = useState(null);
  const lastMove = useRef(0);
  const map = useMapEvents({
    mousemove(e) {
      const now = performance.now();
      if (now - lastMove.current < 60) return;
      lastMove.current = now;
      setPos({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
    mouseout() {
      setPos({ lat: null, lng: null });
    },
    zoomend() {
      setZoom(map.getZoom());
    },
  });
  useEffect(() => {
    setZoom(map.getZoom());
  }, [map]);

  return (
    <div className="map-hud-readout" aria-hidden="true">
      <span>
        <em>LAT</em> {pos.lat != null ? pos.lat.toFixed(4) : "——"}
      </span>
      <span>
        <em>LNG</em> {pos.lng != null ? pos.lng.toFixed(4) : "——"}
      </span>
      <span>
        <em>Z</em> {zoom ?? "—"}
      </span>
    </div>
  );
}

function SeverityPips({ severity }) {
  return (
    <span className="cp-tip__pips" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          className="cp-tip__pip"
          style={n <= severity ? { background: severityColor(severity) } : undefined}
        />
      ))}
    </span>
  );
}

// Presentation-only marker card: every value shown is a field already on the
// request record returned by getRequests().
function MarkerCard({ item }) {
  return (
    <div className="cp-tip">
      <div className="cp-tip__head">
        <span className="cp-tip__dot" style={{ background: severityColor(item.severity) }} />
        <strong>{CATEGORY_LABEL[item.category] ?? humanize(item.category)}</strong>
        {item.sub_category && <span className="cp-tip__sub">{humanize(item.sub_category)}</span>}
      </div>
      <div className="cp-tip__severity">
        <SeverityPips severity={item.severity} />
        <span>
          {severityLabel(item.severity)}, {item.severity} of 5
        </span>
      </div>
      <dl className="cp-tip__facts">
        <dt>People affected</dt>
        <dd>{item.affected_population != null ? item.affected_population.toLocaleString() : "Not estimated"}</dd>
        <dt>Confidence</dt>
        <dd>{Math.round((item.confidence ?? 0) * 100)}%</dd>
      </dl>
      {item.needs_review && <div className="cp-tip__flag">Flagged for manual review</div>}
      <div className="cp-tip__hint">Click for full details</div>
    </div>
  );
}

// hoverCategory / onHoverCategory are optional; they link a hovered priority
// row (or marker) to its counterpart without changing any data flow.
export default function MapView({ items = [], onSelectCategory, onSelectRequest, focusCategory = null, emptyState = null, hoverCategory = null, onHoverCategory }) {
  const plottable = useMemo(() => items.filter((i) => i.latitude != null && i.longitude != null), [items]);
  const hotspots = useMemo(() => toHotspots(plottable), [plottable]);
  const center = plottable.length
    ? [plottable[0].latitude, plottable[0].longitude]
    : [11.1271, 78.6569]; // Tamil Nadu centroid fallback

  const severityCounts = useMemo(() => {
    const counts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const i of plottable) {
      if (i.severity >= 5) counts.critical += 1;
      else if (i.severity === 4) counts.high += 1;
      else if (i.severity === 3) counts.medium += 1;
      else counts.low += 1;
    }
    return counts;
  }, [plottable]);

  const mapRef = useRef(null);
  const frameRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [tilted, setTilted] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);

  // Native fullscreen for the map card, via the browser Fullscreen API
  // directly (no extra dependency). Re-measures the map on every
  // transition so tiles fill the enlarged frame immediately instead of
  // staying letterboxed at the old size.
  useEffect(() => {
    function onFullscreenChange() {
      const active = document.fullscreenElement === frameRef.current;
      setIsFullscreen(active);
      requestAnimationFrame(() => mapRef.current?.invalidateSize());
      setTimeout(() => mapRef.current?.invalidateSize(), 260);
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      frameRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  function fitToData() {
    const map = mapRef.current;
    if (!map || !plottable.length) return;
    const lats = plottable.map((i) => i.latitude);
    const lngs = plottable.map((i) => i.longitude);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [48, 48], maxZoom: 16, animate: true }
    );
  }

  // A clicked priority (focusCategory) wins; otherwise a hovered one previews.
  const emphasis = focusCategory ?? hoverCategory;
  const hasFocus = !!focusCategory;
  const hasEmphasis = !!emphasis;
  const legend = [
    { key: "low", label: "Low", severity: 1 },
    { key: "medium", label: "Medium", severity: 3 },
    { key: "high", label: "High", severity: 4 },
    { key: "critical", label: "Critical", severity: 5 },
  ];

  return (
    <div className="map-frame" ref={frameRef}>
      {tilted ? (
        <Map3D active={tilted} items={plottable} hotspots={hotspots} onSelectCategory={onSelectCategory} onSelectRequest={onSelectRequest} />
      ) : (
        <MapContainer
          center={center}
          zoom={7}
          style={{ height: "100%", width: "100%", background: "#0c0a09" }}
          scrollWheelZoom
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            subdomains="abc"
            maxZoom={19}
          />
          <FitToRequests items={plottable} />
          <MapAutoResize />
          <MapReadout />
          <ScaleControl position="bottomright" imperial={false} />

          {showHotspots &&
            hotspots
            .filter((h) => h.count >= 3)
            .map((h, i) => (
              <CircleMarker
                key={`hotspot-${i}`}
                center={[h.latitude, h.longitude]}
                radius={18 + Math.min(h.count, 12)}
                interactive={false}
                className="hotspot-marker"
                pathOptions={{
                  color: "#d99863",
                  fillColor: "#d99863",
                  fillOpacity: hasFocus ? 0.03 : 0.07,
                  opacity: hasFocus ? 0.35 : 0.85,
                  weight: 1.25,
                  dashArray: "2 5",
                }}
              >
                <Tooltip direction="top" permanent className="hotspot-label">
                  {h.count} reports
                </Tooltip>
              </CircleMarker>
            ))}

          {/* Halos sit beneath the markers (drawn first, non-interactive) so
              a cluster of severe requests glows without hiding the pins. */}
          {plottable.map((item) => {
            const dimmed = hasFocus && item.category !== focusCategory;
            const severe = item.severity >= 4;
            return (
              <CircleMarker
                key={`halo-${item.request_id}-${dimmed ? "d" : "n"}`}
                center={[item.latitude, item.longitude]}
                radius={severityRadius(item.severity) + (severe ? 13 : 8)}
                interactive={false}
                // className is a construction-time Leaflet option (it is only
                // applied when the SVG path is created), so it is passed as a
                // prop rather than through pathOptions, and the key changes with
                // `dimmed` to rebuild the path when the spotlight changes.
                className={item.severity >= 5 && !dimmed ? "halo halo--pulse" : "halo"}
                pathOptions={{
                  stroke: false,
                  fillColor: severityColor(item.severity),
                  fillOpacity: dimmed ? 0.02 : item.severity >= 5 ? 0.24 : severe ? 0.18 : 0.11,
                }}
              />
            );
          })}

          {/* Spotlight rings: markers belonging to the selected / hovered priority
              category get a slowly turning copper ring, tying the ranking to the map. */}
          {hasEmphasis &&
            plottable
              .filter((item) => item.category === emphasis)
              .map((item) => (
                <CircleMarker
                  key={`ring-${item.request_id}-${emphasis}`}
                  center={[item.latitude, item.longitude]}
                  radius={severityRadius(item.severity) + 7}
                  interactive={false}
                  className="focus-ring"
                  pathOptions={{ color: "#dca176", weight: 1.25, fill: false, opacity: 0.95, dashArray: "3 5" }}
                />
              ))}

          {plottable.map((item) => {
            const dimmed = hasEmphasis && item.category !== emphasis;
            return (
              <CircleMarker
                key={item.request_id}
                center={[item.latitude, item.longitude]}
                radius={severityRadius(item.severity)}
                className="severity-marker"
                pathOptions={{
                  color: "#f0e9da",
                  fillColor: severityColor(item.severity),
                  fillOpacity: dimmed ? 0.3 : 0.96,
                  opacity: dimmed ? 0.3 : 0.92,
                  weight: dimmed ? 1 : 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    onSelectCategory?.(item.category);
                    onSelectRequest?.(item);
                  },
                  mouseover: () => onHoverCategory?.(item.category),
                  mouseout: () => onHoverCategory?.(null),
                }}
              >
                <Tooltip direction="top" offset={[0, -8]} className="cp-tooltip" opacity={1}>
                  <MarkerCard item={item} />
                </Tooltip>
              </CircleMarker>
            );
          })}

          {/* Bright core dot on each marker: a small jewel-like highlight. */}
          {plottable.map((item) => {
            const dimmed = hasEmphasis && item.category !== emphasis;
            return (
              <CircleMarker
                key={`core-${item.request_id}`}
                center={[item.latitude, item.longitude]}
                radius={1.8}
                interactive={false}
                className="marker-core"
                pathOptions={{ stroke: false, fillColor: "#fff6e6", fillOpacity: dimmed ? 0.25 : 0.85 }}
              />
            );
          })}
        </MapContainer>
      )}

      <div className="map-frame__vignette" aria-hidden="true" />
      <div className="map-hud" aria-hidden="true">
        <span className="map-hud__corner map-hud__corner--tl" />
        <span className="map-hud__corner map-hud__corner--tr" />
        <span className="map-hud__corner map-hud__corner--bl" />
        <span className="map-hud__corner map-hud__corner--br" />
      </div>

      <div className="map-caption">
        <span className="map-caption__title">Demand map</span>
        <span className="map-caption__meta">
          {plottable.length} {plottable.length === 1 ? "report" : "reports"} plotted
        </span>
        {hasFocus && (
          <button type="button" className="map-caption__focus" onClick={() => onSelectCategory?.(null)} aria-label="Clear category spotlight">
            {CATEGORY_LABEL[focusCategory] ?? focusCategory}
            <X size={12} strokeWidth={2.4} />
          </button>
        )}
      </div>

      <div className="map-toolbar" role="toolbar" aria-label="Map controls">
        {!tilted && (
          <div className="map-tool-group">
            <button type="button" className="map-tool-btn" onClick={() => mapRef.current?.zoomIn()} aria-label="Zoom in" title="Zoom in">
              <Plus size={15} strokeWidth={2.2} />
            </button>
            <button type="button" className="map-tool-btn" onClick={() => mapRef.current?.zoomOut()} aria-label="Zoom out" title="Zoom out">
              <Minus size={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className="map-tool-btn"
              onClick={fitToData}
              disabled={!plottable.length}
              aria-label="Fit map to all reports"
              title="Fit to all reports"
            >
              <Crosshair size={15} strokeWidth={2.2} />
            </button>
            <button
              type="button"
              className={`map-tool-btn${showHotspots ? " map-tool-btn--on" : ""}`}
              onClick={() => setShowHotspots((v) => !v)}
              aria-pressed={showHotspots}
              aria-label={showHotspots ? "Hide hotspot rings" : "Show hotspot rings"}
              title={showHotspots ? "Hide hotspots" : "Show hotspots"}
            >
              <Layers size={15} strokeWidth={2.2} />
            </button>
          </div>
        )}
        <div className="map-tool-group">
          <button
            type="button"
            className={`map-tool-btn${tilted ? " map-tool-btn--active" : ""}`}
            onClick={() => setTilted((v) => !v)}
            aria-pressed={tilted}
            aria-label={tilted ? "Return to flat interactive map" : "Switch to 3D perspective view"}
            title={tilted ? "Return to flat map" : "3D view"}
          >
            <Box size={15} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            className="map-tool-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "Exit full screen" : "View map full screen"}
            title={isFullscreen ? "Exit full screen" : "Full screen"}
          >
            {isFullscreen ? <Minimize2 size={15} strokeWidth={2.2} /> : <Maximize2 size={15} strokeWidth={2.2} />}
          </button>
        </div>
      </div>

      {tilted && <div className="map-3d-hint">Drag to rotate. Right-drag or use two fingers to change the tilt.</div>}

      <div className="map-legend" aria-label="Severity legend">
        {legend.map((l) => (
          <span className="map-legend__item" key={l.key}>
            <span className="map-legend__dot" style={{ background: severityColor(l.severity) }} />
            {l.label}
            <span className="map-legend__count">{severityCounts[l.key]}</span>
          </span>
        ))}
        <span className="map-legend__item map-legend__item--ring">
          <span className="map-legend__ring" />
          Hotspot
        </span>
      </div>

      {plottable.length === 0 && (
        <div className="map-empty-overlay">
          <div className="map-empty">{emptyState ?? <p>No requests match the current filters.</p>}</div>
        </div>
      )}
    </div>
  );
}
