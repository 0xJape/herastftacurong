# HERA Deployment and Integration

## Architecture

```text
ESP32-S3 Wearable
      ↓
Node.js + Express Backend
      ↓
SQLite
      ↓
Analytics / Risk Assessment
      ↓
GroqCloud
      ↓
React + TypeScript Frontend
```

## Development

Recommended:

- Arduino Framework for ESP32
- React + TypeScript frontend
- Node.js + Express backend
- SQLite database
- Environment variables for Groq API keys

## AI Integration

The Groq API key should remain on the backend.

Preferred flow:

**React → Backend → Retrieve Context → GroqCloud → Backend → React**

## Production Considerations

For deployment beyond a local prototype:

- Use HTTPS
- Secure secrets
- Add authentication
- Add backups
- Add logging
- Protect stored health information
