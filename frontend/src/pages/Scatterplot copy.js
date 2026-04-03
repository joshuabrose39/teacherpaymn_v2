import React, { useEffect, useState } from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// Multi-select component reused from other pages.  See SchoolMap for
// implementation comments.  This version is defined locally to
// simplify dependencies; if additional pages require this component
// consider extracting it into a shared components directory.
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

export default function Scatterplot() {
  // Filter options loaded from the backend API.  Each array holds
  // distinct values for that field.
  const [filterOptions, setFilterOptions] = useState({
    districtTypes: [],
    schoolClassifications: [],
    educatorTypes: [],
    educatorSubtypes: [],
    counties: [],
    districts: [],
    schools: [],
  });
  // Selected filter values.  Empty arrays indicate no filtering on that
  // dimension.  We default to no selections to show all data on
  // initial load.
  const [districtTypes, setDistrictTypes] = useState([]);
  const [schoolClassifications, setSchoolClassifications] = useState([]);
  const [educatorTypes, setEducatorTypes] = useState([]);
  const [educatorSubtypes, setEducatorSubtypes] = useState([]);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [schools, setSchools] = useState([]);

  // Data for the scatter plot.  Each entry corresponds to one
  // educator and contains fields for file number, salary, experience,
  // education, type/subtype and location.
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Mobile filter panel state.
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  // Reset all filter selections and reload the full dataset.  Clears
  // every selection to display all educators statewide.
  const resetFilters = () => {
    setDistrictTypes([]);
    setSchoolClassifications([]);
    setEducatorTypes([]);
    setEducatorSubtypes([]);
    setCounties([]);
    setDistricts([]);
    setSchools([]);
    fetchResults();
    setShowFiltersMobile(false);
  };

  // Load filter options on component mount.  The backend provides
  // distinct values for each dimension in alphabetical order.
  useEffect(() => {
    async function loadOptions() {
      try {
        const apiBase = `${window.location.protocol}//${window.location.hostname}:3001`;
        const resp = await fetch(`${apiBase}/api/scatterplot/filter-options`);
        if (!resp.ok) throw new Error('Failed to load filter options');
        const json = await resp.json();
        setFilterOptions(json);
      } catch (e) {
        console.error(e);
      }
    }
    loadOptions();
  }, []);

  // Helper to fetch scatter plot data based on the selected filters.  The
  // API returns the filtered rows, each containing salary and
  // experience among other fields.  Loading and error states are
  // managed here.
  const fetchResults = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiBase = `${window.location.protocol}//${window.location.hostname}:3001`;
      const params = {};
      if (districtTypes.length > 0) params.districtTypes = districtTypes.join(',');
      if (schoolClassifications.length > 0) params.schoolClassifications = schoolClassifications.join(',');
      if (educatorTypes.length > 0) params.educatorTypes = educatorTypes.join(',');
      if (educatorSubtypes.length > 0) params.educatorSubtypes = educatorSubtypes.join(',');
      if (counties.length > 0) params.counties = counties.join(',');
      if (districts.length > 0) params.districts = districts.join(',');
      if (schools.length > 0) params.schools = schools.join(',');
      const query = new URLSearchParams(params).toString();
      const url = `${apiBase}/api/scatterplot${query ? `?${query}` : ''}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load scatterplot data');
      const json = await resp.json();
      setResults(json.results || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  // Fetch initial data on mount to display the full scatterplot.
  useEffect(() => {
    fetchResults();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Compute the domain for the experience and salary axes.  If no
  // results are available, provide sensible defaults to avoid errors.
  const experienceDomain = React.useMemo(() => {
    if (results.length === 0) return [0, 10];
    const min = Math.min(...results.map((r) => r.years_of_experience ?? 0));
    const max = Math.max(...results.map((r) => r.years_of_experience ?? 0));
    return [Math.floor(min), Math.ceil(max) + 1];
  }, [results]);
  const salaryDomain = React.useMemo(() => {
    if (results.length === 0) return [0, 100000];
    const min = Math.min(...results.map((r) => r.contract_salary ?? 0));
    const max = Math.max(...results.map((r) => r.contract_salary ?? 0));
    // Round up to the nearest 10k for the max.
    const roundedMax = Math.ceil(max / 10000) * 10000;
    return [0, roundedMax];
  }, [results]);

  return (
    <div className="card">
      <div className="card-body">
        {/* Page header with title and description */}
        <div className="page-header">
          <div className="page-title">
            <h2>Scatterplot</h2>
            <p>Visualize relationships between educator experience and salary. Filter by district type, classification, educator type and location.</p>
          </div>
          {/* Mobile filter toggle */}
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
              label="Educator Type"
              options={filterOptions.educatorTypes}
              selected={educatorTypes}
              setSelected={setEducatorTypes}
            />
            <MultiSelectChips
              label="Educator Subtype"
              options={filterOptions.educatorSubtypes}
              selected={educatorSubtypes}
              setSelected={setEducatorSubtypes}
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
              <button className="button secondary" onClick={resetFilters}>Reset Filters</button>
              <button className="button primary" onClick={() => { fetchResults(); setShowFiltersMobile(false); }}>Apply Filters</button>
            </div>
          </div>
        </div>
        {/* Desktop layout: filter panel and scatterplot */}
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
                label="Educator Type"
                options={filterOptions.educatorTypes}
                selected={educatorTypes}
                setSelected={setEducatorTypes}
              />
              <MultiSelectChips
                label="Educator Subtype"
                options={filterOptions.educatorSubtypes}
                selected={educatorSubtypes}
                setSelected={setEducatorSubtypes}
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
                <button className="button secondary" onClick={resetFilters}>Reset Filters</button>
                <button className="button primary" onClick={fetchResults}>Apply Filters</button>
              </div>
            </div>
          </div>
          <div className="col col-9">
            {loading && <p>Loading data...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!loading && !error && (
              results.length === 0 ? (
                <p>No educators match your filters.</p>
              ) : (
                <div className="card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">Salary vs. Experience</h2>
                      <div className="card-subtitle">Each dot represents an educator</div>
                    </div>
                  </div>
                    <div className="card-body">
                      <div className="chart-wrap" style={{ height: '520px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 30, left: 0, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              type="number"
                              dataKey="years_of_experience"
                              name="Years of Experience"
                              domain={experienceDomain}
                              tickFormatter={(value) => `${value}`}
                              label={{ value: 'Years of Experience', position: 'insideBottom', offset: -5 }}
                            />
                            <YAxis
                              type="number"
                              dataKey="contract_salary"
                              name="Contract Salary"
                              domain={salaryDomain}
                              tickFormatter={(value) => `$${value.toLocaleString()}`}
                              label={{ value: 'Contract Salary', angle: -90, position: 'insideLeft' }}
                            />
                            <Tooltip
                              cursor={{ strokeDasharray: '3 3' }}
                              formatter={(value, name) => {
                                if (name === 'contract_salary') {
                                  return [`$${Math.round(value).toLocaleString()}`, 'Salary'];
                                }
                                if (name === 'years_of_experience') {
                                  return [`${value}`, 'Experience'];
                                }
                                return [value, name];
                              }}
                              // Customize the tooltip label to show file folder and other details
                              content={({ active, payload, label }) => {
                                if (!active || !payload || payload.length === 0) return null;
                                const data = payload[0].payload;
                                return (
                                  <div className="custom-tooltip" style={{ background: '#ffffff', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                                    <div><strong>File: </strong>{data.file_folder_number}</div>
                                    <div><strong>Salary: </strong>${Math.round(data.contract_salary).toLocaleString()}</div>
                                    <div><strong>Experience: </strong>{data.years_of_experience}</div>
                                    <div><strong>Education: </strong>{data.education_level}</div>
                                    <div><strong>Educator Type: </strong>{data.educator_type}</div>
                                    <div><strong>Subtype: </strong>{data.educator_subtype}</div>
                                    <div><strong>County: </strong>{data.county_name}</div>
                                    <div><strong>District: </strong>{data.district_name}</div>
                                    <div><strong>School: </strong>{data.school_name}</div>
                                  </div>
                                );
                              }}
                            />
                            <Scatter name="Educators" data={results} fill="#8884d8" />
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}