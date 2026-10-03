import assert from 'node:assert/strict';
import { buildPatterns, relationship, trend } from './wellness-patterns.js';

const series = (count, start, step = 1) => Array.from({ length: count }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, value: start + index * step }));
assert.equal(trend('wellness', series(14, 50)).direction, 'increasing');
assert.equal(trend('wellness', series(6, 50)).available, false);
assert.equal(relationship('a', 'b', series(10, 1), series(10, 2, 2)).strength, 'strong');
assert.equal(relationship('a', 'b', series(6, 1), series(6, 2)).available, false);
const patterns = buildPatterns({
  baselines: [
    { key: 'heartRate', label: 'Heart rate', confidence: 'established', status: 'above', current: { date: '2026-09-20', value: 80 }, unit: ' BPM', low: 65, high: 75, reliableDays: 20 },
    { key: 'wellness', label: 'Wellness', confidence: 'established', status: 'below', current: { date: '2026-09-20', value: 45 }, unit: '%', low: 60, high: 80, reliableDays: 20 }
  ],
  series: { wellness: series(14, 50) },
  symptoms: [{ date: '2026-09-01', symptoms: ['fatigue'] }, { date: '2026-09-02', symptoms: ['fatigue'] }, { date: '2026-09-03', symptoms: ['fatigue'] }]
});
assert.equal(patterns.insights[0].type, 'multi-parameter');
assert.ok(patterns.insights.some(item => item.id === 'recurrence-fatigue'));
assert.match(patterns.disclaimer, /not a diagnosis/i);
console.log('Wellness pattern checks passed');
