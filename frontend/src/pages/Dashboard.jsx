import { useEffect, useMemo, useState } from "react";
import { ClipboardList, Gauge, MapPinned, TrendingUp, ShieldAlert, MapPin, RefreshCw, CloudOff, AlertTriangle } from "lucide-react";
import BrandMark from "../components/BrandMark";
import SectionDivider from "../components/SectionDivider";
import SituationOverview from "../components/SituationOverview";
import MapView from "../components/Map";
import PriorityPanel from "../components/PriorityPanel";
import StatRow from "../components/StatRow";
import SeverityDonut from "../components/SeverityDonut";
import RequestsTable from "../components/RequestsTable";
import RequestDetailModal from "../components/RequestDetailModal";
import { SkeletonStatCard, SkeletonMap, SkeletonPriorityRow } from "../components/Skeleton";
import { CATEGORY_LABEL, RECOMMENDATION_LABEL, formatCoord, timeAgo } from "../components/labels";
import { DISTRICTS, CATEGORIES, STATES } from "../constants";
import { getRequests, getPriority } from "../api";

export default function Dashboard() {
  const [districtId, setDistrictId] = useState("madurai");
  const [category, setCategory] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [requests, setRequests] = useState([]);
  const [requestsMeta, setRequestsMeta] = useState({ isCached: false, error: null });
  const [requestsLoading, setRequestsLoading] = useState(true);

  const [priorities, setPriorities] = useState([]);
  const [priorityMeta, setPriorityMeta] = useState({ isCached: false, error: null });
  const [priorityLoading, setPriorityLoading] = useState(true);

  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  // Presentation-only state: two-way hover link between priorities and markers,
  // and the time the last fetch finished (for the header status line).
  const [hoverCategory, setHoverCategory] = useState(null);
  const [syncedAt, setSyncedAt] = useState(null);

  useEffect(() => {
    let active = true;
    setRequestsLoading(true);
    getRequests({ district_id: districtId, category: category || undefined }).then((res) => {
      if (!active) return;
      setRequests(res.data?.requests ?? []);
      setRequestsMeta({ isCached: res.isCached, error: res.error });
      setSyncedAt(new Date());
      setRequestsLoading(false);
    });
    return () => {
      active = false;
    };
  }, [districtId, category, reloadKey]);

  useEffect(() => {
    let active = true;
    setPriorityLoading(true);
    getPriority(districtId).then((res) => {
      if (!active) return;
      setPriorities(res.data?.priorities ?? []);
      setPriorityMeta({ isCached: res.isCached, error: res.error });
      setSelectedCategory(null);
      setSyncedAt(new Date());
      setPriorityLoading(false);
    });
    return () => {
      active = false;
    };
  }, [districtId, reloadKey]);

  const anyCached = requestsMeta.isCached || priorityMeta.isCached;
  const anyError = (requestsMeta.error || priorityMeta.error) && !anyCached;
  const requestsFailed = requestsMeta.error === "unavailable";
  const priorityFailed = priorityMeta.error === "unavailable";
  const activeDistrict = DISTRICTS.find((d) => d.district_id === districtId);

  // Client-side aggregates for the KPI strip and district context — derived
  // from data already fetched above (requests + priorities), not new API calls.
  const requestCount = requests.length;
  const avgConfidence = requestCount ? requests.reduce((sum, r) => sum + (r.confidence ?? 0), 0) / requestCount : 0;
  const confidences = requests.map((r) => r.confidence ?? 0);
  const needsReviewCount = requests.filter((r) => r.needs_review).length;
  const severeCount = requests.filter((r) => r.severity >= 4).length;

  const hotspotCount = useMemo(() => {
    const cellSize = 0.02;
    const counts = new Map();
    for (const r of requests) {
      if (r.latitude == null || r.longitude == null) continue;
      const key = `${Math.round(r.latitude / cellSize)}:${Math.round(r.longitude / cellSize)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    let hotspots = 0;
    for (const [, c] of counts) if (c >= 3) hotspots += 1;
    return hotspots;
  }, [requests]);

  const context = useMemo(() => {
    const byCategory = new Map();
    let affected = 0;
    let latest = null;
    for (const r of requests) {
      byCategory.set(r.category, (byCategory.get(r.category) ?? 0) + 1);
      affected += r.affected_population ?? 0;
      if (!latest || new Date(r.timestamp) > new Date(latest)) latest = r.timestamp;
    }
    const top = [...byCategory.entries()].sort((a, b) => b[1] - a[1])[0];
    return { affected, latest, topCategory: top?.[0] ?? null, topCount: top?.[1] ?? 0 };
  }, [requests]);

  const topPriority = priorities[0];

  const severityBuckets = {
    critical: requests.filter((r) => r.severity >= 5).length,
    high: requests.filter((r) => r.severity === 4).length,
    medium: requests.filter((r) => r.severity === 3).length,
    low: requests.filter((r) => r.severity <= 2).length,
  };

  // Header status is derived from fetch state that already exists above.
  const feedLoading = requestsLoading || priorityLoading;
  const feed = feedLoading
    ? { key: "sync", label: "Syncing" }
    : anyCached
      ? { key: "cached", label: "Saved view" }
      : requestsFailed || priorityFailed
        ? { key: "offline", label: "Offline" }
        : { key: "live", label: "Live" };
  const syncedLabel = syncedAt ? syncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  const stats = [
    {
      label: "Open requests",
      value: requestCount,
      note: requestCount ? `${severeCount} high or critical` : "Nothing reported",
      tone: severeCount > 0 ? "high" : "neutral",
      icon: <ClipboardList size={14} strokeWidth={2} />,
      viz: { type: "bars", values: [severityBuckets.low, severityBuckets.medium, severityBuckets.high, severityBuckets.critical] },
    },
    {
      label: "Avg. confidence",
      value: `${Math.round(avgConfidence * 100)}%`,
      note: requestCount ? `Range ${Math.round(Math.min(...confidences) * 100)}–${Math.round(Math.max(...confidences) * 100)}%` : "No data",
      tone: "sage",
      icon: <Gauge size={14} strokeWidth={2} />,
      viz: requestCount ? { type: "range", min: Math.min(...confidences), max: Math.max(...confidences), value: avgConfidence } : null,
    },
    {
      label: "Demand hotspots",
      value: hotspotCount,
      note: "3+ reports within about 2 km",
      tone: hotspotCount > 0 ? "copper" : "neutral",
      icon: <MapPinned size={14} strokeWidth={2} />,
      viz: { type: "dots", count: hotspotCount, max: 8 },
    },
    {
      label: "Top priority",
      value: topPriority ? CATEGORY_LABEL[topPriority.category] ?? topPriority.category : "—",
      note: topPriority
        ? `Score ${topPriority.priority_score.toFixed(2)}, ${RECOMMENDATION_LABEL[topPriority.recommendation_type] ?? topPriority.recommendation_type}`
        : "No scores yet",
      tone: "critical",
      icon: <TrendingUp size={14} strokeWidth={2} />,
      viz: topPriority ? { type: "meter", value: topPriority.priority_score } : null,
    },
    {
      label: "Needs review",
      value: needsReviewCount,
      note: requestCount ? `${Math.round((needsReviewCount / requestCount) * 100)}% of the queue` : "Queue is clear",
      tone: needsReviewCount > 0 ? "critical" : "sage",
      icon: <ShieldAlert size={14} strokeWidth={2} />,
      viz: requestCount ? { type: "meter", value: needsReviewCount / requestCount } : null,
    },
  ];

  function retry() {
    setReloadKey((k) => k + 1);
  }

  const mapEmptyState = requestsFailed ? (
    <>
      <CloudOff size={22} strokeWidth={1.7} />
      <p className="map-empty__title">Map data unavailable</p>
      <p>We couldn't reach the data service, and there's no saved copy for this view.</p>
      <button type="button" className="btn btn--ghost btn--small" onClick={retry}>
        <RefreshCw size={14} strokeWidth={2.2} />
        Try again
      </button>
    </>
  ) : (
    <>
      <MapPin size={22} strokeWidth={1.7} />
      <p className="map-empty__title">No reports match these filters</p>
      <p>{category ? `Nothing in ${CATEGORY_LABEL[category] ?? category} for ${activeDistrict?.name ?? "this district"}.` : "No reports have been filed for this district yet."}</p>
      {category && (
        <button type="button" className="btn btn--ghost btn--small" onClick={() => setCategory("")}>
          Show all categories
        </button>
      )}
    </>
  );

  return (
    <div className="dashboard">
      <header className="deck reveal" aria-label="District command header">
        <div className="deck__top">
          <div className="deck__brand">
            <span className="deck__mark">
              <BrandMark size={26} />
            </span>
            <span className="deck__brand-text">
              <span className="deck__name">CivicPulse</span>
              <span className="deck__sub">District intelligence</span>
            </span>
          </div>
          <div className={`deck__status deck__status--${feed.key}`} role="status" aria-live="polite">
            <span className="deck__pulse" aria-hidden="true" />
            <span className="deck__status-label">{feed.label}</span>
            {syncedLabel && !feedLoading && <span className="deck__time">Updated {syncedLabel}</span>}
          </div>
        </div>

        <div className="deck__main">
          <div className="deck__district">
            <p className="deck__state">
              <MapPin size={14} strokeWidth={2.2} />
              {activeDistrict?.state}
            </p>
            <h1>{activeDistrict?.name ?? "District"}</h1>
            {activeDistrict && <p className="deck__coords">{formatCoord(activeDistrict.lat, activeDistrict.long)}</p>}
          </div>

          <dl className="deck__facts">
            <div>
              <dt>People affected (est.)</dt>
              <dd>{requestsLoading ? <span className="skeleton-block skeleton-block--inline" /> : context.affected ? context.affected.toLocaleString() : "—"}</dd>
            </div>
            <div>
              <dt>Most reported</dt>
              <dd>
                {requestsLoading ? (
                  <span className="skeleton-block skeleton-block--inline" />
                ) : context.topCategory ? (
                  <>
                    {CATEGORY_LABEL[context.topCategory] ?? context.topCategory}
                    <span className="deck__fact-note">{context.topCount} reports</span>
                  </>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <div>
              <dt>Latest report</dt>
              <dd>{requestsLoading ? <span className="skeleton-block skeleton-block--inline" /> : context.latest ? timeAgo(context.latest) : "—"}</dd>
            </div>
          </dl>
        </div>

        <section className="filter-bar" aria-label="Filters">
          <div className="filter-group">
            <span className="filter-group__label" id="district-filter-label">
              District
            </span>
            <div className="segmented" role="radiogroup" aria-labelledby="district-filter-label">
              {STATES.map((state) => (
                <div className="segmented__cluster" key={state}>
                  <span className="segmented__state">{state}</span>
                  <div className="segmented__options">
                    {DISTRICTS.filter((d) => d.state === state).map((d) => (
                      <button
                        key={d.district_id}
                        type="button"
                        role="radio"
                        aria-checked={districtId === d.district_id}
                        className={`segmented__btn${districtId === d.district_id ? " segmented__btn--active" : ""}`}
                        onClick={() => setDistrictId(d.district_id)}
                      >
                        {d.name}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group__label" id="category-filter-label">
              Category
            </span>
            <div className="chips" role="radiogroup" aria-labelledby="category-filter-label">
              <button type="button" role="radio" aria-checked={category === ""} className={`chip${category === "" ? " chip--active" : ""}`} onClick={() => setCategory("")}>
                All
              </button>
              {CATEGORIES.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  className={`chip${category === c ? " chip--active" : ""}`}
                  onClick={() => setCategory(c)}
                >
                  {CATEGORY_LABEL[c] ?? c}
                </button>
              ))}
            </div>
          </div>
        </section>
      </header>

      <SectionDivider index="01" label="Overview" hint="Key readings for this district" />

      {requestsLoading ? (
        <div className="kpi-strip" aria-busy="true">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonStatCard key={i} />
          ))}
        </div>
      ) : (
        <StatRow stats={stats} />
      )}

      {anyCached && (
        <div className="alert alert--notice" role="status">
          <CloudOff size={16} strokeWidth={2.2} />
          <span>Showing your last saved view. Live data couldn't be reached.</span>
          <button type="button" className="alert__action" onClick={retry}>
            <RefreshCw size={13} strokeWidth={2.4} />
            Retry
          </button>
        </div>
      )}
      {anyError && (
        <div className="alert alert--error" role="alert">
          <AlertTriangle size={16} strokeWidth={2.2} />
          <span>
            <strong>We couldn't load this data.</strong> Check your connection and try again.
          </span>
          <button type="button" className="alert__action" onClick={retry}>
            <RefreshCw size={13} strokeWidth={2.4} />
            Retry
          </button>
        </div>
      )}

      <SituationOverview
        requests={requests}
        priorities={priorities}
        loading={requestsLoading || priorityLoading}
        focusCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      <SectionDivider index="02" label="Map & priorities" hint="Select a category to spotlight its reports" />

      <div className="dashboard__body reveal">
        <div className="dashboard__map">
          {requestsLoading ? (
            <SkeletonMap />
          ) : (
            <MapView
              items={requests}
              onSelectCategory={setSelectedCategory}
              onSelectRequest={setSelectedRequest}
              focusCategory={selectedCategory}
              emptyState={mapEmptyState}
              hoverCategory={hoverCategory}
              onHoverCategory={setHoverCategory}
            />
          )}
        </div>

        <div className="dashboard__rail">
          {priorityLoading ? (
            <section className="panel priority-panel" aria-busy="true">
              <header className="panel__header">
                <h2 className="panel__title">Priority ranking</h2>
              </header>
              <ol className="priority-list">
                {Array.from({ length: 6 }).map((_, i) => (
                  <SkeletonPriorityRow key={i} />
                ))}
              </ol>
            </section>
          ) : priorityFailed ? (
            <section className="panel priority-panel">
              <header className="panel__header">
                <h2 className="panel__title">Priority ranking</h2>
              </header>
              <div className="state-block">
                <CloudOff size={22} strokeWidth={1.7} />
                <p className="state-block__title">Priorities unavailable</p>
                <p className="muted">We couldn't load scores for this district.</p>
                <button type="button" className="btn btn--ghost btn--small" onClick={retry}>
                  <RefreshCw size={14} strokeWidth={2.2} />
                  Try again
                </button>
              </div>
            </section>
          ) : (
            <PriorityPanel
              priorities={priorities}
              selectedCategory={selectedCategory}
              onSelect={setSelectedCategory}
              requests={requests}
              hoverCategory={hoverCategory}
              onHoverCategory={setHoverCategory}
            />
          )}
        </div>
      </div>

      <SectionDivider index="03" label="Details" hint="Severity mix and the reports behind it" />

      <div className="dashboard__lower reveal">
        <SeverityDonut requests={requests} />
        <RequestsTable requests={requests} loading={requestsLoading} onSelectRequest={setSelectedRequest} />
      </div>

      <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} />
    </div>
  );
}
