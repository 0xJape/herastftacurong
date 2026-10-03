import express from 'express';
import cors from 'cors';
import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from 'node:process';
import { calculateSleepWellness } from './sleep-score.js';
import { normalizeWearableReading } from './wearable-quality.js';
import { addActivityBaseline, aggregateActivity } from './activity-analytics.js';
import { buildWellnessTimeline } from './wellness-timeline.js';
import { buildPersonalBaselines } from './personal-baseline.js';
import { buildPatterns } from './wellness-patterns.js';
import { summarizeGoal } from './goal-progress.js';
import { buildInterventionOutcome } from './intervention-outcomes.js';
import { rankSuggestions, SUGGESTIONS } from './intervention-ranking.js';
import { buildHealthSummary, buildVerifiedContactLinks, HEALTH_SUMMARY_DOMAINS } from './health-summary.js';

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
    received_at TEXT NOT NULL,
    user_id INTEGER
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
  );
  CREATE TABLE IF NOT EXISTS meal_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    eaten_at TEXT NOT NULL,
    meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
    food_name TEXT NOT NULL,
    portion_amount REAL,
    portion_unit TEXT,
    calories REAL,
    protein_g REAL,
    carbs_g REAL,
    fat_g REAL,
    notes TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT 'manual',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sleep_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    sleep_date TEXT NOT NULL,
    sleep_quality INTEGER CHECK (sleep_quality BETWEEN 1 AND 5),
    morning_restedness INTEGER CHECK (morning_restedness BETWEEN 1 AND 5),
    sleep_onset_difficulty INTEGER CHECK (sleep_onset_difficulty BETWEEN 1 AND 5),
    nighttime_awakenings INTEGER CHECK (nighttime_awakenings BETWEEN 0 AND 20),
    sleep_disturbances INTEGER CHECK (sleep_disturbances BETWEEN 1 AND 5),
    morning_sleepiness INTEGER CHECK (morning_sleepiness BETWEEN 1 AND 5),
    bedtime TEXT,
    estimated_sleep_time TEXT,
    wake_time TEXT,
    schedule_consistency INTEGER CHECK (schedule_consistency BETWEEN 1 AND 5),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, sleep_date)
  );
  CREATE TABLE IF NOT EXISTS sleep_assessments (
    user_id INTEGER PRIMARY KEY,
    data_signature TEXT NOT NULL,
    summary TEXT NOT NULL,
    confidence TEXT NOT NULL,
    records_reviewed INTEGER NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS device_assignments (
    device_id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS prediction_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    prediction_date TEXT NOT NULL,
    algorithm_version TEXT NOT NULL,
    signature TEXT NOT NULL,
    result_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(user_id, prediction_date, algorithm_version, signature)
  );
  CREATE TABLE IF NOT EXISTS wellness_goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    metric TEXT NOT NULL,
    target_value REAL NOT NULL CHECK(target_value > 0),
    unit TEXT NOT NULL,
    direction TEXT NOT NULL CHECK(direction IN ('at-least', 'at-most')),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'paused', 'completed')),
    start_date TEXT NOT NULL,
    target_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS goal_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    goal_id INTEGER NOT NULL REFERENCES wellness_goals(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    progress_date TEXT NOT NULL,
    value REAL NOT NULL CHECK(value >= 0),
    note TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(goal_id, progress_date)
  );
  CREATE INDEX IF NOT EXISTS wellness_goals_user_status ON wellness_goals(user_id, status);
  CREATE INDEX IF NOT EXISTS goal_progress_goal_date ON goal_progress(goal_id, progress_date);
  CREATE TABLE IF NOT EXISTS interventions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    metrics_json TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL,
    comparison_window_days INTEGER NOT NULL CHECK(comparison_window_days BETWEEN 3 AND 30),
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'cancelled')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS intervention_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    intervention_id INTEGER NOT NULL REFERENCES interventions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feedback_date TEXT NOT NULL,
    outcome TEXT NOT NULL CHECK(outcome IN ('helpful', 'neutral', 'unhelpful', 'unsure')),
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    UNIQUE(intervention_id, feedback_date)
  );
  CREATE INDEX IF NOT EXISTS interventions_user_status ON interventions(user_id, status);
  CREATE INDEX IF NOT EXISTS intervention_feedback_owner_date ON intervention_feedback(user_id, intervention_id, feedback_date);
  CREATE TABLE IF NOT EXISTS suggestion_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    suggestion_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('saved', 'dismissed', 'started', 'helpful', 'irrelevant')),
    intervention_id INTEGER REFERENCES interventions(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS suggestion_feedback_owner ON suggestion_feedback(user_id, suggestion_id, created_at);
  CREATE TABLE IF NOT EXISTS clinics (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, services TEXT NOT NULL, address TEXT NOT NULL,
    city TEXT NOT NULL, region TEXT NOT NULL, postal_code TEXT NOT NULL DEFAULT '', public_phone TEXT,
    public_email TEXT, public_website TEXT, source_url TEXT NOT NULL, verified_at TEXT NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0 CHECK(is_verified IN (0,1)), is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1)),
    UNIQUE(name, address)
  );
  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT, display_name TEXT NOT NULL, specialty TEXT NOT NULL, services TEXT NOT NULL,
    public_phone TEXT, public_email TEXT, public_website TEXT, source_url TEXT NOT NULL, verified_at TEXT NOT NULL,
    is_verified INTEGER NOT NULL DEFAULT 0 CHECK(is_verified IN (0,1)), is_demo INTEGER NOT NULL DEFAULT 0 CHECK(is_demo IN (0,1)),
    UNIQUE(display_name, specialty)
  );
  CREATE TABLE IF NOT EXISTS doctor_clinics (doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE, clinic_id INTEGER NOT NULL REFERENCES clinics(id) ON DELETE CASCADE, PRIMARY KEY(doctor_id, clinic_id));
  CREATE TABLE IF NOT EXISTS saved_specialists (user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, doctor_id INTEGER NOT NULL REFERENCES doctors(id) ON DELETE CASCADE, saved_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS health_summary_drafts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    selected_domains_json TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, draft_text TEXT NOT NULL,
    structured_json TEXT NOT NULL, source_references_json TEXT NOT NULL, specialist_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS health_summary_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, draft_id INTEGER NOT NULL REFERENCES health_summary_drafts(id) ON DELETE RESTRICT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, version_number INTEGER NOT NULL,
    selected_domains_json TEXT NOT NULL, start_date TEXT NOT NULL, end_date TEXT NOT NULL, approved_text TEXT NOT NULL,
    structured_json TEXT NOT NULL, source_references_json TEXT NOT NULL, specialist_id INTEGER REFERENCES doctors(id) ON DELETE SET NULL,
    approved_at TEXT NOT NULL, UNIQUE(user_id, draft_id, version_number)
  );
  CREATE TRIGGER IF NOT EXISTS health_summary_versions_no_update BEFORE UPDATE ON health_summary_versions BEGIN SELECT RAISE(ABORT, 'approved health summary versions are immutable'); END;
  CREATE TRIGGER IF NOT EXISTS health_summary_versions_no_delete BEFORE DELETE ON health_summary_versions BEGIN SELECT RAISE(ABORT, 'approved health summary versions are immutable'); END;
  CREATE INDEX IF NOT EXISTS health_summary_drafts_owner ON health_summary_drafts(user_id, updated_at);
  CREATE INDEX IF NOT EXISTS health_summary_versions_owner ON health_summary_versions(user_id, approved_at);
  CREATE INDEX IF NOT EXISTS clinics_verified_location ON clinics(is_verified, city, region);
  CREATE INDEX IF NOT EXISTS doctors_verified_specialty ON doctors(is_verified, specialty);
`);
const clinicColumns = db.prepare('PRAGMA table_info(clinics)').all();
for (const [name, type] of [['facility_type','TEXT'],['ownership','TEXT'],['provider_listing','TEXT'],['schedule','TEXT'],['accepts_new_patients','TEXT'],['latitude','REAL'],['longitude','REAL'],['coordinate_source','TEXT']]) {
  if (!clinicColumns.some(column => column.name === name)) db.exec(`ALTER TABLE clinics ADD COLUMN ${name} ${type}`);
}
const sensorColumns = db.prepare('PRAGMA table_info(sensor_readings)').all();
if (!sensorColumns.some(column => column.name === 'user_id')) db.exec('ALTER TABLE sensor_readings ADD COLUMN user_id INTEGER');
if (!sensorColumns.some(column => column.name === 'source')) db.exec("ALTER TABLE sensor_readings ADD COLUMN source TEXT NOT NULL DEFAULT 'wearable'");
if (!sensorColumns.some(column => column.name === 'quality_valid')) db.exec('ALTER TABLE sensor_readings ADD COLUMN quality_valid INTEGER NOT NULL DEFAULT 1');
if (!sensorColumns.some(column => column.name === 'quality_issues')) db.exec("ALTER TABLE sensor_readings ADD COLUMN quality_issues TEXT NOT NULL DEFAULT '[]'");
const checkinColumns = db.prepare('PRAGMA table_info(daily_checkins)').all();
if (!checkinColumns.some(column => column.name === 'symptoms')) db.exec("ALTER TABLE daily_checkins ADD COLUMN symptoms TEXT NOT NULL DEFAULT '[]'");
db.exec(`
  INSERT OR IGNORE INTO sleep_records
    (user_id, sleep_date, sleep_quality, notes, created_at, updated_at)
  SELECT user_id, checkin_date, sleep, '', created_at, updated_at FROM daily_checkins
`);

const insertReading = db.prepare(`
  INSERT INTO sensor_readings
    (device_id, wearing, heart_rate, heart_rate_valid, spo2, activity, movement_level, uptime_ms,
     received_at, user_id, source, quality_valid, quality_issues)
  VALUES
    (@deviceId, @wearing, @heartRate, @heartRateValid, @spo2, @activity, @movementLevel, @uptimeMs,
     @receivedAt, @userId, @source, @qualityValid, @qualityIssues)
`);
const getLastDeviceReading = db.prepare(`
  SELECT wearing, heart_rate AS heartRate, heart_rate_valid AS heartRateValid, spo2, activity,
    movement_level AS movementLevel, uptime_ms AS uptimeMs, received_at AS receivedAt
  FROM sensor_readings WHERE device_id = ? ORDER BY id DESC LIMIT 1
`);
const getLatestReading = db.prepare(`
  SELECT device_id AS deviceId, wearing, heart_rate AS heartRate,
    heart_rate_valid AS heartRateValid, spo2, activity,
    movement_level AS movementLevel, uptime_ms AS uptimeMs,
    received_at AS receivedAt, source, quality_valid AS qualityValid, quality_issues AS qualityIssues
  FROM sensor_readings WHERE user_id = ? ORDER BY id DESC LIMIT 1
`);
const getReadingHistory = db.prepare(`
  SELECT device_id AS deviceId, wearing, heart_rate AS heartRate,
    heart_rate_valid AS heartRateValid, spo2, activity,
    movement_level AS movementLevel, uptime_ms AS uptimeMs,
    received_at AS receivedAt, source, quality_valid AS qualityValid, quality_issues AS qualityIssues
  FROM sensor_readings
  WHERE user_id = @userId AND (@deviceId IS NULL OR device_id = @deviceId)
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
const getWaterIntakeRange = db.prepare(`
  SELECT intake_date AS date, milliliters, updated_at AS updatedAt
  FROM daily_water_intake WHERE user_id = ? AND intake_date >= ? ORDER BY intake_date
`);
const saveWaterIntake = db.prepare(`
  INSERT INTO daily_water_intake (user_id, intake_date, milliliters, updated_at)
  VALUES (@userId, @date, @milliliters, @now)
  ON CONFLICT(user_id, intake_date) DO UPDATE SET
    milliliters = excluded.milliliters, updated_at = excluded.updated_at
  RETURNING user_id AS userId, intake_date AS date, milliliters, updated_at AS updatedAt
`);
const mealSelect = `SELECT id, eaten_at AS eatenAt, meal_type AS mealType, food_name AS foodName,
  portion_amount AS portionAmount, portion_unit AS portionUnit, calories, protein_g AS proteinG,
  carbs_g AS carbsG, fat_g AS fatG, notes, source, created_at AS createdAt, updated_at AS updatedAt
  FROM meal_records`;
