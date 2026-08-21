import express from 'express';
import cors from 'cors';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';

const app = express();
const port = 3000;
const root = path.dirname(fileURLToPath(import.meta.url));
try { loadEnvFile(path.join(root, '.env')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
const db = new DatabaseSync(path.join(root, 'hera.db'));
const assistantRequests = new Map();

db.exec('PRAGMA journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS sensor_readings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    wearing INTEGER NOT NULL,
    heart_rate REAL NOT NULL,
    heart_rate_valid INTEGER NOT NULL,
    spo2 REAL NOT NULL,
    activity TEXT NOT NULL,
    movement_level REAL NOT NULL,
    uptime_ms INTEGER NOT NULL,
    received_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS daily_checkins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    checkin_date TEXT NOT NULL,
    mood INTEGER NOT NULL CHECK (mood BETWEEN 1 AND 5),
    stress INTEGER NOT NULL CHECK (stress BETWEEN 1 AND 5),
    energy INTEGER NOT NULL CHECK (energy BETWEEN 1 AND 5),
    sleep INTEGER NOT NULL CHECK (sleep BETWEEN 1 AND 5),
    hydration INTEGER NOT NULL CHECK (hydration BETWEEN 1 AND 5),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, checkin_date)
  );
  CREATE TABLE IF NOT EXISTS menstrual_cycles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, start_date)
  );
  CREATE TABLE IF NOT EXISTS daily_water_intake (
    user_id INTEGER NOT NULL,
    intake_date TEXT NOT NULL,
    milliliters INTEGER NOT NULL CHECK (milliliters BETWEEN 0 AND 10000),
    updated_at TEXT NOT NULL,
    PRIMARY KEY (user_id, intake_date)
  )
`);
const checkinColumns = db.prepare('PRAGMA table_info(daily_checkins)').all();
if (!checkinColumns.some(column => column.name === 'symptoms')) db.exec("ALTER TABLE daily_checkins ADD COLUMN symptoms TEXT NOT NULL DEFAULT '[]'");

const insertReading = db.prepare(`
  INSERT INTO sensor_readings
    (device_id, wearing, heart_rate, heart_rate_valid, spo2, activity, movement_level, uptime_ms, received_at)
  VALUES
    (@deviceId, @wearing, @heartRate, @heartRateValid, @spo2, @activity, @movementLevel, @uptimeMs, @receivedAt)
`);
const getLatestReading = db.prepare(`
  SELECT device_id AS deviceId, wearing, heart_rate AS heartRate,
    heart_rate_valid AS heartRateValid, spo2, activity,
    movement_level AS movementLevel, uptime_ms AS uptimeMs,
    received_at AS receivedAt
  FROM sensor_readings ORDER BY id DESC LIMIT 1
`);
const getReadingHistory = db.prepare(`
  SELECT device_id AS deviceId, wearing, heart_rate AS heartRate,
    heart_rate_valid AS heartRateValid, spo2, activity,
    movement_level AS movementLevel, uptime_ms AS uptimeMs,
    received_at AS receivedAt
  FROM sensor_readings
  WHERE (@deviceId IS NULL OR device_id = @deviceId)
  ORDER BY id DESC LIMIT @limit
`);
const saveCheckin = db.prepare(`
  INSERT INTO daily_checkins
    (user_id, checkin_date, mood, stress, energy, sleep, hydration, symptoms, notes, created_at, updated_at)
  VALUES
    (@userId, @date, @mood, @stress, @energy, @sleep, @hydration, @symptoms, @notes, @now, @now)
  ON CONFLICT(user_id, checkin_date) DO UPDATE SET
    mood = excluded.mood, stress = excluded.stress, energy = excluded.energy,
    sleep = excluded.sleep, hydration = excluded.hydration, symptoms = excluded.symptoms, notes = excluded.notes,
    updated_at = excluded.updated_at
  RETURNING id, user_id AS userId, checkin_date AS date, mood, stress, energy,
    sleep, hydration, symptoms, notes, created_at AS createdAt, updated_at AS updatedAt
