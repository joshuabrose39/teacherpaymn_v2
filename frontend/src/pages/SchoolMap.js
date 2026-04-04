import React, { Fragment, useEffect, useState } from 'react';
// Import components from react-leaflet.  These provide the map,
// tile layer and marker primitives used to render the school map.
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet';
// Import the Leaflet CSS so that the map displays correctly.  The CSS
// loader configured in webpack will handle this import.
import 'leaflet/dist/leaflet.css';
import CheckboxMultiSelect from '../components/CheckboxMultiSelect';
import PartTimeFilter from '../components/PartTimeFilter';
import {
  DISTRICT_TYPE_CATEGORY_OPTIONS,
  filterSelectedDistrictTypes,
  getDistrictTypesForCategories,
  resolveDistrictTypesForFilter,
} from '../utils/districtTypeCategories';
import { orderSchoolClassificationOptions } from '../utils/schoolClassificationOptions';
import { apiUrl } from '../utils/api';

const DEFAULT_DISTRICT_TYPES = [];

const DISTRICT_TYPE_COLORS = {
  'Charter School District': '#FE6100',
  'Charter Schools': '#FE6100',
  'Independent School District': '#648FFF',
  'Independent Districts and Schools': '#648FFF',
  'Special School District': '#648FFF',
  'Special Districts and Schools': '#648FFF',
  other: '#DC267F',
};

const DISTRICT_TYPE_PATTERNS = {
  'Charter School District': 'dashed-ring',
  'Charter Schools': 'dashed-ring',
  'Independent School District': 'solid-ring',
  'Independent Districts and Schools': 'solid-ring',
  'Special School District': 'solid-ring',
  'Special Districts and Schools': 'solid-ring',
  other: 'double-ring',
};

const TWIN_CITIES_CENTER = [44.9537, -93.09];
const TWIN_CITIES_ZOOM = 9;