const getMeals = db.prepare(`${mealSelect} WHERE user_id = ? AND substr(eaten_at, 1, 10) = ? ORDER BY eaten_at, id`);
const getMealsRange = db.prepare(`${mealSelect} WHERE user_id = ? AND substr(eaten_at, 1, 10) >= ? ORDER BY eaten_at, id`);
const createMeal = db.prepare(`INSERT INTO meal_records
  (user_id, eaten_at, meal_type, food_name, portion_amount, portion_unit, calories, protein_g, carbs_g, fat_g, notes, source, created_at, updated_at)
  VALUES (@userId, @eatenAt, @mealType, @foodName, @portionAmount, @portionUnit, @calories, @proteinG, @carbsG, @fatG, @notes, 'manual', @now, @now)
  RETURNING id, eaten_at AS eatenAt, meal_type AS mealType, food_name AS foodName, portion_amount AS portionAmount,
    portion_unit AS portionUnit, calories, protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG,
    notes, source, created_at AS createdAt, updated_at AS updatedAt`);
const updateMeal = db.prepare(`UPDATE meal_records SET eaten_at = @eatenAt, meal_type = @mealType,
  food_name = @foodName, portion_amount = @portionAmount, portion_unit = @portionUnit,
  calories = @calories, protein_g = @proteinG, carbs_g = @carbsG, fat_g = @fatG,
  notes = @notes, updated_at = @now WHERE id = @id AND user_id = @userId
  RETURNING id, eaten_at AS eatenAt, meal_type AS mealType, food_name AS foodName, portion_amount AS portionAmount,
    portion_unit AS portionUnit, calories, protein_g AS proteinG, carbs_g AS carbsG, fat_g AS fatG,
    notes, source, created_at AS createdAt, updated_at AS updatedAt`);
const deleteMeal = db.prepare('DELETE FROM meal_records WHERE id = ? AND user_id = ?');
const getTodayWearableContext = db.prepare(`
  SELECT activity, movement_level AS movementLevel, wearing, received_at AS receivedAt
  FROM sensor_readings WHERE user_id = ? AND substr(received_at, 1, 10) = ? ORDER BY id DESC LIMIT 1
`);
const getRecentActivityContext = db.prepare(`
  SELECT COUNT(*) AS readingCount,
    COUNT(DISTINCT substr(received_at, 1, 10)) AS coveredDays,
    SUM(CASE WHEN wearing = 1 THEN 1 ELSE 0 END) AS wornReadings,
    SUM(CASE WHEN wearing = 1 AND (lower(activity) LIKE '%active%' OR lower(activity) LIKE '%walk%' OR lower(activity) LIKE '%run%' OR lower(activity) LIKE '%exercise%') THEN 1 ELSE 0 END) AS activeReadings
  FROM sensor_readings WHERE user_id = ? AND received_at >= ?
`);
const getDailyWearableAnalytics = db.prepare(`
  SELECT substr(received_at, 1, 10) AS date,
    ROUND(AVG(CASE WHEN wearing = 1 AND heart_rate_valid = 1 THEN heart_rate END), 1) AS heartRate,
    ROUND(AVG(CASE WHEN wearing = 1 AND spo2 > 0 THEN spo2 END), 1) AS spo2,
    ROUND(AVG(CASE WHEN wearing = 1 THEN movement_level END), 2) AS movementLevel,
    SUM(CASE WHEN wearing = 1 THEN 1 ELSE 0 END) AS wornReadings,
    COUNT(*) AS readingCount
  FROM sensor_readings WHERE user_id = ? AND received_at >= ?
  GROUP BY substr(received_at, 1, 10) ORDER BY date
`);
const getActivityReadings = db.prepare(`
  SELECT wearing, activity, received_at AS receivedAt
  FROM sensor_readings
  WHERE user_id = ? AND received_at >= ?
  ORDER BY received_at
`);
const getPredictionSnapshots = db.prepare('SELECT prediction_date AS date, algorithm_version AS algorithmVersion, result_json AS resultJson, created_at AS createdAt FROM prediction_snapshots WHERE user_id = ? ORDER BY id DESC LIMIT ?');
const savePredictionSnapshot = db.prepare('INSERT OR IGNORE INTO prediction_snapshots (user_id, prediction_date, algorithm_version, signature, result_json, created_at) VALUES (?, ?, ?, ?, ?, ?)');
const saveSleepRecord = db.prepare(`
  INSERT INTO sleep_records
    (user_id, sleep_date, sleep_quality, morning_restedness, sleep_onset_difficulty,
     nighttime_awakenings, sleep_disturbances, morning_sleepiness, bedtime,
     estimated_sleep_time, wake_time, schedule_consistency, notes, created_at, updated_at)
  VALUES
    (@userId, @date, @sleepQuality, @morningRestedness, @sleepOnsetDifficulty,
     @nighttimeAwakenings, @sleepDisturbances, @morningSleepiness, @bedtime,
     @estimatedSleepTime, @wakeTime, @scheduleConsistency, @notes, @now, @now)
  ON CONFLICT(user_id, sleep_date) DO UPDATE SET
    sleep_quality = excluded.sleep_quality, morning_restedness = excluded.morning_restedness,
    sleep_onset_difficulty = excluded.sleep_onset_difficulty,
    nighttime_awakenings = excluded.nighttime_awakenings,
    sleep_disturbances = excluded.sleep_disturbances, morning_sleepiness = excluded.morning_sleepiness,
    bedtime = excluded.bedtime, estimated_sleep_time = excluded.estimated_sleep_time,
    wake_time = excluded.wake_time, schedule_consistency = excluded.schedule_consistency,
    notes = excluded.notes, updated_at = excluded.updated_at
  RETURNING id, user_id AS userId, sleep_date AS date, sleep_quality AS sleepQuality,
    morning_restedness AS morningRestedness, sleep_onset_difficulty AS sleepOnsetDifficulty,
    nighttime_awakenings AS nighttimeAwakenings, sleep_disturbances AS sleepDisturbances,
    morning_sleepiness AS morningSleepiness, bedtime, estimated_sleep_time AS estimatedSleepTime,
    wake_time AS wakeTime, schedule_consistency AS scheduleConsistency, notes,
    created_at AS createdAt, updated_at AS updatedAt
`);
const getSleepRecords = db.prepare(`
  SELECT id, user_id AS userId, sleep_date AS date, sleep_quality AS sleepQuality,
    morning_restedness AS morningRestedness, sleep_onset_difficulty AS sleepOnsetDifficulty,
    nighttime_awakenings AS nighttimeAwakenings, sleep_disturbances AS sleepDisturbances,
    morning_sleepiness AS morningSleepiness, bedtime, estimated_sleep_time AS estimatedSleepTime,
    wake_time AS wakeTime, schedule_consistency AS scheduleConsistency, notes,
    created_at AS createdAt, updated_at AS updatedAt
  FROM sleep_records WHERE user_id = ? ORDER BY sleep_date DESC LIMIT ?
`);
const getSleepAssessment = db.prepare(`
  SELECT data_signature AS dataSignature, summary, confidence,
    records_reviewed AS recordsReviewed, created_at AS createdAt
  FROM sleep_assessments WHERE user_id = ?
`);
const saveSleepAssessment = db.prepare(`
  INSERT INTO sleep_assessments
    (user_id, data_signature, summary, confidence, records_reviewed, created_at)
  VALUES (@userId, @dataSignature, @summary, @confidence, @recordsReviewed, @createdAt)
  ON CONFLICT(user_id) DO UPDATE SET
    data_signature = excluded.data_signature, summary = excluded.summary,
    confidence = excluded.confidence, records_reviewed = excluded.records_reviewed,
    created_at = excluded.created_at
`);
const getUserByEmail = db.prepare('SELECT id, name, email, password_hash AS passwordHash FROM users WHERE email = ?');
const getUserBySession = db.prepare(`SELECT users.id, users.name, users.email FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.token_hash = ? AND sessions.expires_at > ?`);
const createUser = db.prepare('INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?) RETURNING id, name, email');
const createSession = db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)');
const deleteSession = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
const getDeviceOwner = db.prepare('SELECT user_id AS userId FROM device_assignments WHERE device_id = ?');
const getUserDevice = db.prepare('SELECT device_id AS deviceId, assigned_at AS assignedAt FROM device_assignments WHERE user_id = ? LIMIT 1');
const assignDevice = db.prepare('INSERT INTO device_assignments (device_id, user_id, assigned_at) VALUES (?, ?, ?) ON CONFLICT(device_id) DO UPDATE SET user_id = excluded.user_id, assigned_at = excluded.assigned_at');
const goalSelect = `SELECT id, title, metric, target_value AS targetValue, unit, direction, status,
  start_date AS startDate, target_date AS targetDate, created_at AS createdAt, updated_at AS updatedAt FROM wellness_goals`;
const getGoals = db.prepare(`${goalSelect} WHERE user_id = ? ORDER BY CASE status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END, id DESC`);
const getGoal = db.prepare(`${goalSelect} WHERE id = ? AND user_id = ?`);
const createGoal = db.prepare(`INSERT INTO wellness_goals
  (user_id, title, metric, target_value, unit, direction, status, start_date, target_date, created_at, updated_at)
  VALUES (@userId, @title, @metric, @targetValue, @unit, @direction, 'active', @startDate, @targetDate, @now, @now)
  RETURNING id, title, metric, target_value AS targetValue, unit, direction, status, start_date AS startDate,
    target_date AS targetDate, created_at AS createdAt, updated_at AS updatedAt`);
const updateGoal = db.prepare(`UPDATE wellness_goals SET title=@title, metric=@metric, target_value=@targetValue,
  unit=@unit, direction=@direction, start_date=@startDate, target_date=@targetDate, updated_at=@now
  WHERE id=@id AND user_id=@userId RETURNING id, title, metric, target_value AS targetValue, unit, direction,
  status, start_date AS startDate, target_date AS targetDate, created_at AS createdAt, updated_at AS updatedAt`);
const setGoalStatus = db.prepare(`UPDATE wellness_goals SET status=?, updated_at=? WHERE id=? AND user_id=?
  RETURNING id, title, metric, target_value AS targetValue, unit, direction, status, start_date AS startDate,
  target_date AS targetDate, created_at AS createdAt, updated_at AS updatedAt`);
const deleteGoal = db.prepare('DELETE FROM wellness_goals WHERE id=? AND user_id=?');
const getGoalProgress = db.prepare('SELECT id, progress_date AS date, value, note, created_at AS createdAt FROM goal_progress WHERE goal_id=? AND user_id=? ORDER BY progress_date');
const saveGoalProgress = db.prepare(`INSERT INTO goal_progress (goal_id, user_id, progress_date, value, note, created_at)
  VALUES (@goalId,@userId,@date,@value,@note,@now) ON CONFLICT(goal_id, progress_date) DO UPDATE SET
  value=excluded.value,note=excluded.note,created_at=excluded.created_at
  RETURNING id, progress_date AS date, value, note, created_at AS createdAt`);
