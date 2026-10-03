const round = value => Math.round(value * 10) / 10;

export function compareInterventionMetric(metric, before = [], after = [], minimumSamples = 3, expectedSamples = null) {
  const reliable = rows => [...new Map(rows.filter(row => row?.reliable !== false && /^\d{4}-\d{2}-\d{2}$/.test(row?.date) && Number.isFinite(Number(row?.value))).map(row => [row.date, { date: row.date, value: Number(row.value) }])).values()];
  const left = reliable(before), right = reliable(after), expected = Number.isInteger(expectedSamples) && expectedSamples > 0 ? expectedSamples : Math.max(left.length, right.length);
  const window = rows => ({ sampleCount: rows.length, coveragePercent: expected ? round(rows.length / expected * 100) : 0 });
  const base = { metric, minimumSamples, expectedSamples: expected, before: window(left), after: window(right), limitation: 'Observed association only; this comparison does not establish causation.' };
  if (!left.length || !right.length) return { ...base, status: 'missing-data', confidence: 'unavailable', absoluteChange: null, percentageChange: null, limitation: `Missing reliable ${!left.length && !right.length ? 'before and after' : !left.length ? 'before' : 'after'} data. No outcome calculated.` };
  if (left.length < minimumSamples || right.length < minimumSamples) return { ...base, status: 'insufficient-data', confidence: 'unavailable', absoluteChange: null, percentageChange: null, limitation: `At least ${minimumSamples} reliable samples are required in each window. No outcome calculated.` };
  const average = rows => round(rows.reduce((sum, row) => sum + row.value, 0) / rows.length);
  const beforeAverage = average(left), afterAverage = average(right), absoluteChange = round(afterAverage - beforeAverage);
  const balance = Math.min(left.length, right.length) / Math.max(left.length, right.length), coverage = Math.min(left.length, right.length) / expected;
  return { ...base, status: 'available', before: { ...window(left), average: beforeAverage }, after: { ...window(right), average: afterAverage }, absoluteChange, percentageChange: beforeAverage === 0 ? null : round(absoluteChange / Math.abs(beforeAverage) * 100), confidence: coverage >= .8 && balance >= .8 && left.length >= 7 ? 'high' : coverage >= .6 && balance >= .6 ? 'moderate' : 'limited', limitation: `${base.limitation}${balance < .8 ? ' Window coverage is uneven.' : ''}${coverage < .6 ? ' Available samples cover less than 60% of the comparison window.' : ''}` };
}

export function buildInterventionOutcome(intervention, seriesByMetric, minimumSamples = 3) {
  const metrics = intervention.metrics.map(metric => compareInterventionMetric(metric, seriesByMetric[metric]?.before, seriesByMetric[metric]?.after, minimumSamples, intervention.comparisonWindowDays));
  return { interventionId: intervention.id, status: metrics.every(item => item.status === 'available') ? 'available' : metrics.some(item => item.status === 'available') ? 'partial' : metrics.some(item => item.status === 'insufficient-data') ? 'insufficient-data' : 'missing-data', beforeWindow: intervention.beforeWindow, afterWindow: intervention.afterWindow, metrics, disclaimer: 'Before/after results show observed associations only and do not prove this change caused an outcome.' };
}
