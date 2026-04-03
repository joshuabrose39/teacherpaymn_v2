export const SCHOOL_CLASSIFICATION_PRIORITY = [
  'Elementary School',
  'Middle / Junior High School',
  'Senior High School',
  'Combined Elementary/Secondary School',
  'Special Education School or Program',
];

export function orderSchoolClassificationOptions(options = []) {
  const uniqueOptions = [...new Set(options)];
  const priorityOptions = SCHOOL_CLASSIFICATION_PRIORITY.filter((option) => uniqueOptions.includes(option));
  const remainingOptions = uniqueOptions
    .filter((option) => !priorityOptions.includes(option))
    .sort((a, b) => a.localeCompare(b));

  if (priorityOptions.length === 0 || remainingOptions.length === 0) {
    return [...priorityOptions, ...remainingOptions];
  }

  return [
    ...priorityOptions,
    { type: 'divider', id: 'school-classification-divider', label: 'More classifications' },
    ...remainingOptions,
  ];
}
