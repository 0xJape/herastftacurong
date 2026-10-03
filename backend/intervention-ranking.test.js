import assert from 'node:assert/strict';
import { rankSuggestions, SUGGESTIONS } from './intervention-ranking.js';

const fresh = rankSuggestions(SUGGESTIONS, [], [], 1);
assert.equal(fresh.available, false);
assert.equal(fresh.evidenceCount, 0);
assert.ok(fresh.suggestions.every(item => item.rank === null));

const belowThreshold = rankSuggestions(SUGGESTIONS, [{ userId: 1, suggestionId: 'steady-hydration', action: 'saved' }], [], 1);
assert.equal(belowThreshold.available, false);

const isolated = rankSuggestions(SUGGESTIONS, [
  { userId: 1, suggestionId: 'steady-hydration', action: 'saved' },
  { userId: 2, suggestionId: 'steady-hydration', action: 'helpful' }
], [{ userId: 2, metric: 'hydration', status: 'available', change: 10 }], 1);
assert.equal(isolated.available, false);
assert.equal(isolated.evidenceCount, 1);

const tied = rankSuggestions(SUGGESTIONS, [
  { userId: 1, suggestionId: 'steady-hydration', action: 'saved' },
  { userId: 1, suggestionId: 'consistent-sleep', action: 'saved' }
], [], 1);
assert.equal(tied.available, true);
assert.equal(tied.suggestions[0].rank, tied.suggestions[1].rank);
assert.ok(tied.suggestions[0].supportingEvidence.length);

const missingOutcome = rankSuggestions(SUGGESTIONS, [], [{ userId: 1, metric: 'hydration', status: 'missing-data', change: 20 }], 1);
assert.equal(missingOutcome.available, false);
console.log('intervention ranking checks passed');
