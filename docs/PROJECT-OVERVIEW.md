# HERA Project Overview

## Project Title

**HERA: An AI-Powered Wearable Wristwatch and Menstrual Health Monitoring System for Adolescents and Women**

## Overview

HERA is an AI-powered wearable health monitoring system designed to support menstrual health awareness, physiological monitoring, wellness tracking, and preventive healthcare among adolescents and women.

The system is composed of an **ESP32-S3-based HERA Wristwatch** and a companion **HERA Application**. The wearable currently uses a **MAX30102 optical sensor** for heart rate and SpO₂ monitoring and a **QMI8658 inertial sensor** for movement and physical activity monitoring. The wristwatch also includes wear detection, local sensor processing, activity classification, a TFT display, physical controls, visual indicators, and power-management functions.

The HERA Application complements the wearable by allowing users to record menstrual and wellness-related information such as menstrual periods, symptoms, mood, stress, energy, sleep, nutrition, hydration, and daily check-ins. Wearable-generated physiological measurements and user-entered information are combined to provide a more comprehensive view of the user's menstrual and general wellness patterns.

HERA analyzes the collected information to identify unusual patterns and changes that may require closer monitoring. The system is not designed to diagnose illnesses or medical conditions. Instead, it functions as a **preventive health monitoring and risk-awareness system** that provides wellness insights, personalized recommendations, reminders, and alerts that may encourage users to seek professional medical consultation when appropriate.

Artificial intelligence is integrated through an **AI Chatbot powered by an LLM Agent**. The agent can use relevant HERA records, processed health information, historical trends, and system-generated results as context when responding to users. It can explain HERA results, answer questions related to menstrual health and wellness, and provide personalized but non-diagnostic guidance.

---

# Main Components

## 1. HERA Wristwatch

The **HERA Wristwatch** is the wearable data-collection component of the system.

The current prototype is built using:

* ESP32-S3 microcontroller
* MAX30102 heart rate and SpO₂ sensor
* QMI8658 motion and activity sensor
* ST7789 1.14-inch TFT display
* Three physical buttons
* NeoPixel status indicator

The wristwatch is responsible for:

* Measuring heart rate
* Measuring SpO₂
* Detecting whether the device is being worn
* Monitoring physical movement
* Classifying physical activity
* Displaying health measurements locally
* Providing wearable controls
* Managing device power consumption
* Preparing wearable measurements for future synchronization with the HERA backend

The wearable currently classifies activity into:

* Resting
* Light Activity
* Walking
* Active
* Vigorous

These classifications are derived from acceleration measurements obtained through the QMI8658 sensor.

Future hardware and firmware integration may include body-temperature sensing, battery-level monitoring, application synchronization, and additional derived health indicators.

---

## 2. HERA Application

The **HERA Application** serves as the primary interface through which users interact with the system.

It is responsible for:

* Displaying wearable measurements
* Managing menstrual cycle records
* Recording daily wellness information
* Presenting health history and trends
* Displaying risk-awareness results
* Providing nutrition and hydration recommendations
* Managing AI-generated insights
* Providing reminders and alerts
* Allowing interaction with the AI Chatbot
* Managing wearable synchronization and device status

---

# HERA Application Features

## 1. Home Dashboard

The **Home Dashboard** provides a centralized overview of the user's current HERA information.

It may display:

* Current menstrual cycle status
* Current cycle phase
* Latest wearable health readings
* Wellness score
* Recent activity information
* AI-generated insights
* Important alerts
* Reminders
* Wearable connection status
* Quick access to major HERA features

---

## 2. Cycle Tracker

The **Cycle Tracker** allows users to record and monitor their menstrual cycles.

It includes:

* Period logging
* Cycle phase tracking
* Estimated upcoming periods
* Symptom recording
* Menstrual cycle history
* Previous cycle comparison
* Identification of possible irregular cycle patterns

The recorded information can be used by HERA's analytics and risk-awareness modules.

---

## 3. Daily Check-In

The **Daily Check-In** allows users to record wellness information that cannot be directly measured by the wearable.

Users may record:

* Mood
* Stress
* Energy level
* Sleep quality
* Menstrual symptoms
* General physical symptoms
* Other wellness observations

