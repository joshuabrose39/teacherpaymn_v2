import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import mysql from 'mysql2/promise';
import { fileURLToPath } from 'url';

// Resolve __dirname in an ES module context.  Using fileURLToPath ensures
// that any URL-encoded characters (spaces, parentheses) in the file path are
// properly decoded on all platforms.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function stripWrappingQuotes(value) {
  if (!value) return value;
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, 'utf8');
  contents.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) return;
    const key = trimmed.slice(0, equalsIndex).trim();
    const rawValue = trimmed.slice(equalsIndex + 1).trim();
    if (!key || process.env[key] != null) return;
    process.env[key] = stripWrappingQuotes(rawValue);
  });
}

loadEnvFile(path.join(__dirname, '.env'));

const FRONTEND_DIST_PATH = path.join(__dirname, '..', 'frontend', 'dist');
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT || 3306),
  database: process.env.MYSQL_DATABASE || 'teacherp_v2',
  user: process.env.MYSQL_USER || 'teacherp_v2app',
  password: process.env.MYSQL_PASSWORD,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  namedPlaceholders: true,
  decimalNumbers: true,
};

const mysqlPool = mysql.createPool(MYSQL_CONFIG);

function createDbFacade(pool) {
  return {
    async all(sql, params = {}) {
      const [rows] = await pool.query(sql, params);
      return rows;
    },
    async get(sql, params = {}) {
      const [rows] = await pool.query(sql, params);
      return rows[0] || null;
    },
  };
}

const dbPromise = Promise.resolve(createDbFacade(mysqlPool));
const educatorProfilesDbPromise = dbPromise;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3001;

/**
 * Helper to build an SQL IN clause with named parameters.  Given a list of
 * values and a base name, returns an object containing the clause
 * `(:name0,:name1,...)` and a params object mapping each generated
 * parameter name to the corresponding value.  If values is empty, returns
 * an empty clause and params.  Callers should not append the clause if
 * it is empty.
 */
function buildInClause(name, values) {
  if (!Array.isArray(values) || values.length === 0) {
    return { clause: '', params: {} };
  }
  const placeholders = values.map((_, idx) => `:${name}${idx}`);
  const params = {};
  values.forEach((v, idx) => {
    params[`${name}${idx}`] = v;
  });
  return {
    clause: `(${placeholders.join(',')})`,
    params,
  };
}

/**
 * Parse a multi-value query parameter.  Accepts either a single string
 * (comma-separated) or an array of strings (from repeated query params).
 * Returns an array of trimmed, non-empty strings.
 */
function parseMulti(val) {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val
      .map((s) => String(s).trim())
      .filter((s) => s !== '');
  }
  return String(val)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s !== '');
}

