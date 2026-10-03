HERA Features
Feature	How it works
Personalized Baseline Learning	Learns the user’s normal patterns for heart rate, activity, sleep, cycle, symptoms, and nutrition. It updates the baseline as reliable new data are added.
Personal Physiological Digital Twin	Builds a personal health profile from past measurements and compares current readings with the user’s own normal pattern.
Personalized Trend Forecasting	Looks at past data to show whether a health measure is stable, increasing, decreasing, or changing, and estimates its short-term direction.
Prediction Stability Monitor	Checks whether a new prediction changes greatly from the previous one and flags predictions that become less stable.
Symptom–Sensor Discrepancy Detector	Compares reported symptoms with wearable data, activity, and sleep to identify patterns that do not match the user’s usual readings.
Multi-Parameter Anomaly Detection	Checks several health measures together, such as heart rate, activity, sleep, symptoms, and cycle timing, to find unusual combinations.
Early Pattern-Deviation Detection	Compares recent patterns with the user’s baseline and flags meaningful changes before they become large.
Pattern Recurrence Detection	Checks whether a current combination of symptoms and measurements is similar to a pattern the user experienced before.
Cycle-Phase Physiological Signature	Learns the user’s usual heart rate, activity, sleep, symptoms, and wellness patterns during each menstrual-cycle phase.
Cycle-to-Cycle Comparison	Compares the newest menstrual cycle with previous cycles and shows whether it is earlier, later, or within the expected range.
Cycle Pattern Change Detection	Looks across several past cycles to identify lasting changes in cycle length, timing, or symptoms.
Cycle Prediction Confidence	Shows how confident the system is about a predicted menstrual window based on the amount and consistency of cycle data.
Adaptive Cumulative ALI	Combines daily activity measurements into a cumulative Activity Load Index and updates it as more activity is recorded.
Activity Distribution Tracking	Shows how much time the user spends in each activity or intensity level throughout the day.
Personal Activity Baseline	Learns the user’s usual activity level and shows whether each new day is above, near, or below that level.
Personalized Recovery Curve	Tracks how the user’s body returns toward its usual baseline after activity and learns the user’s typical recovery pattern.
Recovery Pattern Change Detection	Compares current recovery with previous recovery patterns and flags meaningful changes.
Food Image Processing & Nutritional Breakdown	Uses a food photo to identify the food and estimate calories, protein, carbohydrates, and fat. The user can correct the entry before saving.
Portion-Size Estimation	Estimates the serving size shown in a food photo. If the size cannot be estimated reliably, the user can enter it manually.
Personalized Nutrition Learning	Learns from saved food entries to identify common foods and nutrition patterns and builds a personal nutrition baseline.
Confidence-Aware AI + Explanation	Provides a confidence level with each AI prediction or insight and briefly explains which data influenced the result.
Health Data Quality Detector	Checks health data for missing, impossible, noisy, duplicated, or inconsistent records before AI analysis.
Sensor-Fusion Intelligence	Combines wearable readings and user-entered information by time so the AI can analyze them together.
Counterfactual Health Insights	Lets the system test a hypothetical change in the model and compare the result with the original output. It is clearly marked as a simulation.
Intervention Effectiveness Tracker	Lets users record a wellness change and compare measurements before and after it over selected time periods.
Intervention Recommendation Ranking	Creates several relevant wellness suggestions and prioritizes them using the user’s data and previous responses.
Multimodal Personalized Wellness Timeline	Puts cycle events, symptoms, sensor readings, activity, sleep, nutrition, AI insights, and interventions into one timeline.
Personalized Healthcare & Clinic Matching	Lets users choose a healthcare need and location, then shows clinics that match those choices.
Personalized Clinic Profile	Shows available clinic details such as name, location, services, specialties, and contact information.
Personalized Doctor Profile	Shows available doctors and their specialties and provides profile information for comparison.
Specialist Selection & Saving	Lets the user choose a preferred doctor or specialist and save that choice to the HERA profile.
AI Health Summary Generator	Creates a short health summary from selected HERA records, including cycle history, symptoms, sensor trends, sleep, activity, and nutrition. The user can review and edit it.
mHealth Specialist Connection	After the user approves the health summary, HERA provides the available clinic contact method for communication.
Temporal Pattern Analyzer	Analyzes when changes happen, how long they last, and whether they continue across HERA records.
Cross-Parameter Relationship Mapper	Shows relationships between measures such as heart rate, SpO2, activity, sleep, nutrition, cycle phase, and symptoms.
Sleep-Activity Interaction Analyzer	Compares sleep with activity or ALI before and after sleep periods to identify supported relationships.
Nutrition-Physiology Association Engine	Compares nutrition with related measures such as sleep, activity, heart rate, and cycle phase over the same time periods.
Hydration Pattern Analysis	Tracks recorded water intake to show the user’s usual hydration pattern and changes over time.
Rest-Day Balance Tracking	Compares activity and rest periods to show changes in the user’s usual activity–rest pattern.
Wellness Goal Progress Tracking	Tracks selected wellness goals over time and compares current progress with previous progress.
Multi-Account User Profiles	Allows multiple users to have separate accounts on one device while keeping their health data and preferences separate.

