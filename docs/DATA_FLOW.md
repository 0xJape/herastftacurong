# HERA Data Flow

## Main Flow

**HERA Wristwatch → Sensors → ESP32-S3 → Backend → Database → Analytics → Risk Assessment → AI Assistant → HERA App → User**

## Wearable Flow

1. Sensors collect data.
2. ESP32 processes heart rate, SpO₂, wear status, and activity.
3. Processed readings are packaged as JSON.
4. Data is transmitted to the backend.
5. Backend validates and stores the data.

## User Data Flow

Users enter:

- Menstrual records
- Symptoms
- Mood
- Stress
- Energy
- Sleep
- Nutrition
- Hydration

The backend stores this information with wearable data.

## Analytics Flow

Stored data is used for:

- Cycle calculation
- Wellness score
- Trend analysis
- Activity analysis
- Risk-awareness assessment

## AI Flow

```text
User Question
    ↓
Backend
    ↓
Retrieve Relevant HERA Data
    ↓
Prepare Context
    ↓
GroqCloud
    ↓
Meta Llama
    ↓
Validated Response
    ↓
HERA App
```
