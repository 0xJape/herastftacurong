const scale = value => (value - 1) / 4;
const inverseScale = value => (5 - value) / 4;

export function calculateSleepWellness(record) {
  const factors = [
    ['sleepQuality', record.sleepQuality, scale],
    ['morningRestedness', record.morningRestedness, scale],
    ['sleepOnsetDifficulty', record.sleepOnsetDifficulty, inverseScale],
    ['nighttimeAwakenings', record.nighttimeAwakenings, value => (5 - Math.min(value, 5)) / 5],
    ['sleepDisturbances', record.sleepDisturbances, inverseScale],
    ['morningSleepiness', record.morningSleepiness, inverseScale],
    ['scheduleConsistency', record.scheduleConsistency, scale]
  ];
  const available = factors.filter(([, value]) => Number.isInteger(value));
  if (available.length < 5) return { score: null, completeness: available.length, required: 5, factors: {} };
  const scored = Object.fromEntries(available.map(([name, value, normalize]) => [name, Math.round(normalize(value) * 100)]));
  return {
    score: Math.round(Object.values(scored).reduce((sum, value) => sum + value, 0) / available.length),
    completeness: available.length,
    required: 5,
    factors: scored
  };
}