Sleep Monitoring Features
Feature	How it works
Sleep Quality	Uses the existing 1–5 sleep-quality scale in the new Sleep Dashboard.
Morning Restedness	Uses a 1–5 scale to show how refreshed or tired the user feels in the morning.
Sleep-Onset Difficulty	Uses a 1–5 scale to show how difficult it was for the user to fall asleep.
Nighttime Awakenings	Uses a scale to show how often the user woke up during the night.
Sleep Disturbances	Uses a 1–5 scale to show how much disturbances affected the user’s sleep.
Morning Sleepiness	Uses a 1–5 scale to show how sleepy the user feels after waking.
Sleep Schedule	Allows the user to enter bedtime, estimated sleep time, wake-up time, and sleep-schedule consistency.
Sleep Wellness Score (SWS)	Combines the sleep inputs into one overall percentage score, similar to the HWS.
Sleep Pattern Assessment	Uses AI to review the collected sleep data and identify overall sleep patterns that may need attention.

---

# Implementation Plan and Feature Checklist

Audit date: 2026-09-28

Detailed screen placement and interaction design: [`docs/UI_UX_FEATURE_PLAN.md`](docs/UI_UX_FEATURE_PLAN.md)

## Status rules

- [x] **Done** — working storage, logic/API, and UI exist.
- [~] **Partial** — useful implementation exists, but feature definition is not complete.
- [ ] **Not started** — required feature-specific implementation does not exist.
- Runtime and hardware behavior still require testing. Documentation alone does not count as implementation.

## Delivery order

### Phase 1 — User and data foundation

- [x] Add authenticated user accounts and per-user authorization.
- [x] Remove hard-coded prototype user ID `1` as an authorization decision (legacy-shaped URLs remain temporarily compatible; server uses session owner).
- [x] Add additive database migrations for accounts, sessions, device assignment, and sensor ownership.
- [x] Bind `HERA-001` explicitly to an account; future telemetry resolves `device_id → user_id` server-side.
- [x] Normalize wearable timestamps, source/provenance, validity flags, impossible-value handling, and consecutive duplicate detection.
- [ ] Add consent, retention, export, and deletion controls before real-user deployment.

### Phase 2 — Sleep Dashboard

- [x] Add `sleep_records` storage and validated read/upsert API.
- [x] Build dedicated Sleep Dashboard and navigation entry.
- [x] Move existing 1–5 sleep-quality input into Sleep Dashboard without losing check-in history.
- [x] Add restedness, onset difficulty, awakenings, disturbances, sleepiness, and schedule inputs.
- [x] Add deterministic SWS formula and missing-data handling.
- [x] Add history/trend views and non-diagnostic AI assessment with confidence, reviewed-record count, and safety disclaimer.
- [x] Add runnable formula checks and validate API through the browser flow.

### Phase 3 — Activity, nutrition, and shared timeline

