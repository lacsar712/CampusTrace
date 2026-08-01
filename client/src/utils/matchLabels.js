export const reasonToLabel = (reason) => {
  if (reason === 'category') return 'Category match';
  if (reason === 'location:exact') return 'Exact location match';
  if (reason === 'location') return 'Partial location match';
  if (typeof reason === 'string' && reason.startsWith('dateGap:')) {
    const n = reason.split(':')[1];
    return `${n} day${n === '1' ? '' : 's'} apart`;
  }
  return reason;
};

export const reasonLabels = (reasons) =>
  Array.isArray(reasons) ? reasons.map(reasonToLabel) : [];
