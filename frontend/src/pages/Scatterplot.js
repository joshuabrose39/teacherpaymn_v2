import React, { useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
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

const DISTRICT_TYPE_COLORS = {
  'Charter School District': '#FE6100',
  'Charter Schools': '#FE6100',
  'Independent School District': '#648FFF',
  'Independent Districts and Schools': '#648FFF',
  'Special School District': '#648FFF',
  'Special Districts and Schools': '#648FFF',
  other: '#DC267F',
};

function getDistrictTypeColor(districtType) {
  return DISTRICT_TYPE_COLORS[districtType] || DISTRICT_TYPE_COLORS.other;
}

function ScatterPoint(props) {
  const { cx, cy, payload } = props;
  const clusterCount = Number(payload?.cluster_count || 0);
  const radius = clusterCount > 0
    ? Math.max(4, Math.min(14, 4 + Math.sqrt(clusterCount) * 0.6))
    : 4;
  const fillColor = clusterCount > 0
    ? '#DC267F'
    : getDistrictTypeColor(payload?.district_type_name);
  return (
    <circle
      cx={cx}
      cy={cy}
      r={radius}
      fill={fillColor}
      fillOpacity={0.5}
    />
  );
}

function formatSalaryTick(value) {
  return `${Math.round(value / 1000)}k`;
}

function getSalaryTickStep(maxValue) {
  if (maxValue <= 50000) return 5000;
  if (maxValue <= 120000) return 10000;
  if (maxValue <= 240000) return 20000;
  return 50000;
}

function buildSalaryTicks(maxValue) {
  const step = getSalaryTickStep(maxValue);
  const ticks = [];
  for (let value = 0; value <= maxValue; value += step) {
    ticks.push(value);
  }
  return ticks;
}

function formatSchoolYearLabel(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  return `20${match[1]}-20${match[2]}`;
}

function formatPercentileLabel(percentile) {
  const value = Number(percentile) * 100;
  if (!Number.isFinite(value)) return '';
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function getDistrictTypeLayerKey(districtType) {
  if (districtType === 'Independent School District' || districtType === 'Independent Districts and Schools') {
    return 'independent';
  }
  if (districtType === 'Special School District' || districtType === 'Special Districts and Schools') {
    return 'special';
  }
  if (districtType === 'Charter School District' || districtType === 'Charter Schools') {
    return 'charter';
  }
  return 'other';
}

export default function Scatterplot() {
  // Filter options loaded from the backend API.  Each array holds
  // distinct values for that field.
  const [filterOptions, setFilterOptions] = useState({
    schoolYears: [],
    defaultSchoolYear: '',
    selectedSchoolYear: '',
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
  const [districtTypeCategories, setDistrictTypeCategories] = useState([]);
  const [schoolClassifications, setSchoolClassifications] = useState([]);
  const [educatorTypes, setEducatorTypes] = useState([]);
  const [educatorSubtypes, setEducatorSubtypes] = useState([]);
  const [includePartTime, setIncludePartTime] = useState(false);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [schools, setSchools] = useState([]);
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');

  // Data for the scatter plot.  Each entry corresponds to one
  // educator and contains fields for file number, salary, experience,
  // education, type/subtype and location.
  const [results, setResults] = useState([]);
  const [tableResults, setTableResults] = useState([]);
  const [tooManyToRender, setTooManyToRender] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [renderLimit, setRenderLimit] = useState(20000);
  const [tableOffset, setTableOffset] = useState(0);
  const [tableHasMore, setTableHasMore] = useState(false);
  const [salaryOutlierCount, setSalaryOutlierCount] = useState(0);
  const [salaryCap, setSalaryCap] = useState(null);
  const [salaryPercentile, setSalaryPercentile] = useState(0.999);
  const [clustered, setClustered] = useState(false);
  const [clusterCount, setClusterCount] = useState(0);
  const [chartLoading, setChartLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: 'contract_salary', direction: 'desc' });
  const [hasLoadedChart, setHasLoadedChart] = useState(false);
  const isInitialTableLoad = tableLoading && tableResults.length === 0;
  const [pendingTableQuery, setPendingTableQuery] = useState('');
  const [loadedTableQuery, setLoadedTableQuery] = useState('');
  const [tableVisible, setTableVisible] = useState(false);
  const tableSectionRef = useRef(null);
  const tableLoadMoreRef = useRef(null);
  const requestSequenceRef = useRef(0);

  // Mobile filter panel state.
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const availableDistrictTypes = getDistrictTypesForCategories(
    filterOptions.districtTypes,
    districtTypeCategories,
  );

  // Reset all filter selections and reload the full dataset.  Clears
  // every selection to display all educators statewide.
  const resetFilters = () => {
    setDistrictTypeCategories([]);
    setDistrictTypes([]);
    setSchoolClassifications([]);
    setEducatorTypes([]);
    setEducatorSubtypes([]);
    setIncludePartTime(false);
    setCounties([]);
    setDistricts([]);
    setSchools([]);
    fetchResults({
      schoolYear: selectedSchoolYear,
      districtTypeCategories: [],
      districtTypes: [],
      schoolClassifications: [],
      educatorTypes: [],
      educatorSubtypes: [],
      includePartTime: false,
      counties: [],
      districts: [],
      schools: [],
    });
    setShowFiltersMobile(false);
  };

  const loadFilterOptions = async (schoolYear) => {
    const query = schoolYear ? `?${new URLSearchParams({ schoolYear }).toString()}` : '';
    const resp = await fetch(apiUrl(`/api/scatterplot/filter-options${query}`));
    if (!resp.ok) throw new Error('Failed to load filter options');
    const json = await resp.json();
    setFilterOptions(json);
    return json;
  };

  // Helper to fetch scatter plot data based on the selected filters.  The
  // API returns the filtered rows, each containing salary and
  // experience among other fields.  Loading and error states are
  // managed here.
  const buildQueryString = (nextFilters = {}) => {
    const params = {};
    const activeDistrictTypeCategories = nextFilters.districtTypeCategories ?? districtTypeCategories;
    const rawDistrictTypes = nextFilters.districtTypes ?? districtTypes;
    const activeDistrictTypes = resolveDistrictTypesForFilter(
      filterOptions.districtTypes,
      rawDistrictTypes,
      activeDistrictTypeCategories,
    );
    const activeSchoolClassifications = nextFilters.schoolClassifications ?? schoolClassifications;
    const activeEducatorTypes = nextFilters.educatorTypes ?? educatorTypes;
    const activeEducatorSubtypes = nextFilters.educatorSubtypes ?? educatorSubtypes;
    const activeIncludePartTime = nextFilters.includePartTime ?? includePartTime;
    const activeCounties = nextFilters.counties ?? counties;
    const activeDistricts = nextFilters.districts ?? districts;
    const activeSchools = nextFilters.schools ?? schools;
    const activeSchoolYear = nextFilters.schoolYear ?? selectedSchoolYear;
    if (activeSchoolYear) params.schoolYear = activeSchoolYear;
    if (activeDistrictTypes.length > 0) params.districtTypes = activeDistrictTypes.join(',');
    if (activeSchoolClassifications.length > 0) params.schoolClassifications = activeSchoolClassifications.join(',');
    if (activeEducatorTypes.length > 0) params.educatorTypes = activeEducatorTypes.join(',');
    if (activeEducatorSubtypes.length > 0) params.educatorSubtypes = activeEducatorSubtypes.join(',');
    if (activeIncludePartTime) params.includePartTime = 'true';
    if (activeCounties.length > 0) params.counties = activeCounties.join(',');
    if (activeDistricts.length > 0) params.districts = activeDistricts.join(',');
    if (activeSchools.length > 0) params.schools = activeSchools.join(',');
    return new URLSearchParams(params).toString();
  };

  const TABLE_BATCH_SIZE = 100;

  const fetchTableResults = async (query, requestId, options = {}) => {
    const append = Boolean(options.append);
    const nextOffset = append ? tableOffset : 0;
    if (!query || (!append && loadedTableQuery === query) || tableLoading) return;
    setTableLoading(true);
    try {
      const queryWithPaging = new URLSearchParams(query);
      queryWithPaging.set('limit', String(TABLE_BATCH_SIZE));
      queryWithPaging.set('offset', String(nextOffset));
      const url = apiUrl(`/api/scatterplot/table?${queryWithPaging.toString()}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load scatterplot table');
      const json = await resp.json();
      if (requestSequenceRef.current !== requestId) return;
      setTableResults((prev) => (append ? [...prev, ...(json.results || [])] : (json.results || [])));
      setTooManyToRender(Boolean(json.tooManyToRender));
      setTotalCount(json.totalCount ?? 0);
      setRenderLimit(json.renderLimit || 20000);
      setTableOffset((json.offset ?? nextOffset) + (json.results || []).length);
      setTableHasMore(Boolean(json.hasMore));
      setLoadedTableQuery(query);
    } catch (err) {
      if (requestSequenceRef.current === requestId) {
        setError(err.message);
      }
    }
    if (requestSequenceRef.current === requestId) {
      setTableLoading(false);
    }
  };

  const fetchResults = async (nextFilters = {}) => {
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setChartLoading(true);
    setTableLoading(false);
    setError(null);
    setHasLoadedChart(false);
    setResults([]);
    setTableResults([]);
    setTooManyToRender(false);
    setTableOffset(0);
    setTableHasMore(false);
    setPendingTableQuery('');
    setLoadedTableQuery('');
    try {
      const query = buildQueryString(nextFilters);
      const url = apiUrl(`/api/scatterplot/chart${query ? `?${query}` : ''}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load scatterplot chart');
      const json = await resp.json();
      if (requestSequenceRef.current !== requestId) return;
      setResults(json.results || []);
      setTotalCount(json.totalCount || 0);
      setRenderLimit(json.renderLimit || 20000);
      setSalaryOutlierCount(json.salaryOutlierCount || 0);
      setSalaryCap(json.salaryCap ?? null);
      setSalaryPercentile(json.salaryPercentile ?? 0.999);
      setClustered(Boolean(json.clustered));
      setClusterCount(json.clusterCount || 0);
      setPendingTableQuery(query);
      setHasLoadedChart(true);
      if (tableVisible) {
        fetchTableResults(query, requestId);
      }
    } catch (err) {
      if (requestSequenceRef.current === requestId) {
        setError(err.message);
      }
    }
    if (requestSequenceRef.current === requestId) {
      setChartLoading(false);
    }
  };

  useEffect(() => {
    const node = tableSectionRef.current;
    if (!node) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setTableVisible(true);
        }
      },
      { rootMargin: '300px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [chartLoading]);

  useEffect(() => {
    if (!tableVisible || !pendingTableQuery || loadedTableQuery === pendingTableQuery || chartLoading) return;
    fetchTableResults(pendingTableQuery, requestSequenceRef.current);
  }, [chartLoading, loadedTableQuery, pendingTableQuery, tableVisible]);

  useEffect(() => {
    const node = tableLoadMoreRef.current;
    if (!node || !tableVisible || !tableHasMore || tableLoading) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        fetchTableResults(loadedTableQuery || pendingTableQuery, requestSequenceRef.current, { append: true });
      },
      { rootMargin: '600px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [loadedTableQuery, pendingTableQuery, tableHasMore, tableLoading, tableVisible]);

  useEffect(() => {
    async function initializePage() {
      try {
        const options = await loadFilterOptions();
        const initialSchoolYear = options.selectedSchoolYear || options.defaultSchoolYear || '';
        setSelectedSchoolYear(initialSchoolYear);
        fetchResults({
          schoolYear: initialSchoolYear,
          districtTypeCategories: [],
          districtTypes: [],
          schoolClassifications: [],
          educatorTypes: [],
          educatorSubtypes: [],
          includePartTime: false,
          counties: [],
          districts: [],
          schools: [],
        });
      } catch (e) {
        setError(e.message);
      }
    }

    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSchoolYearChange = async (event) => {
    const nextSchoolYear = event.target.value;
    setSelectedSchoolYear(nextSchoolYear);
    setDistrictTypeCategories([]);
    setDistrictTypes([]);
    setSchoolClassifications([]);
    setEducatorTypes([]);
    setEducatorSubtypes([]);
    setIncludePartTime(false);
    setCounties([]);
    setDistricts([]);
    setSchools([]);
    setShowFiltersMobile(false);

    try {
      await loadFilterOptions(nextSchoolYear);
      fetchResults({
        schoolYear: nextSchoolYear,
        districtTypeCategories: [],
        districtTypes: [],
        schoolClassifications: [],
        educatorTypes: [],
        educatorSubtypes: [],
        includePartTime: false,
        counties: [],
        districts: [],
        schools: [],
      });
    } catch (err) {
      setError(err.message);
    }
  };

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
  const salaryTicks = React.useMemo(() => buildSalaryTicks(salaryDomain[1]), [salaryDomain]);
  const sortedResults = React.useMemo(() => {
    const sortable = [...tableResults];
    const { key, direction } = sortConfig;
    sortable.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      if (valA === null || valA === undefined) valA = key === 'contract_salary' || key === 'years_of_experience' || key === 'education_level_rank' ? 0 : '';
      if (valB === null || valB === undefined) valB = key === 'contract_salary' || key === 'years_of_experience' || key === 'education_level_rank' ? 0 : '';
      if (key === 'contract_salary' || key === 'years_of_experience' || key === 'education_level_rank') {
        valA = Number(valA);
        valB = Number(valB);
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      }
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortable;
  }, [tableResults, sortConfig]);
  const scatterLayers = React.useMemo(() => {
    if (clustered) {
      return [{ key: 'clustered', data: results }];
    }

    const grouped = {
      independent: [],
      special: [],
      charter: [],
      other: [],
    };

    results.forEach((row) => {
      grouped[getDistrictTypeLayerKey(row.district_type_name)].push(row);
    });

    return [
      { key: 'independent', data: grouped.independent },
      { key: 'special', data: grouped.special },
      { key: 'charter', data: grouped.charter },
      { key: 'other', data: grouped.other },
    ];
  }, [clustered, results]);

  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  return (
    <div className="card page-shell">
      <div className="card-body">
        {/* Page header with title and description */}
        <div className="page-header">
          <div className="page-title">
            <h2>Pay vs. Experience</h2>
            <p>Visualize relationships between educator experience and pay. Filter by district type, classification, educator type and location.</p>
          </div>
          {/* Mobile filter toggle */}
          <div className="toolbar">
            <div className="header-field header-field-inline">
              <label htmlFor="scatterplot-school-year">School Year:</label>
              <select
                id="scatterplot-school-year"
                className="select"
                value={selectedSchoolYear}
                onChange={handleSchoolYearChange}
              >
                {filterOptions.schoolYears.map((schoolYear) => (
                  <option key={schoolYear} value={schoolYear}>
                    {formatSchoolYearLabel(schoolYear)}
                  </option>
                ))}
              </select>
            </div>
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
              label="District Type Category"
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
            <CheckboxMultiSelect
              label="Educator Type"
              options={filterOptions.educatorTypes}
              selected={educatorTypes}
              setSelected={setEducatorTypes}
            />
            <CheckboxMultiSelect
              label="Educator Subtype"
              options={filterOptions.educatorSubtypes}
              selected={educatorSubtypes}
              setSelected={setEducatorSubtypes}
            />
            <PartTimeFilter checked={includePartTime} setChecked={setIncludePartTime} />
            <CheckboxMultiSelect
              label="County"
              options={filterOptions.counties}
              selected={counties}
              setSelected={setCounties}
            />
            <CheckboxMultiSelect
              label="District"
              options={filterOptions.districts}
              selected={districts}
              setSelected={setDistricts}
            />
            <CheckboxMultiSelect
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
        <div className="row scatterplot-top-row">
          <div className="col col-3 desktop-filter-panel scatterplot-sidebar-column">
            <div className="scatterplot-sidebar-shell filter-panel-shell">
              <div className="filter-sidebar-header">
                <h3 className="filter-sidebar-title">Filters</h3>
                <div className="filter-buttons salary-finder-sticky-filter-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '10px' }}>
                  <button className="button secondary" onClick={resetFilters}>Reset Filters</button>
                  <button className="button primary" onClick={fetchResults}>Apply Filters</button>
                </div>
              </div>
              <div className="filter-panel scatterplot-filter-panel">
                <CheckboxMultiSelect
                  label="District Type Category"
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
                <CheckboxMultiSelect
                  label="Educator Type"
                  options={filterOptions.educatorTypes}
                  selected={educatorTypes}
                  setSelected={setEducatorTypes}
                />
                <CheckboxMultiSelect
                  label="Educator Subtype"
                  options={filterOptions.educatorSubtypes}
                  selected={educatorSubtypes}
                  setSelected={setEducatorSubtypes}
                />
                <PartTimeFilter checked={includePartTime} setChecked={setIncludePartTime} />
                <CheckboxMultiSelect
                  label="County"
                  options={filterOptions.counties}
                  selected={counties}
                  setSelected={setCounties}
                />
                <CheckboxMultiSelect
                  label="District"
                  options={filterOptions.districts}
                  selected={districts}
                  setSelected={setDistricts}
                />
                <CheckboxMultiSelect
                  label="School"
                  options={filterOptions.schools}
                  selected={schools}
                  setSelected={setSchools}
                />
              </div>
            </div>
          </div>
          <div className="col col-9 scatterplot-chart-column">
            {/* Wrap the conditional content in its own container to avoid adjacent JSX elements */}
            <div className="results-wrapper">
              {chartLoading && <p>Loading chart...</p>}
              {error && <p style={{ color: 'red' }}>{error}</p>}
              {!chartLoading && !error && hasLoadedChart && (
                results.length === 0 ? (
                  <p>No educators match your filters.</p>
                ) : (
                  <div className="card scatterplot-card">
                    <div className="card-header">
                      <div>
                        <h2 className="card-title">{formatSchoolYearLabel(selectedSchoolYear)} Salary vs. Experience</h2>
                        <div className="card-subtitle">
                          {clustered
                            ? `Showing ${clusterCount.toLocaleString()} clustered points for ${totalCount.toLocaleString()} educators. The table below can still be loaded in batches.`
                            : `Each dot represents an educator. ${totalCount.toLocaleString()} Educators Found`}
                        </div>
                        {salaryOutlierCount > 0 && salaryCap != null && (
                          <div className="card-subtitle">
                            Chart capped at the {formatPercentileLabel(salaryPercentile)}th percentile (${Math.round(salaryCap).toLocaleString()}). {salaryOutlierCount.toLocaleString()} educator{salaryOutlierCount === 1 ? '' : 's'} above that value are excluded from the scatter plot only.
                          </div>
                        )}
                      </div>
                      {!clustered && (
                        <div className="scatterplot-legend">
                          <div className="scatterplot-legend-item">
                            <span className="scatterplot-legend-swatch" style={{ backgroundColor: '#648FFF' }}></span>
                            <span>Traditional Public</span>
                          </div>
                          <div className="scatterplot-legend-item">
                            <span className="scatterplot-legend-swatch" style={{ backgroundColor: '#FE6100' }}></span>
                            <span>Charter</span>
                          </div>
                          <div className="scatterplot-legend-item">
                            <span className="scatterplot-legend-swatch" style={{ backgroundColor: '#DC267F' }}></span>
                            <span>Other</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="card-body">
                      <div className="chart-wrap scatterplot-chart-wrap" style={{ height: '520px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ScatterChart margin={{ top: 20, right: 52, left: 34, bottom: 48 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis
                              type="number"
                              dataKey="years_of_experience"
                              name="Years of Experience"
                              domain={experienceDomain}
                              tickFormatter={(value) => `${value}`}
                              tickMargin={10}
                              label={{
                                value: 'Years of Experience',
                                position: 'insideBottom',
                                offset: -16,
                                style: { fontWeight: 700, fill: 'var(--muted)' },
                              }}
                            />
                            <YAxis
                              type="number"
                              dataKey="contract_salary"
                              name="Contract Salary"
                              domain={salaryDomain}
                              ticks={salaryTicks}
                              width={94}
                              tickMargin={8}
                              tickFormatter={formatSalaryTick}
                              label={{
                                value: 'Contract Salary',
                                angle: -90,
                                position: 'left',
                                dx: -10,
                                style: { textAnchor: 'middle', fontWeight: 700, fill: 'var(--muted)' },
                              }}
                            />
                            {!clustered && (
                              <Tooltip
                                cursor={{ strokeDasharray: '3 3' }}
                                formatter={(value, name) => {
                                  if (name === 'contract_salary') {
                                    return [`$${Math.round(value).toLocaleString()}`, 'Pay'];
                                  }
                                  if (name === 'years_of_experience') {
                                    return [`${value}`, 'Experience'];
                                  }
                                  return [value, name];
                                }}
                                content={({ active, payload }) => {
                                  if (!active || !payload || payload.length === 0) return null;
                                  const data = payload[0].payload;
                                  return (
                                    <div className="custom-tooltip" style={{ background: '#ffffff', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}>
                                      <div><strong>File: </strong>{data.file_folder_number}</div>
                                      <div><strong>Pay: </strong>${Math.round(data.contract_salary).toLocaleString()}</div>
                                      <div><strong>Experience: </strong>{data.years_of_experience}</div>
                                      <div><strong>Education: </strong>{data.education_level}</div>
                                      <div><strong>Educator Type: </strong>{data.educator_type}</div>
                                      <div><strong>Subtype: </strong>{data.educator_subtype}</div>
                                    </div>
                                  );
                                }}
                              />
                            )}
                            {scatterLayers.map((layer) => (
                              <Scatter
                                key={layer.key}
                                name="Educators"
                                data={layer.data}
                                shape={<ScatterPoint />}
                              />
                            ))}
                          </ScatterChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
        {!chartLoading && !error && (
          <div className="card salary-finder-results-card" ref={tableSectionRef}>
            <div className="card-header">
              <div>
                <h2 className="card-title">{totalCount.toLocaleString()} Educators Found</h2>
                {!isInitialTableLoad && tableResults.length === 0 && <div className="card-subtitle">No results match your filters.</div>}
              </div>
            </div>
            <div className="card-body">
              {!tableVisible ? (
                <div className="empty-chart-message">
                  <p style={{ textAlign: 'center', margin: '2rem 0' }}>
                    Scroll a little farther to load the educator table.
                  </p>
                </div>
              ) : isInitialTableLoad ? (
                <div className="empty-chart-message">
                  <p style={{ textAlign: 'center', margin: '2rem 0' }}>Loading educator table...</p>
                </div>
              ) : tableResults.length > 0 && (
                <>
                  <div className="salary-finder-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th onClick={() => requestSort('file_folder_number')} style={{ cursor: 'pointer' }}>
                            File Folder Number
                            {sortConfig.key === 'file_folder_number' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('contract_salary')} style={{ cursor: 'pointer' }}>
                            Contract Salary
                            {sortConfig.key === 'contract_salary' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('years_of_experience')} style={{ cursor: 'pointer' }}>
                            Years of Experience
                            {sortConfig.key === 'years_of_experience' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('education_level_rank')} style={{ cursor: 'pointer' }}>
                            Education Level
                            {sortConfig.key === 'education_level_rank' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('educator_type')} style={{ cursor: 'pointer' }}>
                            Educator Category
                            {sortConfig.key === 'educator_type' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('educator_subtype')} style={{ cursor: 'pointer' }}>
                            Educator Subcategory
                            {sortConfig.key === 'educator_subtype' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('county_name')} style={{ cursor: 'pointer' }}>
                            County
                            {sortConfig.key === 'county_name' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('district_name')} style={{ cursor: 'pointer' }}>
                            District
                            {sortConfig.key === 'district_name' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                          <th onClick={() => requestSort('school_name')} style={{ cursor: 'pointer' }}>
                            School
                            {sortConfig.key === 'school_name' && <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedResults.map((row, index) => (
                          <tr key={`${row.file_folder_number}-${index}`}>
                            <td>
                              <NavLink
                                to={`/educator/${row.file_folder_number}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                {row.file_folder_number}
                              </NavLink>
                            </td>
                            <td>${row.contract_salary != null ? Math.round(row.contract_salary).toLocaleString() : '—'}</td>
                            <td>{row.years_of_experience != null ? row.years_of_experience : '—'}</td>
                            <td>{row.education_level || '—'}</td>
                            <td>{row.educator_type || '—'}</td>
                            <td>{row.educator_subtype || '—'}</td>
                            <td>{row.county_name || '—'}</td>
                            <td>{row.district_name || '—'}</td>
                            <td>{row.school_name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {(tableHasMore || tableLoading) && (
                    <div
                      ref={tableLoadMoreRef}
                      className="scatterplot-auto-load-indicator"
                    >
                      {tableLoading
                        ? 'Loading more educators...'
                        : `Scroll to load ${Math.min(TABLE_BATCH_SIZE, totalCount - tableOffset).toLocaleString()} more educators`}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
