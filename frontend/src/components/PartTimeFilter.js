import React from 'react';

export default function PartTimeFilter({ checked, setChecked }) {
  return (
    <div className="filter-section part-time-filter">
      <div className="part-time-filter-label">Include Part Time Educators?</div>
      <label className="part-time-filter-checkbox-row">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      </label>
    </div>
  );
}
