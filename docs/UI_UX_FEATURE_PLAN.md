# HERA UI/UX Feature Plan

Date: 2026-09-28

## Goal

Show all planned features without creating one page per feature. Keep daily tasks quick, advanced analytics optional, and every health insight understandable, confidence-aware, and non-diagnostic.

## Navigation

Use five primary destinations on desktop and mobile:

| Destination | Purpose | Main sections |
|---|---|---|
| Today | Immediate status and next actions | Overview, priority insight, reminders, quick actions |
| Track | User-entered records | Check-In, Cycle, Nutrition |
| Health | Current measurements and personal analysis | Vitals, Activity, Sleep, Patterns |
| History | Records and trends over time | Timeline, Trends, Relationships |
| You | Account, care, device, and settings | Profile, Goals, Care, Device, Notifications, Privacy |

AI Assistant and notification inbox remain globally available overlays.

## Shared presentation rules

### Insight card

Every prediction, anomaly, association, or recommendation uses one card pattern:

1. Plain-language title.
2. One-sentence result.
3. Confidence badge: Low, Moderate, or High.
4. Supporting data summary and date range.
5. `Why this appeared` expandable explanation.
6. Clear limitation or missing-data note.
7. Relevant action, such as `View pattern`, `Log check-in`, or `Discuss with a professional`.
8. `Informational only — not a diagnosis` where health interpretation is involved.

Never show unexplained risk colors, alarming language, or unsupported certainty.

### Metric card

Show current value, unit, timestamp, freshness, personal-range comparison, and a small trend. Selecting it opens detailed history. Missing or low-quality data display `Not enough reliable data`, never zero.

### Status language

- **Within your usual range** — enough personal history and no meaningful deviation.
- **Outside your usual range** — supported deviation, without diagnostic wording.
- **Learning your baseline** — insufficient reliable history, with progress such as `8 of 14 days`.
- **Low confidence** — visible beside result, not hidden in details.
- **Simulation** — prominent label on every counterfactual result.

### Progressive disclosure

- Today shows summaries only.
- Health shows current values and explanations.
- History shows full charts, comparisons, and source records.
- Advanced details open in accordions or bottom sheets.
- Configuration stays under You.

## Screen specifications

## 1. Today

### Layout

1. Greeting and date.
2. Priority insight card.
3. Compact cycle and Sleep Wellness cards.
4. Current vitals and activity row.
5. Today goals and hydration progress.
6. Reminders and quick actions.
7. Wearable connection/freshness strip.

### Features shown

| Feature | UI treatment |
|---|---|
| Personalized Baseline Learning | Small `Learning your baseline` state on metric cards; details link to Health → Patterns. |
| Personal Physiological Digital Twin | `Your normal today` card comparing current state with personal range; avoid avatar/body simulation. |
| Personalized Trend Forecasting | Direction arrow plus short phrase such as `Stable over 7 days`; forecast details remain in History. |
| Early Pattern-Deviation Detection | One calm priority insight when a supported change exists. |
| Intervention Recommendation Ranking | Highest relevant suggestion only; `See all suggestions` opens You → Goals. |
| Wellness Goal Progress Tracking | Compact progress rings/bars for active goals. |
| Sleep Wellness Score | Last-night percentage, confidence/coverage, and `Open Sleep` action. |

Today must not become a full analytics page. Maximum one priority AI insight at once.

## 2. Track

Use segmented tabs: **Check-In**, **Cycle**, **Nutrition**.

### Track → Check-In

Keep current mood, stress, energy, symptoms, hydration, and notes. Move primary sleep entry to Health → Sleep, but retain a shortcut that opens last-night sleep form.

- Mobile: one grouped section at a time with visible progress.
- Desktop: two-column form.
- Optional symptoms and notes appear under `Add details`.
- Save confirmation includes date and edit action.

### Track → Cycle

