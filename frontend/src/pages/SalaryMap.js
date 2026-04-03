import React, { useState } from 'react';

export default function SalaryMap() {
  // For this starter version we use a placeholder image and simple layout.
  // The filter panel is included but not functional yet.
  const [showFilters, setShowFilters] = useState(false);
  return (
    <div className="card">
      <div className="card-body">
        <h2>Salary Map</h2>
        <p>
          Explore educator pay across Minnesota. Filters will become available
          soon. A future version will include an interactive map.
        </p>
        {/* Mobile filter toggle */}
        <button
          className="mobile-filter-toggle"
          onClick={() => setShowFilters(!showFilters)}
        >
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </button>
        <div
          className={`mobile-filter-overlay ${showFilters ? 'active' : ''}`}
          onClick={() => setShowFilters(false)}
        ></div>
        <div
          className={
            showFilters ? 'mobile-filter-panel open' : 'mobile-filter-panel'
          }
        >
          <h3>Filters</h3>
          <p>Filter controls will appear here.</p>
        </div>
        <div className="row">
          <div className="col col-3 desktop-filter-panel">
            <div className="filter-panel">
              <h3>Filters</h3>
              <p>Filter controls will appear here.</p>
            </div>
          </div>
          <div className="col col-9">
            <img
              src="https://upload.wikimedia.org/wikipedia/commons/thumb/3/3d/Placeholder_view_vector.svg/800px-Placeholder_view_vector.svg.png"
              alt="Placeholder map"
              style={{ width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}