- [x] Aggregate wearable samples into daily activity-duration buckets.
- [x] Add ALI, personal activity baseline, activity-balance recovery indicators, and lower-load rest-day detection.
- [x] Add editable manual meal/portion/macro records before image recognition.
- [x] Add food-image analysis and confidence-aware portion estimation.
- [x] Build timestamp-aligned wellness timeline across implemented domains, including daily hydration history.

### Phase 4 — Personal analytics and explainable AI

- [x] Build reliable account-scoped baselines for heart rate, SpO₂, movement, activity load, wellness, sleep wellness, and hydration with quality filters, learning states, and a 14-day threshold.
- [x] Add deterministic trend, recurrence, personal-range deviation, multi-signal anomaly, and curated relationship engines with minimum-sample gates.
- [x] Version deterministic pattern results and expose confidence, stability, inputs, date ranges, explanations, limitations, and recent history.
- [x] Furnish Analytics with Overview, Patterns, and Relationships navigation, quality coverage, accessible help, empty/learning states, and non-diagnostic safety language.

### Phase 5 — Goals, interventions, and care connection

- [ ] Add goals and interventions with before/after periods and outcomes.
- [ ] Rank suggestions only after feedback/outcome data exist.
- [ ] Add clinic/doctor directory, matching, profiles, and saved specialist.
- [ ] Add editable health-summary approval before contact handoff.

## General HERA feature checklist

| Status | Feature | Current evidence / remaining work | Phase |
|---|---|---|---:|
| [~] | Personalized Baseline Learning | Analytics now compares seven domains with reliable prior records, explicit 14-day learning progress, personal ranges, and limitations; nutrition and symptom baselines remain. | 4 |
| [ ] | Personal Physiological Digital Twin | Add personal model and current-versus-normal comparison. | 4 |
| [~] | Personalized Trend Forecasting | Charts and cycle prediction exist; add direction and short-term forecasts by measure. | 4 |
| [ ] | Prediction Stability Monitor | Persist prediction versions and compare consecutive outputs. | 4 |
| [ ] | Symptom–Sensor Discrepancy Detector | Align symptom, wearable, activity, and sleep records; calculate mismatches. | 4 |
| [~] | Multi-Parameter Anomaly Detection | Separate signal notices exist; add joint multi-measure anomaly analysis. | 4 |
| [~] | Early Pattern-Deviation Detection | Cycle/signal notices exist; compare all recent domains with personal baselines. | 4 |
| [~] | Pattern Recurrence Detection | Repeated-symptom rule exists; add combined-pattern matching. | 4 |
| [ ] | Cycle-Phase Physiological Signature | Learn per-phase heart-rate, activity, sleep, symptom, and wellness signatures. | 4 |
| [x] | Cycle-to-Cycle Comparison | Current length, recent baseline, difference, and early/late/on-time result implemented. | Done |
| [~] | Cycle Pattern Change Detection | Latest-versus-average comparison exists; add sustained multi-cycle change logic. | 4 |
| [~] | Cycle Prediction Confidence | Variability and uncertainty range exist; expose explicit confidence level. | 4 |
| [x] | Adaptive Cumulative ALI | Daily Activity Load Index implemented from worn-device activity samples. | Done |
| [x] | Activity Distribution Tracking | Daily duration buckets implemented. | Done |
| [x] | Personal Activity Baseline | Daily load compares with rolling personal baseline. | Done |
| [ ] | Personalized Recovery Curve | Detect activity sessions and model return toward baseline. | 3 |
| [ ] | Recovery Pattern Change Detection | Compare current and historical recovery curves. | 3 |
| [x] | Food Image Processing & Nutritional Breakdown | Photo analysis returns editable food, portion, calorie, and macro draft before save. | Done |
| [x] | Portion-Size Estimation | Confidence-aware AI estimate and manual correction flow implemented. | Done |
| [~] | Personalized Nutrition Learning | Contextual guidance exists; add saved meals and learned nutrition baseline. | 3 |
| [ ] | Confidence-Aware AI + Explanation | Return confidence, influencing records, and limitations with each insight. | 4 |
| [~] | Health Data Quality Detector | Basic validation exists; add missing/noisy/duplicate/inconsistent-data report. | 1 |
| [~] | Sensor-Fusion Intelligence | Shared timeline aligns implemented domains and preserves date/time precision; add Phase 4 relationship quality gates. | 4 |
| [ ] | Counterfactual Health Insights | Add clearly labeled simulation and original-versus-hypothetical result. | 5 |
| [ ] | Intervention Effectiveness Tracker | Add interventions and before/after comparisons. | 5 |
| [~] | Intervention Recommendation Ranking | Ordered nutrition guidance exists; add interventions, feedback, and outcome-based ranking. | 5 |
| [x] | Multimodal Personalized Wellness Timeline | Account-scoped 7/30/90-day timeline covers cycle, check-ins, daily wearable/activity summaries, sleep, meals, hydration, and persisted sleep insight. | Done |
| [ ] | Personalized Healthcare & Clinic Matching | Add need/location search and matching. | 5 |
| [ ] | Personalized Clinic Profile | Add clinic data and profile UI. | 5 |
| [ ] | Personalized Doctor Profile | Add doctor data, specialties, and comparison UI. | 5 |
| [ ] | Specialist Selection & Saving | Save preferred specialist to authenticated profile. | 5 |
| [~] | AI Health Summary Generator | Contextual assistant exists; add record selection, editable draft, approval, and persistence. | 5 |
| [ ] | mHealth Specialist Connection | Show approved clinic contact method after summary approval. | 5 |
| [~] | Temporal Pattern Analyzer | Date ranges and cycle intervals exist; add onset, duration, and persistence analysis. | 4 |
| [ ] | Cross-Parameter Relationship Mapper | Add supported association calculations and visualization. | 4 |
| [ ] | Sleep-Activity Interaction Analyzer | Align sleep periods with activity/ALI before and after sleep. | 4 |
| [ ] | Nutrition-Physiology Association Engine | Compare saved nutrition with sleep, activity, heart rate, and cycle phase. | 4 |
| [~] | Hydration Pattern Analysis | Daily totals and timeline history exist; personal pattern analysis remains Phase 4. | 4 |
| [x] | Rest-Day Balance Tracking | Lower-load and high-load day balance compares with rolling activity baseline. | Done |
| [ ] | Wellness Goal Progress Tracking | Add goals, targets, progress history, and prior-period comparison. | 5 |
| [x] | Multi-Account User Profiles | Authenticated accounts, sessions, profiles, device ownership, and account-scoped APIs implemented. | Done |

