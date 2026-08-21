# HERA AI Assistant / LLM Agent Design

## AI Platform

HERA uses:

- **GroqCloud API**
- **Meta Llama through Groq**
- **Orpheus TTS through Groq**

## Purpose

The AI Assistant can:

- Answer menstrual-health questions
- Explain cycle phases
- Explain HERA results
- Summarize trends
- Explain nutrition recommendations
- Provide personalized wellness guidance

## Agent Flow

```text
User Question
    ↓
Node.js / Express Backend
    ↓
Retrieve Relevant HERA Records
    ↓
Prepare Structured Context
    ↓
GroqCloud API
    ↓
Meta Llama
    ↓
Response Validation
    ↓
HERA Application
```

## Context Sources

The agent may use:

- Cycle records
- Symptoms
- Daily check-ins
- Heart rate
- SpO₂
- Activity
- Wellness score
- Risk-awareness results
- Nutrition information

## Safety

The AI Assistant must not:

- Diagnose diseases
- Prescribe medication
- Invent sensor readings
- Claim access to missing records
- Replace a healthcare professional

## Risk Separation

Preferred architecture:

**Algorithms / Rules → Risk Result**

**LLM Agent → Explanation of Risk Result**

## Voice

Optional flow:

**AI Text → Orpheus TTS through Groq → Audio Playback**