| Feature | UI treatment |
|---|---|
| Cycle-to-Cycle Comparison | Comparison card: current cycle, personal average, day difference, and early/late/expected label. |
| Cycle Pattern Change Detection | Multi-cycle trend card with duration selector and `Why this matters` explanation. |
| Cycle Prediction Confidence | Predicted window includes confidence badge, history count, variability, and explanation. |
| Cycle-Phase Physiological Signature | Phase detail drawer showing usual HR, activity, sleep, symptoms, and wellness when enough data exist. |

Preserve period form, calendar, prediction, and history. Use text and icons in addition to phase colors.

### Track → Nutrition

Start with manual records before image AI:

1. `Add meal` button.
2. Food name, portion, calories, protein, carbohydrates, and fat.
3. Optional photo capture/upload.
4. AI draft appears in editable review form.
5. User confirms or corrects values before save.

| Feature | UI treatment |
|---|---|
| Food Image Processing & Nutritional Breakdown | Photo preview beside editable AI-estimated food and macro fields. |
| Portion-Size Estimation | Estimate plus unit, confidence, and `Enter manually` fallback. |
| Personalized Nutrition Learning | `Your patterns` card for common foods, meal timing, and baseline; only after enough saved meals. |
| Hydration Pattern Analysis | Daily water control plus 7/30-day usual-intake comparison. |

Never save image-derived nutrition silently.

## 3. Health

Use tabs: **Vitals**, **Activity**, **Sleep**, **Patterns**.

### Health → Vitals

Show heart rate, SpO₂, wear status, reading freshness, and future supported measurements. Each card includes current value, personal range, quality state, and short trend.

| Feature | UI treatment |
|---|---|
| Health Data Quality Detector | Data-quality banner and per-card quality icon; details list missing, noisy, duplicate, or inconsistent records. |
| Sensor-Fusion Intelligence | `Combined view` timeline aligns sensor and user-entered events; source chips identify wearable/manual data. |
| Personalized Baseline Learning | Baseline range band on charts and learning-progress state. |
| Personal Physiological Digital Twin | Summary panel comparing current multi-domain state with personal baseline. |

### Health → Activity

| Feature | UI treatment |
|---|---|
| Adaptive Cumulative ALI | Daily ALI hero value, accumulated-load chart, and plain-language scale explanation. |
| Activity Distribution Tracking | Stacked duration bar and list for resting/light/walking/active/vigorous time. |
| Personal Activity Baseline | Today-versus-usual gauge labeled Below, Near, or Above usual. |
| Personalized Recovery Curve | Line chart from activity end toward baseline with typical-range band. |
| Recovery Pattern Change Detection | Comparison card for current recovery versus previous personal pattern. |
| Rest-Day Balance Tracking | Weekly activity/rest calendar and balance summary. |

ALI must disclose formula and data coverage. Never present it as clinical fitness clearance.

### Health → Sleep

Dedicated dashboard; first implementation target.

#### Last-night entry form

| Input | Control |
|---|---|
| Sleep Quality | Existing 1–5 choice buttons moved from Check-In. |
| Morning Restedness | 1–5 choice buttons from very tired to refreshed. |
| Sleep-Onset Difficulty | 1–5 choice buttons from very easy to very difficult. |
| Nighttime Awakenings | Numeric count when known, plus `Not sure`; summary can map count to a scale. |
| Sleep Disturbances | 1–5 choice buttons from none to severe. |
| Morning Sleepiness | 1–5 choice buttons from alert to very sleepy. |
| Bedtime | Time input. |
| Estimated Sleep Time | Time input; label means time user believes sleep began. |
| Wake-Up Time | Time input with overnight/date handling. |
| Schedule Consistency | 1–5 choice buttons or calculated value when enough schedules exist. |

Avoid duplicate sleep records: one record per user and sleep date, editable after saving.

#### Dashboard layout

1. Date selector and completion state.
2. SWS circular percentage with confidence/data-completeness label.
3. Sleep schedule timeline: bedtime → estimated sleep → wake time.
4. Six subjective factor bars with consistent direction: higher display score always means better wellness.
5. Pattern Assessment insight card.
6. 7/30/90-day SWS and schedule charts.
7. Links to related activity, cycle phase, and symptoms.

