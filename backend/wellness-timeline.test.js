import assert from 'node:assert/strict';
import { buildWellnessTimeline } from './wellness-timeline.js';

const events = buildWellnessTimeline({
  checkins: [{ id: 1, date: '2026-03-10', mood: 4, stress: 2, energy: 3, sleep: 4, hydration: 3, symptoms: ['headache'] }],
  cycles: [{ id: 2, startDate: '2026-03-09', endDate: null }],
  sleep: [{ id: 3, date: '2026-03-10', sleepQuality: 4, morningRestedness: 3, sws: { score: 78 } }],
  meals: [{ id: 4, eatenAt: '2026-03-10T12:30:00.000Z', mealType: 'lunch', foodName: 'Rice bowl', portionAmount: 1, portionUnit: 'bowl', calories: 500, proteinG: 20, carbsG: 70, fatG: 12 }],
  water: [{ date: '2026-03-10', milliliters: 1800 }],
  wearable: [{ date: '2026-03-10', heartRate: 72, spo2: 98, movementLevel: 1.2, wornReadings: 20 }],
  activity: [{ date: '2026-03-10', activityLoadIndex: 31, activityBalance: 'balanced', durationsMinutes: { active: 20 }, baseline: 29 }],
  goals: [{ id: 5, startDate: '2026-03-09', title: 'Drink water', direction: 'at-least', targetValue: 2000, unit: 'mL', metric: 'water', status: 'active' }],
  interventions: [{ id: 6, startDate: '2026-03-09', endDate: '2026-03-09', title: 'Earlier bedtime', metrics: ['sleep-wellness'], status: 'completed', feedback: [{ id: 8, date: '2026-03-10', outcome: 'helpful' }], outcome: { status: 'insufficient-data', afterWindow: { end: '2026-03-10' }, metrics: [{ status: 'insufficient-data' }] } }],
  approvedSummaries: [{ id: 9, draftId: 7, versionNumber: 2, startDate: '2026-03-01', endDate: '2026-03-10', approvedText: 'PRIVATE TEXT MUST NOT APPEAR', approvedAt: '2026-03-10T19:00:00.000Z' }],
  assessment: { createdAt: '2026-03-10T18:00:00.000Z', summary: 'Recent sleep was steady.', confidence: 'moderate', recordsReviewed: 4 }
}, '2026-03-09');

assert.equal(events.length, 13);
assert.equal(events[0].domain, 'health-summary');
assert.equal(events.find(item => item.domain === 'nutrition').precision, 'instant');
assert.equal(events.find(item => item.domain === 'hydration').precision, 'day');
assert.equal(events.find(item => item.domain === 'wearable').quality, 'observed');
assert.match(events.find(item => item.domain === 'outcome').summary, /no complete outcome/i);
assert.equal(events.find(item => item.domain === 'intervention-feedback').metrics.outcome, 'helpful');
assert.doesNotMatch(JSON.stringify(events.find(item => item.domain === 'health-summary')), /PRIVATE TEXT/);
assert.deepEqual(buildWellnessTimeline({ checkins: [{ id: 1, date: '2026-03-01', symptoms: [] }] }, '2026-03-09'), []);
assert.deepEqual(buildWellnessTimeline({}, '2026-03-09'), []);
console.log('wellness timeline checks passed');