These records provide additional context when analyzing changes in the user's health and menstrual patterns.

---

## 4. Health Monitoring

The **Health Monitoring** feature displays physiological and activity-related information collected by the HERA wristwatch.

The current wearable prototype supports:

* Heart rate
* SpO₂
* Physical activity
* Activity classification
* Wear status

Heart rate is calculated using beat detection and filtered using recent valid measurements.

SpO₂ is calculated using the MAX30102 red and infrared sensor readings together with the implemented oxygen-saturation algorithm.

Additional planned health indicators may include:

* Body temperature
* Sleep-related information
* Activity Load Index

---

## 5. Nutrition Intelligence

The **Nutrition Intelligence** feature provides personalized nutrition and hydration guidance based on available HERA information.

Recommendations may consider:

* Menstrual cycle phase
* Physical activity
* Symptoms
* Wellness information
* Energy level
* Hydration records
* User-entered nutrition information
* Available physiological measurements

The feature is intended to provide general wellness support and should not be treated as a medical dietary prescription.

---

## 6. Hormonal Risk Assessment

The **Hormonal Risk Assessment** module analyzes available menstrual, physiological, symptom, activity, and wellness information to identify unusual or potentially concerning patterns.

The assessment may consider:

* Menstrual cycle irregularities
* Changes in cycle duration
* Repeated symptoms
* Changes in physiological measurements
* Activity patterns
* Sleep and wellness information
* Historical trends

When notable patterns are detected, HERA can provide a **risk-awareness alert** and suggest continued monitoring or professional medical consultation when appropriate.

The Hormonal Risk Assessment does not provide a medical diagnosis.

---

## 7. Health History and Analytics

The **Health History & Analytics** module allows users to review their recorded health and menstrual information over time.

It may display graphs and trends related to:

* Menstrual cycles
* Cycle duration
* Symptoms
* Mood
* Stress
* Energy
* Sleep
* Heart rate
* SpO₂
* Physical activity
* Wellness scores
* Other supported physiological indicators

The feature allows users to observe long-term changes and recurring patterns.

---

## 8. AI Chatbot / LLM Agent

The **AI Chatbot** is the user-facing conversational assistant of HERA and is technically implemented through an **LLM Agent**.

Users may ask questions related to:

* Menstrual cycles
* Menstrual symptoms
* Cycle phases
* Wellness
* Nutrition
* Hydration
* Physiological readings
* Physical activity
* HERA results
* Risk-awareness alerts
* Historical patterns

The LLM Agent may retrieve relevant HERA records and processed system results as contextual information before generating a response.

The agent can:

* Explain HERA results
* Summarize health trends
* Explain detected patterns
* Provide menstrual-health information
* Provide wellness guidance
* Explain nutrition recommendations
* Encourage professional consultation when appropriate

The AI Chatbot is not intended to diagnose diseases or replace healthcare professionals.

---

## 9. Notifications

The **Notifications** feature provides reminders and system alerts.

These may include:

* Menstrual cycle reminders
* Upcoming period reminders
* Daily check-in reminders
* Wellness reminders
* Hydration reminders
* Wearable synchronization reminders
* Device-related notifications
* Risk-awareness alerts
* Relevant health-monitoring alerts

---

## 10. User Profile

The **User Profile** manages user-specific information and application preferences.

It may contain:

* Basic personal information
* Menstrual health information
* User preferences
* Notification settings
* Wearable settings
* Application settings
* Other user-specific configurations

---

## 11. Wearable Connection

The **Wearable Connection** feature manages communication between the HERA Wristwatch and the application.

The planned module will manage:

* Connection status
* Data synchronization
* Last synchronization time
* Sensor availability
* Sensor status
* Wearable device information
* Battery information when battery monitoring is implemented

The current ESP32 firmware performs local sensing and processing, while backend/API synchronization remains part of the integration stage.

---

## 12. Sensor Data Feed

The **Sensor Data Feed** presents the latest physiological and activity measurements received from the HERA Wristwatch.

The data may be used by:

* Health Monitoring
* Health History & Analytics
* Hormonal Risk Assessment
* Wellness calculations
* Activity analysis
* AI-generated explanations
* Personalized recommendations

