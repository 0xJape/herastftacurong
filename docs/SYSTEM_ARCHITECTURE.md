# HERA System Architecture

## Architecture

```text
Wearable Sensors
      ↓
ESP32-S3
      ↓
Local Processing
      ↓
REST API / HTTP / JSON
      ↓
Node.js + Express.js
      ↓
SQLite Database
      ↓
Analytics & Risk Assessment
      ↓
GroqCloud / Meta Llama
      ↓
React + TypeScript Application
      ↓
User
```

## Wearable Layer

Current hardware:

- ESP32-S3
- MAX30102
- QMI8658
- ST7789 TFT
- 3 buttons
- NeoPixel

## Embedded Processing

Handles:

- Heart-rate calculation
- SpO₂ processing
- Wear detection
- Movement processing
- Activity classification
- Display
- Buttons
- Power management

## Backend Layer

Uses Node.js and Express.js for:

- API requests
- Data validation
- Database access
- Analytics
- Risk assessment
- AI context preparation
- Groq integration

## Database Layer

SQLite stores:

- Users
- Menstrual data
- Symptoms
- Daily check-ins
- Sensor readings
- Nutrition logs
- Analytics
- Risk results
- Notifications

## AI Layer

Uses:

- GroqCloud API
- Meta Llama
- Orpheus TTS

The LLM primarily explains processed HERA data rather than independently calculating medical risk.

## Frontend Layer

Uses React and TypeScript to display the HERA application.
