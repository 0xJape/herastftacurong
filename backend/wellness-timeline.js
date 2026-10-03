const number = value => Number.isFinite(Number(value)) ? Number(value) : null;
const event = (domain, id, date, title, summary, metrics = {}, timestamp = null, quality = null) => ({
  id: `${domain}-${id}`, domain, date, timestamp, precision: timestamp ? 'instant' : 'day', title, summary, metrics, quality
});

export function buildWellnessTimeline(data, sinceDate) {
  const events = [];
  for (const item of data.checkins || []) {
    const symptoms = Array.isArray(item.symptoms) ? item.symptoms : [];
    events.push(event('checkin', item.id, item.date, 'Daily check-in', symptoms.length ? `Symptoms: ${symptoms.join(', ').replaceAll('-', ' ')}` : 'Mood and wellness check-in saved.', { mood: item.mood, stress: item.stress, energy: item.energy, sleep: item.sleep, hydration: item.hydration }));
  }
  for (const item of data.cycles || []) events.push(event('cycle', item.id, item.startDate, 'Cycle started', item.endDate ? `Recorded through ${item.endDate}.` : 'Start date recorded.', { endDate: item.endDate }));
  for (const item of data.sleep || []) events.push(event('sleep', item.id, item.date, 'Sleep log', item.sws?.score == null ? 'Self-reported sleep saved.' : `Sleep Wellness Score ${item.sws.score}/100.`, { sleepQuality: item.sleepQuality, restedness: item.morningRestedness, sws: item.sws?.score ?? null }));
  for (const item of data.meals || []) events.push(event('nutrition', item.id, item.eatenAt.slice(0, 10), item.foodName, `${item.mealType} · ${item.portionAmount ?? '—'} ${item.portionUnit || ''}`.trim(), { calories: number(item.calories), proteinG: number(item.proteinG), carbsG: number(item.carbsG), fatG: number(item.fatG) }, item.eatenAt));
  for (const item of data.water || []) events.push(event('hydration', item.date, item.date, 'Hydration total', `${item.milliliters} mL recorded.`, { milliliters: item.milliliters }));
  for (const item of data.wearable || []) events.push(event('wearable', item.date, item.date, 'Wearable daily summary', `${item.wornReadings} worn reading${item.wornReadings === 1 ? '' : 's'}.`, { heartRate: number(item.heartRate), spo2: number(item.spo2), movementLevel: number(item.movementLevel), wornReadings: item.wornReadings }, null, item.wornReadings > 0 ? 'observed' : 'limited'));
  for (const item of data.activity || []) events.push(event('activity', item.date, item.date, 'Activity load', `ALI ${item.activityLoadIndex}/100 · ${item.activityBalance.replaceAll('-', ' ')}.`, { activityLoadIndex: item.activityLoadIndex, durationsMinutes: item.durationsMinutes, baseline: item.baseline }));
  for (const item of data.goals || []) events.push(event('goal', item.id, item.startDate, 'Goal started', `${item.title}: ${item.direction === 'at-most' ? 'at most' : 'at least'} ${item.targetValue} ${item.unit}.`, { status: item.status, metric: item.metric }));
  for (const item of data.interventions || []) {
    events.push(event('intervention', item.id, item.startDate, 'Wellness change started', `${item.title} · tracking ${item.metrics.join(', ')}.`, { status: item.status, endDate: item.endDate }));
    for (const feedback of item.feedback || []) events.push(event('intervention-feedback', `${item.id}-${feedback.id}`, feedback.date, 'Wellness change feedback', `${item.title}: ${feedback.outcome}.`, { interventionId: item.id, outcome: feedback.outcome }));
    if (item.outcome) events.push(event('outcome', item.id, item.outcome.afterWindow.end, 'Before/after result', item.outcome.status === 'available' ? `${item.title}: comparison available. Association does not prove causation.` : `${item.title}: ${item.outcome.status.replaceAll('-', ' ')}; no complete outcome reported.`, { status: item.outcome.status, metricsCompared: item.outcome.metrics.filter(metric => metric.status === 'available').length }, null, item.outcome.status === 'available' ? 'observed' : 'limited'));
  }
  for (const item of data.approvedSummaries || []) events.push(event('health-summary', item.id, item.approvedAt.slice(0, 10), 'Health summary approved', `Version ${item.versionNumber} approved for ${item.startDate} to ${item.endDate}.`, { versionNumber: item.versionNumber, draftId: item.draftId }, item.approvedAt));
  const assessment = data.assessment;
  if (assessment?.createdAt?.slice(0, 10) >= sinceDate) events.push(event('insight', 'sleep-assessment', assessment.createdAt.slice(0, 10), 'Sleep insight', assessment.summary, { confidence: assessment.confidence, recordsReviewed: assessment.recordsReviewed }, assessment.createdAt, assessment.confidence));
  return events.filter(item => item.date >= sinceDate).sort((a, b) => (b.timestamp || `${b.date}T00:00:00.000Z`).localeCompare(a.timestamp || `${a.date}T00:00:00.000Z`) || a.domain.localeCompare(b.domain));
}