const interventionSelect = `SELECT id, title, description, metrics_json AS metricsJson, start_date AS startDate,
  end_date AS endDate, comparison_window_days AS comparisonWindowDays, status, created_at AS createdAt,
  updated_at AS updatedAt FROM interventions`;
const getInterventions = db.prepare(`${interventionSelect} WHERE user_id=? ORDER BY start_date DESC,id DESC`);
const getIntervention = db.prepare(`${interventionSelect} WHERE id=? AND user_id=?`);
const createIntervention = db.prepare(`INSERT INTO interventions
  (user_id,title,description,metrics_json,start_date,end_date,comparison_window_days,status,created_at,updated_at)
  VALUES (@userId,@title,@description,@metricsJson,@startDate,@endDate,@comparisonWindowDays,'active',@now,@now)
  RETURNING id,title,description,metrics_json AS metricsJson,start_date AS startDate,end_date AS endDate,
  comparison_window_days AS comparisonWindowDays,status,created_at AS createdAt,updated_at AS updatedAt`);
const updateIntervention = db.prepare(`UPDATE interventions SET title=@title,description=@description,metrics_json=@metricsJson,
  start_date=@startDate,end_date=@endDate,comparison_window_days=@comparisonWindowDays,updated_at=@now
  WHERE id=@id AND user_id=@userId RETURNING id,title,description,metrics_json AS metricsJson,start_date AS startDate,
  end_date AS endDate,comparison_window_days AS comparisonWindowDays,status,created_at AS createdAt,updated_at AS updatedAt`);
const setInterventionStatus = db.prepare(`UPDATE interventions SET status=?,updated_at=? WHERE id=? AND user_id=? RETURNING id`);
const deleteIntervention = db.prepare('DELETE FROM interventions WHERE id=? AND user_id=?');
const getInterventionFeedback = db.prepare(`SELECT id,feedback_date AS date,outcome,notes,created_at AS createdAt FROM intervention_feedback WHERE intervention_id=? AND user_id=? ORDER BY feedback_date DESC`);
const saveInterventionFeedback = db.prepare(`INSERT INTO intervention_feedback (intervention_id,user_id,feedback_date,outcome,notes,created_at)
  VALUES (@interventionId,@userId,@date,@outcome,@notes,@now) ON CONFLICT(intervention_id,feedback_date) DO UPDATE SET outcome=excluded.outcome,notes=excluded.notes,created_at=excluded.created_at
  RETURNING id,feedback_date AS date,outcome,notes,created_at AS createdAt`);
const getSuggestionFeedback = db.prepare(`SELECT suggestion_id AS suggestionId,action,intervention_id AS interventionId,created_at AS createdAt,user_id AS userId FROM suggestion_feedback WHERE user_id=? ORDER BY created_at`);
const saveSuggestionFeedback = db.prepare(`INSERT INTO suggestion_feedback (user_id,suggestion_id,action,intervention_id,created_at) VALUES (@userId,@suggestionId,@action,@interventionId,@now) RETURNING id,suggestion_id AS suggestionId,action,intervention_id AS interventionId,created_at AS createdAt`);
const careDoctorSelect = `SELECT d.id,d.display_name AS displayName,d.specialty,d.services,d.public_phone AS publicPhone,
  d.public_email AS publicEmail,d.public_website AS publicWebsite,d.source_url AS sourceUrl,d.verified_at AS verifiedAt,
  d.is_demo AS isDemo,c.id AS clinicId,c.name AS clinicName,c.address,c.city,c.region,c.postal_code AS postalCode,
  c.latitude,c.longitude,c.coordinate_source AS coordinateSource,c.public_phone AS clinicPhone,c.public_email AS clinicEmail,
  c.public_website AS clinicWebsite,c.schedule,c.facility_type AS facilityType,c.ownership,c.provider_listing AS providerListing
  FROM doctors d JOIN doctor_clinics dc ON dc.doctor_id=d.id JOIN clinics c ON c.id=dc.clinic_id
  WHERE d.is_verified=1 AND c.is_verified=1`;
const searchCare = db.prepare(`${careDoctorSelect} AND (@need='' OR lower(d.services) LIKE @needLike OR lower(c.services) LIKE @needLike)
  AND (@location='' OR lower(c.city||' '||c.region||' '||c.postal_code||' '||c.address) LIKE @locationLike)
  AND (@specialty='' OR lower(d.specialty) LIKE @specialtyLike) ORDER BY d.display_name,c.name LIMIT 50`);
const getDoctorProfile = db.prepare(`${careDoctorSelect} AND d.id=? ORDER BY c.name`);
const getClinicProfile = db.prepare(`SELECT c.id,c.name,c.services,c.address,c.city,c.region,c.postal_code AS postalCode,
  c.public_phone AS publicPhone,c.public_email AS publicEmail,c.public_website AS publicWebsite,c.source_url AS sourceUrl,
  c.verified_at AS verifiedAt,c.is_demo AS isDemo,c.latitude,c.longitude,c.coordinate_source AS coordinateSource,
  c.facility_type AS facilityType,c.ownership,c.provider_listing AS providerListing,c.schedule,
  c.accepts_new_patients AS acceptsNewPatients FROM clinics c WHERE c.id=? AND c.is_verified=1`);
const searchClinics = db.prepare(`SELECT c.id,c.name,c.services,c.address,c.city,c.region,c.postal_code AS postalCode,
  c.public_phone AS publicPhone,c.public_email AS publicEmail,c.public_website AS publicWebsite,c.source_url AS sourceUrl,
  c.verified_at AS verifiedAt,c.is_demo AS isDemo,c.latitude,c.longitude,c.coordinate_source AS coordinateSource,
  c.facility_type AS facilityType,c.ownership,c.provider_listing AS providerListing,c.schedule,
  c.accepts_new_patients AS acceptsNewPatients FROM clinics c WHERE c.is_verified=1
  AND (@need='' OR lower(c.services||' '||c.provider_listing) LIKE @needLike)
  AND (@location='' OR lower(c.city||' '||c.region||' '||c.postal_code||' '||c.address) LIKE @locationLike)
  ORDER BY c.name LIMIT 100`);
const getClinicDoctors = db.prepare(`${careDoctorSelect} AND c.id=? ORDER BY d.display_name`);
const getSavedSpecialist = db.prepare(`${careDoctorSelect} AND d.id=(SELECT doctor_id FROM saved_specialists WHERE user_id=?) ORDER BY c.name`);
const saveSpecialist = db.prepare(`INSERT INTO saved_specialists(user_id,doctor_id,saved_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET doctor_id=excluded.doctor_id,saved_at=excluded.saved_at`);
const deleteSavedSpecialist = db.prepare('DELETE FROM saved_specialists WHERE user_id=?');
const summaryDraftSelect = `SELECT id,selected_domains_json AS selectedDomainsJson,start_date AS startDate,end_date AS endDate,draft_text AS draftText,structured_json AS structuredJson,source_references_json AS sourceReferencesJson,specialist_id AS specialistId,created_at AS createdAt,updated_at AS updatedAt FROM health_summary_drafts`;
const summaryVersionSelect = `SELECT id,draft_id AS draftId,version_number AS versionNumber,selected_domains_json AS selectedDomainsJson,start_date AS startDate,end_date AS endDate,approved_text AS approvedText,structured_json AS structuredJson,source_references_json AS sourceReferencesJson,specialist_id AS specialistId,approved_at AS approvedAt FROM health_summary_versions`;
const getSummaryDraft = db.prepare(`${summaryDraftSelect} WHERE id=? AND user_id=?`);
const createSummaryDraft = db.prepare(`INSERT INTO health_summary_drafts(user_id,selected_domains_json,start_date,end_date,draft_text,structured_json,source_references_json,specialist_id,created_at,updated_at) VALUES(@userId,@domainsJson,@startDate,@endDate,@draftText,@structuredJson,@sourcesJson,@specialistId,@now,@now) RETURNING id`);
const updateSummaryDraft = db.prepare(`UPDATE health_summary_drafts SET draft_text=@draftText,specialist_id=@specialistId,updated_at=@now WHERE id=@id AND user_id=@userId RETURNING id`);
const getSummaryVersions = db.prepare(`${summaryVersionSelect} WHERE user_id=? ORDER BY approved_at DESC,id DESC`);
const getSummaryVersion = db.prepare(`${summaryVersionSelect} WHERE id=? AND user_id=?`);
const nextSummaryVersion = db.prepare('SELECT COALESCE(MAX(version_number),0)+1 AS number FROM health_summary_versions WHERE draft_id=? AND user_id=?');
const approveSummaryVersion = db.prepare(`INSERT INTO health_summary_versions(draft_id,user_id,version_number,selected_domains_json,start_date,end_date,approved_text,structured_json,source_references_json,specialist_id,approved_at) VALUES(@draftId,@userId,@versionNumber,@selectedDomainsJson,@startDate,@endDate,@approvedText,@structuredJson,@sourceReferencesJson,@specialistId,@approvedAt) RETURNING id`);

