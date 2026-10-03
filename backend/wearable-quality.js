const ACTIVITIES = new Set(['RESTING', 'LIGHT', 'WALKING', 'ACTIVE', 'VIGOROUS']);

export function normalizeWearableReading(body, receivedAt = new Date().toISOString()) {
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const activity = typeof body.activity === 'string' ? body.activity.trim().toUpperCase() : '';
  if (!deviceId) return { error: 'deviceId is required' };
  if (typeof body.wearing !== 'boolean' || typeof body.heartRateValid !== 'boolean') return { error: 'wearing and heartRateValid must be boolean' };
  if (![body.heartRate, body.spo2, body.movementLevel, body.uptimeMs].every(Number.isFinite)) return { error: 'numeric reading fields are required' };
  if (body.heartRate < 0 || body.heartRate > 300) return { error: 'heartRate must be from 0 to 300 bpm' };
  if (body.spo2 < 0 || body.spo2 > 100) return { error: 'spo2 must be from 0 to 100 percent' };
  if (body.movementLevel < 0 || body.movementLevel > 100000) return { error: 'movementLevel must be from 0 to 100000' };
  if (!Number.isSafeInteger(body.uptimeMs) || body.uptimeMs < 0) return { error: 'uptimeMs must be a non-negative safe integer' };
  if (!ACTIVITIES.has(activity)) return { error: 'activity must be RESTING, LIGHT, WALKING, ACTIVE, or VIGOROUS' };

  const issues = [];
  if (!body.wearing) issues.push('not-worn');
  if (body.wearing && (!body.heartRateValid || body.heartRate < 40 || body.heartRate > 220)) issues.push('heart-rate-invalid');
  if (body.wearing && body.spo2 !== 0 && (body.spo2 < 70 || body.spo2 > 100)) issues.push('spo2-invalid');

  return {
    reading: {
      deviceId,
      wearing: body.wearing,
      heartRate: body.heartRate,
      heartRateValid: body.wearing && body.heartRateValid && body.heartRate >= 40 && body.heartRate <= 220,
      spo2: body.wearing && body.spo2 >= 70 ? body.spo2 : 0,
      activity,
      movementLevel: body.movementLevel,
      uptimeMs: body.uptimeMs,
      receivedAt,
      source: 'wearable',
      qualityValid: issues.length === 0,
      qualityIssues: issues
    }
  };
}
