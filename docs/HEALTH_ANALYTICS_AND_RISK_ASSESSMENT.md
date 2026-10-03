# HERA Health Analytics and Risk Assessment

## Data Used

- Menstrual cycle records
- Symptoms
- Mood
- Stress
- Energy
- Sleep
- Heart rate
- SpO₂
- Activity
- Nutrition
- Hydration

## Analytics

Implemented outputs:

- Cycle length
- Cycle variability
- Symptom frequency
- Wellness score
- Activity trends
- Heart-rate trends
- SpO₂ trends
- Personal ranges after 14 reliable prior days
- Multi-signal deviation and recurring-symptom notices
- Curated sleep/activity, hydration/wellness, nutrition/sleep, and activity/heart-rate relationships
- Data coverage, confidence, limitations, algorithm version, and prediction stability

Calculations are deterministic. LLM features may explain saved results but do not calculate them. Missing or unreliable observations are excluded and never represented as zero.

## Wellness Score

The Wellness Score should use a defined formula based on selected variables such as:

- Mood
- Stress
- Energy
- Sleep
- Activity
- Symptoms

The LLM should explain the score, not calculate it independently.

## Hormonal Risk Assessment

The assessment should identify unusual patterns rather than diagnose a condition.

Example states:

- No Notable Pattern
- Monitor
- Moderate Attention
- Consultation Recommended

## Activity Load Index

Firmware activity classifications are aggregated into daily duration buckets. HERA calculates a documented Activity Load Index from worn-device activity samples, compares it with rolling personal history, and labels high-load, balanced, and lower-load/rest days. Results are informational and non-diagnostic.
