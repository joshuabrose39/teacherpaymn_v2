import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { apiUrl } from '../utils/api';

function formatSchoolYearLabel(value) {
  if (!value) return '';
  const match = String(value).match(/^(\d{2})-(\d{2})$/);
  if (!match) return String(value);
  return `20${match[1]}-20${match[2]}`;
}

function formatFieldLabel(key) {
  if (String(key).includes(' ')) return String(key);
  const acronyms = new Set(['fte']);
  return String(key)
    .split('_')
    .map((part) => {
      const lower = part.toLowerCase();
      if (acronyms.has(lower)) return lower.toUpperCase();
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');
}

function formatFieldValue(value) {
  if (value === null || value === undefined || value === '') return '—';
  return String(value);
}

function RecordListSection({ title, rows }) {
  return (
    <div className="card page-shell">
      <div className="card-header">
        <div>
          <h2 className="card-title">{title}</h2>
          <div className="card-subtitle">
            {rows.length.toLocaleString()} record{rows.length === 1 ? '' : 's'}
          </div>
        </div>
      </div>
      <div className="card-body">
        {rows.length === 0 ? (
          <p>No records found.</p>
        ) : (
          <div className="vertical-grid">
            {rows.map((row, index) => (
              <div className="card" key={`${title}-${index}`}>
                <div className="card-body">
                  <div className="profile-field-list">
                    {Object.entries(row).map(([key, value]) => (
                      <div className="profile-field-row" key={key}>
                        <strong>{formatFieldLabel(key)}:</strong> {formatFieldValue(value)}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function EducatorProfile() {
  const { fileFolderNumber } = useParams();
  const [selectedSchoolYear, setSelectedSchoolYear] = useState('');
  const [profileData, setProfileData] = useState({
    fileFolderNumber: null,
    schoolYears: [],
    defaultSchoolYear: '',
    selectedSchoolYear: '',
    employments: [],
    assignments: [],
    licenses: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      setLoading(true);
      setError(null);
      try {
        const query = selectedSchoolYear
          ? `?${new URLSearchParams({ schoolYear: selectedSchoolYear }).toString()}`
          : '';
        const resp = await fetch(apiUrl(`/api/educator/${fileFolderNumber}${query}`));
        const json = await resp.json();
        if (!resp.ok) throw new Error(json.error || 'Failed to load educator profile');
        setProfileData(json);
        setSelectedSchoolYear(json.selectedSchoolYear || json.defaultSchoolYear || '');
      } catch (err) {
        setError(err.message);
      }
      setLoading(false);
    }

    fetchProfile();
  }, [fileFolderNumber, selectedSchoolYear]);

  const summaryFields = useMemo(() => [
    { label: 'School Year', value: formatSchoolYearLabel(profileData.selectedSchoolYear) || '—' },
    { label: 'File Folder Number', value: profileData.fileFolderNumber || fileFolderNumber || '—' },
  ], [fileFolderNumber, profileData.fileFolderNumber, profileData.selectedSchoolYear]);

  if (loading) return <p>Loading educator profile...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div className="card page-shell">
      <div className="card-body">
        <div className="page-header">
          <div className="page-title">
            <h2>Educator Profile</h2>
            <p>
              Employment, assignment, and license records extracted from{' '}
              <a
                href="https://mn.gov/pelsb/board/data/"
                target="_blank"
                rel="noopener noreferrer"
              >
                PELSB Data Reports
              </a>
              .
            </p>
          </div>
          <div className="toolbar">
            <div className="header-field header-field-inline">
              <label htmlFor="educator-profile-school-year">School Year:</label>
              <select
                id="educator-profile-school-year"
                className="select"
                value={selectedSchoolYear}
                onChange={(event) => setSelectedSchoolYear(event.target.value)}
              >
                {profileData.schoolYears.map((schoolYear) => (
                  <option key={schoolYear} value={schoolYear}>
                    {formatSchoolYearLabel(schoolYear)}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '18px' }}>
          <div className="card-body">
            <div className="profile-summary">
              {summaryFields.map((field) => (
                <div className="profile-summary-row" key={field.label}>
                  <strong>{field.label}:</strong>
                  <span>{field.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="vertical-grid">
          <RecordListSection title="Employments" rows={profileData.employments} />
          <RecordListSection title="Assignments" rows={profileData.assignments} />
          <RecordListSection title="Licenses" rows={profileData.licenses} />
        </div>
      </div>
    </div>
  );
}