## Sleep Dashboard feature checklist

| Status | Feature | Current evidence / remaining work |
|---|---|---|
| [x] | Sleep Quality | Dedicated validated 1–5 input; historical check-in values migrate without overwrite. |
| [x] | Morning Restedness | Validated 1–5 input, storage, API, and UI complete. |
| [x] | Sleep-Onset Difficulty | Validated 1–5 input, storage, API, and UI complete. |
| [x] | Nighttime Awakenings | Validated 0–20 count, storage, API, and UI complete. |
| [x] | Sleep Disturbances | Validated 1–5 input, storage, API, and UI complete. |
| [x] | Morning Sleepiness | Validated 1–5 input, storage, API, and UI complete. |
| [x] | Sleep Schedule | Bedtime, estimated sleep time, wake time, consistency, and overnight validation complete. |
| [x] | Sleep Wellness Score (SWS) | Deterministic percentage formula, minimum-data rule, history calculation, disclaimer, and UI complete. |
| [x] | Sleep Pattern Assessment | Existing Groq integration now summarizes recent sleep records with bounded context, confidence, reviewed-record count, and a non-diagnostic disclaimer. |

## Definition of done for each feature

- [ ] Data model and migration completed where persistence is needed.
- [ ] Input validation and per-user authorization completed at API boundary.
- [ ] Backend calculation/API completed with safe error handling.
- [ ] Responsive, accessible UI completed with loading, empty, and error states.
- [ ] Safety wording and confidence/limitations shown for predictions or AI output.
- [ ] One runnable success check plus important boundary/failure checks added.
- [ ] Existing data compatibility and export behavior verified.
- [ ] Relevant README/API/database/testing docs updated.
- [ ] Browser runtime checked; hardware-dependent behavior checked on device when applicable.

