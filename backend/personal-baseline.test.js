import assert from 'node:assert/strict';
import { buildPersonalBaselines } from './personal-baseline.js';

const days = (count, value, final = value) => Array.from({ length: count }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, value: index === count - 1 ? final : value }));

const established = buildPersonalBaselines({ heartRate: days(15, 70, 80) }).find(item => item.key === 'heartRate');
assert.equal(established.confidence, 'established');
assert.equal(established.reliableDays, 14);
assert.equal(established.average, 70);
assert.equal(established.status, 'above');

const learning = buildPersonalBaselines({ wellness: days(8, 75, 77) }).find(item => item.key === 'wellness');
assert.equal(learning.confidence, 'limited');
assert.equal(learning.status, 'learning');
assert.equal(learning.progress, 7);

const filtered = buildPersonalBaselines({ spo2: [...days(15, 98), { date: '2026-10-01', value: 10, reliable: false }] }).find(item => item.key === 'spo2');
assert.equal(filtered.current.value, 98);
assert.equal(filtered.reliableDays, 14);
assert.equal(filtered.status, 'within');

const missing = buildPersonalBaselines({}).find(item => item.key === 'hydration');
assert.equal(missing.current, null);
assert.equal(missing.status, 'learning');

console.log('Personal baseline checks passed');
