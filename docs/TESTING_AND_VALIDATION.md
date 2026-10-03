# HERA Testing and Validation

## Firmware Testing

Test:

- MAX30102
- Heart rate
- SpO₂
- Wear detection
- QMI8658
- Activity classification
- TFT
- Buttons
- Deep sleep
- NeoPixel

## API Testing

Test:

- Valid payloads
- Missing values
- Invalid values
- Duplicate requests
- Network errors

## Database Testing

Test:

- Insert
- Update
- Delete
- Retrieval
- User-data separation

## Frontend Testing

Test:

- Navigation
- Dashboard
- Cycle logging
- Daily check-in
- Charts
- Wearable status
- Notifications
- AI Assistant

## AI Testing

Evaluate:

- Accuracy relative to HERA records
- Hallucination
- Personalization
- Non-diagnostic language
- Safety
- Relevance

## Integration Testing

Test:

**Wearable → Backend → Database → Analytics → Frontend**

Phase 4 deterministic checks cover personal baseline thresholds, poor-quality filtering, missing data, trend minimum samples/direction, relationship overlap/strength, multi-signal deviations, symptom recurrence, and safety wording. `npm test` runs these checks without network or LLM dependencies. Server validation also includes JavaScript syntax, SQLite migration startup, authenticated account isolation, empty/learning states, and stale service-worker asset checks.

and:

**Frontend → Backend → Groq → Frontend**
