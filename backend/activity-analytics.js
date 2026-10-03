const LEVELS = ['RESTING', 'LIGHT', 'WALKING', 'ACTIVE', 'VIGOROUS'];
const WEIGHTS = { RESTING: 0, LIGHT: 1, WALKING: 2, ACTIVE: 3, VIGOROUS: 4 };

export function aggregateActivity(readings, maxIntervalSeconds = 30) {
  const days = new Map();
  for (let index = 0; index < readings.length - 1; index++) {
    const reading = readings[index], next = readings[index + 1];
    if (!reading.wearing || !LEVELS.includes(reading.activity)) continue;
    const start = Date.parse(reading.receivedAt), end = Date.parse(next.receivedAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const seconds = Math.min((end - start) / 1000, maxIntervalSeconds);
    const date = reading.receivedAt.slice(0, 10);
    const day = days.get(date) || { date, seconds: Object.fromEntries(LEVELS.map(level => [level, 0])) };
    day.seconds[reading.activity] += seconds;
    days.set(date, day);
  }
  return [...days.values()].map(day => {
    const wornSeconds = Object.values(day.seconds).reduce((sum, seconds) => sum + seconds, 0);
    const load = LEVELS.reduce((sum, level) => sum + day.seconds[level] * WEIGHTS[level], 0);
    return {
      date: day.date,
      durationsMinutes: Object.fromEntries(LEVELS.map(level => [level.toLowerCase(), Math.round(day.seconds[level] / 6) / 10])),
      wornMinutes: Math.round(wornSeconds / 6) / 10,
      activityLoadIndex: wornSeconds ? Math.round(load / wornSeconds / 4 * 100) : 0
    };
  });
}

export function addActivityBaseline(days) {
  return days.map((day, index) => {
    const prior = days.slice(Math.max(0, index - 14), index).filter(item => item.wornMinutes >= 10);
    if (prior.length < 3 || day.wornMinutes < 10) return { ...day, baseline: null, baselineStatus: 'building', activityBalance: 'unavailable', restDay: false };
    const baseline = Math.round(prior.reduce((sum, item) => sum + item.activityLoadIndex, 0) / prior.length);
    const difference = day.activityLoadIndex - baseline;
    const recent = prior.slice(-3);
    const recentAverage = Math.round(recent.reduce((sum, item) => sum + item.activityLoadIndex, 0) / recent.length);
    const highRecentLoad = recentAverage >= baseline + 10;
    const restDay = highRecentLoad && day.activityLoadIndex <= baseline - 10;
    const highLoadStreak = highRecentLoad && day.activityLoadIndex >= baseline + 10;
    return {
      ...day,
      baseline,
      baselineStatus: difference >= 10 ? 'above' : difference <= -10 ? 'below' : 'near',
      recentAverage,
      activityBalance: restDay ? 'recovery-day' : highLoadStreak ? 'high-load-streak' : 'balanced',
      restDay
    };
  });
}