`);
const getCheckins = db.prepare(`
  SELECT id, user_id AS userId, checkin_date AS date, mood, stress, energy,
    sleep, hydration, symptoms, notes, created_at AS createdAt, updated_at AS updatedAt
  FROM daily_checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT ?
`);
const getLatestCheckin = db.prepare(`
  SELECT id, user_id AS userId, checkin_date AS date, mood, stress, energy,
    sleep, hydration, symptoms, notes, created_at AS createdAt, updated_at AS updatedAt
  FROM daily_checkins WHERE user_id = ? ORDER BY checkin_date DESC LIMIT 1
`);
const createCycle = db.prepare(`
  INSERT INTO menstrual_cycles
    (user_id, start_date, end_date, notes, created_at, updated_at)
  VALUES (@userId, @startDate, @endDate, @notes, @now, @now)
  RETURNING id, user_id AS userId, start_date AS startDate, end_date AS endDate,
    notes, created_at AS createdAt, updated_at AS updatedAt
`);
const updateCycle = db.prepare(`
  UPDATE menstrual_cycles SET start_date = @startDate, end_date = @endDate,
    notes = @notes, updated_at = @now
  WHERE id = @id AND user_id = @userId
  RETURNING id, user_id AS userId, start_date AS startDate, end_date AS endDate,
    notes, created_at AS createdAt, updated_at AS updatedAt
`);
const getCycleByStart = db.prepare('SELECT id FROM menstrual_cycles WHERE user_id = ? AND start_date = ?');
const getCycleById = db.prepare('SELECT id FROM menstrual_cycles WHERE id = ? AND user_id = ?');
const findCycleOverlap = db.prepare(`
  SELECT id FROM menstrual_cycles
  WHERE user_id = @userId AND id != @excludeId
    AND start_date <= @rangeEnd AND COALESCE(end_date, start_date) >= @startDate
  LIMIT 1
`);
const deleteCycle = db.prepare('DELETE FROM menstrual_cycles WHERE id = ? AND user_id = ?');
const getCycles = db.prepare(`
  SELECT id, user_id AS userId, start_date AS startDate, end_date AS endDate,
    notes, created_at AS createdAt, updated_at AS updatedAt
  FROM menstrual_cycles WHERE user_id = ? ORDER BY start_date DESC LIMIT ?
`);
const getWaterIntake = db.prepare(`
  SELECT user_id AS userId, intake_date AS date, milliliters, updated_at AS updatedAt
  FROM daily_water_intake WHERE user_id = ? AND intake_date = ?
`);
const saveWaterIntake = db.prepare(`
  INSERT INTO daily_water_intake (user_id, intake_date, milliliters, updated_at)
  VALUES (@userId, @date, @milliliters, @now)
  ON CONFLICT(user_id, intake_date) DO UPDATE SET
    milliliters = excluded.milliliters, updated_at = excluded.updated_at
  RETURNING user_id AS userId, intake_date AS date, milliliters, updated_at AS updatedAt
`);
const getTodayWearableContext = db.prepare(`
  SELECT activity, movement_level AS movementLevel, wearing, received_at AS receivedAt
  FROM sensor_readings WHERE substr(received_at, 1, 10) = ? ORDER BY id DESC LIMIT 1
`);
const getRecentActivityContext = db.prepare(`
  SELECT COUNT(*) AS readingCount,
    COUNT(DISTINCT substr(received_at, 1, 10)) AS coveredDays,
    SUM(CASE WHEN wearing = 1 THEN 1 ELSE 0 END) AS wornReadings,
    SUM(CASE WHEN wearing = 1 AND (lower(activity) LIKE '%active%' OR lower(activity) LIKE '%walk%' OR lower(activity) LIKE '%run%' OR lower(activity) LIKE '%exercise%') THEN 1 ELSE 0 END) AS activeReadings
  FROM sensor_readings WHERE received_at >= ?
`);
const getDailyWearableAnalytics = db.prepare(`
  SELECT substr(received_at, 1, 10) AS date,
    ROUND(AVG(CASE WHEN wearing = 1 AND heart_rate_valid = 1 THEN heart_rate END), 1) AS heartRate,
    ROUND(AVG(CASE WHEN wearing = 1 AND spo2 > 0 THEN spo2 END), 1) AS spo2,
    ROUND(AVG(CASE WHEN wearing = 1 THEN movement_level END), 2) AS movementLevel,
    SUM(CASE WHEN wearing = 1 THEN 1 ELSE 0 END) AS wornReadings,
    COUNT(*) AS readingCount
  FROM sensor_readings WHERE received_at >= ?
  GROUP BY substr(received_at, 1, 10) ORDER BY date
