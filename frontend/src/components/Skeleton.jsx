// Generic shimmer-loading primitives, reused across the KPI strip, the map,
// the priority list, and the requests table while their first fetch is
// in flight. Pure presentation — never used to fabricate data.
export function SkeletonBlock({ width = "100%", height = 14, radius = 6, style }) {
  return (
    <span
      className="skeleton-block"
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div className="kpi kpi--skeleton" aria-hidden="true">
      <SkeletonBlock width="50%" height={11} style={{ marginBottom: 14 }} />
      <SkeletonBlock width="38%" height={30} radius={8} style={{ marginBottom: 12 }} />
      <SkeletonBlock width="70%" height={10} />
    </div>
  );
}

export function SkeletonPriorityRow() {
  return (
    <li className="priority-item" aria-hidden="true">
      <div className="priority-row priority-row--skeleton">
        <SkeletonBlock width={22} height={22} radius={6} />
        <span className="priority-row__main">
          <span className="priority-row__top">
            <SkeletonBlock width="40%" height={13} />
            <SkeletonBlock width={30} height={13} />
          </span>
          <SkeletonBlock width="100%" height={4} radius={999} />
          <SkeletonBlock width="55%" height={10} />
        </span>
      </div>
    </li>
  );
}

export function SkeletonMap() {
  return (
    <div className="map-frame map-frame--skeleton" role="status" aria-label="Loading map">
      <div className="skeleton-block skeleton-block--map" aria-hidden="true" />
      <span className="map-skeleton__label">Loading reports</span>
    </div>
  );
}

export function SkeletonTableRow() {
  return (
    <tr className="requests-table__row--skeleton" aria-hidden="true">
      <td><SkeletonBlock width={70} height={12} /></td>
      <td><SkeletonBlock width={90} height={12} /></td>
      <td><SkeletonBlock width={60} height={12} /></td>
      <td><SkeletonBlock width={70} height={12} /></td>
      <td><SkeletonBlock width={60} height={12} /></td>
    </tr>
  );
}