#### Sleep Wellness Score

Show:

- Overall percentage.
- Included inputs and missing inputs.
- Factor breakdown.
- Formula explanation.
- `Not enough data` instead of a score when minimum inputs are absent.

Store raw answers; derive SWS so formula changes do not destroy source data.

#### Sleep Pattern Assessment

Use dedicated sleep context. Output sections:

- `What your records show`
- `Possible contributing patterns`
- `Confidence and data used`
- `What you can track next`
- Non-diagnostic safety note

No sleep-stage claims unless supported wearable measurements exist.

### Health → Patterns

| Feature | UI treatment |
|---|---|
| Personalized Trend Forecasting | Forecast cards by selected measure with historical line and dashed short-term projection. |
| Prediction Stability Monitor | Stability badge and `Changed since last prediction` comparison drawer. |
| Symptom–Sensor Discrepancy Detector | Paired symptom/sensor card showing mismatch date and source records. |
| Multi-Parameter Anomaly Detection | Cluster insight listing unusual combination and contributing measures. |
| Early Pattern-Deviation Detection | Baseline band chart with first meaningful deviation marked. |
| Pattern Recurrence Detection | `Similar to previous pattern` card linking matching prior periods. |
| Cycle-Phase Physiological Signature | Phase selector and personal multi-metric profile. |
| Temporal Pattern Analyzer | Onset, duration, recurrence, and persistence summary. |
| Cross-Parameter Relationship Mapper | Select two measures; scatter/overlay view plus cautious association text. |
| Sleep-Activity Interaction Analyzer | Before/after sleep activity comparison and supported association summary. |
| Nutrition-Physiology Association Engine | Meal/nutrient overlays with sleep, activity, HR, and cycle phase. |

Default to useful curated relationships. Keep manual `Compare measures` tool under advanced controls.

## 4. History

Use tabs: **Timeline**, **Trends**, **Relationships**.

### Timeline

| Feature | UI treatment |
|---|---|
| Multimodal Personalized Wellness Timeline | Chronological cards for cycle, symptoms, sensors, activity, sleep, nutrition, AI insights, goals, and interventions. |

Provide filters, date range, source icons, search, and same-day grouping. Selecting an event opens source details. AI insights link back to exact contributing records.

### Trends

Reuse existing 7/30/90-day analytics. Add metric selection, baseline bands, comparison periods, coverage, and accessible table alternatives for charts.

### Relationships

Show saved relationship views and association results. Always show sample size/date range and state `Association does not prove cause`.

## 5. You

Use sections: **Profile**, **Goals**, **Care**, **Device**, **Notifications**, **Privacy**.

### You → Profile

| Feature | UI treatment |
|---|---|
| Multi-Account User Profiles | Account switcher, avatar/name, explicit active account, sign-in/out, and separate server-backed settings. |
| Specialist Selection & Saving | Preferred specialist card after care selection. |

Never expose another account's preview health data in account switcher.

### You → Goals

| Feature | UI treatment |
|---|---|
| Wellness Goal Progress Tracking | Goal cards with target, current progress, history, and edit/pause actions. |
| Intervention Effectiveness Tracker | Intervention setup, start/end periods, selected measures, and before/after result. |
| Intervention Recommendation Ranking | Ranked suggestions with reason, confidence, dismiss/save/start actions, and feedback. |
| Counterfactual Health Insights | `What-if simulation` form and side-by-side original/simulated output with persistent Simulation label. |

Counterfactual output must not imply guaranteed outcome.

### You → Care

