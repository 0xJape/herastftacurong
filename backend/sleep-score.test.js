import assert from 'node:assert/strict';
import { calculateSleepWellness } from './sleep-score.js';

const best = calculateSleepWellness({ sleepQuality: 5, morningRestedness: 5, sleepOnsetDifficulty: 1, nighttimeAwakenings: 0, sleepDisturbances: 1, morningSleepiness: 1, scheduleConsistency: 5 });
const worst = calculateSleepWellness({ sleepQuality: 1, morningRestedness: 1, sleepOnsetDifficulty: 5, nighttimeAwakenings: 5, sleepDisturbances: 5, morningSleepiness: 5, scheduleConsistency: 1 });
assert.equal(best.score, 100);
assert.equal(worst.score, 0);
assert.equal(calculateSleepWellness({ sleepQuality: 5 }).score, null);
console.log('sleep-score checks passed');
