import assert from 'node:assert/strict';
import { addActivityBaseline, aggregateActivity } from './activity-analytics.js';

const reading = (date, activity, wearing = true) => ({ receivedAt: date, activity, wearing });
const result = aggregateActivity([
  reading('2026-09-30T10:00:00.000Z', 'RESTING'),
  reading('2026-09-30T10:00:10.000Z', 'WALKING'),
  reading('2026-09-30T10:00:30.000Z', 'VIGOROUS'),
  reading('2026-09-30T10:01:30.000Z', 'RESTING')
]);
assert.deepEqual(result, [{
  date: '2026-09-30',
  durationsMinutes: { resting: 0.2, light: 0, walking: 0.3, active: 0, vigorous: 0.5 },
  wornMinutes: 1,
  activityLoadIndex: 67
}]);

const baseline = addActivityBaseline([
  { activityLoadIndex: 10, wornMinutes: 20 },
  { activityLoadIndex: 10, wornMinutes: 20 },
  { activityLoadIndex: 10, wornMinutes: 20 },
  { activityLoadIndex: 50, wornMinutes: 20 },
  { activityLoadIndex: 50, wornMinutes: 20 },
  { activityLoadIndex: 50, wornMinutes: 20 },
  { activityLoadIndex: 60, wornMinutes: 20 }
]);
assert.equal(baseline.at(-1).baseline, 30);
assert.equal(baseline.at(-1).baselineStatus, 'above');
assert.equal(baseline.at(-1).activityBalance, 'high-load-streak');

const recovery = addActivityBaseline([
  { activityLoadIndex: 10, wornMinutes: 20 },
  { activityLoadIndex: 10, wornMinutes: 20 },
  { activityLoadIndex: 10, wornMinutes: 20 },
  { activityLoadIndex: 50, wornMinutes: 20 },
  { activityLoadIndex: 50, wornMinutes: 20 },
  { activityLoadIndex: 50, wornMinutes: 20 },
  { activityLoadIndex: 10, wornMinutes: 20 }
]);
assert.equal(recovery.at(-1).activityBalance, 'recovery-day');
assert.equal(recovery.at(-1).restDay, true);
console.log('Activity analytics checks passed');
