# HERA System Interface Design

## Design Overview

HERA should use a modern, feminine, clean, and health-focused interface that feels like a personal health companion rather than a hospital dashboard.

## Color Palette

| Color | Hex | Role |
|---|---|---|
| Deep Burgundy | `#8B002F` | Headings and strong emphasis |
| Crimson Rose | `#B20A3D` | Secondary actions and selected states |
| HERA Pink | `#D4145A` | Primary buttons and highlights |
| Soft Rose | `#FFF7FA` | Main background |
| White | `#FFFFFF` | Cards and panels |
| Dark Text | `#27171D` | Primary text |
| Muted Text | `#7C6870` | Secondary text |

## Typography

HERA should use **Poppins** as its primary interface font. Use Poppins for headings, body text, navigation, buttons, labels, and dashboard data to maintain a modern, friendly, and polished visual style.

- Font family: `Poppins`, sans-serif
- Headings: Medium to bold weights
- Body text: Regular to medium weights
- Buttons and navigation: Medium to semibold weights

## Primary Navigation

- Home
- Cycle
- Check-In
- Health
- Analytics
- AI Assistant
- Profile

## Home Dashboard

Displays:

- Current cycle day and phase
- Wellness score
- Heart rate
- SpO₂
- Activity
- Wearable status
- AI insight
- Alerts and reminders
- Quick actions

## Cycle Tracker

Includes:

- Period logging
- Cycle calendar
- Phase tracking
- Cycle prediction
- Symptoms
- Cycle history

## Daily Check-In

Includes:

- Mood
- Stress
- Energy
- Sleep
- Symptoms
- Hydration
- Notes

## Health Monitoring

Shows:

- Heart rate
- SpO₂
- Activity classification
- Wear status
- Future temperature
- Future sleep information
- Future Activity Load Index

## Nutrition Intelligence

Shows:

- Cycle-phase guidance
- Hydration suggestions
- Nutrition focus
- Symptom-aware suggestions
- AI explanation

## Hormonal Risk Assessment

Displays:

- Risk-awareness level
- Detected patterns
- Explanation
- Suggested next action
- Non-diagnostic disclaimer

## Health History & Analytics

Recommended charts:

- Cycle trend
- Heart rate
- SpO₂
- Activity
- Mood
- Stress
- Energy
- Sleep
- Symptoms
- Wellness score

## AI Assistant

The AI Assistant uses **Meta Llama through GroqCloud**.

The frontend should communicate with the backend, and the backend should communicate with Groq.

**React → Node/Express → HERA Context → GroqCloud → Meta Llama → Backend → React**

Optional spoken output may use Orpheus TTS through Groq.

## Responsive Design

### Mobile
- Bottom navigation
- Single-column layout
- Large touch targets

### Desktop
- Sidebar navigation
- Multi-column dashboard
- Wider analytics views

## Safety

HERA should clearly indicate that AI responses and risk-awareness results are informational and non-diagnostic.