---

# System Data Sources

HERA combines three major categories of information.

## Wearable-Generated Data

Automatically collected through the HERA Wristwatch:

* Heart rate
* SpO₂
* Physical activity
* Activity classification
* Wear status

Additional planned measurements may include:

* Body temperature
* Sleep-related measurements
* Battery information

---

## User-Entered Data

Entered manually through the HERA Application:

* Menstrual periods
* Symptoms
* Mood
* Stress
* Energy level
* Sleep information
* Nutrition information
* Hydration information
* Daily check-ins

---

## System-Generated Data

Produced after processing wearable and user-entered information:

* Cycle phase
* Cycle predictions
* Wellness score
* Health trends
* Activity Load Index once implemented
* Hormonal risk-awareness results
* AI-generated insights
* Personalized recommendations
* Alerts and reminders

---

# Current Wearable Processing

The HERA firmware already performs several forms of local processing before information is presented or transmitted.

### Heart Rate Processing

The MAX30102 detects pulse signals. HERA calculates the interval between detected beats, converts this interval into BPM, validates the result, and averages recent measurements to improve stability.

### SpO₂ Processing

The system collects red and infrared sensor samples into a buffer and processes them using an oxygen-saturation algorithm to generate SpO₂ measurements.

### Wear Detection

HERA uses infrared readings from the optical sensor to determine whether the wristwatch is currently being worn before maintaining physiological measurements.

### Activity Processing

The QMI8658 measures acceleration across three axes. HERA calculates acceleration magnitude, estimates gravitational acceleration, determines dynamic movement, and classifies the resulting activity level.

---

# System Data Flow

The intended overall HERA data flow is:

**Physiological Sensors → ESP32-S3 → Local Sensor Processing → Backend/API → Database → Data Processing and Health Analytics → Hormonal Risk Assessment → AI Chatbot / LLM Agent → Personalized Insights, Recommendations and Alerts → HERA Application → User**

The wearable first obtains physiological and movement measurements through its connected sensors.

The ESP32-S3 performs initial processing such as heart-rate calculation, SpO₂ processing, wear detection, and physical-activity classification.

The processed wearable readings will then be transmitted to the HERA backend through the system's communication layer.

The backend will validate and store wearable measurements together with user-entered menstrual, wellness, nutrition, sleep, symptom, and daily check-in information.

The stored information will then be made available to the analytics and risk-assessment modules.

When AI-assisted interpretation is needed, relevant user records and processed HERA results will be provided to the LLM Agent as contextual information.

The generated explanation or recommendation will then be presented through the HERA Application together with relevant analytics, notifications, and alerts.

---

# Software Architecture

## 1. Wearable and Sensor Layer

Responsible for collecting physiological and movement measurements.

Current major components include:

* ESP32-S3
* MAX30102
* QMI8658

---

## 2. Embedded Processing Layer

The ESP32 firmware is responsible for:

* Reading sensor data
* Calculating heart rate
* Calculating SpO₂
* Detecting wrist wear
* Processing movement information
* Classifying activity
* Updating the wearable display
* Handling physical controls
* Managing device power

The current firmware also prevents automatic deep sleep while the wristwatch is actively being worn and monitored.

---

## 3. Communication Layer

The planned communication layer will use:

* REST API
* HTTP
* JSON

This layer will transfer wearable information between the ESP32, backend, and HERA Application.

---

## 4. Backend Layer

The backend will use **Node.js and Express.js**.

It will be responsible for:

* Receiving wearable data
* Validating incoming information
* Handling API requests
* Processing application data
* Managing database operations
* Preparing AI context
* Communicating with GroqCloud
* Providing processed data to the frontend

---

## 5. Database Layer

The system will use **SQLite** to store information such as:

* User records
* Menstrual records
* Daily check-ins
* Symptoms
* Heart rate measurements
* SpO₂ measurements
* Activity information
* Wellness records
* Nutrition and hydration information
* Historical analytics
* Risk-awareness results
* System-generated insights

---

## 6. Analytics and Risk Assessment Layer

This layer will process stored HERA information to generate:

* Menstrual cycle calculations
* Cycle predictions
* Wellness indicators
* Activity-related indicators
* Historical health trends
* Pattern detection
* Hormonal risk-awareness results

