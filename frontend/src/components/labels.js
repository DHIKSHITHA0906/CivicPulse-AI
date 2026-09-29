// Presentation helpers shared by the dashboard components. Nothing here
// renames or reshapes an API field — it only maps raw values (category,
// severity 1–5, recommendation_type, ISO timestamps) to display text.

export const CATEGORY_LABEL = {
  water: "Water",
  healthcare: "Healthcare",
  education: "Education",
  roads: "Roads",
  sanitation: "Sanitation",
  other: "Other",
};

export const RECOMMENDATION_LABEL = {
  NEW_INTERVENTION: "New intervention",
  ACCELERATE: "Accelerate",
  REVIEW_EXPAND: "Review & expand",
  MONITOR: "Monitor",
  CONSIDER_REDIRECT: "Consider redirect",
  NO_ACTION_FLAGGED: "No action (flagged)",
};

export function severityTone(severity) {
  if (severity >= 5) return "critical";
  if (severity === 4) return "high";
  if (severity === 3) return "medium";
  return "low";
}

export function severityLabel(severity) {
  if (severity >= 5) return "Critical";
  if (severity === 4) return "High";
  if (severity === 3) return "Medium";
  return "Low";
}

export function humanize(value) {
  return (value ?? "").replace(/_/g, " ");
}

export function timeAgo(iso) {
  if (!iso) return "—";
  const diffMs = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diffMs / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  return new Date(iso).toLocaleDateString();
}

export function formatCoord(lat, long) {
  if (lat == null || long == null) return "";
  const ns = lat >= 0 ? "N" : "S";
  const ew = long >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(2)}° ${ns}, ${Math.abs(long).toFixed(2)}° ${ew}`;
}
