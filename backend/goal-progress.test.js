import assert from 'node:assert/strict';
import { summarizeGoal } from './goal-progress.js';

assert.deepEqual(summarizeGoal({ targetValue: 8, direction: 'at-least' }, [
  { date: '2026-10-01', value: 4 }, { date: '2026-10-02', value: 6 }
]), { current: 6, previous: 4, change: 2, progressPercent: 75, reached: false, entryCount: 2 });

assert.equal(summarizeGoal({ targetValue: 5, direction: 'at-most' }, [{ date: '2026-10-01', value: 4 }]).reached, true);
assert.equal(summarizeGoal({ targetValue: 8, direction: 'at-least' }, []).progressPercent, null);
console.log('goal progress checks passed');
