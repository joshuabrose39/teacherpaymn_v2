export const DISTRICT_TYPE_CATEGORY_OPTIONS = [
  'Traditional Public',
  'Charter',
  'Other',
];

export function getDistrictTypeCategory(districtType) {
  const value = String(districtType || '').trim();
  if (
    value === 'Independent School District' ||
    value === 'Independent Districts and Schools' ||
    value === 'Special School District' ||
    value === 'Special Districts and Schools'
  ) {
    return 'Traditional Public';
  }
  if (value === 'Charter Schools' || value === 'Charter School District') {
    return 'Charter';
  }
  return 'Other';
}

export function getDistrictTypesForCategories(allDistrictTypes, selectedCategories) {
  if (!selectedCategories || selectedCategories.length === 0) {
    return allDistrictTypes;
  }
  return allDistrictTypes.filter((districtType) => selectedCategories.includes(getDistrictTypeCategory(districtType)));
}

export function filterSelectedDistrictTypes(selectedDistrictTypes, selectedCategories) {
  if (!selectedCategories || selectedCategories.length === 0) {
    return selectedDistrictTypes;
  }
  return selectedDistrictTypes.filter((districtType) => selectedCategories.includes(getDistrictTypeCategory(districtType)));
}

export function resolveDistrictTypesForFilter(allDistrictTypes, selectedDistrictTypes, selectedCategories) {
  if (selectedDistrictTypes && selectedDistrictTypes.length > 0) {
    return filterSelectedDistrictTypes(selectedDistrictTypes, selectedCategories);
  }
  return getDistrictTypesForCategories(allDistrictTypes || [], selectedCategories || []);
}

export function getDistrictTypeCategoriesForSelection(selectedDistrictTypes) {
  return [...new Set((selectedDistrictTypes || []).map(getDistrictTypeCategory))];
}
