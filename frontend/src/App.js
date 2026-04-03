import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import Home from './pages/Home';
import SchoolMap from './pages/SchoolMap';
import SalaryFinder from './pages/SalaryFinder';
import Scatterplot from './pages/Scatterplot';
import Methodology from './pages/Methodology';
import AboutProject from './pages/AboutProject';
import EducatorProfile from './pages/EducatorProfile';

function App() {
  // Define navigation items for both top and sidebar navigation. Icons are simple
  // Unicode characters for visual differentiation without external dependencies.
  const navItems = [
    { name: 'Schools', path: '/school-map', icon: '🗺️' },
    { name: 'Compare Pay', path: '/salary-finder', icon: '💲' },
    { name: 'Pay vs. Experience', path: '/scatterplot', icon: '📊' },
    { name: 'About the Data', path: '/methodology', icon: '📄' },
    { name: 'About the Author', path: '/about-project', icon: 'ℹ️' },
  ];

  // State to control the visibility of the mobile navigation panel
  const [showMobileNav, setShowMobileNav] = useState(false);

  return (
    <Router>
      <div className="app">
        {/* Top header */}
        <header className="header">
          <div className="header-left">
            <NavLink to="/" className="brand" onClick={() => setShowMobileNav(false)}>
              {/* Replace the placeholder mark with an apple icon */}
              <div className="brand-icon" role="img" aria-label="apple">🍎</div>
              <span>Minnesota Teacher Pay</span>
            </NavLink>
            {/* Top navigation links (hidden on small screens) */}
            <nav className="top-links">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  className={({ isActive }) =>
                    isActive ? 'active' : undefined
                  }
                  onClick={() => setShowMobileNav(false)}
                >
                  {item.name}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="header-right">
            {/* Hamburger for mobile nav; visible on narrow screens */}
            <button
              className="hamburger"
              onClick={() => setShowMobileNav(!showMobileNav)}
              aria-label="Toggle navigation"
            >
              ☰
            </button>
          </div>
        </header>
        {/* Mobile navigation overlay and panel */}
        <div
          className={showMobileNav ? 'mobile-nav-overlay active' : 'mobile-nav-overlay'}
          onClick={() => setShowMobileNav(false)}
        ></div>
        <div className={showMobileNav ? 'mobile-nav-panel open' : 'mobile-nav-panel'}>
          <nav className="mobile-nav-links">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  isActive ? 'nav-item active' : 'nav-item'
                }
                onClick={() => setShowMobileNav(false)}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.name}</span>
              </NavLink>
            ))}
          </nav>
        </div>
        {/* Main content area */}
        <main className="main">
          <Routes>
            <Route path="/" element={<Home />} />
          {/* Route for the School Map dashboard.  Use the new component
              created for the school map. */}
          <Route path="/school-map" element={<SchoolMap />} />
            <Route path="/salary-finder" element={<SalaryFinder />} />
            <Route path="/scatterplot" element={<Scatterplot />} />
            <Route path="/methodology" element={<Methodology />} />
            <Route path="/about-project" element={<AboutProject />} />
            <Route
              path="/educator/:fileFolderNumber"
              element={<EducatorProfile />}
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
