import React from 'react';

export default function PartTimeFilter({ checked, setChecked }) {
  return (
    <div className="filter-section part-time-filter">
      <label className="part-time-filter-label">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
        <span>Include Part Time Educators?</span>
      </label>
    </div>
  );
}
