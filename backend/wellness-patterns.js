const round = (value, digits = 1) => Number(value.toFixed(digits));
const confidence = count => count >= 21 ? 'high' : count >= 14 ? 'moderate' : 'low';
const dates = items => items.map(item => item.date).sort();

export function trend(metric, items) {
  const values = items.filter(item => Number.isFinite(Number(item.value))).slice(-14);
  if (values.length < 7) return { metric, available: false, sampleSize: values.length, limitation: 'At least 7 reliable daily values are required.' };
  const recent = values.slice(-7), prior = values.slice(-14, -7);
  const recentAverage = recent.reduce((sum, item) => sum + Number(item.value), 0) / recent.length;
  const priorAverage = prior.length ? prior.reduce((sum, item) => sum + Number(item.value), 0) / prior.length : recentAverage;
  const change = priorAverage ? (recentAverage - priorAverage) / Math.abs(priorAverage) * 100 : 0;
  return { metric, available: true, direction: Math.abs(change) < 5 ? 'steady' : change > 0 ? 'increasing' : 'decreasing', changePercent: round(change), recentAverage: round(recentAverage), sampleSize: values.length, confidence: confidence(values.length), startDate: dates(values)[0], endDate: dates(values).at(-1), limitation: prior.length < 7 ? 'Direction uses limited comparison history.' : null };
}

export function relationship(leftKey, rightKey, left, right) {
  const rightByDate = new Map(right.filter(item => Number.isFinite(Number(item.value))).map(item => [item.date, Number(item.value)]));
  const pairs = left.filter(item => Number.isFinite(Number(item.value)) && rightByDate.has(item.date)).map(item => [Number(item.value), rightByDate.get(item.date)]).slice(-30);
  if (pairs.length < 7) return { leftKey, rightKey, available: false, sampleSize: pairs.length, limitation: 'At least 7 overlapping reliable days are required.' };
  const mean = index => pairs.reduce((sum, pair) => sum + pair[index], 0) / pairs.length;
  const mx = mean(0), my = mean(1), numerator = pairs.reduce((sum, pair) => sum + (pair[0] - mx) * (pair[1] - my), 0);
  const denominator = Math.sqrt(pairs.reduce((sum, pair) => sum + (pair[0] - mx) ** 2, 0) * pairs.reduce((sum, pair) => sum + (pair[1] - my) ** 2, 0));
  const coefficient = denominator ? numerator / denominator : 0, strength = Math.abs(coefficient) >= .7 ? 'strong' : Math.abs(coefficient) >= .4 ? 'moderate' : 'weak';
  return { leftKey, rightKey, available: true, coefficient: round(coefficient, 2), direction: coefficient > .1 ? 'move together' : coefficient < -.1 ? 'move in opposite directions' : 'show little linear relationship', strength, sampleSize: pairs.length, confidence: confidence(pairs.length), startDate: dates(left.filter(item => rightByDate.has(item.date)))[0], endDate: dates(left.filter(item => rightByDate.has(item.date))).at(-1), limitation: 'Association does not prove cause.' };
}

