const expected = ['date', 'value'];

const issue = (type, count, examples = []) => ({ type, count, examples: examples.slice(0, 5) });

export function assessDataQuality({ checkins = [], wearable = [], sleep = [], water = [], meals = [] } = {}) {
  const report = [];
  const inspect = (name, items, dateKey = 'date') => {
    const missing = items.filter(item => !item?.[dateKey]);
    const dates = items.map(item => item?.[dateKey]).filter(Boolean);
    const duplicates = dates.filter((date, index) => dates.indexOf(date) !== index);
    if (missing.length) report.push(issue('missing-date', missing.length, [name]));
    if (duplicates.length) report.push(issue('duplicate-date', duplicates.length, [...new Set(duplicates)]));
  };
  inspect('checkins', checkins);
  inspect('wearable', wearable, 'date');
  inspect('sleep', sleep);
  inspect('water', water);
  inspect('meals', meals, 'eatenAt');
  const noisyWearable = wearable.filter(item => item?.qualityValid === false || (Array.isArray(item?.qualityIssues) && item.qualityIssues.length));
  if (noisyWearable.length) report.push(issue('noisy-wearable', noisyWearable.length, noisyWearable.flatMap(item => item.qualityIssues || [])));
  const invalidWater = water.filter(item => !Number.isFinite(Number(item.milliliters)) || item.milliliters < 0 || item.milliliters > 10000);
  if (invalidWater.length) report.push(issue('invalid-hydration', invalidWater.length));
  const invalidMeals = meals.filter(item => ['calories', 'proteinG', 'carbsG', 'fatG'].some(key => item[key] != null && (!Number.isFinite(Number(item[key])) || Number(item[key]) < 0)));
  if (invalidMeals.length) report.push(issue('invalid-nutrition', invalidMeals.length));
  const checked = checkins.length + wearable.length + sleep.length + water.length + meals.length;
  return { status: report.length ? 'review' : 'clear', checkedRecords: checked, issueCount: report.reduce((sum, item) => sum + item.count, 0), issues: report, limitation: 'Quality checks identify records for review; they do not determine medical validity.' };
}

export { expected };