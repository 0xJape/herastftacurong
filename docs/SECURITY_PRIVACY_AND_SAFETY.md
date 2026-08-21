# HERA Security, Privacy, and Safety

## Privacy

HERA processes sensitive menstrual and health-related information.

The system should:

- Collect only necessary information
- Limit unnecessary data sharing
- Protect stored health records
- Send only relevant data to external AI services

## Security

Recommended controls:

- HTTPS
- Input validation
- Authentication
- Authorization
- Password hashing
- Parameterized database queries
- Secure API keys
- Rate limiting

## AI Safety

The backend should control what HERA information is sent to GroqCloud.

The AI should not:

- Diagnose
- Prescribe
- Invent records
- Present uncertain results as facts

## Medical Safety

HERA should clearly state that it is a preventive monitoring and risk-awareness system and does not replace professional medical evaluation.
