import assert from 'node:assert/strict';
import { buildHealthSummary, buildVerifiedContactLinks } from './health-summary.js';

const input = { startDate: '2026-03-01', endDate: '2026-03-07', domains: ['sleep', 'checkins', 'nutrition'], records: {
  checkins: [{ id: 1, date: '2026-03-02', mood: 4, stress: 2, energy: 3 }, { id: 2, date: '2026-02-28', mood: 1, stress: 5, energy: 1 }],
  sleep: [{ id: 3, date: '2026-03-03', score: 78 }], water: [{ date: '2026-03-02', milliliters: 1800 }], meals: [{ id: 4, eatenAt: '2026-03-02T12:00:00.000Z' }]
} };
const first = buildHealthSummary(input), second = buildHealthSummary(input);
assert.deepEqual(first, second);
assert.deepEqual(first.domains, ['sleep', 'checkins', 'nutrition']);
assert.equal(first.sections.length, 3);
assert.match(first.text, /Average mood 4\/5/);
assert.equal(first.sources.length, 4);
assert.ok(first.sources.every(source => source.date >= input.startDate && source.date <= input.endDate));
assert.ok(!first.text.includes('2026-02-28'));
assert.match(buildHealthSummary({ ...input, domains: ['wearable'], records: {} }).text, /No reliable worn-device/);
assert.deepEqual(buildVerifiedContactLinks({ phone: '+63 (83) 123-4567', email: 'care@example.org', website: 'https://example.org/contact' }).map(item => item.href), ['tel:+63831234567', 'mailto:care@example.org', 'https://example.org/contact']);
assert.deepEqual(buildVerifiedContactLinks({ phone: 'javascript:alert(1)', email: 'bad', website: 'javascript:alert(1)' }), []);
console.log('health summary checks passed');