// Main component for the School Map dashboard.  Displays a map with
// circle markers sized by enrollment and tooltips with summary
// statistics.  Includes multi-select filters for district type and
// school classification. Results are
// fetched from the backend API defined in server.js.
export default function SchoolMap() {
  // State for filter options retrieved from the API.  Each array
  // contains the distinct values for that field.  These values are
  // sorted alphabetically by the backend.
  const [filterOptions, setFilterOptions] = useState({
    districtTypes: [],
    schoolClassifications: [],
  });
  // State for selected filter values.  Empty arrays indicate no
  // filtering on that dimension.
  const [districtTypeCategories, setDistrictTypeCategories] = useState([]);
  const [districtTypes, setDistrictTypes] = useState(DEFAULT_DISTRICT_TYPES);
  const [schoolClassifications, setSchoolClassifications] = useState([]);
  const [includePartTime, setIncludePartTime] = useState(false);
  const availableDistrictTypes = getDistrictTypesForCategories(
    filterOptions.districtTypes,
    districtTypeCategories,
  );

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
        const resp = await fetch(apiUrl('/api/school-map/filter-options'));
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
  const fetchResults = async (nextFilters = {}) => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      const activeDistrictTypeCategories = nextFilters.districtTypeCategories ?? districtTypeCategories;
      const rawDistrictTypes = nextFilters.districtTypes ?? districtTypes;
      const activeDistrictTypes = resolveDistrictTypesForFilter(
        filterOptions.districtTypes,
        rawDistrictTypes,
        activeDistrictTypeCategories,
      );
      const activeSchoolClassifications = nextFilters.schoolClassifications ?? schoolClassifications;
      const activeIncludePartTime = nextFilters.includePartTime ?? includePartTime;
      if (activeDistrictTypes.length > 0) params.districtTypes = activeDistrictTypes.join(',');
      if (activeSchoolClassifications.length > 0) params.schoolClassifications = activeSchoolClassifications.join(',');
      if (activeIncludePartTime) params.includePartTime = 'true';
      const query = new URLSearchParams(params).toString();
      const url = apiUrl(`/api/school-map${query ? `?${query}` : ''}`);
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
    if (!enrollment || enrollment <= 0) return 6;
    // Scale factor chosen empirically for a pleasant visual range.
    return Math.min(40, (Math.sqrt(enrollment) / 5) * 2);
  };

  const getCircleColor = (districtType) =>
    DISTRICT_TYPE_COLORS[districtType] || DISTRICT_TYPE_COLORS.other;

  const getCirclePattern = (districtType) =>
    DISTRICT_TYPE_PATTERNS[districtType] || DISTRICT_TYPE_PATTERNS.other;

  // Reset all filters to their defaults and reload the map data.
  const resetFilters = () => {
    setDistrictTypeCategories([]);
    const nextDistrictTypes = [...DEFAULT_DISTRICT_TYPES];
    setDistrictTypes(nextDistrictTypes);
    setSchoolClassifications([]);
    setIncludePartTime(false);
    // Reload results and close mobile drawer if open.
    fetchResults({
      districtTypeCategories: [],
      districtTypes: nextDistrictTypes,
      schoolClassifications: [],
      includePartTime: false,
    });
    setShowFiltersMobile(false);
  };

  const sizeLegendItems = [250, 1000, 2500];
  const colorLegendItems = [
    {
      label: 'Charter Schools',
      color: DISTRICT_TYPE_COLORS['Charter Schools'],
      pattern: DISTRICT_TYPE_PATTERNS['Charter Schools'],
    },
    {
      label: 'Traditional Public Schools',
      color: DISTRICT_TYPE_COLORS['Independent Districts and Schools'],
      pattern: DISTRICT_TYPE_PATTERNS['Independent Districts and Schools'],
    },
    {
      label: 'All Other District Types',
      color: DISTRICT_TYPE_COLORS.other,
      pattern: DISTRICT_TYPE_PATTERNS.other,
    },
  ];

  return (
    <div className="card page-shell">
      <div className="card-body">
        {/* Page header with title and description */}
        <div className="page-header">
          <div className="page-title">
            <h2>School Map</h2>
            <p>Explore Minnesota schools and summary statistics. Filter by district type and school classification.</p>
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
            <CheckboxMultiSelect
              label="District Category"
              options={DISTRICT_TYPE_CATEGORY_OPTIONS}
              selected={districtTypeCategories}
              setSelected={(nextCategories) => {
                setDistrictTypeCategories(nextCategories);
                setDistrictTypes((current) => filterSelectedDistrictTypes(current, nextCategories));
              }}
            />
            <CheckboxMultiSelect
              label="District Type"
              options={availableDistrictTypes}
              selected={districtTypes}
              setSelected={setDistrictTypes}
            />
            <CheckboxMultiSelect
              label="School Classification"
              options={orderSchoolClassificationOptions(filterOptions.schoolClassifications)}
              selected={schoolClassifications}
              setSelected={setSchoolClassifications}
            />
            <PartTimeFilter checked={includePartTime} setChecked={setIncludePartTime} />
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
        <div className="row school-map-top-row">
          <div className="col col-3 desktop-filter-panel school-map-sidebar-column">
            <div className="filter-sidebar-shell filter-panel-shell dashboard-filter-card school-map-filter-card">
              <div className="filter-sidebar-header">
                <h3 className="filter-sidebar-title">Filters</h3>
                <div className="filter-buttons salary-finder-sticky-filter-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <button className="button secondary" onClick={resetFilters}>
                    Reset Filters
                  </button>
                  <button className="button primary" onClick={fetchResults}>
                    Apply Filters
                  </button>
                </div>
              </div>
              <div className="filter-panel school-map-filter-panel">
                <CheckboxMultiSelect
                  label="District Category"
                  options={DISTRICT_TYPE_CATEGORY_OPTIONS}
                  selected={districtTypeCategories}
                  setSelected={(nextCategories) => {
                    setDistrictTypeCategories(nextCategories);
                    setDistrictTypes((current) => filterSelectedDistrictTypes(current, nextCategories));
                  }}
                />
                <CheckboxMultiSelect
                  label="District Type"
                  options={availableDistrictTypes}
                  selected={districtTypes}
                  setSelected={setDistrictTypes}
                />
                <CheckboxMultiSelect
                  label="School Classification"
                  options={orderSchoolClassificationOptions(filterOptions.schoolClassifications)}
                  selected={schoolClassifications}
                  setSelected={setSchoolClassifications}
                />
                <PartTimeFilter checked={includePartTime} setChecked={setIncludePartTime} />
              </div>
            </div>
          </div>
          <div className="col col-9 school-map-chart-column">
            <div className="card school-map-card">
              <div className="card-body school-map-card-body">
                {loading ? (
                  <div className="empty-chart-message chart-panel-message">
                    <p style={{ textAlign: 'center', margin: '2rem 0' }}>Loading data...</p>
                  </div>
                ) : error ? (
                  <div className="empty-chart-message chart-panel-message">
                    <p style={{ textAlign: 'center', margin: '2rem 0', color: 'red' }}>{error}</p>
                  </div>
                ) : results.length === 0 ? (
                  <div className="empty-chart-message chart-panel-message">
                    <p style={{ textAlign: 'center', margin: '2rem 0' }}>No schools match your filters.</p>
                  </div>
                ) : (
                  <>
                    <div className="school-map-legend-bar">
                      <div className="school-map-legend-group">
                        <div className="school-map-legend-title">District type</div>
                        <div className="school-map-legend-items">
                          {colorLegendItems.map((item) => (
                            <div key={item.label} className="school-map-legend-item">
                              <span
                                className={`school-map-legend-dot ${item.pattern}`}
                                style={{ background: item.color }}
                              ></span>
                              <span>{item.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="school-map-legend-group">
                        <div className="school-map-legend-title">Circle size</div>
                        <div className="school-map-size-note">Student enrollment</div>
                        <div className="school-map-size-items">
                          {sizeLegendItems.map((value) => {
                            const radius = getRadius(value);
                            return (
                              <div key={value} className="school-map-size-item">
                                <div
                                  className="school-map-size-circle"
                                  style={{
                                    width: `${radius * 2}px`,
                                    height: `${radius * 2}px`,
                                  }}
                                ></div>
                                <div>{value.toLocaleString()}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="school-map-map-wrap">
                      <MapContainer center={TWIN_CITIES_CENTER} zoom={TWIN_CITIES_ZOOM} scrollWheelZoom={true} style={{ height: '100%', width: '100%' }}>
                        {/* Use an open source tile layer from OpenStreetMap.  Attribution is included per terms. */}
                        <TileLayer
                          /*
                           * Use a plain text attribution.  HTML tags are not allowed in JSX
                           * string literals because React treats namespace prefixes (e.g. <a>)
                           * as invalid JSX.  Including them here caused a compile error.
                           */
                          attribution="© OpenStreetMap contributors"
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        {results.map((school) => {
                          const radius = getRadius(school.student_enrollment);
                          const color = getCircleColor(school.district_type_name);
                          const pattern = getCirclePattern(school.district_type_name);
                          const markerKey = `${school.school_number}-${school.district_number}`;
                          const center = [school.latitude, school.longitude];

                          return (
                            <Fragment key={markerKey}>
                              <CircleMarker
                                center={center}
                                radius={radius}
                                color={color}
                                fillColor={color}
                                fillOpacity={0.6}
                                stroke={false}
                              >
                                <Tooltip direction="top" offset={[0, -4]} opacity={1} className="map-tooltip">
                                  <div>
                                    <strong>{school.school_name}</strong>
                                    {school.district_name && <div>District: {school.district_name}</div>}
                                    <div>Enrollment: {school.student_enrollment?.toLocaleString()}</div>
                                    <div>Median Salary: {school.median_teacher_salary != null ? `$${Math.round(school.median_teacher_salary).toLocaleString()}` : '—'}</div>
                                    <div>Median Experience: {school.median_years_experience != null ? school.median_years_experience.toFixed(1) : '—'} years</div>
                                    <div>Median Education: {school.median_education_level_label || '—'}</div>
                                  </div>
                                </Tooltip>
                              </CircleMarker>
                              {pattern === 'dashed-ring' && (
                                <CircleMarker
                                  center={center}
                                  radius={Math.max(radius - 1, 5)}
                                  color="#183153"
                                  weight={2}
                                  fillOpacity={0}
                                  dashArray="4 4"
                                />
                              )}
                              {pattern === 'solid-ring' && (
                                <CircleMarker
                                  center={center}
                                  radius={Math.max(radius - 1, 5)}
                                  color="#183153"
                                  weight={2}
                                  fillOpacity={0}
                                />
                              )}
                              {pattern === 'double-ring' && (
                                <CircleMarker
                                  center={center}
                                  radius={Math.max(radius - 2, 4)}
                                  color="#183153"
                                  weight={2}
                                  fillOpacity={0}
                                />
                              )}
                            </Fragment>
                          );
                        })}
                      </MapContainer>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