function passwordHash(password, salt = randomBytes(16).toString('hex')) { return `${salt}:${scryptSync(password, salt, 64).toString('hex')}`; }
function passwordMatches(password, stored) {
  const [salt, expectedHex] = stored.split(':'), actual = scryptSync(password, salt, 64), expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
function cookieValue(req, name) { return req.headers.cookie?.split(';').map(value => value.trim().split('=')).find(([key]) => key === name)?.[1] || null; }
function sessionHash(token) { return createHash('sha256').update(token).digest('hex'); }
function setSession(res, userId) {
  const token = randomBytes(32).toString('base64url'), now = new Date(), expires = new Date(now.getTime() + 30 * DAY_MS);
  createSession.run(sessionHash(token), userId, expires.toISOString(), now.toISOString());
  res.setHeader('Set-Cookie', `hera_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${30 * 86400}${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`);
}

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

function validateSleepInput(body) {
  const scales = ['sleepQuality', 'morningRestedness', 'sleepOnsetDifficulty', 'sleepDisturbances', 'morningSleepiness', 'scheduleConsistency'];
  if (!Number.isInteger(body.userId) || body.userId < 1) return 'userId must be a positive integer';
  if (!validDateOnly(body.date) || body.date > todayDate()) return 'date must be a valid non-future YYYY-MM-DD date';
  if (scales.some(name => !Number.isInteger(body[name]) || body[name] < 1 || body[name] > 5)) return `${scales.join(', ')} must be integers from 1 to 5`;
  if (!Number.isInteger(body.nighttimeAwakenings) || body.nighttimeAwakenings < 0 || body.nighttimeAwakenings > 20) return 'nighttimeAwakenings must be an integer from 0 to 20';
  if (['bedtime', 'estimatedSleepTime', 'wakeTime'].some(name => typeof body[name] !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(body[name]))) return 'bedtime, estimatedSleepTime, and wakeTime must use HH:MM';
  const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const bedtime = minutes(body.bedtime), sleep = minutes(body.estimatedSleepTime), wake = minutes(body.wakeTime);
  const sleepAfterBed = (sleep - bedtime + 1440) % 1440;
  const wakeAfterSleep = (wake - sleep + 1440) % 1440;
  if (sleepAfterBed > 720 || wakeAfterSleep < 30 || wakeAfterSleep > 1200) return 'sleep schedule must follow bedtime, sleep time, then wake time within one overnight period';
  if (typeof body.notes !== 'string' || body.notes.length > 1000) return 'notes must be a string up to 1000 characters';
  return null;
}

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

function normalizeMealInput(body) {
  const mealTypes = new Set(['breakfast', 'lunch', 'dinner', 'snack']);
  const foodName = typeof body.foodName === 'string' ? body.foodName.trim() : '';
  const eatenAt = typeof body.eatenAt === 'string' ? body.eatenAt : '';
  if (!foodName || foodName.length > 120) return { error: 'foodName must be 1 to 120 characters' };
  if (!mealTypes.has(body.mealType)) return { error: 'mealType must be breakfast, lunch, dinner, or snack' };
  const eatenTime = Date.parse(eatenAt);
  if (!Number.isFinite(eatenTime) || eatenTime > Date.now() + 60000) return { error: 'eatenAt must be a valid non-future timestamp' };
  const optionalNumber = (name, maximum) => {
    if (body[name] === null || body[name] === undefined || body[name] === '') return null;
    const value = Number(body[name]);
    return Number.isFinite(value) && value >= 0 && value <= maximum ? Math.round(value * 10) / 10 : NaN;
  };
  const values = { portionAmount: optionalNumber('portionAmount', 10000), calories: optionalNumber('calories', 10000), proteinG: optionalNumber('proteinG', 1000), carbsG: optionalNumber('carbsG', 2000), fatG: optionalNumber('fatG', 1000) };
  if (Object.values(values).some(Number.isNaN)) return { error: 'portion and nutrition values must be non-negative numbers within allowed limits' };
  const portionUnit = typeof body.portionUnit === 'string' ? body.portionUnit.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';
  if (portionUnit.length > 30) return { error: 'portionUnit must be up to 30 characters' };
  if (notes.length > 500) return { error: 'notes must be up to 500 characters' };
  return { meal: { eatenAt: new Date(eatenTime).toISOString(), mealType: body.mealType, foodName, ...values, portionUnit: portionUnit || null, notes } };
}

function cycleSummary(cycles) {
  const today = todayDate();
  const latest = cycles.find(cycle => cycle.startDate <= today) || null;
  const cycleDay = latest ? daysBetween(latest.startDate, today) + 1 : null;
  const intervals = cycles.slice(0, -1).map((cycle, index) => daysBetween(cycles[index + 1].startDate, cycle.startDate)).filter(days => days >= 15 && days <= 60).slice(0, 6);
  const comparison = (() => {
    if (intervals.length < 2) return null;
    const currentLength = intervals[0];
    const prior = intervals.slice(1);
    const baselineLength = Math.round(prior.reduce((sum, days) => sum + days, 0) / prior.length);
    const differenceDays = currentLength - baselineLength;
    const status = differenceDays <= -3 ? 'early' : differenceDays >= 3 ? 'late' : 'on-time';
    return { status, currentLength, baselineLength, differenceDays };
  })();
  const phaseSummary = cycleLength => {
    if (!latest) return { phaseAvailable: false, phaseModel: null, estimatedCycleEnd: null, estimatedOvulationWindow: null, currentEstimatedPhase: null };
    const ovulationDay = Math.max(1, cycleLength - 14);
    const ovulationCenter = addDays(latest.startDate, ovulationDay - 1);
    const currentEstimatedPhase = cycleDay > cycleLength ? 'Beyond estimated cycle range' : cycleDay >= ovulationDay + 2 ? 'Estimated luteal phase' : cycleDay >= ovulationDay - 1 ? 'Estimated ovulation window' : cycleDay > 5 ? 'Estimated follicular phase' : 'Recorded/estimated period phase';
    return { phaseAvailable: true, phaseModel: cycleLength === 28 ? 'provisional-28-day' : 'recorded-average', estimatedCycleEnd: addDays(latest.startDate, cycleLength - 1), estimatedOvulationWindow: { start: addDays(ovulationCenter, -1), end: addDays(ovulationCenter, 1) }, currentEstimatedPhase };
  };
  if (cycles.length < 3 || intervals.length < 2) return { cycleDay, comparison, averageCycleLength: null, variabilityDays: null, predictionAvailable: false, predictedStart: null, predictedRange: null, lateStatus: null, ...phaseSummary(28) };
  const mean = intervals.reduce((sum, days) => sum + days, 0) / intervals.length;
  const averageCycleLength = Math.round(mean);
  const variabilityDays = Math.round(Math.sqrt(intervals.reduce((sum, days) => sum + (days - mean) ** 2, 0) / intervals.length) * 10) / 10;
  const uncertainty = Math.max(2, Math.ceil(variabilityDays));
  const predictedStart = addDays(latest.startDate, averageCycleLength);
  const lateDays = Math.max(0, daysBetween(addDays(predictedStart, uncertainty), today));
  const lateStatus = lateDays >= 7 ? { level: 'significant', days: lateDays, advisory: 'If pregnancy is possible, consider taking a pregnancy test. Consult a qualified healthcare professional if the delay continues or concerns you.' } : lateDays > 0 ? { level: 'late', days: lateDays, advisory: 'Cycle timing can vary. Continue tracking and consult a qualified healthcare professional if the delay persists or concerns you.' } : null;
  return { cycleDay, comparison, averageCycleLength, variabilityDays, predictionAvailable: true, predictedStart, predictedRange: { start: addDays(predictedStart, -uncertainty), end: addDays(predictedStart, uncertainty), uncertaintyDays: uncertainty }, lateStatus, ...phaseSummary(averageCycleLength) };
}

app.use(cors());
app.use(express.json({ limit: '5mb' }));
const frontendRoot = path.join(root, '..', 'frontend');

app.post('/api/auth/register', (req, res) => {
  const name = typeof req.body.name === 'string' ? req.body.name.trim() : '', email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '', password = req.body.password;
  if (name.length < 2 || name.length > 60) return res.status(400).json({ error: 'name must be 2 to 60 characters' });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: 'valid email is required' });
  if (typeof password !== 'string' || password.length < 10 || password.length > 128) return res.status(400).json({ error: 'password must be 10 to 128 characters' });
  try {
    const firstAccount = !db.prepare('SELECT 1 FROM users LIMIT 1').get();
    db.exec('BEGIN');
    let user;
    try {
      user = createUser.get(name, email, passwordHash(password), new Date().toISOString());
      if (firstAccount) {
        for (const table of ['daily_checkins', 'menstrual_cycles', 'daily_water_intake', 'sleep_records', 'sleep_assessments']) db.prepare(`UPDATE ${table} SET user_id = ? WHERE user_id = 1`).run(user.id);
        db.prepare('UPDATE sensor_readings SET user_id = ? WHERE user_id IS NULL OR user_id = 1').run(user.id);
        assignDevice.run('HERA-001', user.id, new Date().toISOString());
      }
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    setSession(res, user.id); res.status(201).json({ user });
  } catch (error) { if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({ error: 'email already registered' }); throw error; }
});
app.post('/api/auth/login', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '', user = getUserByEmail.get(email);
  if (!user || typeof req.body.password !== 'string' || !passwordMatches(req.body.password, user.passwordHash)) return res.status(401).json({ error: 'invalid email or password' });
  setSession(res, user.id); res.json({ user: { id: user.id, name: user.name, email: user.email } });
});
app.use((req, _res, next) => { const token = cookieValue(req, 'hera_session'); req.sessionTokenHash = token ? sessionHash(token) : null; req.user = req.sessionTokenHash ? getUserBySession.get(req.sessionTokenHash, new Date().toISOString()) : null; next(); });
app.get('/api/auth/me', (req, res) => req.user ? res.json({ user: req.user }) : res.status(401).json({ error: 'authentication required' }));
app.post('/api/auth/logout', (req, res) => { if (req.sessionTokenHash) deleteSession.run(req.sessionTokenHash); res.setHeader('Set-Cookie', 'hera_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'); res.status(204).end(); });
app.get(['/login', '/register'], (req, res) => req.user ? res.redirect('/homepage') : res.sendFile(path.join(frontendRoot, 'auth.html')));

app.get('/', (req, res) => req.user ? res.redirect('/homepage') : res.sendFile(path.join(frontendRoot, 'auth.html')));

app.get('/homepage', (req, res) => req.user ? res.sendFile(path.join(frontendRoot, 'index.html')) : res.redirect('/login'));
app.use(express.static(frontendRoot));

app.use('/api', (req, res, next) => {
  if (req.path === '/wearable/readings') return next();
  if (!req.user) return res.status(401).json({ error: 'authentication required' });
  if (req.body) req.body.userId = req.user.id;
  next();
});
app.get('/api/device', (req, res) => res.json({ device: getUserDevice.get(req.user.id) || null }));
app.put('/api/device', (req, res) => {
  if (req.body.deviceId !== 'HERA-001') return res.status(400).json({ error: 'deviceId must be HERA-001' });
  const previous = getDeviceOwner.get('HERA-001');
  if (previous && previous.userId !== req.user.id && req.body.confirmReassign !== true) return res.status(409).json({ error: 'device belongs to another account; confirm reassignment' });
  const assignedAt = new Date().toISOString(); assignDevice.run('HERA-001', req.user.id, assignedAt);
  res.json({ device: { deviceId: 'HERA-001', assignedAt }, reassigned: Boolean(previous && previous.userId !== req.user.id) });
});

const goalMetrics = new Set(['water', 'sleep-wellness', 'activity-load', 'wellness', 'custom']);
function goalInput(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '', metric = body.metric,
    targetValue = Number(body.targetValue), unit = typeof body.unit === 'string' ? body.unit.trim() : '',
    direction = body.direction, startDate = body.startDate, targetDate = body.targetDate || null;
  if (title.length < 2 || title.length > 80) return { error: 'title must be 2 to 80 characters' };
  if (!goalMetrics.has(metric)) return { error: 'metric is not supported' };
  if (!Number.isFinite(targetValue) || targetValue <= 0 || targetValue > 100000) return { error: 'targetValue must be greater than 0 and at most 100000' };
  if (!unit || unit.length > 20) return { error: 'unit is required and must be at most 20 characters' };
  if (!['at-least', 'at-most'].includes(direction)) return { error: 'direction must be at-least or at-most' };
  if (!validDateOnly(startDate) || (targetDate && (!validDateOnly(targetDate) || targetDate < startDate))) return { error: 'dates must be valid and targetDate cannot precede startDate' };
  return { value: { title, metric, targetValue, unit, direction, startDate, targetDate } };
}
const withGoalProgress = (goal, userId) => {
  const history = getGoalProgress.all(goal.id, userId);
  return { ...goal, progress: summarizeGoal(goal, history), history };
};
app.get('/api/goals', (req, res) => res.json({ goals: getGoals.all(req.user.id).map(goal => withGoalProgress(goal, req.user.id)) }));
app.post('/api/goals', (req, res) => {
  const parsed = goalInput(req.body); if (parsed.error) return res.status(400).json({ error: parsed.error });
  const goal = createGoal.get({ userId: req.user.id, ...parsed.value, now: new Date().toISOString() });
  res.status(201).json({ goal: withGoalProgress(goal, req.user.id) });
});
app.put('/api/goals/:id', (req, res) => {
  const parsed = goalInput(req.body), id = Number(req.params.id); if (parsed.error) return res.status(400).json({ error: parsed.error });
  const goal = updateGoal.get({ id, userId: req.user.id, ...parsed.value, now: new Date().toISOString() });
  if (!goal) return res.status(404).json({ error: 'goal not found' }); res.json({ goal: withGoalProgress(goal, req.user.id) });
});
app.patch('/api/goals/:id/status', (req, res) => {
  if (!['active', 'paused', 'completed'].includes(req.body.status)) return res.status(400).json({ error: 'status must be active, paused, or completed' });
  const goal = setGoalStatus.get(req.body.status, new Date().toISOString(), Number(req.params.id), req.user.id);
  if (!goal) return res.status(404).json({ error: 'goal not found' }); res.json({ goal: withGoalProgress(goal, req.user.id) });
});
app.delete('/api/goals/:id', (req, res) => {
  if (!deleteGoal.run(Number(req.params.id), req.user.id).changes) return res.status(404).json({ error: 'goal not found' });
  res.status(204).end();
});
app.post('/api/goals/:id/progress', (req, res) => {
  const goalId = Number(req.params.id), date = req.body.date, value = Number(req.body.value), note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
  if (!getGoal.get(goalId, req.user.id)) return res.status(404).json({ error: 'goal not found' });
  if (!validDateOnly(date) || date > todayDate()) return res.status(400).json({ error: 'date must be valid and cannot be in the future' });
  if (!Number.isFinite(value) || value < 0 || value > 100000) return res.status(400).json({ error: 'value must be from 0 to 100000' });
  if (note.length > 300) return res.status(400).json({ error: 'note must be at most 300 characters' });
  saveGoalProgress.get({ goalId, userId: req.user.id, date, value, note, now: new Date().toISOString() });
  res.status(201).json({ goal: withGoalProgress(getGoal.get(goalId, req.user.id), req.user.id) });
});