`);

const DAY_MS = 86400000;
const dateMs = value => Date.parse(`${value}T00:00:00Z`);
const dateOnly = value => new Date(value).toISOString().slice(0, 10);
const addDays = (value, days) => dateOnly(dateMs(value) + days * DAY_MS);
const daysBetween = (start, end) => Math.round((dateMs(end) - dateMs(start)) / DAY_MS);
const validDateOnly = value => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = dateMs(value);
  return Number.isFinite(time) && dateOnly(time) === value;
};
const todayDate = () => new Date().toISOString().slice(0, 10);

function validateCycleInput(body) {
  const { startDate, endDate = null, notes = '' } = body;
  if (!validDateOnly(startDate)) return 'startDate must be a valid YYYY-MM-DD date';
  if (startDate > todayDate()) return 'startDate cannot be in the future';
  if (endDate !== null && endDate !== '' && !validDateOnly(endDate)) return 'endDate must be a valid YYYY-MM-DD date';
  const normalizedEndDate = endDate || null;
  if (normalizedEndDate && normalizedEndDate > todayDate()) return 'endDate cannot be in the future';
  if (normalizedEndDate && normalizedEndDate < startDate) return 'endDate cannot be before startDate';
  if (normalizedEndDate && daysBetween(startDate, normalizedEndDate) > 14) return 'period duration cannot exceed 15 days';
  if (typeof notes !== 'string' || notes.length > 500) return 'notes must be a string up to 500 characters';
  return null;
}

function cycleSummary(cycles) {
  const today = todayDate();
  const latest = cycles.find(cycle => cycle.startDate <= today) || null;
  const cycleDay = latest ? daysBetween(latest.startDate, today) + 1 : null;
  const intervals = cycles.slice(0, -1).map((cycle, index) => daysBetween(cycles[index + 1].startDate, cycle.startDate)).filter(days => days >= 15 && days <= 60).slice(0, 6);
  const phaseSummary = cycleLength => {
    if (!latest) return { phaseAvailable: false, phaseModel: null, estimatedCycleEnd: null, estimatedOvulationWindow: null, currentEstimatedPhase: null };
    const ovulationDay = Math.max(1, cycleLength - 14);
    const ovulationCenter = addDays(latest.startDate, ovulationDay - 1);
    const currentEstimatedPhase = cycleDay > cycleLength ? 'Beyond estimated cycle range' : cycleDay >= ovulationDay + 2 ? 'Estimated luteal phase' : cycleDay >= ovulationDay - 1 ? 'Estimated ovulation window' : cycleDay > 5 ? 'Estimated follicular phase' : 'Recorded/estimated period phase';
    return { phaseAvailable: true, phaseModel: cycleLength === 28 ? 'provisional-28-day' : 'recorded-average', estimatedCycleEnd: addDays(latest.startDate, cycleLength - 1), estimatedOvulationWindow: { start: addDays(ovulationCenter, -1), end: addDays(ovulationCenter, 1) }, currentEstimatedPhase };
  };
  if (cycles.length < 3 || intervals.length < 2) return { cycleDay, averageCycleLength: null, variabilityDays: null, predictionAvailable: false, predictedStart: null, predictedRange: null, ...phaseSummary(28) };
  const mean = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;
  const averageCycleLength = Math.round(mean);
  const variabilityDays = Math.round(Math.sqrt(intervals.reduce((sum, days) => sum + (days - mean) ** 2, 0) / intervals.length) * 10) / 10;
  const uncertainty = Math.max(2, Math.ceil(variabilityDays));
  const predictedStart = addDays(latest.startDate, averageCycleLength);
  return { cycleDay, averageCycleLength, variabilityDays, predictionAvailable: true, predictedStart, predictedRange: { start: addDays(predictedStart, -uncertainty), end: addDays(predictedStart, uncertainty), uncertaintyDays: uncertainty }, ...phaseSummary(averageCycleLength) };
}

app.use(cors());
app.use(express.json({ limit: '8kb' }));
const frontendRoot = path.join(root, '..', 'frontend');

app.get('/', (_req, res) => {
  res.redirect('/homepage');
});

app.get('/homepage', (_req, res) => res.sendFile(path.join(frontendRoot, 'index.html')));
app.use(express.static(frontendRoot));

app.post('/api/wearable/readings', (req, res) => {
  const { deviceId, wearing, heartRate, heartRateValid, spo2, activity, movementLevel, uptimeMs } = req.body;

  if (typeof deviceId !== 'string' || !deviceId.trim()) {
    return res.status(400).json({ error: 'deviceId is required' });
  }
  if (typeof wearing !== 'boolean' || typeof heartRateValid !== 'boolean') {
    return res.status(400).json({ error: 'wearing and heartRateValid must be boolean' });
  }
  if (![heartRate, spo2, movementLevel, uptimeMs].every(Number.isFinite)) {
    return res.status(400).json({ error: 'numeric reading fields are required' });
  }
  if (typeof activity !== 'string' || !activity.trim()) {
    return res.status(400).json({ error: 'activity is required' });
  }

  const reading = {
    deviceId: deviceId.trim(),
    wearing,
    heartRate,
    heartRateValid,
    spo2,
    activity: activity.trim(),
    movementLevel,
    uptimeMs,
    receivedAt: new Date().toISOString()
  };
  insertReading.run({
    ...reading,
    wearing: Number(reading.wearing),
    heartRateValid: Number(reading.heartRateValid)
  });

  res.status(201).json({ accepted: true, reading });
});

app.get('/api/wearable/latest', (_req, res) => {
  const reading = getLatestReading.get();
  if (!reading) return res.status(404).json({ error: 'No wearable reading received' });
  res.json({ ...reading, wearing: Boolean(reading.wearing), heartRateValid: Boolean(reading.heartRateValid) });
});

app.get('/api/wearable/history', (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const deviceId = typeof req.query.deviceId === 'string' && req.query.deviceId.trim() ? req.query.deviceId.trim() : null;
  const readings = getReadingHistory.all({ deviceId, limit }).reverse().map(reading => ({
    ...reading,
    wearing: Boolean(reading.wearing),
    heartRateValid: Boolean(reading.heartRateValid)
  }));
  res.json({ readings, count: readings.length });
});

app.post('/api/checkins', (req, res) => {
  const { userId, date, mood, stress, energy, sleep, hydration, symptoms = [], notes = '' } = req.body;
  const scores = { mood, stress, energy, sleep, hydration };
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return res.status(400).json({ error: 'date must be a valid YYYY-MM-DD date' });
  if (!Object.values(scores).every(value => Number.isInteger(value) && value >= 1 && value <= 5)) return res.status(400).json({ error: 'mood, stress, energy, sleep, and hydration must be integers from 1 to 5' });
  const allowedSymptoms = ['cramps', 'headache', 'bloating', 'fatigue', 'nausea', 'breast-tenderness', 'back-pain'];
  if (!Array.isArray(symptoms) || symptoms.length > allowedSymptoms.length || symptoms.some(value => !allowedSymptoms.includes(value)) || new Set(symptoms).size !== symptoms.length) return res.status(400).json({ error: 'symptoms must contain unique supported symptom names' });
  if (typeof notes !== 'string' || notes.length > 1000) return res.status(400).json({ error: 'notes must be a string up to 1000 characters' });
  const checkin = saveCheckin.get({ userId, date, ...scores, symptoms: JSON.stringify(symptoms), notes: notes.trim(), now: new Date().toISOString() });
  res.status(201).json({ checkin: { ...checkin, symptoms: JSON.parse(checkin.symptoms) } });
});

app.get('/api/checkins/:userId', (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;
  const checkins = getCheckins.all(userId, limit).map(checkin => ({ ...checkin, symptoms: JSON.parse(checkin.symptoms) }));
  res.json({ checkins, count: checkins.length });
});

app.get('/api/analytics/:userId', (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  const days = Number.parseInt(req.query.days, 10);
  if (userId !== 1) return res.status(400).json({ error: 'userId must be 1' });
  if (![7, 30, 90].includes(days)) return res.status(400).json({ error: 'days must be 7, 30, or 90' });
  const since = new Date(Date.now() - (days - 1) * DAY_MS).toISOString();
  const sinceDate = since.slice(0, 10);
  const checkins = getCheckins.all(userId, 100).filter(item => item.date >= sinceDate).reverse().map(item => {
    const symptoms = JSON.parse(item.symptoms);
    const wellness = Math.round(((item.mood - 1 + (5 - item.stress) + item.energy - 1 + item.sleep - 1 + item.hydration - 1) / 20) * 100);
    return { date: item.date, mood: item.mood, sleep: item.sleep, wellness, symptoms };
  });
  const cycles = getCycles.all(userId, 100).filter(item => item.startDate >= sinceDate).reverse();
  const cycleIntervals = cycles.slice(1).map((cycle, index) => ({ date: cycle.startDate, days: daysBetween(cycles[index].startDate, cycle.startDate) })).filter(item => item.days >= 15 && item.days <= 60);
  const symptomCounts = {};
  checkins.flatMap(item => item.symptoms).forEach(symptom => { symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1; });
  const wearable = getDailyWearableAnalytics.all(since);
  res.json({ rangeDays: days, checkins, wearable, cycles, cycleIntervals, symptomCounts, coverage: { checkinDays: checkins.length, wearableDays: wearable.length, cycleStarts: cycles.length }, disclaimer: 'Charts summarize stored HERA observations and self-reports. They do not diagnose conditions or establish causes.' });
});

app.post('/api/assistant', async (req, res) => {
  const { message, history = [] } = req.body;
  if (typeof message !== 'string' || !message.trim() || message.length > 2000) return res.status(400).json({ error: 'message must be 1 to 2000 characters' });
  if (!Array.isArray(history) || history.length > 8 || history.some(item => !item || !['user', 'assistant'].includes(item.role) || typeof item.content !== 'string' || !item.content.trim() || item.content.length > 2000)) return res.status(400).json({ error: 'history must contain up to 8 valid user or assistant messages' });
  if (/chest pain|cannot breathe|can't breathe|severe bleeding|fainting|suicid|overdose|emergency/i.test(message)) return res.json({ reply: 'This may need urgent help. Contact local emergency services now. If safe, tell a trusted person nearby. HERA cannot assess emergencies.' });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'AI assistant is not configured' });
  const now = Date.now(), ip = req.ip, recent = (assistantRequests.get(ip) || []).filter(time => now - time < 60000);
  if (recent.length >= 10) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  recent.push(now); assistantRequests.set(ip, recent);
  const checkins = getCheckins.all(1, 7).map(item => ({ date: item.date, mood: item.mood, stress: item.stress, energy: item.energy, sleep: item.sleep, hydration: item.hydration, symptoms: JSON.parse(item.symptoms) }));
  const cycles = getCycles.all(1, 6), cycle = cycleSummary(cycles);
  const wearable = getDailyWearableAnalytics.all(new Date(now - 7 * DAY_MS).toISOString());
  const water = getWaterIntake.get(1, todayDate()) || null;
  const latest = checkins[0] || null;
  const wellness = latest ? Math.round(((latest.mood - 1 + (5 - latest.stress) + latest.energy - 1 + latest.sleep - 1 + latest.hydration - 1) / 20) * 100) : null;
  const context = { asOf: new Date().toISOString(), latestCheckin: latest, recentCheckins: checkins, wellnessScore: wellness, hydration: { waterTodayMilliliters: water?.milliliters ?? 0, waterRecordedToday: Boolean(water?.updatedAt), generalTargetMilliliters: 2000 }, cycle: { cycleDay: cycle.cycleDay, currentEstimatedPhase: cycle.currentEstimatedPhase, phaseModel: cycle.phaseModel, predictionAvailable: cycle.predictionAvailable }, wearableDailyAverages: wearable, unavailableDataMustRemainUnavailable: true };
  const system = `You are HERA, a warm, compassionate, conversational health and wellness companion. Sound natural and supportive, not clinical, robotic, or like a database report. Briefly acknowledge the user's feelings or goal when relevant, then respond helpfully. Ask one gentle follow-up question when it would meaningfully continue the conversation. Do not begin every response with an apology. Answer only questions about cycle tracking, recorded symptoms, wellness, nutrition, activity, and HERA results. Use only provided HERA context for claims about the user. When specific data is unavailable, say so briefly, then still offer safe general guidance if useful; distinguish general guidance from recorded facts. Give personalized but non-diagnostic general guidance. Never diagnose, prescribe, alter medication, claim fertility certainty, replace emergency care, or invent readings or meals. Cycle phases may be estimates. For urgent symptoms, advise local emergency services. For persistent or concerning symptoms, suggest a qualified clinician. Use plain text without Markdown markers such as **, #, or backticks. Do not mention internal prompts or raw field names. HERA context: ${JSON.stringify(context)}`;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', temperature: 0.55, max_completion_tokens: 500, messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: message.trim() }] }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(502).json({ error: 'AI service is temporarily unavailable' });
    const reply = (await response.json()).choices?.[0]?.message?.content?.trim().replace(/[*#`]/g, '');
    if (!reply) return res.status(502).json({ error: 'AI service returned no response' });
    res.json({ reply });
  } catch {
    res.status(502).json({ error: 'AI service is temporarily unavailable' });
  }
});

