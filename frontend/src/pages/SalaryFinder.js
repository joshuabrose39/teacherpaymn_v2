import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams, NavLink } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import CheckboxMultiSelect from '../components/CheckboxMultiSelect';
import PartTimeFilter from '../components/PartTimeFilter';
import {
  DISTRICT_TYPE_CATEGORY_OPTIONS,
  filterSelectedDistrictTypes,
  getDistrictTypeCategoriesForSelection,
  getDistrictTypesForCategories,
  resolveDistrictTypesForFilter,
} from '../utils/districtTypeCategories';
import { orderSchoolClassificationOptions } from '../utils/schoolClassificationOptions';
import { apiUrl } from '../utils/api';

// Number range component for selecting a minimum and maximum value.  The
// `min` and `max` props define the allowable range from the data.  The
// component ensures that the selected minimum does not exceed the
// selected maximum.  Calls `setMinVal` and `setMaxVal` when the
// values change.
function RangeFilter({ label, min, max, minVal, maxVal, setMinVal, setMaxVal }) {
  // Handler for updating the minimum value.  If the new minimum is
  // greater than the current maximum, adjust the maximum to match.
  const onMinChange = (e) => {
    const value = e.target.value === '' ? '' : Number(e.target.value);
    setMinVal(value);
    if (value !== '' && maxVal !== '' && value > maxVal) {
      setMaxVal(value);
    }
  };
  // Handler for updating the maximum value.  If the new maximum is
  // less than the current minimum, adjust the minimum to match.
  const onMaxChange = (e) => {
    const value = e.target.value === '' ? '' : Number(e.target.value);
    setMaxVal(value);
    if (value !== '' && minVal !== '' && value < minVal) {
      setMinVal(value);
    }
  };
  return (
    <div className="filter-section salary-finder-range-filter">
      <label>{label}</label>
      <div className="salary-finder-range-row">
        <input
          type="number"
          value={minVal}
          min={min}
          max={max}
          onChange={onMinChange}
          placeholder={`Min (${min})`}
          className="input salary-finder-range-input"
        />
        <span className="salary-finder-range-separator">to</span>
        <input
          type="number"
          value={maxVal}
          min={min}
          max={max}
          onChange={onMaxChange}
          placeholder={`Max (${max})`}
          className="input salary-finder-range-input"
        />
      </div>
    </div>
  );
}