const interventionMetrics = new Set(['wellness', 'sleep-wellness', 'hydration', 'activity-load', 'heart-rate', 'spo2']);
function interventionInput(body) {
  const title = typeof body.title === 'string' ? body.title.trim() : '', description = typeof body.description === 'string' ? body.description.trim() : '', metrics = body.metrics,
    comparisonWindowDays = Number(body.comparisonWindowDays), startDate = body.startDate, endDate = body.endDate;
  if (title.length < 2 || title.length > 80) return { error: 'title must be 2 to 80 characters' };
  if (description.length > 500) return { error: 'description must be at most 500 characters' };
  if (!Array.isArray(metrics) || !metrics.length || metrics.length > 4 || new Set(metrics).size !== metrics.length || metrics.some(metric => !interventionMetrics.has(metric))) return { error: 'metrics must contain 1 to 4 unique supported metrics' };
  if (!validDateOnly(startDate) || !validDateOnly(endDate) || endDate < startDate) return { error: 'startDate and endDate must be valid and ordered' };
  if (!Number.isInteger(comparisonWindowDays) || comparisonWindowDays < 3 || comparisonWindowDays > 30) return { error: 'comparisonWindowDays must be an integer from 3 to 30' };
  return { value: { title, description, metrics, metricsJson: JSON.stringify(metrics), startDate, endDate, comparisonWindowDays } };
}
const parseIntervention = row => ({ ...row, metrics: JSON.parse(row.metricsJson), metricsJson: undefined });
app.get('/api/interventions', (req, res) => res.json({ interventions: getInterventions.all(req.user.id).map(row => ({ ...parseIntervention(row), feedback: getInterventionFeedback.all(row.id, req.user.id) })) }));
app.post('/api/interventions', (req, res) => { const parsed=interventionInput(req.body);if(parsed.error)return res.status(400).json({error:parsed.error});const row=createIntervention.get({userId:req.user.id,...parsed.value,now:new Date().toISOString()});res.status(201).json({intervention:{...parseIntervention(row),feedback:[]}}); });
app.put('/api/interventions/:id', (req, res) => { const parsed=interventionInput(req.body);if(parsed.error)return res.status(400).json({error:parsed.error});const row=updateIntervention.get({id:Number(req.params.id),userId:req.user.id,...parsed.value,now:new Date().toISOString()});if(!row)return res.status(404).json({error:'intervention not found'});res.json({intervention:{...parseIntervention(row),feedback:getInterventionFeedback.all(row.id,req.user.id)}}); });
app.patch('/api/interventions/:id/status', (req,res)=>{if(!['active','completed','cancelled'].includes(req.body.status))return res.status(400).json({error:'status must be active, completed, or cancelled'});if(!setInterventionStatus.get(req.body.status,new Date().toISOString(),Number(req.params.id),req.user.id))return res.status(404).json({error:'intervention not found'});res.json({intervention:{...parseIntervention(getIntervention.get(Number(req.params.id),req.user.id)),feedback:getInterventionFeedback.all(Number(req.params.id),req.user.id)}});});
app.delete('/api/interventions/:id',(req,res)=>{if(!deleteIntervention.run(Number(req.params.id),req.user.id).changes)return res.status(404).json({error:'intervention not found'});res.status(204).end();});
app.post('/api/interventions/:id/feedback',(req,res)=>{const interventionId=Number(req.params.id),date=req.body.date,outcome=req.body.outcome,notes=typeof req.body.notes==='string'?req.body.notes.trim():'';if(!getIntervention.get(interventionId,req.user.id))return res.status(404).json({error:'intervention not found'});if(!validDateOnly(date)||date>todayDate())return res.status(400).json({error:'date must be valid and non-future'});if(!['helpful','neutral','unhelpful','unsure'].includes(outcome))return res.status(400).json({error:'outcome is invalid'});if(notes.length>500)return res.status(400).json({error:'notes must be at most 500 characters'});res.status(201).json({feedback:saveInterventionFeedback.get({interventionId,userId:req.user.id,date,outcome,notes,now:new Date().toISOString()})});});

function outcomeFor(row,userId){const intervention=parseIntervention(row),beforeStart=addDays(intervention.startDate,-intervention.comparisonWindowDays),beforeEnd=addDays(intervention.startDate,-1),afterStart=addDays(intervention.endDate,1),afterEnd=addDays(intervention.endDate,intervention.comparisonWindowDays),checkins=getCheckins.all(userId,100),sleep=getSleepRecords.all(userId,100),water=getWaterIntakeRange.all(userId,beforeStart),wearable=getDailyWearableAnalytics.all(userId,`${beforeStart}T00:00:00.000Z`),activity=aggregateActivity(getActivityReadings.all(userId,`${beforeStart}T00:00:00.000Z`));const windows=rows=>({before:rows.filter(x=>x.date>=beforeStart&&x.date<=beforeEnd),after:rows.filter(x=>x.date>=afterStart&&x.date<=afterEnd)}),series={wellness:windows(checkins.map(x=>({date:x.date,value:Math.round(((x.mood-1+(5-x.stress)+x.energy-1+x.sleep-1+x.hydration-1)/20)*100)}))),'sleep-wellness':windows(sleep.map(x=>{const score=calculateSleepWellness(x).score;return {date:x.date,value:score,reliable:score!=null};})),hydration:windows(water.map(x=>({date:x.date,value:x.milliliters}))), 'heart-rate':windows(wearable.map(x=>({date:x.date,value:x.heartRate,reliable:x.wornReadings>0&&x.heartRate!=null}))),spo2:windows(wearable.map(x=>({date:x.date,value:x.spo2,reliable:x.wornReadings>0&&x.spo2!=null}))), 'activity-load':windows(activity.map(x=>({date:x.date,value:x.activityLoadIndex,reliable:x.wornMinutes>=10})))};return buildInterventionOutcome({...intervention,beforeWindow:{start:beforeStart,end:beforeEnd},afterWindow:{start:afterStart,end:afterEnd}},series);}
app.get('/api/interventions/:id/outcome',(req,res)=>{const row=getIntervention.get(Number(req.params.id),req.user.id);if(!row)return res.status(404).json({error:'intervention not found'});res.json({outcome:outcomeFor(row,req.user.id)});});

function rankingOutcomes(userId) {
  return getInterventions.all(userId).flatMap(row => outcomeFor(row, userId).metrics.filter(metric => metric.status === 'available').map(metric => ({ userId, metric: metric.metric, status: metric.status, change: metric.absoluteChange })));
}
app.get('/api/suggestions', (req, res) => res.json(rankSuggestions(SUGGESTIONS, getSuggestionFeedback.all(req.user.id), rankingOutcomes(req.user.id), req.user.id)));
app.post('/api/suggestions/:id/feedback', (req, res) => {
  const suggestionId = req.params.id, action = req.body.action, interventionId = req.body.interventionId == null ? null : Number(req.body.interventionId);
  if (!SUGGESTIONS.some(item => item.id === suggestionId)) return res.status(404).json({ error: 'suggestion not found' });
  if (!['saved', 'dismissed', 'started', 'helpful', 'irrelevant'].includes(action)) return res.status(400).json({ error: 'action is invalid' });
  if (interventionId !== null && !getIntervention.get(interventionId, req.user.id)) return res.status(400).json({ error: 'linked intervention not found' });
  const feedback = saveSuggestionFeedback.get({ userId: req.user.id, suggestionId, action, interventionId, now: new Date().toISOString() });
  res.status(201).json({ feedback, ranking: rankSuggestions(SUGGESTIONS, getSuggestionFeedback.all(req.user.id), rankingOutcomes(req.user.id), req.user.id) });
});
app.post('/api/simulations/what-if', (req, res) => {
  const interventionId = Number(req.body.interventionId), metricName = req.body.metric, adjustmentPercent = Number(req.body.adjustmentPercent);
  const row = getIntervention.get(interventionId, req.user.id);
  if (!row) return res.status(404).json({ error: 'intervention not found' });
  if (!interventionMetrics.has(metricName)) return res.status(400).json({ error: 'metric is not supported' });
  if (!Number.isFinite(adjustmentPercent) || adjustmentPercent < -50 || adjustmentPercent > 50) return res.status(400).json({ error: 'adjustmentPercent must be from -50 to 50' });
  const metric = outcomeFor(row, req.user.id).metrics.find(item => item.metric === metricName);
  if (!metric || metric.status !== 'available') return res.status(409).json({ error: 'reliable observed outcome is required for this metric' });
  const simulatedValue = Math.round(metric.after.average * (1 + adjustmentPercent / 100) * 10) / 10;
  res.json({ simulation: { label: 'Simulation', persisted: false, metric: metricName, original: { value: metric.after.average, source: 'observed after-window average' }, simulated: { value: simulatedValue }, changedInputs: { adjustmentPercent }, assumptions: ['Only selected observed average changes; all other inputs stay constant.', 'Calculation is arithmetic, not a prediction.'], limitations: ['Hypothetical result is not saved.', 'Simulation does not establish or guarantee a health outcome.'] } });
});