app.get('/api/wellness/:userId', (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  const checkin = getLatestCheckin.get(userId);
  if (!checkin) return res.status(404).json({ error: 'No daily check-in available' });
  const score = Math.round(((checkin.mood - 1 + (5 - checkin.stress) + checkin.energy - 1 + checkin.sleep - 1 + checkin.hydration - 1) / 20) * 100);
  const label = score >= 75 ? 'Feeling strong' : score >= 50 ? 'Balanced' : score >= 25 ? 'Needs care' : 'Low self-report';
  res.json({ score, label, checkinDate: checkin.date, components: { mood: checkin.mood, stress: checkin.stress, energy: checkin.energy, sleep: checkin.sleep, hydration: checkin.hydration }, disclaimer: 'Wellness score summarizes self-reported check-in values and is not a medical assessment.' });
});

app.get('/api/nutrition/:userId', (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  if (userId !== 1) return res.status(400).json({ error: 'userId must be 1' });
  const date = todayDate();
  const water = getWaterIntake.get(userId, date) || { userId, date, milliliters: 0, updatedAt: null };
  const checkin = getLatestCheckin.get(userId) || null;
  const wearable = getTodayWearableContext.get(date) || null;
  const recentActivity = getRecentActivityContext.get(`${addDays(date, -6)}T00:00:00.000Z`);
  const summary = cycleSummary(getCycles.all(userId, 24));
  const active = Boolean(wearable?.wearing) && /active|walk|run|exercise/i.test(wearable.activity);
  const targetMilliliters = 2000 + (active ? 250 : 0);
  const recommendations = [];
  if (checkin?.hydration <= 2) recommendations.push({ title: 'Hydration needs attention', detail: 'Your latest check-in reported low hydration. Sip water regularly and use thirst as your guide.', source: 'Latest daily check-in' });
  if (active) recommendations.push({ title: 'Replace fluids after activity', detail: 'Today’s wearable activity is elevated. Add water gradually after movement.', source: 'Today’s wearable activity' });
  if (recentActivity.coveredDays >= 3 && recentActivity.wornReadings >= 10 && recentActivity.activeReadings === 0) recommendations.push({ title: 'Add gentle movement', detail: 'Recent worn-device readings show no detected active periods. If it feels safe, consider a walk or another activity you enjoy.', source: 'Past 7 days of wearable activity' });
  if (/period/i.test(summary.currentEstimatedPhase || '')) recommendations.push({ title: 'Support menstruation days', detail: 'Choose regular balanced meals with iron-rich foods, vitamin C foods, and adequate fluids.', source: 'Recorded cycle timing' });
  else if (summary.phaseAvailable) recommendations.push({ title: 'Phase-aware basics', detail: 'Keep meals regular and varied with protein, whole grains, fruits, vegetables, and fluids.', source: summary.phaseModel === 'provisional-28-day' ? 'Provisional cycle estimate' : 'Recorded cycle average' });
  if (checkin?.energy <= 2) recommendations.push({ title: 'Low-energy meal focus', detail: 'Pair complex carbohydrates with protein for steadier energy.', source: 'Latest daily check-in' });
  if (!recommendations.length) recommendations.push({ title: 'Maintain balanced basics', detail: 'Choose varied meals and drink according to thirst throughout the day.', source: 'Available HERA data' });
  res.json({ date, water, targetMilliliters, checkin, wearable: wearable ? { ...wearable, wearing: Boolean(wearable.wearing) } : null, recentActivity, cycle: summary, recommendations, recommendationEngine: 'rules-based', disclaimer: 'General wellness guidance only. Fluid and nutrition needs vary; follow clinician advice for medical conditions, pregnancy, or fluid restrictions.' });
});