export function temporalPattern(items = []) {
  const dates = items.map(item => item?.date).filter(Boolean).sort();
  if (dates.length < 3) return { available: false, sampleSize: dates.length, limitation: 'At least 3 dated records are required.' };
  const gaps = dates.slice(1).map((date, index) => Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${dates[index]}T00:00:00Z`)) / 86400000));
  return { available: true, sampleSize: dates.length, startDate: dates[0], endDate: dates.at(-1), averageGapDays: round(gaps.reduce((sum, value) => sum + value, 0) / gaps.length), persistenceDays: Math.max(...gaps), limitation: 'Timing does not establish cause.' };
}

const unavailable = (type, limitation) => ({ type, available: false, limitation });
export function symptomSensorDiscrepancy(symptoms = [], baselines = []) {
  const symptomDates = new Set(symptoms.filter(item => item.symptoms?.length).map(item => item.date));
  const sensor = baselines.filter(item => item.current && item.confidence === 'established');
  if (!sensor.length || !symptomDates.size) return unavailable('symptom-sensor-discrepancy', 'Symptoms and established sensor baselines are needed.');
  const mismatches = sensor.filter(item => symptomDates.has(item.current.date) && item.status === 'within');
  return { type: 'symptom-sensor-discrepancy', available: true, symptomDays: symptomDates.size, mismatchDays: mismatches.length, measures: mismatches.map(item => item.key), limitation: 'A mismatch does not invalidate either record.' };
}

export function recoveryCurve(activity = [], baselines = []) {
  const normal = baselines.find(item => item.key === 'activityLoadIndex' && item.average != null);
  const values = activity.filter(item => Number.isFinite(Number(item.value))).slice(-14);
  if (!normal || values.length < 7) return unavailable('recovery-curve', 'An established activity baseline and 7 activity days are required.');
  return { type: 'recovery-curve', available: true, baseline: normal.average, daysWithinRange: values.filter(item => Number(item.value) <= normal.high).length, sampleSize: values.length, limitation: 'Inferred from daily activity load, not clinical recovery.' };
}

export function sleepActivityInteraction(sleep = [], activity = []) {
  const activityByDate = new Map(activity.map(item => [item.date, Number(item.value)]));
  const pairs = sleep.map(item => ({ date: item.date, sleep: Number(item.value), activity: activityByDate.get(item.date) })).filter(item => Number.isFinite(item.sleep) && Number.isFinite(item.activity));
  if (pairs.length < 7) return unavailable('sleep-activity-interaction', 'At least 7 overlapping sleep and activity days are required.');
  const result = relationship('sleepWellness', 'activityLoadIndex', pairs.map(item => ({ date: item.date, value: item.sleep })), pairs.map(item => ({ date: item.date, value: item.activity })));
  return { type: 'sleep-activity-interaction', ...result, explanation: 'Compares sleep wellness with same-day recorded activity; it does not establish cause.' };
}

export function nutritionPhysiologyAssociation(meals = [], series = {}) {
  const calories = new Map(meals.filter(item => Number.isFinite(Number(item.value))).map(item => [item.date, Number(item.value)]));
  const associations = ['sleepWellness', 'activityLoadIndex', 'heartRate'].map(key => {
    const values = series[key] || [];
    return relationship('calories', key, [...calories].map(([date, value]) => ({ date, value })), values);
  }).filter(item => item.available);
  if (!associations.length) return unavailable('nutrition-physiology-association', 'At least 7 overlapping nutrition and physiology days are required.');
  return { type: 'nutrition-physiology-association', available: true, associations, sampleSize: Math.max(...associations.map(item => item.sampleSize)), limitation: 'Recorded calories and physiology may be incomplete; association does not prove cause.' };
}

export function cyclePhaseSignature(cycles = [], series = {}) {
  if (cycles.length < 3) return unavailable('cycle-phase-signature', 'At least 3 recorded cycles are required.');
  const lengths = cycles.slice(1).map((cycle, index) => Math.round((Date.parse(`${cycle.startDate}T00:00:00Z`) - Date.parse(`${cycles[index].startDate}T00:00:00Z`)) / 86400000)).filter(value => value >= 15 && value <= 60);
  if (lengths.length < 2) return unavailable('cycle-phase-signature', 'At least 3 valid cycle starts are required.');
  const cycleLength = Math.round(lengths.reduce((sum, value) => sum + value, 0) / lengths.length), phases = { period: [], follicular: [], ovulation: [], luteal: [] };
  for (const [key, values] of Object.entries(series)) for (const item of values) {
    const cycle = cycles.slice().reverse().find(entry => entry.startDate <= item.date);
    if (!cycle || !Number.isFinite(Number(item.value))) continue;
    const day = Math.floor((Date.parse(`${item.date}T00:00:00Z`) - Date.parse(`${cycle.startDate}T00:00:00Z`)) / 86400000) + 1;
    const phase = day <= 5 ? 'period' : day <= Math.max(6, cycleLength - 16) ? 'follicular' : day <= cycleLength - 12 ? 'ovulation' : 'luteal';
    phases[phase].push({ key, value: Number(item.value) });
  }
  const summary = Object.fromEntries(Object.entries(phases).map(([phase, values]) => [phase, { sampleSize: values.length, averages: Object.fromEntries([...new Set(values.map(item => item.key))].map(key => [key, round(values.filter(item => item.key === key).reduce((sum, item) => sum + item.value, 0) / values.filter(item => item.key === key).length)])) }]));
  return { type: 'cycle-phase-signature', available: true, cycleLength, phases: summary, confidence: confidence(lengths.length + 1), limitation: 'Phase assignment is estimated from recorded cycle starts; it is not medical prediction.' };
}

export function digitalTwinSummary(baselines = []) {
  const available = baselines.filter(item => item.current && item.average != null);
  if (!available.length) return unavailable('digital-twin', 'Reliable current values and personal baselines are required.');
  return { type: 'digital-twin', available: true, currentVsNormal: available.map(item => ({ key: item.key, label: item.label, current: item.current.value, normal: item.average, status: item.status, unit: item.unit })), sampleSize: available.length, limitation: 'Personal comparison only; not a medical reference.' };
}

export function buildPatterns({ baselines = [], series = {}, symptoms = [], quality = {} }) {
  const established = baselines.filter(item => item.confidence === 'established' && ['above', 'below'].includes(item.status));
  const insights = established.map(item => ({ id: `deviation-${item.key}`, type: 'deviation', title: `${item.label} is ${item.status} your usual range`, summary: `Current ${item.label.toLowerCase()} is ${item.current.value}${item.unit}; your recent personal range is ${item.low}–${item.high}${item.unit}.`, confidence: 'moderate', dateRange: { start: item.current.date, end: item.current.date }, inputs: [item.key], why: `Compared the current reliable daily value with ${item.reliableDays} prior reliable days.`, limitation: 'Personal ranges are informational and are not medical reference ranges.' }));
  if (established.length >= 2) insights.unshift({ id: 'multi-signal-deviation', type: 'multi-parameter', title: 'Several signals differ from your usual pattern', summary: `${established.slice(0, 3).map(item => item.label).join(', ')} are outside their recent personal ranges.`, confidence: established.length >= 3 ? 'high' : 'moderate', dateRange: { start: established[0].current.date, end: established[0].current.date }, inputs: established.map(item => item.key), why: 'Two or more quality-gated daily measurements changed on the same current day.', limitation: 'This combination does not identify a cause or medical condition.' });
  const symptomCounts = new Map();
  for (const item of symptoms) for (const name of item.symptoms || []) symptomCounts.set(name, (symptomCounts.get(name) || 0) + 1);
  for (const [name, count] of symptomCounts) if (count >= 3) insights.push({ id: `recurrence-${name}`, type: 'recurrence', title: `${name.replaceAll('-', ' ')} was logged repeatedly`, summary: `Recorded in ${count} check-ins during this analysis period.`, confidence: confidence(count + 6), dateRange: { start: symptoms[0]?.date, end: symptoms.at(-1)?.date }, inputs: ['checkins'], why: 'The same structured symptom appeared in at least three saved check-ins.', limitation: 'Frequency alone does not establish severity or cause.' });
  const trends = Object.entries(series).map(([key, values]) => trend(key, values));
  const relationships = [
    relationship('sleepWellness', 'activityLoadIndex', series.sleepWellness || [], series.activityLoadIndex || []),
    relationship('hydration', 'wellness', series.hydration || [], series.wellness || []),
    relationship('calories', 'sleepWellness', series.calories || [], series.sleepWellness || []),
    relationship('activityLoadIndex', 'heartRate', series.activityLoadIndex || [], series.heartRate || [])
  ];
  const temporal = temporalPattern(symptoms.filter(item => (item.symptoms || []).length));
  return { generatedAt: new Date().toISOString(), algorithmVersion: 'patterns-1.2', insights, trends, relationships, temporal, quality, disclaimer: 'Informational pattern analysis only — not a diagnosis. Associations do not prove cause.' };
}
