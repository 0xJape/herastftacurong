# HERA API Design

## Wearable

### POST `/api/wearable/readings`

Receives wearable data.

Example:

```json
{
  "deviceId": "HERA-001",
  "userId": 1,
  "wearing": true,
  "heartRate": 78,
  "spo2": 98,
  "activity": "WALKING",
  "movementLevel": 145.2
}
```

## Cycle

- `GET /api/cycles/:userId`
- `POST /api/cycles`
- `PUT /api/cycles/:id`

## Daily Check-In

- `GET /api/checkins/:userId`
- `POST /api/checkins`

## Health

- `GET /api/health/latest/:userId`
- `GET /api/health/history/:userId`

## Analytics

- `GET /api/analytics/:userId`

Authenticated endpoint; URL user ID is ignored in favor of session account. `days` must be `1`, `7`, `30`, or `90`. Response includes account-scoped observations, activity summaries, personal baselines, deterministic insights, trend directions, curated same-day relationships, data-quality coverage, prediction stability, and recent version history. Personal comparisons use a 31-day learning window and require 14 prior reliable days for established ranges. Missing values remain unavailable rather than becoming zero.

Pattern output includes `algorithmVersion`, confidence, supporting inputs/date range, explanation, limitation, and non-diagnostic disclaimer. Relationship output requires seven overlapping days and states that association does not prove cause.

## Risk Assessment

- `GET /api/risk-assessment/latest/:userId`
- `POST /api/risk-assessment/:userId`

## AI Assistant

### POST `/api/ai/chat`

```json
{
  "userId": 1,
  "message": "Explain my recent energy trend."
}
```

The backend retrieves relevant HERA records before contacting GroqCloud.

## Notifications

- `GET /api/notifications/:userId`
- `PATCH /api/notifications/:id/read`