app.put('/api/nutrition/:userId/water', (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  const { date, milliliters } = req.body;
  if (userId !== 1) return res.status(400).json({ error: 'userId must be 1' });
  if (!validDateOnly(date) || date > todayDate()) return res.status(400).json({ error: 'date must be a valid non-future YYYY-MM-DD date' });
  if (!Number.isInteger(milliliters) || milliliters < 0 || milliliters > 10000) return res.status(400).json({ error: 'milliliters must be an integer from 0 to 10000' });
  const water = saveWaterIntake.get({ userId, date, milliliters, now: new Date().toISOString() });
  res.json({ water });
});

app.post('/api/cycles', (req, res) => {
  const { userId, startDate, endDate = null, notes = '' } = req.body;
  if (userId !== 1) return res.status(400).json({ error: 'userId must be 1' });
  const error = validateCycleInput(req.body);
  if (error) return res.status(400).json({ error });
  const normalizedEndDate = endDate || null;
  const duplicate = getCycleByStart.get(userId, startDate);
  const excludeId = duplicate?.id || 0;
  if (findCycleOverlap.get({ userId, startDate, rangeEnd: normalizedEndDate || startDate, excludeId })) return res.status(409).json({ error: 'period range overlaps an existing record' });
  const values = { id: excludeId, userId, startDate, endDate: normalizedEndDate, notes: notes.trim(), now: new Date().toISOString() };
  const cycle = duplicate ? updateCycle.get(values) : createCycle.get({ userId, startDate, endDate: normalizedEndDate, notes: notes.trim(), now: values.now });
  res.status(duplicate ? 200 : 201).json({ cycle });
});