const careRows = rows => rows.map(row => ({ ...row, services: row.services.split('|'), isDemo: Boolean(row.isDemo), freshness: daysBetween(row.verifiedAt, todayDate()) > 180 ? 'stale' : 'current' }));
app.get('/api/care/search', (req, res) => {
  const value = name => typeof req.query[name] === 'string' ? req.query[name].trim().toLowerCase() : '';
  const need=value('need'),location=value('location'),specialty=value('specialty');
  if ([need,location,specialty].some(item => item.length > 80)) return res.status(400).json({ error: 'filters must be at most 80 characters' });
  const params={need,location,specialty,needLike:`%${need}%`,locationLike:`%${location}%`,specialtyLike:`%${specialty}%`};
  const facilities=searchClinics.all({need,location,needLike:params.needLike,locationLike:params.locationLike}).map(row=>({...row,type:'facility',services:row.services.split('|'),isDemo:Boolean(row.isDemo),freshness:daysBetween(row.verifiedAt,todayDate())>180?'stale':'current'}));
  const doctors=careRows(searchCare.all(params)).map(row=>({...row,type:'doctor'}));
  res.json({ facilities, doctors, results:[...facilities,...doctors], disclaimer: 'Spreadsheet directory records only. Confirm details with the listed source before seeking care.' });
});
app.get('/api/care/doctors/:id', (req, res) => { const rows=getDoctorProfile.all(Number(req.params.id));if(!rows.length)return res.status(404).json({error:'doctor not found'});const clean=careRows(rows);res.json({doctor:{...clean[0],clinics:clean.map(({clinicId,clinicName,address,city,region,postalCode})=>({id:clinicId,name:clinicName,address,city,region,postalCode}))}}); });
app.get('/api/care/clinics/:id', (req, res) => { const clinic=getClinicProfile.get(Number(req.params.id));if(!clinic)return res.status(404).json({error:'clinic not found'});res.json({clinic:{...clinic,services:clinic.services.split('|'),isDemo:Boolean(clinic.isDemo),freshness:daysBetween(clinic.verifiedAt,todayDate())>180?'stale':'current',doctors:careRows(getClinicDoctors.all(clinic.id))}}); });
app.get('/api/care/preferred', (req, res) => { const rows=getSavedSpecialist.all(req.user.id),clean=careRows(rows);res.json({specialist:clean.length?{...clean[0],clinics:clean.map(row=>({id:row.clinicId,name:row.clinicName}))}:null}); });
app.put('/api/care/preferred', (req, res) => { const doctorId=Number(req.body.doctorId),rows=getDoctorProfile.all(doctorId);if(!Number.isInteger(doctorId)||!rows.length)return res.status(400).json({error:'verified doctorId is required'});saveSpecialist.run(req.user.id,doctorId,new Date().toISOString());const clean=careRows(rows);res.json({specialist:{...clean[0],clinics:clean.map(row=>({id:row.clinicId,name:row.clinicName}))}}); });
app.delete('/api/care/preferred', (req, res) => { deleteSavedSpecialist.run(req.user.id);res.status(204).end(); });

const parseSummaryDraft = row => row && ({ ...row, selectedDomains: JSON.parse(row.selectedDomainsJson), structured: JSON.parse(row.structuredJson), sourceReferences: JSON.parse(row.sourceReferencesJson), selectedDomainsJson: undefined, structuredJson: undefined, sourceReferencesJson: undefined });
const parseSummaryVersion = row => row && ({ ...row, selectedDomains: JSON.parse(row.selectedDomainsJson), structured: JSON.parse(row.structuredJson), sourceReferences: JSON.parse(row.sourceReferencesJson), selectedDomainsJson: undefined, structuredJson: undefined, sourceReferencesJson: undefined });
function summarySelection(body) {
  const domains = body.domains, startDate = body.startDate, endDate = body.endDate, specialistId = body.specialistId == null ? null : Number(body.specialistId);
  if (!Array.isArray(domains) || !domains.length || domains.length > HEALTH_SUMMARY_DOMAINS.size || new Set(domains).size !== domains.length || domains.some(domain => !HEALTH_SUMMARY_DOMAINS.has(domain))) return { error: 'domains must contain unique supported domains' };
  if (!validDateOnly(startDate) || !validDateOnly(endDate) || endDate < startDate || endDate > todayDate() || daysBetween(startDate, endDate) > 365) return { error: 'date range must be ordered, non-future, and at most 366 days' };
  if (specialistId !== null && (!Number.isInteger(specialistId) || !getDoctorProfile.all(specialistId).length)) return { error: 'specialistId must identify a verified specialist' };
  return { value: { domains, startDate, endDate, specialistId } };
}
function summaryRecords(userId, startDate) {
  return { checkins: getCheckins.all(userId, 1000).map(item => ({ ...item, symptoms: JSON.parse(item.symptoms) })), cycles: getCycles.all(userId, 1000), sleep: getSleepRecords.all(userId, 1000).map(item => ({ ...item, score: calculateSleepWellness(item).score })), wearable: getDailyWearableAnalytics.all(userId, `${startDate}T00:00:00.000Z`), water: getWaterIntakeRange.all(userId, startDate), meals: getMealsRange.all(userId, startDate), goals: getGoals.all(userId), interventions: getInterventions.all(userId).map(parseIntervention) };
}
app.post('/api/health-summaries/drafts', (req, res) => {
  const parsed=summarySelection(req.body);if(parsed.error)return res.status(400).json({error:parsed.error});const value=parsed.value,summary=buildHealthSummary({...value,records:summaryRecords(req.user.id,value.startDate)}),now=new Date().toISOString();
  const result=createSummaryDraft.get({userId:req.user.id,domainsJson:JSON.stringify(value.domains),startDate:value.startDate,endDate:value.endDate,draftText:summary.text,structuredJson:JSON.stringify(summary),sourcesJson:JSON.stringify(summary.sources),specialistId:value.specialistId,now});
  res.status(201).json({draft:parseSummaryDraft(getSummaryDraft.get(result.id,req.user.id))});
});
app.put('/api/health-summaries/drafts/:id', (req, res) => {
  const id=Number(req.params.id),draftText=typeof req.body.draftText==='string'?req.body.draftText.trim():'',specialistId=req.body.specialistId==null?null:Number(req.body.specialistId);
  if(!draftText||draftText.length>20000)return res.status(400).json({error:'draftText must be 1 to 20000 characters'});if(specialistId!==null&&(!Number.isInteger(specialistId)||!getDoctorProfile.all(specialistId).length))return res.status(400).json({error:'specialistId must identify a verified specialist'});
  if(!updateSummaryDraft.get({id,userId:req.user.id,draftText,specialistId,now:new Date().toISOString()}))return res.status(404).json({error:'draft not found'});res.json({draft:parseSummaryDraft(getSummaryDraft.get(id,req.user.id))});
});
app.get('/api/health-summaries/drafts/:id/preview', (req, res) => { const draft=parseSummaryDraft(getSummaryDraft.get(Number(req.params.id),req.user.id));if(!draft)return res.status(404).json({error:'draft not found'});res.json({preview:{...draft,status:'unapproved',handoffUnlocked:false,disclaimer:'Preview only. Approval is required before contact controls become available.'}}); });
app.post('/api/health-summaries/drafts/:id/approve', (req, res) => {
  if(req.body.confirm!==true)return res.status(400).json({error:'explicit approval confirmation is required'});const draft=getSummaryDraft.get(Number(req.params.id),req.user.id);if(!draft)return res.status(404).json({error:'draft not found'});const approvedAt=new Date().toISOString(),versionNumber=nextSummaryVersion.get(draft.id,req.user.id).number;
  const result=approveSummaryVersion.get({draftId:draft.id,userId:req.user.id,versionNumber,selectedDomainsJson:draft.selectedDomainsJson,startDate:draft.startDate,endDate:draft.endDate,approvedText:draft.draftText,structuredJson:draft.structuredJson,sourceReferencesJson:draft.sourceReferencesJson,specialistId:draft.specialistId,approvedAt});res.status(201).json({version:parseSummaryVersion(getSummaryVersion.get(result.id,req.user.id)),handoffUnlocked:true});
});
app.get('/api/health-summaries/versions', (req, res) => res.json({versions:getSummaryVersions.all(req.user.id).map(parseSummaryVersion)}));
app.get('/api/health-summaries/versions/:id', (req, res) => {const version=parseSummaryVersion(getSummaryVersion.get(Number(req.params.id),req.user.id));if(!version)return res.status(404).json({error:'approved version not found'});res.json({version,handoffUnlocked:true});});
app.get('/api/health-summaries/versions/:id/handoff', (req, res) => {
  const version=getSummaryVersion.get(Number(req.params.id),req.user.id);
  if(!version)return res.status(404).json({error:'approved version not found'});
  if(!version.specialistId)return res.status(409).json({error:'approved version has no linked specialist'});
  const rows=getDoctorProfile.all(version.specialistId);
  if(!rows.length)return res.status(409).json({error:'linked specialist is no longer verified'});
  const doctor=rows[0],links=buildVerifiedContactLinks({phone:doctor.publicPhone||doctor.clinicPhone,email:doctor.publicEmail||doctor.clinicEmail,website:doctor.publicWebsite||doctor.clinicWebsite});
  res.json({specialist:{id:doctor.id,displayName:doctor.displayName,specialty:doctor.specialty,verifiedAt:doctor.verifiedAt,links},notice:'No health summary was transmitted. Contact actions only open your device application.'});
});

app.post('/api/wearable/readings', (req, res) => {
  const normalized = normalizeWearableReading(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const reading = normalized.reading;
  const owner = getDeviceOwner.get(reading.deviceId);
  if (!owner) return res.status(409).json({ error: 'device must be connected to an account' });
  const previous = getLastDeviceReading.get(reading.deviceId);
  const duplicate = previous && reading.uptimeMs === previous.uptimeMs
    && reading.wearing === Boolean(previous.wearing) && reading.heartRate === previous.heartRate
    && reading.heartRateValid === Boolean(previous.heartRateValid) && reading.spo2 === previous.spo2
    && reading.activity === previous.activity && reading.movementLevel === previous.movementLevel;
  if (duplicate) return res.status(200).json({ accepted: true, duplicate: true, reading: { ...reading, userId: owner.userId } });

  reading.userId = owner.userId;
  insertReading.run({
    ...reading,
    wearing: Number(reading.wearing),
    heartRateValid: Number(reading.heartRateValid),
    qualityValid: Number(reading.qualityValid),
    qualityIssues: JSON.stringify(reading.qualityIssues)
  });

  res.status(201).json({ accepted: true, reading });
});

app.get('/api/wearable/latest', (req, res) => {
  const reading = getLatestReading.get(req.user.id);
  if (!reading) return res.status(404).json({ error: 'No wearable reading received' });
  res.json({ ...reading, wearing: Boolean(reading.wearing), heartRateValid: Boolean(reading.heartRateValid), qualityValid: Boolean(reading.qualityValid), qualityIssues: JSON.parse(reading.qualityIssues) });
});

app.get('/api/wearable/history', (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 500) : 100;
  const deviceId = typeof req.query.deviceId === 'string' && req.query.deviceId.trim() ? req.query.deviceId.trim() : null;
  const readings = getReadingHistory.all({ userId: req.user.id, deviceId, limit }).reverse().map(reading => ({
    ...reading,
    wearing: Boolean(reading.wearing),
    heartRateValid: Boolean(reading.heartRateValid),
    qualityValid: Boolean(reading.qualityValid),
    qualityIssues: JSON.parse(reading.qualityIssues)
  }));
  res.json({ readings, count: readings.length });
});

app.post('/api/checkins', (req, res) => {
  const { date, mood, stress, energy, sleep, hydration, symptoms = [], notes = '' } = req.body, userId = req.user.id;
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
  const userId = req.user.id;
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 30;
  const checkins = getCheckins.all(userId, limit).map(checkin => ({ ...checkin, symptoms: JSON.parse(checkin.symptoms) }));
  res.json({ checkins, count: checkins.length });
});

app.put('/api/sleep/:userId', (req, res) => {
  const userId = req.user.id;
  const values = { ...req.body, userId };
  const error = validateSleepInput(values);
  if (error) return res.status(400).json({ error });
  const record = saveSleepRecord.get({ ...values, notes: values.notes.trim(), now: new Date().toISOString() });
  res.json({ record, sws: calculateSleepWellness(record), disclaimer: 'Sleep Wellness Score summarizes self-reported sleep information and is not a medical assessment.' });
});