| Feature | UI treatment |
|---|---|
| Personalized Healthcare & Clinic Matching | Need and location form, filter chips, map/list toggle only if reliable map data exist. |
| Personalized Clinic Profile | Name, location, services, specialties, contact, hours, and source freshness. |
| Personalized Doctor Profile | Specialty, clinic, available verified profile details, and compare/save action. |
| AI Health Summary Generator | Record/date selectors → generated editable draft → preview → explicit approval. |
| mHealth Specialist Connection | After approval, show verified clinic contact method and user-controlled copy/download/share action. |

No automatic transmission. User reviews and approves exact summary first.

### You → Device, Notifications, Privacy

Preserve current device state, preferences, alert history, and export. Add connection diagnostics under an expandable section. Put deletion, consent, retention, and account controls in Privacy, separated from routine settings.

## AI and explanation patterns

| Feature | UI treatment |
|---|---|
| Confidence-Aware AI + Explanation | Standard confidence badge, supporting-data chips, `Why this appeared`, limitations, and feedback controls. |
| AI Health Summary Generator | Editable generated draft; AI text never becomes approved record automatically. |
| Intervention Recommendation Ranking | Show ranking reason and let user dismiss, save, or report irrelevance. |

The assistant remains global but deep-links answers to relevant HERA screens rather than duplicating full dashboards in chat.

## Accessibility requirements

- Move focus to new page heading after SPA navigation and announce title changes.
- Keep all touch targets at least 44 × 44 CSS pixels.
- Use text/icons with color for every status.
- Add keyboard access and table summaries for chart data.
- Use fieldsets and legends for every 1–5 choice group.
- Trap and restore focus in modal dialogs and bottom sheets; support Escape.
- Announce save/loading/error states through live regions.
- Verify WCAG AA contrast on pink, muted, translucent, and gradient surfaces.
- Respect reduced-motion preference.
- Keep health language readable and non-alarming.

## Responsive behavior

### Mobile

- Fixed five-item bottom navigation: Today, Track, Health, History, You.
- Tabs scroll horizontally when needed.
- Forms use one column and sticky Save/Continue action where useful.
- Charts show summary first; details open on demand.
- Dense comparison tables become stacked cards.

### Desktop

- Persistent left navigation.
- Main content maximum readable width.
- Summary/details can use two columns.
- Filters remain visible beside history and relationship views.

## UI delivery checklist

### Foundation

- [ ] Change navigation to Today, Track, Health, History, You.
- [ ] Add reusable tabs, insight card, confidence badge, quality state, metric card, and accessible chart/table patterns.
- [ ] Fix route focus, dialogs, touch targets, labels, and contrast before feature expansion.
- [ ] Define loading, empty, partial-data, stale-data, offline, and error states.

### Sleep Dashboard

- [ ] Add Health → Sleep route/tab and Today summary card.
- [ ] Build accessible last-night sleep form.
- [ ] Preserve existing sleep-quality history.
- [ ] Build SWS summary and factor breakdown.
- [ ] Build schedule timeline and 7/30/90-day trends.
- [ ] Add confidence-aware Pattern Assessment.
- [ ] Validate mobile, desktop, keyboard, screen-reader, and reduced-motion behavior.

### Remaining domains

- [ ] Build Activity UI after daily activity derivations exist.
- [ ] Build manual Nutrition records before image processing.
- [ ] Build unified Timeline before cross-domain pattern cards.
- [ ] Build baseline views before forecasts/anomalies.
- [ ] Build Goals/Interventions before recommendation ranking or simulations.
- [ ] Build authenticated profiles before Care saving/sharing.

## Per-feature UI definition of done

- [ ] Entry point is discoverable from one primary destination.
- [ ] Summary state and detailed state both exist where needed.
- [ ] Loading, empty, insufficient-data, stale-data, error, and success states are designed.
- [ ] Source data, date range, confidence, and limitations are visible for computed insights.
- [ ] Mobile and desktop layouts work without horizontal page overflow.
- [ ] Keyboard, focus, labels, live announcements, contrast, and touch targets pass checks.
- [ ] Non-diagnostic wording and escalation guidance are reviewed.
- [ ] No placeholder or synthetic health result appears as real data.
