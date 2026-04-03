import React, { useEffect, useState } from 'react';
// Import components from react-leaflet.  These provide the map,
// tile layer and marker primitives used to render the school map.
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
// Import the Leaflet CSS so that the map displays correctly.  The CSS
// loader configured in webpack will handle this import.
import 'leaflet/dist/leaflet.css';

// A simple multi-select component that displays selected values as
// removable chips.  This replicates the behaviour used elsewhere in
// the application.  The `options` prop is an array of strings, and
// `selected` is the current array of selected values.  The
// `setSelected` callback updates the selection.
function MultiSelectChips({ label, options, selected, setSelected }) {
  const available = options.filter((opt) => !selected.includes(opt));
  const handleAdd = (e) => {
    const value = e.target.value;
    if (value && !selected.includes(value)) {
      setSelected([...selected, value]);
    }
  };
  const handleRemove = (value) => {
    setSelected(selected.filter((item) => item !== value));
  };
  return (
    <div className="filter-section">
      <label>{label}</label>
      <div className="chips">
        {selected.map((item) => (
          <span className="chip" key={item}>
            {item}
            <button type="button" onClick={() => handleRemove(item)}>
              ×
            </button>
          </span>
        ))}
      </div>
      <select value="" onChange={handleAdd}>
        <option value="">Select {label}</option>
        {available.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}

// Main component for the School Map dashboard.  Displays a map with
// circle markers sized by enrollment and tooltips with summary
// statistics.  Includes multi-select filters for district type,
// school classification, county, district and school.  Results are
// fetched from the backend API defined in server.js.
export default function SchoolMap() {
  // State for filter options retrieved from the API.  Each array
  // contains the distinct values for that field.  These values are
  // sorted alphabetically by the backend.
  const [filterOptions, setFilterOptions] = useState({
    districtTypes: [],
    schoolClassifications: [],
    counties: [],
    districts: [],
    schools: [],
  });
  // State for selected filter values.  Empty arrays indicate no
  // filtering on that dimension.
  const [districtTypes, setDistrictTypes] = useState([]);
  const [schoolClassifications, setSchoolClassifications] = useState([]);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [schools, setSchools] = useState([]);

  // State for results returned from the API.  Each entry represents
  // one school with location coordinates and summary metrics.
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // State to control mobile filter panel visibility.
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Load filter options on component mount.  These values do not
  // depend on any user input, so they only need to be fetched once.
  useEffect(() => {
    async function loadOptions() {
      try {
        const apiBase = `${window.location.protocol}//${window.location.hostname}:3001`;
        const resp = await fetch(`${apiBase}/api/school-map/filter-options`);
        if (!resp.ok) throw new Error('Failed to load filter options');
        const json = await resp.json();
        setFilterOptions(json);
      } catch (e) {
        console.error(e);
      }
    }
    loadOptions();
  }, []);

  // Helper to fetch map data based on selected filters.  Constructs a
  // query string from the current selection and sends it to the
  // backend.  When the request completes, updates the `results`
  // state.  Loading and error states are managed here as well.
  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = `${window.location.protocol}//${window.location.hostname}:3001`;
      const params = {};
      if (districtTypes.length > 0) params.districtTypes = districtTypes.join(',');
      if (schoolClassifications.length > 0) params.schoolClassifications = schoolClassifications.join(',');
      if (counties.length > 0) params.counties = counties.join(',');
      if (districts.length > 0) params.districts = districts.join(',');
      if (schools.length > 0) params.schools = schools.join(',');
      const query = new URLSearchParams(params).toString();
      const url = `${apiBase}/api/school-map${query ? `?${query}` : ''}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load school map data');
      const json = await resp.json();
      setResults(json.results || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Fetch initial results on mount so that the map displays all
  // schools by default.
  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine a reasonable circle marker radius based on the school
  // enrollment.  Very large schools should not dominate the map.  We
  // use the square root of enrollment scaled down and clamp the
  // radius to a maximum value.
  const getRadius = (enrollment) => {
    if (!enrollment || enrollment <= 0) return 3;
    // Scale factor chosen empirically for a pleasant visual range.
    return Math.min(20, Math.sqrt(enrollment) / 5);
  };

  // Compute the default map center and zoom.  Minnesota roughly
  // centers around latitude 46 and longitude -94.  A zoom level of 6
  // shows the entire state on most screens.
  const mapCenter = [46.0, -94.0];
  const mapZoom = 6;

  // Reset all filters to their default (empty selections) and reload
  // the full set of schools.  Useful when the user wants to clear
  // selections and see statewide data again.
  const resetFilters = () => {
    setDistrictTypes([]);
    setSchoolClassifications([]);
    setCounties([]);
    setDistricts([]);
    setSchools([]);
    // Reload results and close mobile drawer if open.
    fetchResults();
    setShowFiltersMobile(false);
  };

  return (
    <div className="card">
      <div className="card-body">
        {/* Page header with title and description */}
        <div className="page-header">
          <div className="page-title">
            <h2>School Map</h2>
            <p>Explore Minnesota schools and summary statistics. Filter by district type, classification and location.</p>
          </div>
          {/* Mobile filter toggle button */}
          <div className="toolbar">
            <button
              className="button secondary mobile-filter-toggle"
              onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            >
              {showFiltersMobile ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
        </div>
        {/* Mobile filter overlay and panel */}
        <div
          className={showFiltersMobile ? 'mobile-filter-overlay active' : 'mobile-filter-overlay'}
          onClick={() => setShowFiltersMobile(false)}
        ></div>
        <div className={showFiltersMobile ? 'mobile-filter-panel open' : 'mobile-filter-panel'}>
          <div className="filter-panel">
            <h3>Filters</h3>
            <MultiSelectChips
              label="District Type"
              options={filterOptions.districtTypes}
              selected={districtTypes}
              setSelected={setDistrictTypes}
            />
            <MultiSelectChips
              label="School Classification"
              options={filterOptions.schoolClassifications}
              selected={schoolClassifications}
              setSelected={setSchoolClassifications}
            />
            <MultiSelectChips
              label="County"
              options={filterOptions.counties}
              selected={counties}
              setSelected={setCounties}
            />
            <MultiSelectChips
              label="District"
              options={filterOptions.districts}
              selected={districts}
              setSelected={setDistricts}
            />
            <MultiSelectChips
              label="School"
              options={filterOptions.schools}
              selected={schools}
              setSelected={setSchools}
            />
            <div className="filter-buttons" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button className="button secondary" onClick={resetFilters}>
                Reset Filters
              </button>
              <button className="button primary" onClick={() => { fetchResults(); setShowFiltersMobile(false); }}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
        {/* Desktop layout: filter panel and map side by side */}
        <div className="row">
          <div className="col col-3 desktop-filter-panel">
            <div className="filter-panel">
              <h3>Filters</h3>
              <MultiSelectChips
                label="District Type"
                options={filterOptions.districtTypes}
                selected={districtTypes}
                setSelected={setDistrictTypes}
              />
              <MultiSelectChips
                label="School Classification"
                options={filterOptions.schoolClassifications}
                selected={schoolClassifications}
                setSelected={setSchoolClassifications}
              />
              <MultiSelectChips
                label="County"
                options={filterOptions.counties}
                selected={counties}
                setSelected={setCounties}
              />
              <MultiSelectChips
                label="District"
                options={filterOptions.districts}
                selected={districts}
                setSelected={setDistricts}
              />
              <MultiSelectChips
                label="School"
                options={filterOptions.schools}
                selected={schools}
                setSelected={setSchools}
              />
              <div className="filter-buttons" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                <button className="button secondary" onClick={resetFilters}>
                  Reset Filters
                </button>
                <button className="button primary" onClick={fetchResults}>
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
          <div className="col col-9">
            {loading && <p>Loading data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!loading && !error && (
              results.length === 0 ? (
                <p>No schools match your filters.</p>
              ) : (
                // Wrap the map in a div with a fixed height so that the
                // Leaflet map renders correctly.  Without a height the
                // container would collapse to 0.
                <div style={{ height: '600px', width: '100%' }}>
                  <MapContainer center={mapCenter} zoom={mapZoom} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
                    {/* Use an open source tile layer from OpenStreetMap.  Attribution is included per terms. */}
                    <TileLayer
                      attribution="&copy; <a href=\"https://www.openstreetmap.org/copyright\">OpenStreetMap</a> contributors"
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {results.map((school) => (
                      <CircleMarker
                        key={`${school.school_number}-${school.district_number}`}
                        center={[school.latitude, school.longitude]}
                        radius={getRadius(school.student_enrollment)}
                        color="#355cbb"
                        fillColor="#355cbb"
                        fillOpacity={0.6}
                        stroke={false}
                      >
                        <Tooltip direction="top" offset={[0, -4]} opacity={1} className="map-tooltip">
                          <div>
                            <strong>{school.school_name}</strong>
                            {school.district_name && <div>District: {school.district_name}</div>}
                            <div>Enrollment: {school.student_enrollment?.toLocaleString()}</div>
                            <div>Students of Color: {school.student_students_of_color_pct != null ? `${(school.student_students_of_color_pct * 100).toFixed(1)}%` : '—'}</div>
                            <div>Teachers of Color: {school.teacher_teachers_of_color_pct != null ? `${(school.teacher_teachers_of_color_pct * 100).toFixed(1)}%` : '—'}</div>
                            <div>Median Salary: {school.median_teacher_salary != null ? `$${Math.round(school.median_teacher_salary).toLocaleString()}` : '—'}</div>
                            <div>Median Experience: {school.median_years_experience != null ? school.median_years_experience.toFixed(1) : '—'} years</div>
                            <div>Median Education: {school.median_education_level_label || '—'}</div>
                          </div>
                        </Tooltip>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}