app.get('/api/sleep/:userId', (req, res) => {
  const userId = req.user.id;
  const requestedLimit = Number.parseInt(req.query.limit, 10);
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 90) : 30;
  const records = getSleepRecords.all(userId, limit).map(record => ({ ...record, sws: calculateSleepWellness(record) }));
  res.json({ records, count: records.length, disclaimer: 'Sleep records and scores are self-reported wellness summaries, not diagnoses or clinical sleep measurements.' });
});

app.get('/api/sleep/:userId/assessment', async (req, res) => {
  const userId = req.user.id;
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  const records = getSleepRecords.all(userId, 14).map(record => ({ date: record.date, bedtime: record.bedtime, estimatedSleepTime: record.estimatedSleepTime, wakeTime: record.wakeTime, sleepQuality: record.sleepQuality, morningRestedness: record.morningRestedness, sleepOnsetDifficulty: record.sleepOnsetDifficulty, nighttimeAwakenings: record.nighttimeAwakenings, sleepDisturbances: record.sleepDisturbances, morningSleepiness: record.morningSleepiness, scheduleConsistency: record.scheduleConsistency, sws: calculateSleepWellness(record).score }));
  if (!records.length) return res.status(404).json({ error: 'Add a sleep log before requesting an assessment' });
  const dataSignature = createHash('sha256').update(JSON.stringify(records)).digest('hex');
  const cached = getSleepAssessment.get(userId);
  if (cached?.dataSignature === dataSignature) return res.json({ summary: cached.summary, confidence: cached.confidence, recordsReviewed: cached.recordsReviewed, generatedAt: cached.createdAt, cached: true, disclaimer: 'AI-generated summary of self-reported wellness data. Not a diagnosis or clinical sleep assessment.' });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'AI assessment is not configured' });
  const now = Date.now(), ip = `sleep:${req.ip}`, recent = (assistantRequests.get(ip) || []).filter(time => now - time < 60000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  recent.push(now); assistantRequests.set(ip, recent);
  const completeRecords = records.filter(record => record.sws !== null).length;
  const confidence = completeRecords >= 7 ? 'high' : completeRecords >= 3 ? 'moderate' : 'limited';
  const system = `You are HERA's bounded sleep wellness summarizer. Using only supplied self-reported sleep records, write 2 concise plain-text sentences: first summarize supported patterns; second give one gentle practical wellness suggestion. Never diagnose, infer a disorder, prescribe treatment, claim causation, or invent missing data. Mention limited data when fewer than 3 complete records exist. No Markdown. Sleep records: ${JSON.stringify(records)}`;
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b', temperature: 0.25, max_completion_tokens: 500, messages: [{ role: 'system', content: system }, { role: 'user', content: 'Summarize my recent sleep pattern.' }] }), signal: AbortSignal.timeout(15000) });
    if (!response.ok) return res.status(502).json({ error: 'AI service is temporarily unavailable' });
    const summary = (await response.json()).choices?.[0]?.message?.content?.trim().replace(/[*#`]/g, '');
    if (!summary) return res.status(502).json({ error: 'AI service returned no assessment' });
    const createdAt = new Date().toISOString();
    saveSleepAssessment.run({ userId, dataSignature, summary, confidence, recordsReviewed: records.length, createdAt });
    res.json({ summary, confidence, recordsReviewed: records.length, generatedAt: createdAt, cached: false, disclaimer: 'AI-generated summary of self-reported wellness data. Not a diagnosis or clinical sleep assessment.' });
  } catch {
    res.status(502).json({ error: 'AI service is temporarily unavailable' });
  }
});

app.get('/api/analytics/:userId', (req, res) => {
  const userId = req.user.id;
  const days = Number.parseInt(req.query.days, 10);
  if (![1, 7, 30, 90].includes(days)) return res.status(400).json({ error: 'days must be 1, 7, 30, or 90' });
  const sinceDate = addDays(todayDate(), 1 - days);
  const since = `${sinceDate}T00:00:00.000Z`;
  const wellnessCheckins = items => items.map(item => {
    const symptoms = JSON.parse(item.symptoms);
    const wellness = Math.round(((item.mood - 1 + (5 - item.stress) + item.energy - 1 + item.sleep - 1 + item.hydration - 1) / 20) * 100);
    return { date: item.date, mood: item.mood, sleep: item.sleep, wellness, symptoms };
  });
  const allCheckins = getCheckins.all(userId, 100).reverse();
  const checkins = wellnessCheckins(allCheckins.filter(item => item.date >= sinceDate));
  const cycles = getCycles.all(userId, 100).filter(item => item.startDate >= sinceDate).reverse();
  const cycleIntervals = cycles.slice(1).map((cycle, index) => ({ date: cycle.startDate, days: daysBetween(cycles[index].startDate, cycle.startDate) })).filter(item => item.days >= 15 && item.days <= 60);
  const symptomCounts = {};
  checkins.flatMap(item => item.symptoms).forEach(symptom => { symptomCounts[symptom] = (symptomCounts[symptom] || 0) + 1; });
  const wearable = getDailyWearableAnalytics.all(userId, since);
  const activity = addActivityBaseline(aggregateActivity(getActivityReadings.all(userId, since)));
  const baselineSinceDate = addDays(todayDate(), -30), baselineSince = `${baselineSinceDate}T00:00:00.000Z`;
  const baselineWearable = getDailyWearableAnalytics.all(userId, baselineSince);
  const baselineActivity = aggregateActivity(getActivityReadings.all(userId, baselineSince));
  const baselineCheckins = wellnessCheckins(allCheckins.filter(item => item.date >= baselineSinceDate));
  const baselineSleep = getSleepRecords.all(userId, 31).filter(item => item.date >= baselineSinceDate).reverse().map(item => ({ date: item.date, sws: calculateSleepWellness(item).score }));
  const baselineWater = getWaterIntakeRange.all(userId, baselineSinceDate);
  const baselineMeals = getMealsRange.all(userId, baselineSinceDate), caloriesByDate = new Map();
  for (const meal of baselineMeals) if (meal.calories != null) caloriesByDate.set(meal.eatenAt.slice(0, 10), (caloriesByDate.get(meal.eatenAt.slice(0, 10)) || 0) + meal.calories);
  const series = {
    heartRate: baselineWearable.map(item => ({ date: item.date, value: item.heartRate, reliable: item.wornReadings > 0 && item.heartRate != null })),
    spo2: baselineWearable.map(item => ({ date: item.date, value: item.spo2, reliable: item.wornReadings > 0 && item.spo2 != null })),
    movementLevel: baselineWearable.map(item => ({ date: item.date, value: item.movementLevel, reliable: item.wornReadings > 0 && item.movementLevel != null })),
    activityLoadIndex: baselineActivity.map(item => ({ date: item.date, value: item.activityLoadIndex, reliable: item.wornMinutes >= 10 })),
    wellness: baselineCheckins.map(item => ({ date: item.date, value: item.wellness })),
    sleepWellness: baselineSleep.map(item => ({ date: item.date, value: item.sws, reliable: item.sws != null })),
    hydration: baselineWater.map(item => ({ date: item.date, value: item.milliliters })),
    calories: [...caloriesByDate].map(([date, value]) => ({ date, value }))
  };
  const baselines = buildPersonalBaselines(series);
  const quality = { reliableWearableDays: baselineWearable.filter(item => item.wornReadings > 0).length, checkinDays: baselineCheckins.length, sleepDays: baselineSleep.filter(item => item.sws != null).length, hydrationDays: baselineWater.length, mealDays: caloriesByDate.size, windowDays: 31 };
  const patterns = buildPatterns({ baselines, series, symptoms: baselineCheckins, quality });
  const signature = createHash('sha256').update(JSON.stringify({ insights: patterns.insights, trends: patterns.trends, relationships: patterns.relationships })).digest('hex');
  savePredictionSnapshot.run(userId, todayDate(), patterns.algorithmVersion, signature, JSON.stringify(patterns), patterns.generatedAt);
  const predictionHistory = getPredictionSnapshots.all(userId, 5).map(item => ({ ...item, result: JSON.parse(item.resultJson), resultJson: undefined }));
  patterns.stability = predictionHistory.length < 2 ? { status: 'new', message: 'No earlier comparable result.' } : predictionHistory[0].result.insights.map(item => item.id).join('|') === predictionHistory[1].result.insights.map(item => item.id).join('|') ? { status: 'stable', message: 'Current insight set matches the previous saved version.' } : { status: 'changed', message: 'Current insight set differs from the previous saved version.' };
  res.json({ rangeDays: days, checkins, wearable, activity, cycles, cycleIntervals, symptomCounts, baselines, patterns, predictionHistory: predictionHistory.map(item => ({ date: item.date, algorithmVersion: item.algorithmVersion, createdAt: item.createdAt, insightCount: item.result.insights.length })), coverage: { checkinDays: checkins.length, wearableDays: wearable.length, cycleStarts: cycles.length }, disclaimer: 'Charts summarize stored HERA observations and self-reports. Personal ranges are informational comparisons, not medical reference ranges or diagnoses.' });
});

