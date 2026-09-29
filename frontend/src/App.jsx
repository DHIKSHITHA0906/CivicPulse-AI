import { useEffect, useState } from "react";
import { Link, NavLink, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { FileEdit, LayoutDashboard, Menu, X } from "lucide-react";
import Submit from "./pages/Submit";
import Dashboard from "./pages/Dashboard";
import SyntheticBanner from "./components/SyntheticBanner";
import BrandMark from "./components/BrandMark";
import CustomCursor from "./components/CustomCursor";
import { t } from "./i18n/strings";

const lang = "en"; // Nav chrome stays in English; Submit.jsx handles its own 4-language switch.

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <CustomCursor />
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <nav className="top-nav" aria-label="Primary">
          <Link to="/" className="top-nav__brand" aria-label={`${t(lang, "appName")} home`}>
            <span className="top-nav__brand-mark">
              <BrandMark />
            </span>
            {t(lang, "appName")}
          </Link>

          <div className="top-nav__links top-nav__links--desktop">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
              <LayoutDashboard size={15} strokeWidth={2} />
              {t(lang, "navDashboard")}
            </NavLink>
            <NavLink to="/submit" className={({ isActive }) => (isActive ? "active" : "")}>
              <FileEdit size={15} strokeWidth={2} />
              {t(lang, "navSubmit")}
            </NavLink>
          </div>

          <button
            type="button"
            className="top-nav__menu-btn"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-nav"
          >
            {menuOpen ? <X size={20} strokeWidth={2} /> : <Menu size={20} strokeWidth={2} />}
          </button>
        </nav>

        {menuOpen && (
          <div className="mobile-nav-drawer fade-in" id="mobile-nav">
            <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
              <LayoutDashboard size={16} strokeWidth={2} />
              {t(lang, "navDashboard")}
            </NavLink>
            <NavLink to="/submit" className={({ isActive }) => (isActive ? "active" : "")}>
              <FileEdit size={16} strokeWidth={2} />
              {t(lang, "navSubmit")}
            </NavLink>
          </div>
        )}

        <SyntheticBanner lang={lang} />
      </header>

      <main className="app-main" id="main" key={location.pathname}>
        <Routes>
          <Route path="/" element={<Navigate to="/submit" replace />} />
          <Route path="/submit" element={<Submit />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