function parseBooleanQueryParam(val) {
  if (val == null) return false;
  const normalized = String(val).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function appendFullTimeOnlyClause(whereClause, params, includePartTime, columnName = 'full_time_part_time') {
  if (includePartTime) return whereClause;
  whereClause += ` AND COALESCE(${columnName}, '') != :partTimeValue`;
  params.partTimeValue = 'Part-time';
  return whereClause;
}

const SCHOOL_CLASSIFICATION_UNKNOWN = 'Not reported / Unknown';
const SCHOOL_CLASSIFICATION_CHARTER = 'Charter School';

function normalizeSchoolClassification(value) {
  return value === SCHOOL_CLASSIFICATION_CHARTER
    ? SCHOOL_CLASSIFICATION_UNKNOWN
    : value;
}

function expandSchoolClassificationFilters(values) {
  const expanded = new Set();
  values.forEach((value) => {
    if (value === SCHOOL_CLASSIFICATION_UNKNOWN) {
      expanded.add(SCHOOL_CLASSIFICATION_UNKNOWN);
      expanded.add(SCHOOL_CLASSIFICATION_CHARTER);
      return;
    }
    expanded.add(value);
  });
  return [...expanded];
}

async function getSchoolYearContext(tableName, requestedSchoolYear = null) {
  const db = await dbPromise;
  const schoolYears = (await db.all(
    `SELECT DISTINCT school_year AS value
     FROM ${tableName}
     WHERE school_year IS NOT NULL AND school_year != ''
     ORDER BY CAST(SUBSTRING(school_year, 1, 2) AS UNSIGNED) DESC, school_year DESC`
  )).map((row) => row.value);

  const defaultSchoolYear = schoolYears[0] || null;
  const selectedSchoolYear = schoolYears.includes(requestedSchoolYear)
    ? requestedSchoolYear
    : defaultSchoolYear;

  return {
    schoolYears,
    defaultSchoolYear,
    selectedSchoolYear,
    scopeClause: selectedSchoolYear ? 'school_year = :schoolYear' : '1 = 1',
    scopeParams: selectedSchoolYear ? { schoolYear: selectedSchoolYear } : {},
  };
}

async function getProfileSchoolYearContext(fileFolderNumber, requestedSchoolYear = null) {
  const educatorProfilesDb = await educatorProfilesDbPromise;
  const schoolYears = (await educatorProfilesDb.all(
    `SELECT DISTINCT school_year AS value
     FROM (
       SELECT \`School Year\` AS school_year FROM profile_employments WHERE \`File Folder Number\` = :fileFolderNumber
       UNION
       SELECT \`School Year\` AS school_year FROM profile_assignments WHERE \`File Folder Number\` = :fileFolderNumber
       UNION
       SELECT \`School Year\` AS school_year FROM profile_licenses WHERE \`File Folder Number\` = :fileFolderNumber
     )
     WHERE school_year IS NOT NULL AND school_year != ''
     ORDER BY CAST(SUBSTRING(school_year, 1, 2) AS UNSIGNED) DESC, school_year DESC`,
    { fileFolderNumber }
  )).map((row) => row.value);

  const defaultSchoolYear = schoolYears[0] || null;
  const selectedSchoolYear = schoolYears.includes(requestedSchoolYear)
    ? requestedSchoolYear
    : defaultSchoolYear;

  return {
    schoolYears,
    defaultSchoolYear,
    selectedSchoolYear,
  };
}

async function getSchoolClassificationOptions(tableName, scopeClause = '1 = 1', scopeParams = {}) {
  const db = await dbPromise;
  const rows = await db.all(
    `SELECT DISTINCT
        CASE
          WHEN school_classification_name = :charterSchoolClassification THEN :unknownSchoolClassification
          ELSE school_classification_name
        END AS value
     FROM ${tableName}
     WHERE ${scopeClause}
       AND school_classification_name IS NOT NULL
       AND school_classification_name != ''
     ORDER BY value`,
    {
      ...scopeParams,
      charterSchoolClassification: SCHOOL_CLASSIFICATION_CHARTER,
      unknownSchoolClassification: SCHOOL_CLASSIFICATION_UNKNOWN,
    }
  );

  return rows.map((row) => row.value);
}

function buildScatterplotWhereClause(query) {
  const districtTypes = parseMulti(query.districtTypes);
  const schoolClassifications = expandSchoolClassificationFilters(parseMulti(query.schoolClassifications));
  const educatorTypes = parseMulti(query.educatorTypes);
  const educatorSubtypes = parseMulti(query.educatorSubtypes);
  const counties = parseMulti(query.counties);
  const districts = parseMulti(query.districts);
  const schools = parseMulti(query.schools);
  const schoolYear = query.schoolYear ? String(query.schoolYear) : null;
  const includePartTime = parseBooleanQueryParam(query.includePartTime);

  let whereClause = ' WHERE contract_salary IS NOT NULL AND contract_salary > 0';
  const params = {};
  if (schoolYear) {
    whereClause += ' AND school_year = :schoolYear';
    params.schoolYear = schoolYear;
  }
  if (districtTypes.length > 0) {
    const { clause, params: inParams } = buildInClause('dt', districtTypes);
    whereClause += ` AND district_type_name IN ${clause}`;
    Object.assign(params, inParams);
  }
  if (schoolClassifications.length > 0) {
    const { clause, params: inParams } = buildInClause('sc', schoolClassifications);
    whereClause += ` AND school_classification_name IN ${clause}`;
    Object.assign(params, inParams);
  }
  if (educatorTypes.length > 0) {
    const { clause, params: inParams } = buildInClause('et', educatorTypes);
    whereClause += ` AND educator_type IN ${clause}`;
    Object.assign(params, inParams);
  }
  if (educatorSubtypes.length > 0) {
    const { clause, params: inParams } = buildInClause('est', educatorSubtypes);
    whereClause += ` AND educator_subtype IN ${clause}`;
    Object.assign(params, inParams);
  }
  if (counties.length > 0) {
    const { clause, params: inParams } = buildInClause('cty', counties);
    whereClause += ` AND county_name IN ${clause}`;
    Object.assign(params, inParams);
  }
  if (districts.length > 0) {
    const { clause, params: inParams } = buildInClause('dist', districts);
    whereClause += ` AND district_name IN ${clause}`;
    Object.assign(params, inParams);
  }
  if (schools.length > 0) {
    const { clause, params: inParams } = buildInClause('sch', schools);
    whereClause += ` AND school_name IN ${clause}`;
    Object.assign(params, inParams);
  }

  whereClause = appendFullTimeOnlyClause(whereClause, params, includePartTime);

  return { whereClause, params };
}

function getEducationBand(rank, label, educationLabels) {
  if (rank == null || Number.isNaN(Number(rank))) return { minRank: null, maxRank: null };

  const normalizedLabel = String(label || '').trim();
  if (!normalizedLabel) {
    const normalizedRank = Number(rank);
    return { minRank: normalizedRank, maxRank: normalizedRank };
  }

  let matcher = null;
  if (normalizedLabel.startsWith('BA ')) {
    matcher = (itemLabel) => String(itemLabel).startsWith('BA ');
  } else if (normalizedLabel.startsWith('MA ')) {
    matcher = (itemLabel) => String(itemLabel).startsWith('MA ');
  } else if (normalizedLabel === 'ED Specialist' || normalizedLabel === 'Doctoral degree') {
    matcher = (itemLabel) => itemLabel === 'ED Specialist' || itemLabel === 'Doctoral degree';
  }

  if (!matcher) {
    const normalizedRank = Number(rank);
    return { minRank: normalizedRank, maxRank: normalizedRank };
  }

  const matchingRanks = (educationLabels || [])
    .filter((item) => matcher(item.label))
    .map((item) => Number(item.rank))
    .filter((value) => !Number.isNaN(value));

  if (matchingRanks.length === 0) {
    const normalizedRank = Number(rank);
    return { minRank: normalizedRank, maxRank: normalizedRank };
  }

  return {
    minRank: Math.min(...matchingRanks),
    maxRank: Math.max(...matchingRanks),
  };
}

function getExperienceBand(years, minBound, maxBound) {
  if (
    years == null ||
    minBound == null ||
    maxBound == null ||
    Number.isNaN(Number(years)) ||
    Number.isNaN(Number(minBound)) ||
    Number.isNaN(Number(maxBound))
  ) {
    return { minExperience: null, maxExperience: null };
  }

  const normalizedYears = Number(years);
  const normalizedMinBound = Number(minBound);
  const normalizedMaxBound = Number(maxBound);

  if (normalizedYears <= 3) {
    return {
      minExperience: Math.max(normalizedMinBound, 0),
      maxExperience: Math.min(normalizedMaxBound, 3),
    };
  }

  return {
    minExperience: Math.max(normalizedMinBound, normalizedYears - 2),
    maxExperience: Math.min(normalizedMaxBound, normalizedYears + 2),
  };
}

/**
 * Compute histogram bins from an array of numeric values.  The number of
 * bins can be specified (default 15).  Bin boundaries are aligned to
 * thousand increments for readability.  Returns an array of objects with
 * `start`, `end` and `count` properties.  If all values are identical,
 * returns a single bin spanning the exact value.
 */
function computeHistogram(values, binCount = 15) {
  if (!values || values.length === 0) return [];
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  if (minVal === maxVal) {
    return [
      {
        start: minVal,
        end: maxVal,
        count: values.length,
      },
    ];
  }
  // Calculate the raw bin size and round up to the nearest thousand.
  const rawBinSize = (maxVal - minVal) / binCount;
  const binWidth = Math.max(1000, Math.ceil(rawBinSize / 1000) * 1000);
  // Align the start to the nearest lower thousand.
  const start = Math.floor(minVal / 1000) * 1000;
  // Compute the end boundary so all values are covered.  Extend until
  // maxVal is within the final bin.
  let end = start + binWidth * binCount;
  while (end < maxVal) {
    end += binWidth;
  }
  // Initialize bins
  const bins = [];
  for (let s = start; s < end; s += binWidth) {
    bins.push({ start: s, end: s + binWidth, count: 0 });
  }
  // Count values into bins.  Values equal to the final boundary fall into
  // the last bin.
  values.forEach((val) => {
    let idx = Math.floor((val - start) / binWidth);
    if (idx < 0) idx = 0;
    if (idx >= bins.length) idx = bins.length - 1;
    bins[idx].count++;
  });
  return bins;
}

function computePercentile(values, percentile) {
  if (!values || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 1) return sorted[0];
  const position = (sorted.length - 1) * percentile;
  const lowerIndex = Math.floor(position);
  const upperIndex = Math.ceil(position);
  if (lowerIndex === upperIndex) return sorted[lowerIndex];
  const weight = position - lowerIndex;
  return sorted[lowerIndex] + (sorted[upperIndex] - sorted[lowerIndex]) * weight;
}

function computeScatterClusters(rows, {
  experienceBinSize = 1,
  salaryBinSize = 5000,
} = {}) {
  if (!rows || rows.length === 0) return [];

  const clusterMap = new Map();

  rows.forEach((row) => {
    const experience = Number(row.years_of_experience);
    const salary = Number(row.contract_salary);
    if (Number.isNaN(experience) || Number.isNaN(salary)) return;

    const xBin = Math.floor(experience / experienceBinSize);
    const yBin = Math.floor(salary / salaryBinSize);
    const key = `${xBin}:${yBin}`;
    const districtType = row.district_type_name || 'other';

    if (!clusterMap.has(key)) {
      clusterMap.set(key, {
        years_of_experience: xBin * experienceBinSize + (experienceBinSize / 2),
        contract_salary: yBin * salaryBinSize + (salaryBinSize / 2),
        cluster_count: 0,
        districtTypeCounts: {},
      });
    }

    const cluster = clusterMap.get(key);
    cluster.cluster_count += 1;
    cluster.districtTypeCounts[districtType] = (cluster.districtTypeCounts[districtType] || 0) + 1;
  });

  return Array.from(clusterMap.values()).map((cluster, index) => {
    const dominantDistrictType = Object.entries(cluster.districtTypeCounts)
      .sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))[0]?.[0] || null;

    return {
      scatterplot_id: `cluster-${index}`,
      years_of_experience: cluster.years_of_experience,
      contract_salary: cluster.contract_salary,
      district_type_name: dominantDistrictType,
      cluster_count: cluster.cluster_count,
    };
  });
}