---

## 7. Artificial Intelligence Layer

HERA will use **Meta Llama through the GroqCloud API** to power its AI Chatbot / LLM Agent.

The AI layer will primarily perform:

* Contextual interpretation
* Personalized explanations
* Conversational interaction
* Wellness guidance
* Explanation of HERA-generated assessments
* Explanation of historical trends and patterns

The LLM Agent will not independently diagnose medical conditions.

---

## 8. Presentation Layer

The HERA Application will use **React and TypeScript** to provide the user interface.

It will contain:

* Home Dashboard
* Cycle Tracker
* Daily Check-In
* Health Monitoring
* Nutrition Intelligence
* Hormonal Risk Assessment
* Health History & Analytics
* AI Chatbot
* Notifications
* User Profile
* Wearable Connection
* Sensor Data Feed

---

# Proposed Technology Stack

| Technology                   | Purpose                                          |
| ---------------------------- | ------------------------------------------------ |
| **ESP32-S3**                 | Main wearable microcontroller                    |
| **Arduino Framework**        | Embedded firmware development                    |
| **MAX30102**                 | Heart rate and SpO₂ sensing                      |
| **QMI8658**                  | Physical movement and activity sensing           |
| **ST7789 TFT**               | Wearable display interface                       |
| **React**                    | HERA application frontend                        |
| **TypeScript**               | Structured and type-safe application development |
| **Node.js**                  | Backend runtime                                  |
| **Express.js**               | Backend and API framework                        |
| **SQLite**                   | Application database                             |
| **REST API / HTTP**          | System communication                             |
| **JSON**                     | Structured data transmission                     |
| **GroqCloud API**            | AI inference platform                            |
| **Meta Llama through Groq**  | AI Chatbot / LLM Agent                           |
| **Orpheus TTS through Groq** | AI-generated spoken output                       |
| **Charting Library**         | Historical health visualization                  |

---

# Project Objectives

The primary objective of HERA is to develop an integrated wearable and intelligent health-monitoring platform that can support adolescents and women in understanding and monitoring their menstrual, physiological, and wellness information.

Specifically, HERA aims to:

1. Monitor supported physiological indicators through a wearable wristwatch.
2. Track heart rate, SpO₂, movement, and physical activity.
3. Provide menstrual cycle and symptom tracking.
4. Collect daily wellness information such as mood, stress, sleep, and energy.
5. Combine wearable measurements and manually entered health information.
6. Present historical health trends through analytics and visualization.
7. Identify unusual menstrual, physiological, and wellness patterns for risk awareness.
8. Provide personalized nutrition, hydration, and wellness guidance.
9. Allow users to interact with an AI-powered assistant that can use relevant HERA information as context.
10. Provide reminders and alerts that encourage consistent health monitoring.
11. Encourage timely professional consultation when potentially concerning patterns are identified.
12. Demonstrate the integration of wearable sensing, health analytics, artificial intelligence, and menstrual health monitoring in one platform.

---

# Scope and Limitations

HERA is designed as a **preventive health-monitoring, menstrual-awareness, and wellness-support system**.

The system focuses on:

* Menstrual health monitoring
* Heart rate monitoring
* SpO₂ monitoring
* Physical activity monitoring
* Wellness tracking
* Symptom monitoring
* Historical health analytics
* Pattern identification
* Nutrition and hydration guidance
* AI-assisted explanations
* Risk-awareness alerts

The current wearable prototype directly supports heart rate, SpO₂, wear detection, and physical-activity classification. Body-temperature monitoring, true sleep monitoring, Activity Load Index calculation, battery monitoring, and backend synchronization remain subject to further hardware or software integration.

HERA is **not intended to diagnose, confirm, or treat medical conditions**.

System-generated assessments, AI responses, alerts, and recommendations are intended only to support health awareness and preventive monitoring and should not replace professional medical evaluation, diagnosis, or treatment.

The reliability of HERA may also depend on:

* Sensor accuracy
* Proper wearable placement
* Completeness of user-entered information
* Availability of historical records
* Consistency of wearable use
* Device connectivity
* Data synchronization
* Environmental and movement-related interference
