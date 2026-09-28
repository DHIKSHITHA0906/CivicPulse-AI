# Visual redesign — change list (frontend only)

No changes to: `src/api.js`, `src/constants.js`, `src/i18n/*`, `vite.config.js`, `package.json`,
Firebase config, routes, or any API call / response shape. No new dependencies.

New files
- src/theme-refine.css            cinematic theme layer (imported last in main.jsx)
- src/components/CustomCursor.jsx luminous cursor (touch/fallback safe, fullscreen-aware)
- src/components/SituationOverview.jsx  district overview built from already-fetched data
- src/components/SectionDivider.jsx     overview → map → priorities → details markers
- src/components/BrandMark.jsx          logo mark extracted from App.jsx

Edited (presentation/props only)
- src/main.jsx                  + import "./theme-refine.css"
- src/App.jsx                   mounts <CustomCursor />, uses shared BrandMark
- src/pages/Dashboard.jsx       new header deck, KPI viz data, overview, dividers, hover-link state
- src/components/StatRow.jsx    mini visualizations + hover light (same `stats` prop, optional `viz`)
- src/components/Map.jsx        HUD, readout, spotlight rings, hotspot toggle (new props are optional)
- src/components/PriorityPanel.jsx  optional hoverCategory / onHoverCategory props

Cursor: set `data-cursor="hover"` on any custom element that should trigger the hover state.