const NUMERIC_SQL = {
  contractSalary: 'CAST(contract_salary AS DECIMAL(12,2))',
  yearsOfExperience: 'CAST(years_of_experience AS DECIMAL(10,2))',
  highestEducationRank: 'CAST(highest_education_level_rank AS DECIMAL(10,2))',
};

/*
 * Endpoint: GET /api/school-map/filter-options
 * Returns lists of distinct values for each filter used on the School Map
 * dashboard. Only the active School Map filters are returned. Each list is
 * sorted alphabetically for display. Null or blank values are excluded.
 */
app.get('/api/school-map/filter-options', async (req, res) => {
  try {
    const db = await dbPromise;
    const districtTypes = await db.all(
      `SELECT DISTINCT district_type_name AS value
       FROM web_school_map
       WHERE district_type_name IS NOT NULL AND district_type_name != ''
       ORDER BY district_type_name`
    );
    const schoolClassifications = await getSchoolClassificationOptions('web_school_map');
    res.json({
      districtTypes: districtTypes.map((r) => r.value),
      schoolClassifications,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch map filter options' });
  }
});

/*
 * Endpoint: GET /api/school-map
 * Returns map data filtered by optional query parameters.  Query params:
 * - districtTypes: comma-separated list of district_type_name values
 * - schoolClassifications: comma-separated list of school_classification_name values
 * - schoolYear: optional school_year value to filter by
 */
app.get('/api/school-map', async (req, res) => {
  try {
    const db = await dbPromise;
    const districtTypes = parseMulti(req.query.districtTypes);
    const schoolClassifications = expandSchoolClassificationFilters(parseMulti(req.query.schoolClassifications));
    const schoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;
    const includePartTime = parseBooleanQueryParam(req.query.includePartTime);
    const medianTeacherSalaryColumn = includePartTime ? 'median_teacher_salary' : 'median_teacher_salary_full_time';
    const medianYearsExperienceColumn = includePartTime ? 'median_years_experience' : 'median_years_experience_full_time';
    const medianEducationRankColumn = includePartTime ? 'median_education_level_rank' : 'median_education_level_rank_full_time';
    const medianEducationLabelColumn = includePartTime ? 'median_education_level_label' : 'median_education_level_label_full_time';

    let sql = `SELECT district_number, district_name, district_type_name,
                      school_number, school_name, school_classification_name,
                      county_name, latitude, longitude, student_enrollment,
                      student_students_of_color_pct, teacher_teachers_of_color_pct,
                      ${medianTeacherSalaryColumn} AS median_teacher_salary,
                      ${medianYearsExperienceColumn} AS median_years_experience,
                      ${medianEducationRankColumn} AS median_education_level_rank,
                      ${medianEducationLabelColumn} AS median_education_level_label
               FROM web_school_map
               WHERE 1=1`;
    const params = {};
    // Year filter if provided
    if (schoolYear) {
      sql += ' AND school_year = :schoolYear';
      params.schoolYear = schoolYear;
    }
    // Apply multi-select filters
    if (districtTypes.length > 0) {
      const { clause, params: inParams } = buildInClause('dt', districtTypes);
      sql += ` AND district_type_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schoolClassifications.length > 0) {
      const { clause, params: inParams } = buildInClause('sc', schoolClassifications);
      sql += ` AND school_classification_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    // Execute query
    const rows = await db.all(sql, params);
    res.json({ results: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch map data' });
  }
});

/*
 * Endpoint: GET /api/scatterplot/filter-options
 * Returns distinct filter values for the Scatterplot dashboard.
 */
app.get('/api/scatterplot/filter-options', async (req, res) => {
  try {
    const db = await dbPromise;
    const schoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;
    const yearContext = await getSchoolYearContext('web_salary_scatterplot', schoolYear);
    const districtTypes = await db.all(
      `SELECT DISTINCT district_type_name AS value
       FROM web_salary_scatterplot
       WHERE ${yearContext.scopeClause}
         AND district_type_name IS NOT NULL AND district_type_name != ''
       ORDER BY district_type_name`,
      yearContext.scopeParams
    );
    const schoolClassifications = await getSchoolClassificationOptions(
      'web_salary_scatterplot',
      yearContext.scopeClause,
      yearContext.scopeParams,
    );
    const educatorTypes = await db.all(
      `SELECT DISTINCT educator_type AS value
       FROM web_salary_scatterplot
       WHERE ${yearContext.scopeClause}
         AND educator_type IS NOT NULL AND educator_type != ''
       ORDER BY educator_type`,
      yearContext.scopeParams
    );
    const educatorSubtypes = await db.all(
      `SELECT DISTINCT educator_subtype AS value
       FROM web_salary_scatterplot
       WHERE ${yearContext.scopeClause}
         AND educator_subtype IS NOT NULL AND educator_subtype != ''
       ORDER BY educator_subtype`,
      yearContext.scopeParams
    );
    const counties = await db.all(
      `SELECT DISTINCT county_name AS value
       FROM web_salary_scatterplot
       WHERE ${yearContext.scopeClause}
         AND county_name IS NOT NULL AND county_name != ''
       ORDER BY county_name`,
      yearContext.scopeParams
    );
    const districts = await db.all(
      `SELECT DISTINCT district_name AS value
       FROM web_salary_scatterplot
       WHERE ${yearContext.scopeClause}
         AND district_name IS NOT NULL AND district_name != ''
       ORDER BY district_name`,
      yearContext.scopeParams
    );
    const schools = await db.all(
      `SELECT DISTINCT school_name AS value
       FROM web_salary_scatterplot
       WHERE ${yearContext.scopeClause}
         AND school_name IS NOT NULL AND school_name != ''
       ORDER BY school_name`,
      yearContext.scopeParams
    );
    res.json({
      schoolYears: yearContext.schoolYears,
      defaultSchoolYear: yearContext.defaultSchoolYear,
      selectedSchoolYear: yearContext.selectedSchoolYear,
      districtTypes: districtTypes.map((r) => r.value),
      schoolClassifications,
      educatorTypes: educatorTypes.map((r) => r.value),
      educatorSubtypes: educatorSubtypes.map((r) => r.value),
      counties: counties.map((r) => r.value),
      districts: districts.map((r) => r.value),
      schools: schools.map((r) => r.value),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scatterplot filter options' });
  }
});

/*
 * Endpoint: GET /api/scatterplot
 * Returns scatter plot data filtered by optional query parameters.  Query
 * params:
 * - districtTypes: list of district_type_name values
 * - schoolClassifications: list of school_classification_name values
 * - educatorTypes: list of educator_type values
 * - educatorSubtypes: list of educator_subtype values
 * - counties: list of county_name values
 * - districts: list of district_name values
 * - schools: list of school_name values
 * - schoolYear: optional school_year value
 */
app.get('/api/scatterplot', async (req, res) => {
  try {
    const db = await dbPromise;
    const SCATTERPLOT_RENDER_LIMIT = 20000;
    const { whereClause, params } = buildScatterplotWhereClause(req.query);
    const totalCount = (await db.get(
      `SELECT COUNT(*) AS count FROM web_salary_scatterplot${whereClause}`,
      params
    )).count;

    const sql = `SELECT file_folder_number,
                        ${NUMERIC_SQL.contractSalary} AS contract_salary,
                        ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
                        district_type_name, education_level,
                        CAST(education_level_rank AS DECIMAL(10,2)) AS education_level_rank,
                        educator_type, educator_subtype,
                        county_name, district_name, school_name
                 FROM web_salary_scatterplot${whereClause}`;
    const rows = await db.all(sql, params);
    const salaries = rows
      .map((row) => Number(row.contract_salary))
      .filter((salary) => !Number.isNaN(salary));
    const salaryPercentile = 0.999;
    const salaryCap = computePercentile(salaries, salaryPercentile);
    const chartRows = salaryCap != null
      ? rows.filter((row) => Number(row.contract_salary) <= salaryCap)
      : rows;
    const outlierCount = rows.length - chartRows.length;
    const clustered = totalCount > SCATTERPLOT_RENDER_LIMIT;
    const displayRows = clustered ? computeScatterClusters(chartRows) : chartRows;
    res.json({
      results: displayRows,
      tooManyToRender: false,
      totalCount,
      renderLimit: SCATTERPLOT_RENDER_LIMIT,
      salaryOutlierCount: outlierCount,
      salaryCap,
      salaryPercentile,
      clustered,
      clusterCount: clustered ? displayRows.length : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scatterplot data' });
  }
});

app.get('/api/scatterplot/chart', async (req, res) => {
  try {
    const db = await dbPromise;
    const SCATTERPLOT_RENDER_LIMIT = 20000;
    const { whereClause, params } = buildScatterplotWhereClause(req.query);
    const totalCount = (await db.get(
      `SELECT COUNT(*) AS count FROM web_salary_scatterplot${whereClause}`,
      params
    )).count;

    const sql = `SELECT file_folder_number,
                        ${NUMERIC_SQL.contractSalary} AS contract_salary,
                        ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
                        district_type_name, education_level,
                        CAST(education_level_rank AS DECIMAL(10,2)) AS education_level_rank,
                        educator_type, educator_subtype
                 FROM web_salary_scatterplot${whereClause}`;
    const rows = await db.all(sql, params);
    const salaries = rows
      .map((row) => Number(row.contract_salary))
      .filter((salary) => !Number.isNaN(salary));
    const salaryPercentile = 0.999;
    const salaryCap = computePercentile(salaries, salaryPercentile);
    const chartRows = salaryCap != null
      ? rows.filter((row) => Number(row.contract_salary) <= salaryCap)
      : rows;
    const outlierCount = rows.length - chartRows.length;
    const clustered = totalCount > SCATTERPLOT_RENDER_LIMIT;
    const displayRows = clustered ? computeScatterClusters(chartRows) : chartRows;
    res.json({
      results: displayRows,
      totalCount,
      renderLimit: SCATTERPLOT_RENDER_LIMIT,
      salaryOutlierCount: outlierCount,
      salaryCap,
      salaryPercentile,
      clustered,
      clusterCount: clustered ? displayRows.length : 0,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scatterplot chart data' });
  }
});

app.get('/api/scatterplot/table', async (req, res) => {
  try {
    const db = await dbPromise;
    const SCATTERPLOT_RENDER_LIMIT = 20000;
    const { whereClause, params } = buildScatterplotWhereClause(req.query);
    const totalCount = (await db.get(
      `SELECT COUNT(*) AS count FROM web_salary_scatterplot${whereClause}`,
      params
    )).count;

    if (totalCount > SCATTERPLOT_RENDER_LIMIT) {
      res.json({
        results: [],
        tooManyToRender: true,
        totalCount,
        renderLimit: SCATTERPLOT_RENDER_LIMIT,
      });
      return;
    }

    const sql = `SELECT file_folder_number,
                        ${NUMERIC_SQL.contractSalary} AS contract_salary,
                        ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
                        district_type_name, education_level,
                        CAST(education_level_rank AS DECIMAL(10,2)) AS education_level_rank,
                        educator_type, educator_subtype,
                        county_name, district_name, school_name
                 FROM web_salary_scatterplot${whereClause}`;
    const rows = await db.all(sql, params);
    res.json({
      results: rows,
      tooManyToRender: false,
      totalCount,
      renderLimit: SCATTERPLOT_RENDER_LIMIT,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch scatterplot table data' });
  }
});

/*
 * Endpoint: GET /api/salary-finder/filter-options
 * Returns distinct filter values and range information for the Salary Finder
 * dashboard.  Also provides the list of education level options with
 * associated rank values, sorted by rank.
 */
app.get('/api/salary-finder/filter-options', async (req, res) => {
  try {
    const db = await dbPromise;
    const schoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;
    const yearContext = await getSchoolYearContext('web_salary_finder', schoolYear);
    const safeRows = async (label, query) => {
      try {
        return await query();
      } catch (err) {
        console.error(`salary-finder/filter-options ${label} failed`, err);
        return [];
      }
    };

    const safeRow = async (label, query, fallback) => {
      try {
        return (await query()) || fallback;
      } catch (err) {
        console.error(`salary-finder/filter-options ${label} failed`, err);
        return fallback;
      }
    };

    const districtTypes = await safeRows('districtTypes', () => db.all(
      `SELECT DISTINCT district_type_name AS value
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND district_type_name IS NOT NULL AND district_type_name != ''
       ORDER BY district_type_name`,
      yearContext.scopeParams
    ));
    const schoolClassifications = await safeRows('schoolClassifications', () => getSchoolClassificationOptions(
      'web_salary_finder',
      yearContext.scopeClause,
      yearContext.scopeParams,
    ));
    const educatorCategories = await safeRows('educatorCategories', () => db.all(
      `SELECT DISTINCT educator_type AS value
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND educator_type IS NOT NULL AND educator_type != ''
       ORDER BY educator_type`,
      yearContext.scopeParams
    ));
    const educatorSubcategories = await safeRows('educatorSubcategories', () => db.all(
      `SELECT DISTINCT educator_subtype AS value
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND educator_subtype IS NOT NULL AND educator_subtype != ''
       ORDER BY educator_subtype`,
      yearContext.scopeParams
    ));
    const counties = await safeRows('counties', () => db.all(
      `SELECT DISTINCT county_name AS value
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND county_name IS NOT NULL AND county_name != ''
       ORDER BY county_name`,
      yearContext.scopeParams
    ));
    const districts = await safeRows('districts', () => db.all(
      `SELECT DISTINCT district_name AS value
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND district_name IS NOT NULL AND district_name != ''
       ORDER BY district_name`,
      yearContext.scopeParams
    ));
    const schools = await safeRows('schools', () => db.all(
      `SELECT DISTINCT school_name AS value
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND school_name IS NOT NULL AND school_name != ''
       ORDER BY school_name`,
      yearContext.scopeParams
    ));
    const expRange = await safeRow(
      'experienceRange',
      () => db.get(
        `SELECT
            MIN(CASE WHEN TRIM(COALESCE(years_of_experience, '')) = '' THEN NULL ELSE ${NUMERIC_SQL.yearsOfExperience} END) AS minExp,
            MAX(CASE WHEN TRIM(COALESCE(years_of_experience, '')) = '' THEN NULL ELSE ${NUMERIC_SQL.yearsOfExperience} END) AS maxExp
         FROM web_salary_finder
         WHERE ${yearContext.scopeClause}`,
        yearContext.scopeParams
      ),
      { minExp: 0, maxExp: 0 }
    );
    const minExperience = expRange.minExp != null ? Number(expRange.minExp) : 0;
    const maxExperience = expRange.maxExp != null ? Number(expRange.maxExp) : 0;
    const eduRange = await safeRow(
      'educationRange',
      () => db.get(
        `SELECT
            MIN(CASE WHEN TRIM(COALESCE(highest_education_level_rank, '')) = '' THEN NULL ELSE ${NUMERIC_SQL.highestEducationRank} END) AS minRank,
            MAX(CASE WHEN TRIM(COALESCE(highest_education_level_rank, '')) = '' THEN NULL ELSE ${NUMERIC_SQL.highestEducationRank} END) AS maxRank
         FROM web_salary_finder
         WHERE ${yearContext.scopeClause}`,
        yearContext.scopeParams
      ),
      { minRank: 0, maxRank: 0 }
    );
    const minEducationRank = eduRange.minRank != null ? Number(eduRange.minRank) : 0;
    const maxEducationRank = eduRange.maxRank != null ? Number(eduRange.maxRank) : 0;
    const eduOptions = await safeRows('educationOptions', () => db.all(
      `SELECT DISTINCT
          ${NUMERIC_SQL.highestEducationRank} AS rank,
          highest_education_level AS label
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND highest_education_level_rank IS NOT NULL
         AND TRIM(COALESCE(highest_education_level_rank, '')) != ''
         AND highest_education_level IS NOT NULL
         AND highest_education_level != ''
       ORDER BY CAST(highest_education_level_rank AS DECIMAL(10,2)), highest_education_level`,
      yearContext.scopeParams
    ));
    res.json({
      schoolYears: yearContext.schoolYears,
      defaultSchoolYear: yearContext.defaultSchoolYear,
      selectedSchoolYear: yearContext.selectedSchoolYear,
      districtTypes: districtTypes.map((r) => r.value),
      schoolClassifications: Array.isArray(schoolClassifications)
        ? schoolClassifications.map((r) => (typeof r === 'string' ? r : r.value))
        : [],
      educatorCategories: educatorCategories.map((r) => r.value),
      educatorSubcategories: educatorSubcategories.map((r) => r.value),
      counties: counties.map((r) => r.value),
      districts: districts.map((r) => r.value),
      schools: schools.map((r) => r.value),
      minExperience,
      maxExperience,
      minEducationRank,
      maxEducationRank,
      educationLevelOptions: eduOptions.map((r) => ({ rank: r.rank, label: r.label })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch salary finder filter options' });
  }
});

/*
 * Endpoint: GET /api/salary-finder
 * Returns filtered educator data and histogram for the Salary Finder
 * dashboard.  Supports multi-select filters and numeric ranges.
 * Query parameters:
 * - districtTypes: comma-separated district_type_name values
 * - schoolClassifications: comma-separated school_classification_name values
 * - educatorCategories: comma-separated educator_type values
 * - educatorSubcategories: comma-separated educator_subtype values
 * - counties: comma-separated county_name values
 * - districts: comma-separated district_name values
 * - schools: comma-separated school_name values
 * - minExperience: minimum years_of_experience (inclusive)
 * - maxExperience: maximum years_of_experience (inclusive)
 * - minEducationRank: minimum highest_education_level_rank (inclusive)
 * - maxEducationRank: maximum highest_education_level_rank (inclusive)
 * - schoolYear: optional school_year value
 */
app.get('/api/salary-finder', async (req, res) => {
  try {
    const db = await dbPromise;
    const SALARY_FINDER_RENDER_LIMIT = 20000;
    const districtTypes = parseMulti(req.query.districtTypes);
    const schoolClassifications = expandSchoolClassificationFilters(parseMulti(req.query.schoolClassifications));
    const educatorCategories = parseMulti(req.query.educatorCategories);
    const educatorSubcategories = parseMulti(req.query.educatorSubcategories);
    const counties = parseMulti(req.query.counties);
    const districts = parseMulti(req.query.districts);
    const schools = parseMulti(req.query.schools);
    const schoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;
    const includePartTime = parseBooleanQueryParam(req.query.includePartTime);
    // Numeric range filters.  Use parseFloat to allow decimals but cast to
    // numbers.  Default to null to indicate no filtering on that bound.
    const minExperience = req.query.minExperience != null ? parseFloat(req.query.minExperience) : null;
    const maxExperience = req.query.maxExperience != null ? parseFloat(req.query.maxExperience) : null;
    const minEducationRank = req.query.minEducationRank != null ? parseInt(req.query.minEducationRank, 10) : null;
    const maxEducationRank = req.query.maxEducationRank != null ? parseInt(req.query.maxEducationRank, 10) : null;

    let sql = `SELECT file_folder_number,
                      ${NUMERIC_SQL.contractSalary} AS contract_salary,
                      ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
                      highest_education_level,
                      ${NUMERIC_SQL.highestEducationRank} AS highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name
               FROM web_salary_finder
               WHERE contract_salary IS NOT NULL AND ${NUMERIC_SQL.contractSalary} > 0`;
    const params = {};
    if (schoolYear) {
      sql += ' AND school_year = :schoolYear';
      params.schoolYear = schoolYear;
    }
    // Multi-select filters
    if (districtTypes.length > 0) {
      const { clause, params: inParams } = buildInClause('dt', districtTypes);
      sql += ` AND district_type_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schoolClassifications.length > 0) {
      const { clause, params: inParams } = buildInClause('sc', schoolClassifications);
      sql += ` AND school_classification_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (educatorCategories.length > 0) {
      const { clause, params: inParams } = buildInClause('ec', educatorCategories);
      sql += ` AND educator_type IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (educatorSubcategories.length > 0) {
      const { clause, params: inParams } = buildInClause('esub', educatorSubcategories);
      sql += ` AND educator_subtype IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (counties.length > 0) {
      const { clause, params: inParams } = buildInClause('cty', counties);
      sql += ` AND county_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (districts.length > 0) {
      const { clause, params: inParams } = buildInClause('dist', districts);
      sql += ` AND district_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schools.length > 0) {
      const { clause, params: inParams } = buildInClause('sch', schools);
      sql += ` AND school_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    sql = appendFullTimeOnlyClause(sql, params, includePartTime);
    // Numeric range filters for experience
    if (minExperience != null) {
      sql += ` AND ${NUMERIC_SQL.yearsOfExperience} >= :minExp`;
      params.minExp = minExperience;
    }
    if (maxExperience != null) {
      sql += ` AND ${NUMERIC_SQL.yearsOfExperience} <= :maxExp`;
      params.maxExp = maxExperience;
    }
    // Numeric range filters for education rank
    if (minEducationRank != null) {
      sql += ` AND ${NUMERIC_SQL.highestEducationRank} >= :minEduRank`;
      params.minEduRank = minEducationRank;
    }
    if (maxEducationRank != null) {
      sql += ` AND ${NUMERIC_SQL.highestEducationRank} <= :maxEduRank`;
      params.maxEduRank = maxEducationRank;
    }
    const countSql = sql.replace(
      `SELECT file_folder_number, contract_salary, years_of_experience,
                      highest_education_level, highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name`,
      'SELECT COUNT(*) AS count'
    );
    const totalCount = (await db.get(countSql, params)).count;
    const salarySql = sql.replace(
      `SELECT file_folder_number, contract_salary, years_of_experience,
                      highest_education_level, highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name`,
      'SELECT contract_salary'
    );
    const salaryRows = await db.all(salarySql, params);
    const salaries = salaryRows
      .map((r) => Number(r.contract_salary))
      .filter((s) => !Number.isNaN(s));
    const histogramPercentile = 0.999;
    const histogramCap = computePercentile(salaries, histogramPercentile);
    const chartSalaries = histogramCap != null
      ? salaries.filter((salary) => salary <= histogramCap)
      : salaries;
    const outlierCount = salaries.length - chartSalaries.length;
    const histogram = computeHistogram(chartSalaries, 15);
    let averageSalary = null;
    let medianSalary = null;

    if (salaries.length > 0) {
      const sum = salaries.reduce((acc, value) => acc + value, 0);
      averageSalary = sum / salaries.length;
      const sortedSalaries = [...salaries].sort((a, b) => a - b);
      const midpoint = Math.floor(sortedSalaries.length / 2);
      medianSalary = sortedSalaries.length % 2 !== 0
        ? sortedSalaries[midpoint]
        : (sortedSalaries[midpoint - 1] + sortedSalaries[midpoint]) / 2;
    }

    const rows = totalCount > SALARY_FINDER_RENDER_LIMIT
      ? []
      : await db.all(sql, params);

    res.json({
      results: rows,
      histogram,
      tooManyTableResults: totalCount > SALARY_FINDER_RENDER_LIMIT,
      totalCount,
      renderLimit: SALARY_FINDER_RENDER_LIMIT,
      histogramOutlierCount: outlierCount,
      histogramCap,
      histogramPercentile,
      averageSalary,
      medianSalary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch salary finder data' });
  }
});

app.get('/api/salary-finder/chart', async (req, res) => {
  try {
    const db = await dbPromise;
    const districtTypes = parseMulti(req.query.districtTypes);
    const schoolClassifications = expandSchoolClassificationFilters(parseMulti(req.query.schoolClassifications));
    const educatorCategories = parseMulti(req.query.educatorCategories);
    const educatorSubcategories = parseMulti(req.query.educatorSubcategories);
    const counties = parseMulti(req.query.counties);
    const districts = parseMulti(req.query.districts);
    const schools = parseMulti(req.query.schools);
    const schoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;
    const includePartTime = parseBooleanQueryParam(req.query.includePartTime);
    const minExperience = req.query.minExperience != null ? parseFloat(req.query.minExperience) : null;
    const maxExperience = req.query.maxExperience != null ? parseFloat(req.query.maxExperience) : null;
    const minEducationRank = req.query.minEducationRank != null ? parseInt(req.query.minEducationRank, 10) : null;
    const maxEducationRank = req.query.maxEducationRank != null ? parseInt(req.query.maxEducationRank, 10) : null;

    let sql = `SELECT file_folder_number,
                      ${NUMERIC_SQL.contractSalary} AS contract_salary,
                      ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
                      highest_education_level,
                      ${NUMERIC_SQL.highestEducationRank} AS highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name
               FROM web_salary_finder
               WHERE contract_salary IS NOT NULL AND ${NUMERIC_SQL.contractSalary} > 0`;
    const params = {};
    if (schoolYear) {
      sql += ' AND school_year = :schoolYear';
      params.schoolYear = schoolYear;
    }
    if (districtTypes.length > 0) {
      const { clause, params: inParams } = buildInClause('dt', districtTypes);
      sql += ` AND district_type_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schoolClassifications.length > 0) {
      const { clause, params: inParams } = buildInClause('sc', schoolClassifications);
      sql += ` AND school_classification_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (educatorCategories.length > 0) {
      const { clause, params: inParams } = buildInClause('ec', educatorCategories);
      sql += ` AND educator_type IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (educatorSubcategories.length > 0) {
      const { clause, params: inParams } = buildInClause('esub', educatorSubcategories);
      sql += ` AND educator_subtype IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (counties.length > 0) {
      const { clause, params: inParams } = buildInClause('cty', counties);
      sql += ` AND county_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (districts.length > 0) {
      const { clause, params: inParams } = buildInClause('dist', districts);
      sql += ` AND district_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schools.length > 0) {
      const { clause, params: inParams } = buildInClause('sch', schools);
      sql += ` AND school_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    sql = appendFullTimeOnlyClause(sql, params, includePartTime);
    if (minExperience != null) {
      sql += ` AND ${NUMERIC_SQL.yearsOfExperience} >= :minExp`;
      params.minExp = minExperience;
    }
    if (maxExperience != null) {
      sql += ` AND ${NUMERIC_SQL.yearsOfExperience} <= :maxExp`;
      params.maxExp = maxExperience;
    }
    if (minEducationRank != null) {
      sql += ` AND ${NUMERIC_SQL.highestEducationRank} >= :minEduRank`;
      params.minEduRank = minEducationRank;
    }
    if (maxEducationRank != null) {
      sql += ` AND ${NUMERIC_SQL.highestEducationRank} <= :maxEduRank`;
      params.maxEduRank = maxEducationRank;
    }
    const countSql = sql.replace(
      `SELECT file_folder_number, contract_salary, years_of_experience,
                      highest_education_level, highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name`,
      'SELECT COUNT(*) AS count'
    );
    const totalCount = (await db.get(countSql, params)).count;
    const salarySql = sql.replace(
      `SELECT file_folder_number, contract_salary, years_of_experience,
                      highest_education_level, highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name`,
      'SELECT contract_salary'
    );
    const salaryRows = await db.all(salarySql, params);
    const salaries = salaryRows
      .map((r) => Number(r.contract_salary))
      .filter((s) => !Number.isNaN(s));
    const histogramPercentile = 0.999;
    const histogramCap = computePercentile(salaries, histogramPercentile);
    const chartSalaries = histogramCap != null
      ? salaries.filter((salary) => salary <= histogramCap)
      : salaries;
    const outlierCount = salaries.length - chartSalaries.length;
    const histogram = computeHistogram(chartSalaries, 15);
    let averageSalary = null;
    let medianSalary = null;

    if (salaries.length > 0) {
      const sum = salaries.reduce((acc, value) => acc + value, 0);
      averageSalary = sum / salaries.length;
      const sortedSalaries = [...salaries].sort((a, b) => a - b);
      const midpoint = Math.floor(sortedSalaries.length / 2);
      medianSalary = sortedSalaries.length % 2 !== 0
        ? sortedSalaries[midpoint]
        : (sortedSalaries[midpoint - 1] + sortedSalaries[midpoint]) / 2;
    }

    res.json({
      histogram,
      totalCount,
      histogramOutlierCount: outlierCount,
      histogramCap,
      histogramPercentile,
      averageSalary,
      medianSalary,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch salary finder chart data' });
  }
});

app.get('/api/salary-finder/table', async (req, res) => {
  try {
    const db = await dbPromise;
    const SALARY_FINDER_RENDER_LIMIT = 20000;
    const districtTypes = parseMulti(req.query.districtTypes);
    const schoolClassifications = expandSchoolClassificationFilters(parseMulti(req.query.schoolClassifications));
    const educatorCategories = parseMulti(req.query.educatorCategories);
    const educatorSubcategories = parseMulti(req.query.educatorSubcategories);
    const counties = parseMulti(req.query.counties);
    const districts = parseMulti(req.query.districts);
    const schools = parseMulti(req.query.schools);
    const schoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;
    const includePartTime = parseBooleanQueryParam(req.query.includePartTime);
    const minExperience = req.query.minExperience != null ? parseFloat(req.query.minExperience) : null;
    const maxExperience = req.query.maxExperience != null ? parseFloat(req.query.maxExperience) : null;
    const minEducationRank = req.query.minEducationRank != null ? parseInt(req.query.minEducationRank, 10) : null;
    const maxEducationRank = req.query.maxEducationRank != null ? parseInt(req.query.maxEducationRank, 10) : null;

    let sql = `SELECT file_folder_number,
                      ${NUMERIC_SQL.contractSalary} AS contract_salary,
                      ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
                      highest_education_level,
                      ${NUMERIC_SQL.highestEducationRank} AS highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name
               FROM web_salary_finder
               WHERE contract_salary IS NOT NULL AND ${NUMERIC_SQL.contractSalary} > 0`;
    const params = {};
    if (schoolYear) {
      sql += ' AND school_year = :schoolYear';
      params.schoolYear = schoolYear;
    }
    if (districtTypes.length > 0) {
      const { clause, params: inParams } = buildInClause('dt', districtTypes);
      sql += ` AND district_type_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schoolClassifications.length > 0) {
      const { clause, params: inParams } = buildInClause('sc', schoolClassifications);
      sql += ` AND school_classification_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (educatorCategories.length > 0) {
      const { clause, params: inParams } = buildInClause('ec', educatorCategories);
      sql += ` AND educator_type IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (educatorSubcategories.length > 0) {
      const { clause, params: inParams } = buildInClause('esub', educatorSubcategories);
      sql += ` AND educator_subtype IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (counties.length > 0) {
      const { clause, params: inParams } = buildInClause('cty', counties);
      sql += ` AND county_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (districts.length > 0) {
      const { clause, params: inParams } = buildInClause('dist', districts);
      sql += ` AND district_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    if (schools.length > 0) {
      const { clause, params: inParams } = buildInClause('sch', schools);
      sql += ` AND school_name IN ${clause}`;
      Object.assign(params, inParams);
    }
    sql = appendFullTimeOnlyClause(sql, params, includePartTime);
    if (minExperience != null) {
      sql += ` AND ${NUMERIC_SQL.yearsOfExperience} >= :minExp`;
      params.minExp = minExperience;
    }
    if (maxExperience != null) {
      sql += ` AND ${NUMERIC_SQL.yearsOfExperience} <= :maxExp`;
      params.maxExp = maxExperience;
    }
    if (minEducationRank != null) {
      sql += ` AND ${NUMERIC_SQL.highestEducationRank} >= :minEduRank`;
      params.minEduRank = minEducationRank;
    }
    if (maxEducationRank != null) {
      sql += ` AND ${NUMERIC_SQL.highestEducationRank} <= :maxEduRank`;
      params.maxEduRank = maxEducationRank;
    }
    const countSql = sql.replace(
      `SELECT file_folder_number, contract_salary, years_of_experience,
                      highest_education_level, highest_education_level_rank,
                      educator_type, educator_subtype,
                      county_name, district_name, school_name`,
      'SELECT COUNT(*) AS count'
    );
    const totalCount = (await db.get(countSql, params)).count;

    if (totalCount > SALARY_FINDER_RENDER_LIMIT) {
      res.json({
        results: [],
        tooManyTableResults: true,
        totalCount,
        renderLimit: SALARY_FINDER_RENDER_LIMIT,
      });
      return;
    }

    const rows = await db.all(sql, params);
    res.json({
      results: rows,
      tooManyTableResults: false,
      totalCount,
      renderLimit: SALARY_FINDER_RENDER_LIMIT,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch salary finder table data' });
  }
});

/*
 * Endpoint: GET /api/salary-finder/matching-filters
 * Looks up a single educator by file folder number and returns the filter
 * values that should be applied on the Salary Finder page.
 */
app.get('/api/salary-finder/matching-filters', async (req, res) => {
  try {
    const db = await dbPromise;
    const fileFolderNumber = req.query.fileFolderNumber != null
      ? parseInt(String(req.query.fileFolderNumber), 10)
      : null;
    const requestedSchoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;

    if (fileFolderNumber == null || Number.isNaN(fileFolderNumber)) {
      res.status(400).json({ error: 'A valid fileFolderNumber is required' });
      return;
    }

    const yearContext = await getSchoolYearContext('web_salary_finder', requestedSchoolYear);
    const educator = await db.get(
      `SELECT file_folder_number, school_year, district_type_name, educator_type, educator_subtype,
              full_time_part_time,
              highest_education_level,
              ${NUMERIC_SQL.yearsOfExperience} AS years_of_experience,
              ${NUMERIC_SQL.highestEducationRank} AS highest_education_level_rank,
              ${NUMERIC_SQL.contractSalary} AS contract_salary
       FROM web_salary_finder
       WHERE file_folder_number = :fileFolderNumber
         AND ${yearContext.scopeClause}
       LIMIT 1`
    , { fileFolderNumber, ...yearContext.scopeParams });

    if (!educator) {
      res.status(404).json({ error: 'No educator found for that file folder number' });
      return;
    }

    const rangeBounds = await db.get(
      `SELECT MIN(${NUMERIC_SQL.yearsOfExperience}) AS minExperience,
              MAX(${NUMERIC_SQL.yearsOfExperience}) AS maxExperience
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND years_of_experience IS NOT NULL`
    , yearContext.scopeParams);

    const educationLabels = await db.all(
      `SELECT DISTINCT ${NUMERIC_SQL.highestEducationRank} AS rank, highest_education_level AS label
       FROM web_salary_finder
       WHERE ${yearContext.scopeClause}
         AND highest_education_level_rank IS NOT NULL
         AND highest_education_level IS NOT NULL
         AND highest_education_level != ''
       ORDER BY rank`
    , yearContext.scopeParams);

    const educationLabelByRank = new Map(
      educationLabels.map((item) => [Number(item.rank), item.label])
    );

    const experienceValue = educator.years_of_experience != null ? Number(educator.years_of_experience) : null;
    const minExperienceBound = rangeBounds.minExperience != null ? Number(rangeBounds.minExperience) : null;
    const maxExperienceBound = rangeBounds.maxExperience != null ? Number(rangeBounds.maxExperience) : null;
    const educationBand = getEducationBand(
      educator.highest_education_level_rank,
      educator.highest_education_level,
      educationLabels,
    );
    const experienceBand = getExperienceBand(experienceValue, minExperienceBound, maxExperienceBound);

    const districtTypes = ['Independent School District', 'Special School District'].includes(educator.district_type_name)
      ? ['Independent School District', 'Special School District']
      : (educator.district_type_name ? [educator.district_type_name] : []);

    const matchingFilters = {
      districtTypes,
      schoolClassifications: [],
      educatorCategories: educator.educator_type ? [educator.educator_type] : [],
      educatorSubcategories: educator.educator_subtype ? [educator.educator_subtype] : [],
      includePartTime: educator.full_time_part_time === 'Part-time',
      counties: [],
      districts: [],
      schools: [],
      minExperience: experienceBand.minExperience,
      maxExperience: experienceBand.maxExperience,
      minEducationRank: educationBand.minRank,
      maxEducationRank: educationBand.maxRank,
      minEducationLabel: educationLabelByRank.get(educationBand.minRank) || null,
      maxEducationLabel: educationLabelByRank.get(educationBand.maxRank) || null,
    };

    res.json({
      selectedSchoolYear: yearContext.selectedSchoolYear,
      educator,
      matchingFilters,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to compute matching salary finder filters' });
  }
});

app.get('/api/educator/:fileFolderNumber', async (req, res) => {
  try {
    const educatorProfilesDb = await educatorProfilesDbPromise;
    const fileFolderNumber = parseInt(String(req.params.fileFolderNumber), 10);
    const requestedSchoolYear = req.query.schoolYear ? String(req.query.schoolYear) : null;

    if (Number.isNaN(fileFolderNumber)) {
      res.status(400).json({ error: 'A valid file folder number is required' });
      return;
    }

    const yearContext = await getProfileSchoolYearContext(fileFolderNumber, requestedSchoolYear);
    if (!yearContext.selectedSchoolYear) {
      res.status(404).json({ error: 'No educator records found for that file folder number' });
      return;
    }

    const queryParams = {
      fileFolderNumber,
      schoolYear: yearContext.selectedSchoolYear,
    };

    const employments = await educatorProfilesDb.all(
      `SELECT *
       FROM profile_employments
       WHERE \`File Folder Number\` = :fileFolderNumber
         AND \`School Year\` = :schoolYear
       ORDER BY \`District Number\`, CAST(\`Contract Salary\` AS DECIMAL(12,2)) DESC, \`Contract Days\` DESC`
    , queryParams);

    const assignments = await educatorProfilesDb.all(
      `SELECT *
       FROM profile_assignments
       WHERE \`File Folder Number\` = :fileFolderNumber
         AND \`School Year\` = :schoolYear
       ORDER BY \`District Number\`, \`School Number\`, \`Assignment Code\`, \`Cert Code\``
    , queryParams);

    const licenses = await educatorProfilesDb.all(
      `SELECT *
       FROM profile_licenses
       WHERE \`File Folder Number\` = :fileFolderNumber
         AND \`School Year\` = :schoolYear
       ORDER BY \`Licensure Area Code\`, \`Assignment Code\`, \`License Type\``
    , queryParams);

    res.json({
      fileFolderNumber,
      schoolYears: yearContext.schoolYears,
      defaultSchoolYear: yearContext.defaultSchoolYear,
      selectedSchoolYear: yearContext.selectedSchoolYear,
      employments,
      assignments,
      licenses,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load educator profile' });
  }
});

if (fs.existsSync(FRONTEND_DIST_PATH)) {
  app.use(express.static(FRONTEND_DIST_PATH));

  // Serve the SPA shell for non-API routes so the React router can handle
  // direct visits and refreshes when the frontend is bundled locally.
  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST_PATH, 'index.html'));
  });
}

// Start the server
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
