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
