import assert from 'node:assert/strict';
import { normalizeWearableReading } from './wearable-quality.js';

const valid = {
  deviceId: ' HERA-001 ', wearing: true, heartRate: 72, heartRateValid: true,
  spo2: 98, activity: 'walking', movementLevel: 125.5, uptimeMs: 5000
};
const normalized = normalizeWearableReading(valid, '2026-09-30T12:00:00.000Z');
assert.equal(normalized.reading.deviceId, 'HERA-001');
assert.equal(normalized.reading.activity, 'WALKING');
assert.equal(normalized.reading.qualityValid, true);
assert.equal(normalized.reading.source, 'wearable');

const noisy = normalizeWearableReading({ ...valid, heartRate: 230, spo2: 65 });
assert.equal(noisy.reading.heartRateValid, false);
assert.equal(noisy.reading.spo2, 0);
assert.deepEqual(noisy.reading.qualityIssues, ['heart-rate-invalid', 'spo2-invalid']);
assert.match(normalizeWearableReading({ ...valid, spo2: 101 }).error, /spo2/);
assert.match(normalizeWearableReading({ ...valid, activity: 'FLYING' }).error, /activity/);

console.log('Wearable quality checks passed');