app.get('/api/timeline', (req, res) => {
  const days = Number.parseInt(req.query.days, 10);
  if (![7, 30, 90].includes(days)) return res.status(400).json({ error: 'days must be 7, 30, or 90' });
  const since = new Date(Date.now() - (days - 1) * DAY_MS).toISOString(), sinceDate = since.slice(0, 10), userId = req.user.id;
  const checkins = getCheckins.all(userId, 100).filter(item => item.date >= sinceDate).map(item => ({ ...item, symptoms: JSON.parse(item.symptoms) }));
  const cycles = getCycles.all(userId, 100).filter(item => item.startDate >= sinceDate);
  const sleep = getSleepRecords.all(userId, 90).filter(item => item.date >= sinceDate).map(item => ({ ...item, sws: calculateSleepWellness(item) }));
  const wearable = getDailyWearableAnalytics.all(userId, since);
  const activity = addActivityBaseline(aggregateActivity(getActivityReadings.all(userId, since)));
  const interventions = getInterventions.all(userId).map(row => { const item = parseIntervention(row); return { ...item, feedback: getInterventionFeedback.all(item.id, userId), outcome: addDays(item.endDate, item.comparisonWindowDays) <= todayDate() ? outcomeFor(row, userId) : null }; });
  const events = buildWellnessTimeline({ checkins, cycles, sleep, wearable, activity, meals: getMealsRange.all(userId, sinceDate), water: getWaterIntakeRange.all(userId, sinceDate), goals: getGoals.all(userId), interventions, approvedSummaries: getSummaryVersions.all(userId), assessment: getSleepAssessment.get(userId) }, sinceDate);
  res.json({ rangeDays: days, events, count: events.length, disclaimer: 'Timeline combines stored observations and self-reports. It does not diagnose conditions or establish causes.' });
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
  const userId = req.user.id;
  const checkins = getCheckins.all(userId, 7).map(item => ({ date: item.date, mood: item.mood, stress: item.stress, energy: item.energy, sleep: item.sleep, hydration: item.hydration, symptoms: JSON.parse(item.symptoms) }));
  const cycles = getCycles.all(userId, 6), cycle = cycleSummary(cycles);
  const sinceDate = addDays(todayDate(), -29), since = `${sinceDate}T00:00:00.000Z`;
  const checkinHistory = getCheckins.all(userId, 100).filter(item => item.date >= sinceDate).map(item => ({ ...item, symptoms: JSON.parse(item.symptoms), wellness: Math.round(((item.mood - 1 + (5 - item.stress) + item.energy - 1 + item.sleep - 1 + item.hydration - 1) / 20) * 100) }));
  const wearable = getDailyWearableAnalytics.all(userId, since);
  const activity = addActivityBaseline(aggregateActivity(getActivityReadings.all(userId, since))), latestActivity = activity.at(-1) || null;
  const sleepRecords = getSleepRecords.all(userId, 30).filter(item => item.date >= sinceDate), latestSleep = sleepRecords[0] || null;
  const waterHistory = getWaterIntakeRange.all(userId, sinceDate), meals = getMealsRange.all(userId, sinceDate);
  const goals = getGoals.all(userId).filter(item => item.status === 'active').slice(0, 5).map(item => { const goal = withGoalProgress(item, userId); return { title: goal.title, metric: goal.metric, targetValue: goal.targetValue, unit: goal.unit, latestProgress: goal.progress.current }; });
  const interventions = getInterventions.all(userId).slice(0, 5).map(parseIntervention).map(item => ({ title: item.title, status: item.status, metrics: item.metrics, startDate: item.startDate, endDate: item.endDate }));
  const water = getWaterIntake.get(userId, todayDate()) || null;
  const latest = checkins[0] || null;
  const wellness = latest ? Math.round(((latest.mood - 1 + (5 - latest.stress) + latest.energy - 1 + latest.sleep - 1 + latest.hydration - 1) / 20) * 100) : null;
  const average = values => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
  const symptomFrequency = Object.fromEntries([...checkinHistory.flatMap(item => item.symptoms).reduce((counts, symptom) => counts.set(symptom, (counts.get(symptom) || 0) + 1), new Map())].sort((a, b) => b[1] - a[1]).slice(0, 8));
  const personalRanges = buildPersonalBaselines({ heartRate: wearable.map(item => ({ date: item.date, value: item.heartRate, reliable: item.wornReadings > 0 })), spo2: wearable.map(item => ({ date: item.date, value: item.spo2, reliable: item.wornReadings > 0 })), movementLevel: wearable.map(item => ({ date: item.date, value: item.movementLevel, reliable: item.wornReadings > 0 })), activityLoadIndex: activity.map(item => ({ date: item.date, value: item.activityLoadIndex, reliable: item.wornMinutes >= 10 })), wellness: checkinHistory.map(item => ({ date: item.date, value: item.wellness })) });
  const context = { asOf: new Date().toISOString(), periodDays: 30, latestCheckin: latest, recentCheckins: checkins, checkinSummary: { recordedDays: checkinHistory.length, averageWellness: average(checkinHistory.map(item => item.wellness)), symptomFrequency }, wellnessScore: wellness, personalRanges, hydration: { waterTodayMilliliters: water?.milliliters ?? null, waterRecordedToday: Boolean(water?.updatedAt), averageRecordedMilliliters: average(waterHistory.map(item => item.milliliters)), recordedDays: waterHistory.length, generalTargetMilliliters: 2000 }, cycle: { cycleDay: cycle.cycleDay, currentEstimatedPhase: cycle.currentEstimatedPhase, phaseModel: cycle.phaseModel, predictionAvailable: cycle.predictionAvailable, averageCycleLength: cycle.averageCycleLength, variabilityDays: cycle.variabilityDays, predictedStart: cycle.predictedStart, predictedRange: cycle.predictedRange, recordedStarts: cycles.map(item => item.startDate) }, wearable: { latestDailyAverage: wearable.at(-1) || null, recordedDays: wearable.length, thirtyDayAverage: { heartRate: average(wearable.map(item => item.heartRate).filter(Number.isFinite)), spo2: average(wearable.map(item => item.spo2).filter(Number.isFinite)), movementLevel: average(wearable.map(item => item.movementLevel).filter(Number.isFinite)) } }, activity: latestActivity ? { latestLoadIndex: latestActivity.activityLoadIndex, wornMinutes: latestActivity.wornMinutes, personalBaseline: latestActivity.baseline, baselineStatus: latestActivity.baselineStatus, balance: latestActivity.activityBalance, recordedDays: activity.length } : null, sleep: latestSleep ? { latest: { date: latestSleep.date, score: calculateSleepWellness(latestSleep).score, quality: latestSleep.sleepQuality, restedness: latestSleep.morningRestedness, bedtime: latestSleep.bedtime, wakeTime: latestSleep.wakeTime }, averageScore: average(sleepRecords.map(item => calculateSleepWellness(item).score).filter(Number.isFinite)), recordedDays: sleepRecords.length } : null, nutrition: { recordedMeals: meals.length, recordedDays: new Set(meals.map(item => item.eatenAt.slice(0, 10))).size, averageDailyCalories: average([...meals.reduce((days, item) => days.set(item.eatenAt.slice(0, 10), (days.get(item.eatenAt.slice(0, 10)) || 0) + (item.calories || 0)), new Map()).values()]) }, activeGoals: goals, recentInterventions: interventions, unavailableDataMustRemainUnavailable: true };
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
  const userId = req.user.id;
  if (!Number.isInteger(userId) || userId < 1) return res.status(400).json({ error: 'userId must be a positive integer' });
  const checkin = getLatestCheckin.get(userId);
  if (!checkin) return res.status(404).json({ error: 'No daily check-in available' });
  const score = Math.round(((checkin.mood - 1 + (5 - checkin.stress) + checkin.energy - 1 + checkin.sleep - 1 + checkin.hydration - 1) / 20) * 100);
  const label = score >= 75 ? 'Feeling strong' : score >= 50 ? 'Balanced' : score >= 25 ? 'Needs care' : 'Low self-report';
  res.json({ score, label, checkinDate: checkin.date, components: { mood: checkin.mood, stress: checkin.stress, energy: checkin.energy, sleep: checkin.sleep, hydration: checkin.hydration }, disclaimer: 'Wellness score summarizes self-reported check-in values and is not a medical assessment.' });
});

app.get('/api/nutrition/:userId', (req, res) => {
  const userId = req.user.id;
  const date = todayDate();
  const water = getWaterIntake.get(userId, date) || { userId, date, milliliters: 0, updatedAt: null };
  const checkin = getLatestCheckin.get(userId) || null;
  const wearable = getTodayWearableContext.get(userId, date) || null;
  const recentActivity = getRecentActivityContext.get(userId, `${addDays(date, -6)}T00:00:00.000Z`);
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
  const userId = req.user.id;
  const { date, milliliters } = req.body;
  if (!validDateOnly(date) || date > todayDate()) return res.status(400).json({ error: 'date must be a valid non-future YYYY-MM-DD date' });
  if (!Number.isInteger(milliliters) || milliliters < 0 || milliliters > 10000) return res.status(400).json({ error: 'milliliters must be an integer from 0 to 10000' });
  const water = saveWaterIntake.get({ userId, date, milliliters, now: new Date().toISOString() });
  res.json({ water });
});

app.get('/api/meals', (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : todayDate();
  if (!validDateOnly(date)) return res.status(400).json({ error: 'date must be a valid YYYY-MM-DD date' });
  const meals = getMeals.all(req.user.id, date);
  const totals = meals.reduce((sum, meal) => {
    for (const key of ['calories', 'proteinG', 'carbsG', 'fatG']) sum[key] = Math.round((sum[key] + (meal[key] ?? 0)) * 10) / 10;
    return sum;
  }, { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  res.json({ date, meals, totals });
});

app.post('/api/meals/assess-image', async (req, res) => {
  const image = typeof req.body.image === 'string' ? req.body.image : '';
  if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(image)) return res.status(400).json({ error: 'image must be a JPEG, PNG, or WebP file' });
  if (Buffer.byteLength(image, 'utf8') > 4_200_000) return res.status(413).json({ error: 'image must be smaller than 3 MB' });
  if (!process.env.GROQ_API_KEY) return res.status(503).json({ error: 'AI food assessment is not configured' });
  if (!process.env.GROQ_VISION_MODEL) return res.status(503).json({ error: 'Groq vision is not available for this account. Enter meal details manually.' });
  const now = Date.now(), key = `food:${req.user.id}`, recent = (assistantRequests.get(key) || []).filter(time => now - time < 60000);
  if (recent.length >= 5) return res.status(429).json({ error: 'Too many image assessments. Try again in a minute.' });
  recent.push(now); assistantRequests.set(key, recent);
  const prompt = 'Inspect this meal photo. Return only one JSON object with keys foodName, portionAmount, portionUnit, calories, proteinG, carbsG, fatG, notes, confidence. Use null for values that cannot be estimated. confidence must be low, medium, or high. Keep notes under 180 characters and state that values are visual estimates. Never identify medical conditions.';
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.GROQ_VISION_MODEL, temperature: 0.1, max_completion_tokens: 400, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: image } }] }] }), signal: AbortSignal.timeout(25000) });
    if (!response.ok) {
      const provider = await response.json().catch(() => ({}));
      const unavailable = response.status === 400 || response.status === 404;
      console.error('Groq food image assessment failed:', response.status, provider.error?.code || 'provider_error');
      return res.status(502).json({ error: unavailable ? 'Configured Groq model does not support image assessment. Enter meal details manually.' : 'AI image assessment is temporarily unavailable' });
    }
    const content = (await response.json()).choices?.[0]?.message?.content;
    const draft = JSON.parse(content || '{}');
    const number = (value, max) => Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max ? Math.round(Number(value) * 10) / 10 : null;
    res.json({ draft: { foodName: typeof draft.foodName === 'string' ? draft.foodName.trim().slice(0, 120) : '', portionAmount: number(draft.portionAmount, 10000), portionUnit: typeof draft.portionUnit === 'string' ? draft.portionUnit.trim().slice(0, 30) : '', calories: number(draft.calories, 10000), proteinG: number(draft.proteinG, 1000), carbsG: number(draft.carbsG, 2000), fatG: number(draft.fatG, 1000), notes: typeof draft.notes === 'string' ? draft.notes.trim().slice(0, 500) : 'AI visual estimate. Review before saving.', confidence: ['low', 'medium', 'high'].includes(draft.confidence) ? draft.confidence : 'low' }, disclaimer: 'AI estimates from photos can be inaccurate. Review and edit every field before saving.' });
  } catch {
    res.status(502).json({ error: 'AI image assessment is temporarily unavailable' });
  }
});

app.post('/api/meals', (req, res) => {
  const normalized = normalizeMealInput(req.body);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const meal = createMeal.get({ userId: req.user.id, ...normalized.meal, now: new Date().toISOString() });
  res.status(201).json({ meal });
});

app.put('/api/meals/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10), normalized = normalizeMealInput(req.body);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'meal id must be a positive integer' });
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const meal = updateMeal.get({ id, userId: req.user.id, ...normalized.meal, now: new Date().toISOString() });
  if (!meal) return res.status(404).json({ error: 'meal not found' });
  res.json({ meal });
});

app.delete('/api/meals/:id', (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'meal id must be a positive integer' });
  if (!deleteMeal.run(id, req.user.id).changes) return res.status(404).json({ error: 'meal not found' });
  res.status(204).end();
});

app.post('/api/cycles', (req, res) => {
  const { startDate, endDate = null, notes = '' } = req.body, userId = req.user.id;
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
  const { startDate, endDate = null, notes = '' } = req.body, userId = req.user.id;
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'valid id is required' });
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
  if (!deleteCycle.run(id, req.user.id).changes) return res.status(404).json({ error: 'cycle not found' });
  res.status(204).end();
});

app.get('/api/cycles/:userId', (req, res) => {
  const userId = req.user.id;
  const requestedLimit = Number.parseInt(req.query.limit, 10);
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
