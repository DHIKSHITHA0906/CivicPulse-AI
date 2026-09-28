// severity is an integer 1–5 on CitizenRequest (Master Reference Section 2.1).
// Section 6.2 requires markers "colored/sized by severity" — both derived
// from the same raw integer field, never renamed. Shared by Map.jsx (flat
// Leaflet view), Map3D.jsx (MapLibre 3D view) and SeverityDonut so every
// view agrees on the same restrained severity ramp: brick → amber → straw → sage.

export function severityColor(severity) {
  if (severity >= 5) return "#d24d3a"; // critical
  if (severity === 4) return "#e0902e"; // high
  if (severity === 3) return "#d3bd6a"; // medium
  return "#7fa885"; // 1–2: low
}

export function severityRadius(severity) {
  return 5 + severity * 1.4;
}

export function severityLabel(severity) {
  if (severity >= 5) return "Critical";
  if (severity === 4) return "High";
  if (severity === 3) return "Medium";
  return "Low";
}

// Groups nearby requests into a coarse grid so 3+ requests in the same cell
// render as a hotspot ring (spec: "multiple requests form a demand hotspot").
export function toHotspots(items) {
  const cellSize = 0.02;
  const cells = new Map();
  for (const item of items) {
    const key = `${Math.round(item.latitude / cellSize)}:${Math.round(item.longitude / cellSize)}`;
    if (!cells.has(key)) cells.set(key, []);
    cells.get(key).push(item);
  }
  return Array.from(cells.values()).map((group) => ({
    latitude: group.reduce((s, g) => s + g.latitude, 0) / group.length,
    longitude: group.reduce((s, g) => s + g.longitude, 0) / group.length,
    count: group.length,
  }));
}
