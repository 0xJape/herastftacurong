# HERA Database Design

## Database

**SQLite**

## Main Tables

### users
Stores basic user information.

### menstrual_cycles
Stores period dates and cycle records.

### symptoms
Stores symptom entries and severity.

### daily_checkins
Stores mood, stress, energy, sleep, and daily wellness information.

### sensor_readings
Stores:

- Heart rate
- SpO₂
- Activity class
- Movement level
- Wear status
- Future temperature

### nutrition_logs
Stores hydration and nutrition entries.

### wellness_scores
Stores calculated wellness scores.

### risk_assessments
Stores risk-awareness results and detected patterns.

### notifications
Stores reminders and alerts.

### ai_conversations
Stores HERA AI Assistant interactions.

## Relationships

```text
users
 ├── menstrual_cycles
 ├── symptoms
 ├── daily_checkins
 ├── sensor_readings
 ├── nutrition_logs
 ├── wellness_scores
 ├── risk_assessments
 ├── notifications
 └── ai_conversations
```