app.put('/api/cycles/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  const { userId, startDate, endDate = null, notes = '' } = req.body;
  if (!Number.isInteger(id) || id < 1 || userId !== 1) return res.status(400).json({ error: 'valid id and userId 1 are required' });
  if (!getCycleById.get(id, userId)) return res.status(404).json({ error: 'cycle not found' });
  const error = validateCycleInput(req.body);
  if (error) return res.status(400).json({ error });
  const normalizedEndDate = endDate || null;
  if (findCycleOverlap.get({ userId, startDate, rangeEnd: normalizedEndDate || startDate, excludeId: id })) return res.status(409).json({ error: 'period range overlaps an existing record' });
  try {
    const cycle = updateCycle.get({ id, userId, startDate, endDate: normalizedEndDate, notes: notes.trim(), now: new Date().toISOString() });
    res.json({ cycle });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'a period with that start date already exists' });
    throw error;
  }
});

app.delete('/api/cycles/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'id must be a positive integer' });
  if (!deleteCycle.run(id, 1).changes) return res.status(404).json({ error: 'cycle not found' });
  res.status(204).end();
});

app.get('/api/cycles/:userId', (req, res) => {
  const userId = Number.parseInt(req.params.userId, 10);
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  if (userId !== 1) return res.status(400).json({ error: 'userId must be 1' });
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 24;
  const cycles = getCycles.all(userId, limit);
  res.json({ cycles, count: cycles.length, summary: cycleSummary(cycles) });
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`HERA backend listening on http://0.0.0.0:${port}`);
});
