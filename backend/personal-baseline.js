const METRICS = {
  heartRate: { label: 'Heart rate', unit: ' BPM', precision: 1 },
  spo2: { label: 'Blood oxygen', unit: '%', precision: 1 },
  movementLevel: { label: 'Movement', unit: '', precision: 2 },
  activityLoadIndex: { label: 'Activity load', unit: '/100', precision: 0 },
  wellness: { label: 'Wellness', unit: '%', precision: 0 },
  sleepWellness: { label: 'Sleep wellness', unit: '/100', precision: 0 },
  hydration: { label: 'Hydration', unit: ' mL', precision: 0 },
  nutritionCalories: { label: 'Recorded calories', unit: ' kcal', precision: 0 },
  symptomDays: { label: 'Symptom days', unit: ' days', precision: 0 }
};

const round = (value, precision) => Number(value.toFixed(precision));

export function buildPersonalBaselines(seriesByMetric, minimumDays = 14) {
  return Object.entries(METRICS).map(([key, metadata]) => {
    const values = (seriesByMetric[key] || [])
      .filter(item => item?.date && Number.isFinite(Number(item.value)) && item.reliable !== false)
      .map(item => ({ date: item.date, value: Number(item.value) }))
      .sort((a, b) => a.date.localeCompare(b.date));
    const current = values.at(-1) || null;
    const history = values.slice(0, -1).slice(-30);
    const progress = Math.min(history.length, minimumDays);
    const confidence = history.length >= minimumDays ? 'established' : history.length >= 7 ? 'limited' : 'learning';
    if (!current || !history.length) return { key, ...metadata, current, average: null, low: null, high: null, difference: null, status: 'learning', confidence, reliableDays: history.length, minimumDays, progress };
    const mean = history.reduce((sum, item) => sum + item.value, 0) / history.length;
    const variance = history.reduce((sum, item) => sum + (item.value - mean) ** 2, 0) / history.length;
    const deviation = Math.sqrt(variance);
    const tolerance = Math.max(deviation, Math.abs(mean) * 0.05, metadata.precision ? 0.1 : 1);
    const low = mean - tolerance, high = mean + tolerance;
    return {
      key, ...metadata, current,
      average: round(mean, metadata.precision),
      low: round(low, metadata.precision),
      high: round(high, metadata.precision),
      difference: round(current.value - mean, metadata.precision),
      status: confidence !== 'established' ? 'learning' : current.value < low ? 'below' : current.value > high ? 'above' : 'within',
      confidence, reliableDays: history.length, minimumDays, progress
    };
  });
}