function EducationLevelRangeFilter({ label, options, minVal, maxVal, setMinVal, setMaxVal }) {
  const handleMinChange = (e) => {
    const value = e.target.value === '' ? '' : Number(e.target.value);
    setMinVal(value);
    if (value !== '' && maxVal !== '' && value > maxVal) {
      setMaxVal(value);
    }
  };

  const handleMaxChange = (e) => {
    const value = e.target.value === '' ? '' : Number(e.target.value);
    setMaxVal(value);
    if (value !== '' && minVal !== '' && value < minVal) {
      setMinVal(value);
    }
  };

  return (
    <div className="filter-section salary-finder-education-filter">
      <label>{label}</label>
      <div className="salary-finder-education-stack">
        <select value={minVal} onChange={handleMinChange} className="select salary-finder-education-select">
          <option value="">Min</option>
          {options.map((opt) => (
            <option key={`min-${opt.rank}`} value={opt.rank}>
              {opt.label}
            </option>
          ))}
        </select>
        <span className="salary-finder-range-separator">to</span>
        <select value={maxVal} onChange={handleMaxChange} className="select salary-finder-education-select">
          <option value="">Max</option>
          {options.map((opt) => (
            <option key={`max-${opt.rank}`} value={opt.rank}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
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

export default function SalaryFinder() {
  // Use search params to preserve filter state in the URL.  When the
  // component mounts, parse the URL and populate filter state.  When
  // filters are applied, update the search params so that the page
  // can be bookmarked or shared.
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter options loaded from the backend.  See server.js for
  // details on the returned structure.  Contains arrays for each
  // categorical filter and numeric ranges for experience and education.
  const [filterOptions, setFilterOptions] = useState({
    schoolYears: [],
    defaultSchoolYear: '',
    selectedSchoolYear: '',
    districtTypes: [],
    schoolClassifications: [],
    educatorCategories: [],
    educatorSubcategories: [],
    counties: [],
    districts: [],
    schools: [],
    minExperience: 0,
    maxExperience: 0,
    minEducationRank: 0,
    maxEducationRank: 0,
    educationLevelOptions: [],
  });

  // Selected filter state.  For multi-select filters we store arrays;
  // for range filters we store numbers or empty strings.  Defaults
  // depend on the loaded filter options.
  const [districtTypeCategories, setDistrictTypeCategories] = useState([]);
  const [districtTypes, setDistrictTypes] = useState([]);
  const [schoolClassifications, setSchoolClassifications] = useState([]);
  const [educatorCategories, setEducatorCategories] = useState([]);
  const [educatorSubcategories, setEducatorSubcategories] = useState([]);
  const [includePartTime, setIncludePartTime] = useState(false);
  const [counties, setCounties] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [schools, setSchools] = useState([]);
  const [minExperience, setMinExperience] = useState('');
  const [maxExperience, setMaxExperience] = useState('');
  const [minEducationRank, setMinEducationRank] = useState('');
  const [maxEducationRank, setMaxEducationRank] = useState('');
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const availableDistrictTypes = getDistrictTypesForCategories(
    filterOptions.districtTypes,
    districtTypeCategories,
  );

  // Control the visibility of the mobile filter drawer.  When true
  // the filter panel is shown as an overlay on small screens.
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [folderNumberInput, setFolderNumberInput] = useState('');
  const [matchingFiltersError, setMatchingFiltersError] = useState(null);
  const [matchingFiltersLoading, setMatchingFiltersLoading] = useState(false);
  const [matchedEducatorSalary, setMatchedEducatorSalary] = useState(null);
  const [pendingTableQuery, setPendingTableQuery] = useState('');
  const [loadedTableQuery, setLoadedTableQuery] = useState('');
  const [tableVisible, setTableVisible] = useState(false);
  const tableSectionRef = useRef(null);
  const tableLoadMoreRef = useRef(null);
  const requestSequenceRef = useRef(0);

  // Reset all filters to their defaults.  Clears all multi-select
  // selections and resets numeric ranges to the minimum and maximum
  // provided by the filter options.  After clearing filters, the
  // results are reloaded and the mobile filter drawer is closed.
  const resetFilters = () => {
    setDistrictTypeCategories([]);
    setDistrictTypes([]);
    setSchoolClassifications([]);
    setEducatorCategories([]);
    setEducatorSubcategories([]);
    setIncludePartTime(false);
    setCounties([]);
    setDistricts([]);
    setSchools([]);
    setMinExperience('');
    setMaxExperience('');
    setMinEducationRank('');
    setMaxEducationRank('');
    setMatchingFiltersError(null);
    setMatchedEducatorSalary(null);
    setSearchParams(selectedSchoolYear ? { schoolYear: selectedSchoolYear } : {});
    fetchResults({
      schoolYear: selectedSchoolYear,
      districtTypeCategories: [],
      districtTypes: [],
      schoolClassifications: [],
      educatorCategories: [],
      educatorSubcategories: [],
      includePartTime: false,
      counties: [],
      districts: [],
      schools: [],
      minExperience: '',
      maxExperience: '',
      minEducationRank: '',
      maxEducationRank: '',
    });
    setShowFiltersMobile(false);
  };

  // Educator results and histogram returned from the API.  The
  // results array contains objects with keys matching the web table
  // fields.
  const [results, setResults] = useState([]);
  const [histogram, setHistogram] = useState([]);
  const [medianSalary, setMedianSalary] = useState(null);
  const [tooManyTableResults, setTooManyTableResults] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [renderLimit, setRenderLimit] = useState(20000);
  const [tableOffset, setTableOffset] = useState(0);
  const [tableHasMore, setTableHasMore] = useState(false);
  const [histogramOutlierCount, setHistogramOutlierCount] = useState(0);
  const [histogramCap, setHistogramCap] = useState(null);
  const [histogramPercentile, setHistogramPercentile] = useState(0.999);

  const [chartLoading, setChartLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [error, setError] = useState(null);
  const [histogramKeyPulse, setHistogramKeyPulse] = useState(false);

  // Sorting configuration for the educator table.  By default sort
  // descending on contract salary.  Changing the sort on a column
  // toggles ascending/descending order.
  const [sortConfig, setSortConfig] = useState({ key: 'contract_salary', direction: 'desc' });

  // Sorted results are computed whenever the results or sort config
  // change.  This ensures that the table displays in the correct
  // order.  Null or undefined values are handled gracefully.
  const sortedResults = React.useMemo(() => {
    const sortable = [...results];
    const { key, direction } = sortConfig;
    sortable.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];
      if (valA === null || valA === undefined) valA = key === 'contract_salary' || key === 'years_of_experience' || key === 'highest_education_level_rank' ? 0 : '';
      if (valB === null || valB === undefined) valB = key === 'contract_salary' || key === 'years_of_experience' || key === 'highest_education_level_rank' ? 0 : '';
      // Numeric comparison for salary, experience and education rank
      if (key === 'contract_salary' || key === 'years_of_experience' || key === 'highest_education_level_rank') {
        valA = Number(valA);
        valB = Number(valB);
        if (valA < valB) return direction === 'asc' ? -1 : 1;
        if (valA > valB) return direction === 'asc' ? 1 : -1;
        return 0;
      }
      // String comparison for other fields
      const strA = String(valA).toLowerCase();
      const strB = String(valB).toLowerCase();
      if (strA < strB) return direction === 'asc' ? -1 : 1;
      if (strA > strB) return direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sortable;
  }, [results, sortConfig]);

  // Compute histogram domain and ticks for the bar chart.  When the
  // histogram array changes, update the domain and ticks.  Domain is
  // [start of first bin, end of last bin].
  const xAxisDomain = React.useMemo(() => {
    if (!histogram || histogram.length === 0) return [0, 0];
    const binWidth = histogram[0].end - histogram[0].start;
    return [
      histogram[0].start - binWidth / 2,
      histogram[histogram.length - 1].end - binWidth / 2,
    ];
  }, [histogram]);
  const xAxisTicks = React.useMemo(() => {
    if (!histogram || histogram.length === 0) return [];
    return histogram.map((bin) => bin.start);
  }, [histogram]);
  const formatSalaryTick = (value) => `${Math.round(value / 1000)}k`;
  const histogramUpperBound = histogram.length > 0 ? histogram[histogram.length - 1].end : null;
  const showYourSalaryLine = matchedEducatorSalary != null && histogramUpperBound != null && matchedEducatorSalary <= histogramUpperBound;

  useEffect(() => {
    if (chartLoading) return undefined;
    if (totalCount === 0 && medianSalary == null && matchedEducatorSalary == null) return undefined;

    setHistogramKeyPulse(true);
    const timeoutId = window.setTimeout(() => {
      setHistogramKeyPulse(false);
    }, 700);

    return () => window.clearTimeout(timeoutId);
  }, [chartLoading, totalCount, medianSalary, matchedEducatorSalary]);

  const loadFilterOptions = async (schoolYear) => {
    const query = schoolYear ? `?${new URLSearchParams({ schoolYear }).toString()}` : '';
    const resp = await fetch(apiUrl(`/api/salary-finder/filter-options${query}`));
    if (!resp.ok) throw new Error('Failed to load filter options');
    const json = await resp.json();
    setFilterOptions(json);
    return json;
  };

  // Function to request sorting by a given column.  If the same
  // column is clicked again, toggle the direction; otherwise start
  // with ascending order.
  const requestSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  // Fetch data from the API based on the current filter state.  Build
  // a query string with all parameters.  When the fetch completes
  // update the results and histogram.  Errors are stored for display.
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
    const activeEducatorCategories = nextFilters.educatorCategories ?? educatorCategories;
    const activeEducatorSubcategories = nextFilters.educatorSubcategories ?? educatorSubcategories;
    const activeIncludePartTime = nextFilters.includePartTime ?? includePartTime;
    const activeCounties = nextFilters.counties ?? counties;
    const activeDistricts = nextFilters.districts ?? districts;
    const activeSchools = nextFilters.schools ?? schools;
    const activeMinExperience = nextFilters.minExperience ?? minExperience;
    const activeMaxExperience = nextFilters.maxExperience ?? maxExperience;
    const activeMinEducationRank = nextFilters.minEducationRank ?? minEducationRank;
    const activeMaxEducationRank = nextFilters.maxEducationRank ?? maxEducationRank;
    const activeSchoolYear = nextFilters.schoolYear ?? selectedSchoolYear;

    if (activeSchoolYear) params.schoolYear = activeSchoolYear;
    if (activeDistrictTypes.length > 0) params.districtTypes = activeDistrictTypes.join(',');
    if (activeSchoolClassifications.length > 0) params.schoolClassifications = activeSchoolClassifications.join(',');
    if (activeEducatorCategories.length > 0) params.educatorCategories = activeEducatorCategories.join(',');
    if (activeEducatorSubcategories.length > 0) params.educatorSubcategories = activeEducatorSubcategories.join(',');
    if (activeIncludePartTime) params.includePartTime = 'true';
    if (activeCounties.length > 0) params.counties = activeCounties.join(',');
    if (activeDistricts.length > 0) params.districts = activeDistricts.join(',');
    if (activeSchools.length > 0) params.schools = activeSchools.join(',');
    if (activeMinExperience !== '') params.minExperience = activeMinExperience;
    if (activeMaxExperience !== '') params.maxExperience = activeMaxExperience;
    if (activeMinEducationRank !== '') params.minEducationRank = activeMinEducationRank;
    if (activeMaxEducationRank !== '') params.maxEducationRank = activeMaxEducationRank;
    return new URLSearchParams(params).toString();
  };

  const TABLE_BATCH_SIZE = 500;

  const fetchTableResults = async (query, requestId, options = {}) => {
    const append = Boolean(options.append);
    const nextOffset = append ? tableOffset : 0;
    if (!query || (!append && loadedTableQuery === query) || tableLoading) return;
    setTableLoading(true);
    try {
      const queryWithPaging = new URLSearchParams(query);
      queryWithPaging.set('limit', String(TABLE_BATCH_SIZE));
      queryWithPaging.set('offset', String(nextOffset));
      const url = apiUrl(`/api/salary-finder/table?${queryWithPaging.toString()}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load educator table');
      const json = await resp.json();
      if (requestSequenceRef.current !== requestId) return;
      setResults((prev) => (append ? [...prev, ...(json.results || [])] : (json.results || [])));
      setTooManyTableResults(Boolean(json.tooManyTableResults));
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
    setResults([]);
    setTooManyTableResults(false);
    setTableOffset(0);
    setTableHasMore(false);
    setPendingTableQuery('');
    setLoadedTableQuery('');
    try {
      const query = buildQueryString(nextFilters);
      const url = apiUrl(`/api/salary-finder/chart${query ? `?${query}` : ''}`);
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('Failed to load salary chart');
      const json = await resp.json();
      if (requestSequenceRef.current !== requestId) return;
      setHistogram(json.histogram || []);
      setTotalCount(json.totalCount || 0);
      setHistogramOutlierCount(json.histogramOutlierCount || 0);
      setHistogramCap(json.histogramCap ?? null);
      setHistogramPercentile(json.histogramPercentile ?? 0.999);
      setMedianSalary(json.medianSalary ?? null);
      setPendingTableQuery(query);
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
        const params = Object.fromEntries([...searchParams.entries()]);
        const requestedSchoolYear = params.schoolYear || '';
        const options = await loadFilterOptions(requestedSchoolYear);
        const initialSchoolYear = options.selectedSchoolYear || options.defaultSchoolYear || '';

        const initialDistrictTypeCategories = params.districtTypeCategories ? params.districtTypeCategories.split(',').filter((s) => s) : [];
        const initialDistrictTypes = params.districtTypes ? params.districtTypes.split(',').filter((s) => s) : [];
        const initialSchoolClassifications = params.schoolClassifications ? params.schoolClassifications.split(',').filter((s) => s) : [];
        const initialEducatorCategories = params.educatorCategories ? params.educatorCategories.split(',').filter((s) => s) : [];
        const initialEducatorSubcategories = params.educatorSubcategories ? params.educatorSubcategories.split(',').filter((s) => s) : [];
        const initialIncludePartTime = params.includePartTime === 'true';
        const initialCounties = params.counties ? params.counties.split(',').filter((s) => s) : [];
        const initialDistricts = params.districts ? params.districts.split(',').filter((s) => s) : [];
        const initialSchools = params.schools ? params.schools.split(',').filter((s) => s) : [];
        const initialMinExperience = params.minExperience !== undefined ? (params.minExperience === '' ? '' : Number(params.minExperience)) : '';
        const initialMaxExperience = params.maxExperience !== undefined ? (params.maxExperience === '' ? '' : Number(params.maxExperience)) : '';
        const initialMinEducationRank = params.minEducationRank !== undefined ? (params.minEducationRank === '' ? '' : Number(params.minEducationRank)) : '';
        const initialMaxEducationRank = params.maxEducationRank !== undefined ? (params.maxEducationRank === '' ? '' : Number(params.maxEducationRank)) : '';

        setSelectedSchoolYear(initialSchoolYear);
        setDistrictTypeCategories(initialDistrictTypeCategories);
        setDistrictTypes(initialDistrictTypes);
        setSchoolClassifications(initialSchoolClassifications);
        setEducatorCategories(initialEducatorCategories);
        setEducatorSubcategories(initialEducatorSubcategories);
        setIncludePartTime(initialIncludePartTime);
        setCounties(initialCounties);
        setDistricts(initialDistricts);
        setSchools(initialSchools);
        setMinExperience(initialMinExperience);
        setMaxExperience(initialMaxExperience);
        setMinEducationRank(initialMinEducationRank);
        setMaxEducationRank(initialMaxEducationRank);

        fetchResults({
          schoolYear: initialSchoolYear,
          districtTypeCategories: initialDistrictTypeCategories,
          districtTypes: initialDistrictTypes,
          schoolClassifications: initialSchoolClassifications,
          educatorCategories: initialEducatorCategories,
          educatorSubcategories: initialEducatorSubcategories,
          includePartTime: initialIncludePartTime,
          counties: initialCounties,
          districts: initialDistricts,
          schools: initialSchools,
          minExperience: initialMinExperience,
          maxExperience: initialMaxExperience,
          minEducationRank: initialMinEducationRank,
          maxEducationRank: initialMaxEducationRank,
        });
      } catch (e) {
        setError(e.message);
      }
    }

    initializePage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Apply filters and update the URL query string.  When filters are
  // applied, call fetchResults and update search params so that the
  // state is reflected in the address bar.  This allows bookmarking
  // and sharing filtered views.
  const applyFilters = (nextFilters = null) => {
    const suppliedFilters = nextFilters && typeof nextFilters === 'object' && !('target' in nextFilters)
      ? nextFilters
      : null;
    const activeFilters = suppliedFilters
      ? { schoolYear: suppliedFilters.schoolYear ?? selectedSchoolYear, ...suppliedFilters }
      : {
          schoolYear: selectedSchoolYear,
          districtTypeCategories,
          districtTypes,
          schoolClassifications,
          educatorCategories,
          educatorSubcategories,
          includePartTime,
          counties,
          districts,
          schools,
          minExperience,
          maxExperience,
          minEducationRank,
          maxEducationRank,
        };
    const params = {};
    if (activeFilters.schoolYear) params.schoolYear = activeFilters.schoolYear;
    if (activeFilters.districtTypeCategories.length > 0) params.districtTypeCategories = activeFilters.districtTypeCategories.join(',');
    if (activeFilters.districtTypes.length > 0) params.districtTypes = activeFilters.districtTypes.join(',');
    if (activeFilters.schoolClassifications.length > 0) params.schoolClassifications = activeFilters.schoolClassifications.join(',');
    if (activeFilters.educatorCategories.length > 0) params.educatorCategories = activeFilters.educatorCategories.join(',');
    if (activeFilters.educatorSubcategories.length > 0) params.educatorSubcategories = activeFilters.educatorSubcategories.join(',');
    if (activeFilters.includePartTime) params.includePartTime = 'true';
    if (activeFilters.counties.length > 0) params.counties = activeFilters.counties.join(',');
    if (activeFilters.districts.length > 0) params.districts = activeFilters.districts.join(',');
    if (activeFilters.schools.length > 0) params.schools = activeFilters.schools.join(',');
    if (activeFilters.minExperience !== '') params.minExperience = activeFilters.minExperience;
    if (activeFilters.maxExperience !== '') params.maxExperience = activeFilters.maxExperience;
    if (activeFilters.minEducationRank !== '') params.minEducationRank = activeFilters.minEducationRank;
    if (activeFilters.maxEducationRank !== '') params.maxEducationRank = activeFilters.maxEducationRank;
    setSearchParams(params);
    fetchResults(activeFilters);
  };

  const loadMatchedEducatorSalary = async (fileFolderNumber, schoolYearOverride = null) => {
    const trimmedValue = String(fileFolderNumber || '').trim();
    if (!trimmedValue) {
      setMatchedEducatorSalary(null);
      return null;
    }

    try {
      const queryParams = { fileFolderNumber: trimmedValue };
      const effectiveSchoolYear = schoolYearOverride ?? selectedSchoolYear;
      if (effectiveSchoolYear) queryParams.schoolYear = effectiveSchoolYear;
      const query = new URLSearchParams(queryParams).toString();
      const resp = await fetch(apiUrl(`/api/salary-finder/matching-filters?${query}`));
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to load educator salary');
      const salary = json.educator && json.educator.contract_salary != null
        ? Number(json.educator.contract_salary)
        : null;
      setMatchedEducatorSalary(salary);
      return salary;
    } catch (err) {
      setMatchedEducatorSalary(null);
      return null;
    }
  };

  const applyMatchingFilters = async () => {
    if (!folderNumberInput.trim()) {
      setMatchingFiltersError('Enter a file folder number to match an educator.');
      return;
    }

    setMatchingFiltersLoading(true);
    setMatchingFiltersError(null);
    try {
      const queryParams = { fileFolderNumber: folderNumberInput.trim() };
      if (selectedSchoolYear) queryParams.schoolYear = selectedSchoolYear;
      const query = new URLSearchParams(queryParams).toString();
      const resp = await fetch(apiUrl(`/api/salary-finder/matching-filters?${query}`));
      const json = await resp.json();
      if (!resp.ok) throw new Error(json.error || 'Failed to apply matching filters');

      const nextFilters = {
        districtTypeCategories: getDistrictTypeCategoriesForSelection(json.matchingFilters.districtTypes || []),
        districtTypes: [],
        schoolClassifications: [],
        educatorCategories: json.matchingFilters.educatorCategories || [],
        educatorSubcategories: json.matchingFilters.educatorSubcategories || [],
        includePartTime: Boolean(json.matchingFilters.includePartTime),
        counties: [],
        districts: [],
        schools: [],
        minExperience: json.matchingFilters.minExperience ?? '',
        maxExperience: json.matchingFilters.maxExperience ?? '',
        minEducationRank: json.matchingFilters.minEducationRank ?? '',
        maxEducationRank: json.matchingFilters.maxEducationRank ?? '',
      };

      setMatchedEducatorSalary(
        json.educator && json.educator.contract_salary != null
          ? Number(json.educator.contract_salary)
          : null
      );

      setDistrictTypeCategories(nextFilters.districtTypeCategories);
      setDistrictTypes(nextFilters.districtTypes);
      setSchoolClassifications(nextFilters.schoolClassifications);
      setEducatorCategories(nextFilters.educatorCategories);
      setEducatorSubcategories(nextFilters.educatorSubcategories);
      setIncludePartTime(nextFilters.includePartTime);
      setCounties(nextFilters.counties);
      setDistricts(nextFilters.districts);
      setSchools(nextFilters.schools);
      setMinExperience(nextFilters.minExperience);
      setMaxExperience(nextFilters.maxExperience);
      setMinEducationRank(nextFilters.minEducationRank);
      setMaxEducationRank(nextFilters.maxEducationRank);

      applyFilters(nextFilters);
    } catch (err) {
      setMatchedEducatorSalary(null);
      setMatchingFiltersError(err.message);
    }
    setMatchingFiltersLoading(false);
  };

  const handleSchoolYearChange = async (event) => {
    const nextSchoolYear = event.target.value;
    setSelectedSchoolYear(nextSchoolYear);
    setDistrictTypeCategories([]);
    setDistrictTypes([]);
    setSchoolClassifications([]);
    setEducatorCategories([]);
    setEducatorSubcategories([]);
    setIncludePartTime(false);
    setCounties([]);
    setDistricts([]);
    setSchools([]);
    setMinExperience('');
    setMaxExperience('');
    setMinEducationRank('');
    setMaxEducationRank('');
    setMatchingFiltersError(null);

    try {
      await loadFilterOptions(nextSchoolYear);
      if (folderNumberInput.trim()) {
        await loadMatchedEducatorSalary(folderNumberInput, nextSchoolYear);
      } else {
        setMatchedEducatorSalary(null);
      }
      setSearchParams(nextSchoolYear ? { schoolYear: nextSchoolYear } : {});
      fetchResults({
        schoolYear: nextSchoolYear,
        districtTypeCategories: [],
        districtTypes: [],
        schoolClassifications: [],
        educatorCategories: [],
        educatorSubcategories: [],
        includePartTime: false,
        counties: [],
        districts: [],
        schools: [],
        minExperience: '',
        maxExperience: '',
        minEducationRank: '',
        maxEducationRank: '',
      });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="card">
      <div className="card-body">
        {/* Page header */}
        <div className="page-header salary-finder-header">
          <div className="page-title salary-finder-header-copy">
            <h2>Compare Pay</h2>
            <p>Filter educators, explore salary distributions, and view individual records.</p>
          </div>
          <div className="toolbar salary-finder-header-year">
            <div className="header-field header-field-inline">
              <label htmlFor="salary-finder-school-year">School Year:</label>
              <select
                id="salary-finder-school-year"
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
              onClick={() => setShowFiltersMobile((show) => !show)}
            >
              {showFiltersMobile ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>
          <div className="salary-finder-header-match-panel">
            <div className="salary-finder-header-match-copy">
              <p>
                To use <strong>Apply Matching Filters</strong>, enter a file folder number. If you don't know
                the file folder number, look it up here:{' '}
                <a
                  href="https://pub.education.mn.gov/licenselookup/"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Minnesota Educator License Lookup
                </a>
                .
              </p>
            </div>
            <div className="toolbar salary-finder-header-match">
              <input
                type="text"
                className="input"
                value={folderNumberInput}
                onChange={(e) => setFolderNumberInput(e.target.value)}
                placeholder="File folder number"
                aria-label="File folder number"
              />
              <button
                className="button primary"
                onClick={applyMatchingFilters}
                disabled={matchingFiltersLoading}
              >
                {matchingFiltersLoading ? 'Matching...' : 'Apply Matching Filters'}
              </button>
            </div>
          </div>
        </div>
        {matchingFiltersError && <p style={{ color: 'red', marginTop: 0 }}>{matchingFiltersError}</p>}
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
              label="Educator Category"
              options={filterOptions.educatorCategories}
              selected={educatorCategories}
              setSelected={setEducatorCategories}
            />
            <CheckboxMultiSelect
              label="Educator Subcategory"
              options={filterOptions.educatorSubcategories}
              selected={educatorSubcategories}
              setSelected={setEducatorSubcategories}
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
            <RangeFilter
              label="Years of Experience"
              min={filterOptions.minExperience}
              max={filterOptions.maxExperience}
              minVal={minExperience}
              maxVal={maxExperience}
              setMinVal={setMinExperience}
              setMaxVal={setMaxExperience}
            />
            <EducationLevelRangeFilter
              label="Education Level"
              options={filterOptions.educationLevelOptions}
              minVal={minEducationRank}
              maxVal={maxEducationRank}
              setMinVal={setMinEducationRank}
              setMaxVal={setMaxEducationRank}
            />
            <div className="filter-buttons" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <button className="button secondary" onClick={resetFilters}>Reset Filters</button>
              <button
                className="button primary"
                onClick={async () => {
                  await loadMatchedEducatorSalary(folderNumberInput);
                  applyFilters();
                  setShowFiltersMobile(false);
                }}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
        {/* Desktop layout: filters and content */}
        <div className="row salary-finder-top-row">
          <div className="col col-3 desktop-filter-panel salary-finder-sidebar-column">
            <div className="filter-sidebar-shell">
              <div className="filter-sidebar-header">
                <h3 className="filter-sidebar-title">Filters</h3>
                <div className="filter-buttons salary-finder-sticky-filter-actions" style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                  <button className="button secondary" onClick={resetFilters}>Reset Filters</button>
                  <button
                    className="button primary"
                    onClick={async () => {
                      await loadMatchedEducatorSalary(folderNumberInput);
                      applyFilters();
                    }}
                  >
                    Apply Filters
                  </button>
                </div>
              </div>
              <div className="filter-panel salary-finder-filter-panel">
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
                  label="Educator Category"
                  options={filterOptions.educatorCategories}
                  selected={educatorCategories}
                  setSelected={setEducatorCategories}
                />
                <CheckboxMultiSelect
                  label="Educator Subcategory"
                  options={filterOptions.educatorSubcategories}
                  selected={educatorSubcategories}
                  setSelected={setEducatorSubcategories}
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
                <RangeFilter
                  label="Years of Experience"
                  min={filterOptions.minExperience}
                  max={filterOptions.maxExperience}
                  minVal={minExperience}
                  maxVal={maxExperience}
                  setMinVal={setMinExperience}
                  setMaxVal={setMaxExperience}
                />
                <EducationLevelRangeFilter
                  label="Education Level"
                  options={filterOptions.educationLevelOptions}
                  minVal={minEducationRank}
                  maxVal={maxEducationRank}
                  setMinVal={setMinEducationRank}
                  setMaxVal={setMaxEducationRank}
                />
              </div>
            </div>
          </div>
          <div className="col col-9 salary-finder-chart-column">
            {chartLoading && <p>Loading chart...</p>}
            {error && <p style={{ color: 'red' }}>{error}</p>}
            {!chartLoading && !error && (
              <div className="vertical-grid salary-finder-chart-grid">
                <div className="card salary-finder-histogram-card">
                  <div className="card-header">
                    <div>
                      <h2 className="card-title">{formatSchoolYearLabel(selectedSchoolYear)} Salary Comparison</h2>
                      {histogramOutlierCount > 0 && histogramCap != null && (
                        <div className="card-subtitle">
                          Chart capped at the {formatPercentileLabel(histogramPercentile)}th percentile (${Math.round(histogramCap).toLocaleString()}). {histogramOutlierCount.toLocaleString()} educator{histogramOutlierCount === 1 ? '' : 's'} above that value are excluded from the histogram only.
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="card-body salary-finder-histogram-body">
                    {totalCount < 10 ? (
                      <div className="empty-chart-message">
                        <p style={{ textAlign: 'center', margin: '2rem 0' }}>
                          Less than 10 results found, please broaden your filters to display the graph.
                        </p>
                      </div>
                    ) : (
                      <>
                        <div className={`salary-finder-key-panel${histogramKeyPulse ? ' is-updating' : ''}`}>
                          <div className="salary-finder-key-items">
                            <div className="salary-finder-key-item">
                              <span className="salary-finder-key-swatch salary-finder-key-swatch-count">#</span>
                              <span className="salary-finder-key-label">Educators Found:</span>
                              <span className="salary-finder-key-value">{totalCount.toLocaleString()}</span>
                            </div>
                            <div className="salary-finder-key-item">
                              <span className="salary-finder-key-swatch salary-finder-key-swatch-median"></span>
                              <span className="salary-finder-key-label">Median Salary:</span>
                              <span className="salary-finder-key-value">${Math.round(medianSalary).toLocaleString()}</span>
                            </div>
                            {matchedEducatorSalary != null && (
                              <div className="salary-finder-key-item">
                                <span className="salary-finder-key-swatch salary-finder-key-swatch-yours"></span>
                                <span className="salary-finder-key-label">Your Salary:</span>
                                <span className="salary-finder-key-value">
                                  ${Math.round(matchedEducatorSalary).toLocaleString()}
                                  {!showYourSalaryLine && histogramUpperBound != null ? ' (above chart range)' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="chart-wrap salary-finder-chart-wrap">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={histogram} margin={{ top: 12, right: 10, left: 16, bottom: 18 }} barCategoryGap="16%">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis
                                type="number"
                                dataKey="start"
                                domain={xAxisDomain}
                                ticks={xAxisTicks}
                                tickFormatter={formatSalaryTick}
                                interval={0}
                                minTickGap={0}
                                label={{
                                  value: 'Contract Salary',
                                  position: 'insideBottom',
                                  offset: -10,
                                  style: { fontWeight: 700, fill: 'var(--muted)' },
                                }}
                              />
                              <YAxis
                                width={56}
                                label={{
                                  value: 'Educators',
                                  angle: -90,
                                  position: 'left',
                                  dx: -4,
                                  style: { textAnchor: 'middle', fontWeight: 700, fill: 'var(--muted)' },
                                }}
                              />
                              <Tooltip
                                formatter={(value) => value}
                                labelFormatter={(label) => `Salary ≥ $${label.toLocaleString()}`}
                              />
                              <Bar dataKey="count" fill="#8884d8" />
                              <ReferenceLine
                                x={medianSalary}
                                stroke="#cc8a8a"
                                strokeWidth={3}
                                ifOverflow="extendDomain"
                              />
                              {showYourSalaryLine && (
                                <ReferenceLine
                                  x={matchedEducatorSalary}
                                  stroke="#66a6b0"
                                  strokeWidth={3}
                                  strokeDasharray="6 4"
                                  ifOverflow="extendDomain"
                                />
                              )}
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {!chartLoading && !error && (
          <div className="card salary-finder-results-card" ref={tableSectionRef}>
                <div className="card-header">
                  <div>
                    <h2 className="card-title">{totalCount} Educators Found</h2>
                {!tableLoading && results.length === 0 && <div className="card-subtitle">No results match your filters.</div>}
                  </div>
                </div>
                <div className="card-body">
              {!tableVisible ? (
                <div className="empty-chart-message">
                  <p style={{ textAlign: 'center', margin: '2rem 0' }}>
                    Scroll a little farther to load the full educator table.
                  </p>
                </div>
              ) : tableLoading ? (
                <div className="empty-chart-message">
                  <p style={{ textAlign: 'center', margin: '2rem 0' }}>Loading educator table...</p>
                </div>
              ) : results.length > 0 && (
                <>
                  <div className="salary-finder-table-wrap">
                    <table className="results-table">
                      <thead>
                        <tr>
                          <th onClick={() => requestSort('file_folder_number')} style={{ cursor: 'pointer' }}>
                            File Folder Number
                            {sortConfig.key === 'file_folder_number' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('contract_salary')} style={{ cursor: 'pointer' }}>
                            Contract Salary
                            {sortConfig.key === 'contract_salary' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('years_of_experience')} style={{ cursor: 'pointer' }}>
                            Years of Experience
                            {sortConfig.key === 'years_of_experience' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('highest_education_level_rank')} style={{ cursor: 'pointer' }}>
                            Education Level
                            {sortConfig.key === 'highest_education_level_rank' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('educator_type')} style={{ cursor: 'pointer' }}>
                            Educator Category
                            {sortConfig.key === 'educator_type' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('educator_subtype')} style={{ cursor: 'pointer' }}>
                            Educator Subcategory
                            {sortConfig.key === 'educator_subtype' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('county_name')} style={{ cursor: 'pointer' }}>
                            County
                            {sortConfig.key === 'county_name' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('district_name')} style={{ cursor: 'pointer' }}>
                            District
                            {sortConfig.key === 'district_name' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                          <th onClick={() => requestSort('school_name')} style={{ cursor: 'pointer' }}>
                            School
                            {sortConfig.key === 'school_name' && (
                              <span>{sortConfig.direction === 'asc' ? ' ▲' : ' ▼'}</span>
                            )}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedResults.map((row) => (
                          <tr key={row.file_folder_number}>
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
                            <td>{row.highest_education_level || '—'}</td>
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
