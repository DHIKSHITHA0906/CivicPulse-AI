import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { severityColor, severityRadius } from "./mapSeverity";
import { CATEGORY_LABEL, severityLabel, humanize } from "./labels";

// Free, no-API-key vector tiles (OpenFreeMap). The "building" source-layer
// carries real render_height / render_min_height values from OpenStreetMap,
// which is what lets us extrude actual building footprints instead of the
// old flat-tile-plus-CSS-transform illusion.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";
const BUILDINGS_TILES_URL = "https://tiles.openfreemap.org/planet";

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

// Same card layout as the flat map's tooltip (see Map.jsx MarkerCard), built
// with DOM APIs because MapLibre popups take a node, not React children.
function buildPopupContent(item) {
  const wrap = el("div", "cp-tip");

  const head = el("div", "cp-tip__head");
  const dot = el("span", "cp-tip__dot");
  dot.style.background = severityColor(item.severity);
  head.appendChild(dot);
  head.appendChild(el("strong", null, CATEGORY_LABEL[item.category] ?? humanize(item.category)));
  if (item.sub_category) head.appendChild(el("span", "cp-tip__sub", humanize(item.sub_category)));
  wrap.appendChild(head);

  const sev = el("div", "cp-tip__severity");
  const pips = el("span", "cp-tip__pips");
  for (let n = 1; n <= 5; n += 1) {
    const pip = el("span", "cp-tip__pip");
    if (n <= item.severity) pip.style.background = severityColor(item.severity);
    pips.appendChild(pip);
  }
  sev.appendChild(pips);
  sev.appendChild(el("span", null, `${severityLabel(item.severity)}, ${item.severity} of 5`));
  wrap.appendChild(sev);

  if (item.needs_review) wrap.appendChild(el("div", "cp-tip__flag", "Flagged for manual review"));
  wrap.appendChild(el("div", "cp-tip__hint", "Click for full details"));
  return wrap;
}

export default function Map3D({ active, items = [], hotspots = [], onSelectCategory, onSelectRequest }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  // Mount/unmount the whole MapLibre instance with `active` rather than just
  // hiding it — keeps a hidden WebGL context from sitting around when the
  // user is back on the flat map.
  useEffect(() => {
    if (!active || !containerRef.current) return undefined;

    const plottable = items.filter((i) => i.latitude != null && i.longitude != null);
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: plottable.length ? [plottable[0].longitude, plottable[0].latitude] : [78.6569, 11.1271],
      zoom: plottable.length ? 14 : 6.5,
      pitch: plottable.length ? 58 : 0,
      bearing: -18,
      antialias: true,
    });
    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");

    const markers = [];

    map.on("load", () => {
      map.addSource("cp-osm-buildings", { type: "vector", url: BUILDINGS_TILES_URL });
      map.addLayer({
        id: "cp-3d-buildings",
        type: "fill-extrusion",
        source: "cp-osm-buildings",
        "source-layer": "building",
        minzoom: 13,
        filter: ["!=", ["get", "hide_3d"], true],
        paint: {
          "fill-extrusion-color": "#9a948a",
          "fill-extrusion-opacity": 0.88,
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 6],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        },
      });

      hotspots
        .filter((h) => h.count >= 3)
        .forEach((h) => {
          const size = (16 + Math.min(h.count, 12)) * 2;
          const el = document.createElement("div");
          el.className = "map3d-hotspot";
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          const label = document.createElement("span");
          label.className = "map3d-hotspot__label";
          label.textContent = `${h.count} reports`;
          el.appendChild(label);
          markers.push(new maplibregl.Marker({ element: el }).setLngLat([h.longitude, h.latitude]).addTo(map));
        });

      plottable.forEach((item) => {
        const diameter = severityRadius(item.severity) * 2;
        const color = severityColor(item.severity);
        const el = document.createElement("div");
        el.className = "map3d-marker";
        el.style.width = `${diameter}px`;
        el.style.height = `${diameter}px`;
        el.style.background = color;
        el.style.color = color;
        el.addEventListener("click", () => {
          onSelectCategory?.(item.category);
          onSelectRequest?.(item);
        });

        const popup = new maplibregl.Popup({ offset: diameter / 2 + 6, closeButton: false, className: "map3d-popup-wrap" }).setDOMContent(
          buildPopupContent(item)
        );
        const marker = new maplibregl.Marker({ element: el }).setLngLat([item.longitude, item.latitude]).setPopup(popup).addTo(map);
        el.addEventListener("mouseenter", () => marker.togglePopup());
        el.addEventListener("mouseleave", () => marker.togglePopup());
        markers.push(marker);
      });

      // Frame tightly around the actual data instead of the whole region —
      // fitBounds' own maxZoom cap is what keeps a single cluster of nearby
      // requests from leaving a sea of empty land/ocean around it.
      if (plottable.length > 1) {
        const bounds = plottable.reduce(
          (b, i) => b.extend([i.longitude, i.latitude]),
          new maplibregl.LngLatBounds([plottable[0].longitude, plottable[0].latitude], [plottable[0].longitude, plottable[0].latitude])
        );
        map.fitBounds(bounds, { padding: 70, maxZoom: 17, pitch: 58, bearing: -18, duration: 0 });
      }
    });

    const resizeObserver = new ResizeObserver(() => map.resize());
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      markers.forEach((m) => m.remove());
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, items, hotspots]);

  return <div ref={containerRef} className="map3d-canvas" />;
}
