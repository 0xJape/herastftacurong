import assert from 'node:assert/strict';
import { assessDataQuality } from './data-quality.js';

const report = assessDataQuality({ checkins: [{ date: '2026-10-01' }, { date: '2026-10-01' }], wearable: [{ date: '2026-10-01', qualityValid: false, qualityIssues: ['spo2-invalid'] }] });
assert.equal(report.status, 'review');
assert.ok(report.issues.some(item => item.type === 'duplicate-date'));
assert.ok(report.issues.some(item => item.type === 'noisy-wearable'));
assert.equal(assessDataQuality().status, 'clear');
console.log('Data quality checks passed');