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
  return { generatedAt: new Date().toISOString(), algorithmVersion: 'patterns-1.0', insights, trends, relationships, quality, disclaimer: 'Informational pattern analysis only — not a diagnosis. Associations do not prove cause.' };
}
