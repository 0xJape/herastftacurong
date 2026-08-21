/*
  ============================================================
                       HERA  (v2 + WiFi upload)
       Real-Time Wearable Health & Activity Monitor
  ============================================================

  Hardware:
  - ESP32-S3
  - MAX30102
  - QMI8658
  - ST7789 1.14" TFT
  - 3 Buttons (GPIO16, 15, 14 - RTC capable, used for sleep wake)
  - NeoPixel

  v2 additions:
  - Button 2: short press = recalibrate activity baseline,
              long press  = cycle brightness (low/med/high)
  - Button 3: short press = jump to Health screen,
              long press  = manual sleep now
  - NeoPixel heartbeat pulse on each detected beat
  - Mode-indicator dots on screen
  - Idle power saving: backlight timeout + deep sleep
    (only engages when the watch is NOT being worn)

  WiFi addition:
  - Uploads live readings to HERA backend
*/

#include <Wire.h>
#include <SPI.h>

#include <Adafruit_GFX.h>
#include <Adafruit_ST7789.h>
#include <Adafruit_NeoPixel.h>

#include "MAX30105.h"
#include "heartRate.h"
#include "spo2_algorithm.h"

#include <QMI8658.h>

#include <esp_sleep.h>
#include <driver/rtc_io.h>

#include <WiFi.h>
#include <HTTPClient.h>
#include "secrets.h"


// ============================================================
// WIFI / BACKEND UPLOAD
// ============================================================
const char* WEBSITE_API_URL = "http://jaypee.local:3000/api/wearable/readings";
const char* DEVICE_ID = "HERA-001";

bool wifiConnected = false;
bool maxSensorReady = false;
bool imuReady = false;

unsigned long lastWiFiCheck = 0;
const unsigned long WIFI_CHECK_INTERVAL = 15000;  // re-check every 15s
const unsigned long WIFI_CONNECT_TIMEOUT_MS = 10000;
unsigned long lastUpload = 0;
const unsigned long UPLOAD_INTERVAL_MS = 5000;


// ============================================================
// DISPLAY
// ============================================================
#define TFT_I2C_POWER 21
#define TFT_CS        7
#define TFT_DC        39
#define TFT_RST       40
#define TFT_BACKLITE  45
#define TFT_MOSI      35
#define TFT_SCLK      36

SPIClass spi = SPIClass(FSPI);
Adafruit_ST7789 tft(&spi, TFT_CS, TFT_DC, TFT_RST);


// ============================================================
// NEOPIXEL
// ============================================================
#define NEOPIXEL_PIN   33
#define NEOPIXEL_POWER 34
Adafruit_NeoPixel pixel(1, NEOPIXEL_PIN, NEO_GRB + NEO_KHZ800);

uint8_t pixelBrightnessLevels[3] = {10, 35, 80};  // low / med / high
int brightnessIndex = 1;                          // start at medium


// ============================================================
// I2C
// ============================================================
#define I2C_SDA 42
#define I2C_SCL 41


// ============================================================
// SENSORS
// ============================================================
MAX30105 maxSensor;
QMI8658 imu;


// ============================================================
// BUTTONS
// ============================================================
#define BUTTON1_PIN 16
#define BUTTON2_PIN 15
#define BUTTON3_PIN 14


// ============================================================
// DISPLAY MODE
// ============================================================
enum DisplayMode { HEALTH_MODE, ACTIVITY_MODE, MODE_COUNT };
DisplayMode displayMode = HEALTH_MODE;


// ============================================================
// TIMERS
// ============================================================
unsigned long lastDisplayUpdate = 0;
unsigned long lastIMUUpdate     = 0;
unsigned long lastSpO2Update    = 0;

const unsigned long DISPLAY_INTERVAL = 100;  // 10 FPS
const unsigned long IMU_INTERVAL     = 20;   // 50 Hz
const unsigned long SPO2_INTERVAL    = 500;  // 2 Hz


// ============================================================
// BUTTON DEBOUNCE + LONG PRESS
// ============================================================
bool lastRawState[3]   = {HIGH, HIGH, HIGH};
bool debouncedState[3] = {HIGH, HIGH, HIGH};
unsigned long lastDebounce[3] = {0, 0, 0};
const unsigned long debounceDelay = 30;

unsigned long pressStartTime[3] = {0, 0, 0};
bool longPressFired[3] = {false, false, false};
const unsigned long LONG_PRESS_MS = 700;


// ============================================================
// MAX30102 WEAR DETECTION
// ============================================================
#define IR_WEAR_THRESHOLD 50000
bool wearing = false;
unsigned long wearStartTime = 0;
unsigned long removalStartTime = 0;
const unsigned long WEAR_CONFIRM_TIME = 400;
const unsigned long REMOVE_CONFIRM_TIME = 600;


// ============================================================
// HEART RATE
// ============================================================
int currentHeartRate = 0;
int filteredHeartRate = 0;
bool heartRateValid = false;

#define HR_HISTORY_SIZE 5
int hrHistory[HR_HISTORY_SIZE];
int hrHistoryIndex = 0;
int hrHistoryCount = 0;

long lastBeatTime = 0;

// Heartbeat NeoPixel pulse
bool heartbeatFlashActive = false;
unsigned long heartbeatFlashUntil = 0;
const unsigned long HEARTBEAT_FLASH_MS = 90;


// ============================================================
// SPO2
// ============================================================
#define SPO2_BUFFER_SIZE 100
uint32_t irBuffer[SPO2_BUFFER_SIZE];
uint32_t redBuffer[SPO2_BUFFER_SIZE];
int spo2SampleCount = 0;

int32_t currentSpO2 = 0;
int32_t calculatedSpO2 = 0;
int8_t validSpO2 = 0;
int8_t validHeartRateFromSpO2 = 0;
int32_t calculatedHeartRateFromSpO2 = 0;


// ============================================================
// ACTIVITY
// ============================================================
enum ActivityLevel { RESTING, LIGHT_ACTIVITY, WALKING, ACTIVE, VIGOROUS };
ActivityLevel activity = RESTING;

float accelerationMagnitude = 1.0;
float gravityMagnitude = 1.0;
float movementLevel = 0;


// ============================================================
// POWER / IDLE MANAGEMENT
// ============================================================
unsigned long lastInteractionTime = 0;
bool backlightOn = true;

// Only kicks in while NOT worn - active monitoring is never interrupted.
const unsigned long BACKLIGHT_TIMEOUT_MS = 20000;   // 20s idle -> screen off
const unsigned long DEEPSLEEP_TIMEOUT_MS = 120000;  // 2 min idle -> deep sleep


// ============================================================
// SETUP
// ============================================================
void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(TFT_I2C_POWER, OUTPUT);
  digitalWrite(TFT_I2C_POWER, HIGH);
  pinMode(TFT_BACKLITE, OUTPUT);
  digitalWrite(TFT_BACKLITE, HIGH);
  pinMode(NEOPIXEL_POWER, OUTPUT);
  digitalWrite(NEOPIXEL_POWER, HIGH);

  pinMode(BUTTON1_PIN, INPUT_PULLUP);
  pinMode(BUTTON2_PIN, INPUT_PULLUP);
  pinMode(BUTTON3_PIN, INPUT_PULLUP);

  spi.begin(TFT_SCLK, -1, TFT_MOSI, TFT_CS);
  tft.init(135, 240);
  tft.setRotation(3);
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextWrap(false);

  pixel.begin();
  pixel.setBrightness(pixelBrightnessLevels[brightnessIndex]);
  setPixel(0, 0, 0);

  Wire.begin(I2C_SDA, I2C_SCL);
  Wire.setClock(400000);

  printWakeReason();
  showStartup();

  Serial.println();
  Serial.println("Initializing MAX30102...");

  if (!maxSensor.begin(Wire, I2C_SPEED_FAST)) {
    maxSensorReady = false;
    Serial.println("ERROR: MAX30102 NOT FOUND");
    tft.fillScreen(ST77XX_BLACK);
    tft.setTextColor(ST77XX_RED);
    tft.setTextSize(2);
    tft.setCursor(10, 50);
    tft.println("MAX30102");
    tft.println("NOT FOUND");
  } else {
    maxSensorReady = true;
    Serial.println("MAX30102 OK");
    maxSensor.setup(0x1F, 4, 2, 100, 411, 4096);
    maxSensor.setPulseAmplitudeRed(0x1F);
    maxSensor.setPulseAmplitudeIR(0x1F);
    maxSensor.setPulseAmplitudeGreen(0);
  }

  Serial.println("Initializing QMI8658...");
  if (!imu.begin()) {
    imuReady = false;
    Serial.println("ERROR: QMI8658 NOT FOUND");
  } else {
    imuReady = true;
    Serial.println("QMI8658 OK");
  }

  clearHeartHistory();
  clearSpO2Buffer();

  lastInteractionTime = millis();
  backlightOn = true;

  // --- WiFi bring-up ---
  connectWiFi();

  tft.fillScreen(ST77XX_BLACK);
  drawHealthScreen();
}


// ============================================================
// MAIN LOOP
// ============================================================
void loop() {
  maintainWiFi();
  uploadReadingToWebsite();

  handleButtons();
  serviceMAX30102();
  updateWearDetection();

  if (millis() - lastIMUUpdate >= IMU_INTERVAL) {
    lastIMUUpdate = millis();
    updateActivity();
  }

  if (millis() - lastSpO2Update >= SPO2_INTERVAL) {
    lastSpO2Update = millis();
    calculateSpO2();
  }

  updateHeartbeatPixel();
  updateIdlePower();

  if (backlightOn && millis() - lastDisplayUpdate >= DISPLAY_INTERVAL) {
    lastDisplayUpdate = millis();
    updateDisplay();
  }
}

// ============================================================
// WEBSITE UPLOAD
// ============================================================
void uploadReadingToWebsite() {
  if (!wifiConnected || millis() - lastUpload < UPLOAD_INTERVAL_MS) return;
  lastUpload = millis();

  String payload = "{";
  payload += "\"deviceId\":\"" + String(DEVICE_ID) + "\",";
  payload += "\"wearing\":" + String(wearing ? "true" : "false") + ",";
  payload += "\"heartRate\":" + String((wearing && heartRateValid) ? filteredHeartRate : 0) + ",";
  payload += "\"heartRateValid\":" + String((wearing && heartRateValid) ? "true" : "false") + ",";
  payload += "\"spo2\":" + String(wearing ? currentSpO2 : 0) + ",";
  payload += "\"activity\":\"" + String(activityName()) + "\",";
  payload += "\"movementLevel\":" + String(movementLevel, 3) + ",";
  payload += "\"uptimeMs\":" + String(millis());
  payload += "}";

  WiFiClient client;
  HTTPClient http;
  if (!http.begin(client, WEBSITE_API_URL)) {
    Serial.print("ERROR: website API setup failed: ");
    Serial.println(WEBSITE_API_URL);
    return;
  }

  http.addHeader("Content-Type", "application/json");
  int status = http.POST(payload);
  Serial.print("Website upload HTTP status: ");
  Serial.println(status);
  if (status <= 0) {
    Serial.print("ERROR: website upload failed: ");
    Serial.println(http.errorToString(status));
  } else if (status >= 400) {
    Serial.print("ERROR: website rejected reading: ");
    Serial.println(http.getString());
  } else {
    Serial.println("Website reading accepted");
  }
  http.end();
}


// ============================================================
// WIFI / BACKEND CONNECTION
// ============================================================
void connectWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.setSleep(false);  // keep backend uploads responsive
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  unsigned long startAttempt = millis();
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startAttempt < WIFI_CONNECT_TIMEOUT_MS) {
    delay(250);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    wifiConnected = true;
    Serial.print("WiFi connected. IP: ");
    Serial.println(WiFi.localIP());
  } else {
    wifiConnected = false;
    Serial.println("WiFi connect failed/timed out - continuing offline.");
    Serial.println("Will keep retrying in the background.");
  }
}

// Non-blocking periodic check; sensor loop continues during reconnects.
void maintainWiFi() {
  if (millis() - lastWiFiCheck < WIFI_CHECK_INTERVAL) return;
  lastWiFiCheck = millis();

  if (WiFi.status() != WL_CONNECTED) {
    if (wifiConnected) {
      Serial.println("WiFi dropped - reconnecting...");
    }
    wifiConnected = false;
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  } else if (!wifiConnected) {
    // Just came back up
    wifiConnected = true;
    Serial.print("WiFi reconnected. IP: ");
    Serial.println(WiFi.localIP());
  }
}


// ============================================================
// MAX30102 SERVICE
// ============================================================
void serviceMAX30102() {
  if (!maxSensorReady) return;
  maxSensor.check();

  while (maxSensor.available()) {
    uint32_t red = maxSensor.getFIFORed();
    uint32_t ir  = maxSensor.getFIFOIR();

    if (spo2SampleCount < SPO2_BUFFER_SIZE) {
      irBuffer[spo2SampleCount] = ir;
      redBuffer[spo2SampleCount] = red;
      spo2SampleCount++;
    } else {
      for (int i = 0; i < SPO2_BUFFER_SIZE - 1; i++) {
        irBuffer[i] = irBuffer[i + 1];
        redBuffer[i] = redBuffer[i + 1];
      }
      irBuffer[SPO2_BUFFER_SIZE - 1] = ir;
      redBuffer[SPO2_BUFFER_SIZE - 1] = red;
    }

    processHeartBeat(ir);
    maxSensor.nextSample();
  }
}


// ============================================================
// HEART RATE
// ============================================================
void processHeartBeat(uint32_t irValue) {
  if (!wearing) return;

  if (checkForBeat(irValue)) {
    long now = millis();
    long delta = now - lastBeatTime;
    lastBeatTime = now;

    if (delta > 250 && delta < 1500) {
      int bpm = 60000 / delta;

      if (bpm >= 40 && bpm <= 220) {
        currentHeartRate = bpm;
        addHeartRate(bpm);
        filteredHeartRate = getAverageHeartRate();
        heartRateValid = true;

        // NeoPixel heartbeat pulse
        heartbeatFlashActive = true;
        heartbeatFlashUntil = millis() + HEARTBEAT_FLASH_MS;
        pixel.setPixelColor(0, pixel.Color(255, 0, 0));
        pixel.show();

        Serial.print("Heart rate: ");
        Serial.println(filteredHeartRate);
      }
    }
  }
}

void addHeartRate(int bpm) {
  hrHistory[hrHistoryIndex] = bpm;
  hrHistoryIndex++;
  if (hrHistoryIndex >= HR_HISTORY_SIZE) hrHistoryIndex = 0;
  if (hrHistoryCount < HR_HISTORY_SIZE) hrHistoryCount++;
}

int getAverageHeartRate() {
  if (hrHistoryCount == 0) return 0;
  long total = 0;
  for (int i = 0; i < hrHistoryCount; i++) total += hrHistory[i];
  return total / hrHistoryCount;
}


// ============================================================
// HEARTBEAT NEOPIXEL PULSE
// ============================================================
void updateHeartbeatPixel() {
  if (heartbeatFlashActive && millis() > heartbeatFlashUntil) {
    heartbeatFlashActive = false;
    setBaseStatusColor();  // restore whatever color reflects current wear state
  }
}


// ============================================================
// SPO2
// ============================================================
void calculateSpO2() {
  if (!wearing) {
    currentSpO2 = 0;
    return;
  }

  if (spo2SampleCount < SPO2_BUFFER_SIZE) return;

  maxim_heart_rate_and_oxygen_saturation(
    irBuffer, SPO2_BUFFER_SIZE, redBuffer,
    &calculatedSpO2, &validSpO2,
    &calculatedHeartRateFromSpO2, &validHeartRateFromSpO2
  );

  if (validSpO2 && calculatedSpO2 >= 70 && calculatedSpO2 <= 100) {
    currentSpO2 = calculatedSpO2;
    Serial.print("SpO2: ");
    Serial.print(currentSpO2);
    Serial.println("%");
  }
}


// ============================================================
// WEAR DETECTION
// ============================================================
void updateWearDetection() {
  if (!maxSensorReady) return;
  uint32_t ir = maxSensor.getIR();

  if (!wearing) {
    if (ir > IR_WEAR_THRESHOLD) {
      if (wearStartTime == 0) wearStartTime = millis();

      if (millis() - wearStartTime >= WEAR_CONFIRM_TIME) {
        wearing = true;
        wearStartTime = 0;
        removalStartTime = 0;

        Serial.println(">>> HERA WORN");
        setBaseStatusColor();
        markInteraction();   // waking the watch by wearing it counts as activity
      }
    } else {
      wearStartTime = 0;
    }
  } else {
    if (ir < IR_WEAR_THRESHOLD) {
      if (removalStartTime == 0) removalStartTime = millis();

      if (millis() - removalStartTime >= REMOVE_CONFIRM_TIME) {
        wearing = false;
        removalStartTime = 0;
        wearStartTime = 0;
        heartRateValid = false;
        filteredHeartRate = 0;
        currentSpO2 = 0;

        clearHeartHistory();
        clearSpO2Buffer();

        Serial.println(">>> HERA REMOVED");
        setBaseStatusColor();
        markInteraction();   // start the idle clock from the moment it's taken off
      }
    } else {
      removalStartTime = 0;
    }
  }
}

// Sets the NeoPixel to whatever "resting" color reflects current state.
// Centralized so the heartbeat flash always has a correct color to return to.
void setBaseStatusColor() {
  if (wearing) {
    setPixel(0, 80, 120);  // teal - worn, monitoring
  } else {
    setPixel(0, 0, 0);     // off - not worn
  }
}


// ============================================================
// BUFFER RESETS
// ============================================================
void clearSpO2Buffer() {
  spo2SampleCount = 0;
  for (int i = 0; i < SPO2_BUFFER_SIZE; i++) {
    irBuffer[i] = 0;
    redBuffer[i] = 0;
  }
}

void clearHeartHistory() {
  for (int i = 0; i < HR_HISTORY_SIZE; i++) hrHistory[i] = 0;
  hrHistoryIndex = 0;
  hrHistoryCount = 0;
  lastBeatTime = 0;
}


// ============================================================
// QMI8658 ACTIVITY
// ============================================================
void updateActivity() {
  if (!imuReady) return;
  QMI8658_Data data;
  if (!imu.readSensorData(data)) return;

  accelerationMagnitude = sqrt(
    data.accelX * data.accelX +
    data.accelY * data.accelY +
    data.accelZ * data.accelZ
  );

  gravityMagnitude = gravityMagnitude * 0.90 + accelerationMagnitude * 0.10;

  float dynamicAcceleration = fabs(accelerationMagnitude - gravityMagnitude);

  movementLevel = movementLevel * 0.80 + dynamicAcceleration * 0.20;

  if (movementLevel < 40) activity = RESTING;
  else if (movementLevel < 100) activity = LIGHT_ACTIVITY;
  else if (movementLevel < 200) activity = WALKING;
  else if (movementLevel < 300) activity = ACTIVE;
  else activity = VIGOROUS;

  static unsigned long lastIMUDebug = 0;
  if (millis() - lastIMUDebug >= 500) {
    lastIMUDebug = millis();
    Serial.print("ACC: ");
    Serial.print(accelerationMagnitude, 3);
    Serial.print(" | MOVE: ");
    Serial.print(movementLevel, 4);
    Serial.print(" | ACTIVITY: ");
    Serial.println(activityName());
  }
}

// Manual recalibration - resets the gravity/movement baseline.
// Useful if the watch was moved around while off-wrist.
void recalibrateActivity() {
  gravityMagnitude = accelerationMagnitude;
  movementLevel = 0;
  Serial.println(">>> Activity baseline recalibrated");

  // brief white flash as confirmation, then restore base color
  setPixel(255, 255, 255);
  delay(120);
  setBaseStatusColor();
}

const char* activityName() {
  switch (activity) {
    case RESTING:        return "RESTING";
    case LIGHT_ACTIVITY:  return "LIGHT";
    case WALKING:         return "WALKING";
    case ACTIVE:          return "ACTIVE";
    case VIGOROUS:         return "VIGOROUS";
  }
  return "UNKNOWN";
}


// ============================================================
// DISPLAY UPDATE
// ============================================================
void updateDisplay() {
  if (displayMode == HEALTH_MODE) drawHealthScreen();
  else drawActivityScreen();
}

// Small dot row at the bottom showing which screen is active.
void drawModeDots() {
  int totalModes = MODE_COUNT;
  int spacing = 12;
  int startX = (240 - (totalModes - 1) * spacing) / 2;
  int y = 128;

  for (int i = 0; i < totalModes; i++) {
    uint16_t color = (i == displayMode) ? ST77XX_WHITE : ST77XX_WHITE;
    if (i == displayMode) {
      tft.fillCircle(startX + i * spacing, y, 2, ST77XX_CYAN);
    } else {
      tft.drawCircle(startX + i * spacing, y, 2, ST77XX_WHITE);
    }
  }
}


// ============================================================
// HEALTH SCREEN
// ============================================================
void drawHealthScreen() {
  tft.fillScreen(ST77XX_BLACK);

  tft.setTextSize(2);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(90, 5);
  tft.print("HERA");

  tft.setTextSize(1);
  tft.setCursor(7, 10);
  if (wearing) {
    tft.setTextColor(ST77XX_GREEN);
    tft.print("* WORN");
  } else {
    tft.setTextColor(ST77XX_RED);
    tft.print("* OFF");
  }

  tft.drawLine(5, 28, 235, 28, ST77XX_WHITE);

  // Heart rate
  tft.setTextColor(ST77XX_RED);
  tft.setTextSize(1);
  tft.setCursor(20, 38);
  tft.print("HEART RATE");

  tft.setTextSize(4);
  tft.setCursor(15, 53);
  if (wearing && heartRateValid) tft.print(filteredHeartRate);
  else tft.print("--");

  tft.setTextSize(1);
  tft.setCursor(82, 76);
  tft.print("BPM");

  // SpO2
  tft.setTextColor(ST77XX_CYAN);
  tft.setTextSize(1);
  tft.setCursor(150, 38);
  tft.print("SpO2");

  tft.setTextSize(4);
  tft.setCursor(140, 53);
  if (wearing && currentSpO2 > 0) tft.print(currentSpO2);
  else tft.print("--");

  tft.setTextSize(1);
  tft.setCursor(205, 76);
  tft.print("%");

  // Bottom
  tft.drawLine(5, 93, 235, 93, ST77XX_WHITE);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(20, 106);
  if (!wearing) tft.print("PLACE HERA ON WRIST");
  else tft.print(activityName());

  drawModeDots();
}


// ============================================================
// ACTIVITY SCREEN
// ============================================================
void drawActivityScreen() {
  tft.fillScreen(ST77XX_BLACK);

  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(2);
  tft.setCursor(65, 5);
  tft.print("ACTIVITY");

  tft.drawLine(5, 28, 235, 28, ST77XX_WHITE);

  tft.setTextSize(1);
  tft.setTextColor(ST77XX_WHITE);
  tft.setCursor(88, 39);
  tft.print("CURRENT");

  tft.setTextSize(3);
  tft.setTextColor(ST77XX_GREEN);
  const char* name = activityName();
  int textWidth = strlen(name) * 18;
  tft.setCursor((240 - textWidth) / 2, 57);
  tft.print(name);

  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(1);
  tft.setCursor(25, 95);
  tft.print("MOVEMENT");
  tft.setCursor(125, 95);
  tft.print(movementLevel, 3);

  tft.setCursor(25, 112);
  tft.print("HEART");
  tft.setCursor(125, 112);
  if (wearing && heartRateValid) {
    tft.print(filteredHeartRate);
    tft.print(" BPM");
  } else {
    tft.print("--");
  }

  drawModeDots();
}


// ============================================================
// BUTTON HANDLING
// ============================================================
void handleButtons() {
  checkButton(BUTTON1_PIN, 0);
  checkButton(BUTTON2_PIN, 1);
  checkButton(BUTTON3_PIN, 2);

  checkLongPress(0);
  checkLongPress(1);
  checkLongPress(2);
}

void checkButton(int pin, int index) {
  bool reading = digitalRead(pin);

  if (reading != lastRawState[index]) {
    lastDebounce[index] = millis();
  }

  if (millis() - lastDebounce[index] >= debounceDelay) {
    if (reading != debouncedState[index]) {
      debouncedState[index] = reading;

      if (debouncedState[index] == LOW) {
        // fresh press
        pressStartTime[index] = millis();
        longPressFired[index] = false;
        markInteraction();
        onButtonPress(index);   // fires immediately on press-down (short action)
      }
    }
  }

  lastRawState[index] = reading;
}

// Checked every loop while a button is held, independent of debounce timing,
// so a long hold is detected even if the button never "changes" again.
void checkLongPress(int index) {
  int pin = (index == 0) ? BUTTON1_PIN : (index == 1) ? BUTTON2_PIN : BUTTON3_PIN;

  if (debouncedState[index] == LOW && !longPressFired[index]) {
    if (millis() - pressStartTime[index] >= LONG_PRESS_MS) {
      longPressFired[index] = true;
      onLongPress(index);
    }
  }
}


// ============================================================
// BUTTON ACTIONS (short press - fires immediately on press-down)
// ============================================================
void onButtonPress(int index) {
  switch (index) {

    case 0:  // Button 1: cycle display mode
      displayMode = (DisplayMode)((displayMode + 1) % MODE_COUNT);
      updateDisplay();
      Serial.println("Button 1: mode changed");
      break;

    case 1:  // Button 2 short: recalibrate activity baseline
      recalibrateActivity();
      Serial.println("Button 2: recalibrated");
      break;

    case 2:  // Button 3 short: jump to Health screen
      displayMode = HEALTH_MODE;
      updateDisplay();
      Serial.println("Button 3: home");
      break;
  }
}


// ============================================================
// BUTTON ACTIONS (long press - fires once after holding LONG_PRESS_MS)
// ============================================================
void onLongPress(int index) {
  switch (index) {

    case 1:  // Button 2 long: cycle brightness
      brightnessIndex = (brightnessIndex + 1) % 3;
      pixel.setBrightness(pixelBrightnessLevels[brightnessIndex]);
      setBaseStatusColor();
      Serial.print("Button 2 (long): brightness -> ");
      Serial.println(pixelBrightnessLevels[brightnessIndex]);
      break;

    case 2:  // Button 3 long: manual sleep now
      Serial.println("Button 3 (long): manual sleep");
      goToSleep();
      break;
  }
}


// ============================================================
// IDLE POWER MANAGEMENT
// ============================================================
void markInteraction() {
  lastInteractionTime = millis();

  if (!backlightOn) {
    digitalWrite(TFT_BACKLITE, HIGH);
    backlightOn = true;
    updateDisplay();
  }
}

void updateIdlePower() {
  // Never dim or sleep while the watch is actively being worn/monitoring.
  if (wearing) return;

  unsigned long idleFor = millis() - lastInteractionTime;

  if (backlightOn && idleFor >= BACKLIGHT_TIMEOUT_MS) {
    digitalWrite(TFT_BACKLITE, LOW);
    backlightOn = false;
    Serial.println(">>> Backlight off (idle, not worn)");
  }

  if (idleFor >= DEEPSLEEP_TIMEOUT_MS) {
    goToSleep();
  }
}

void goToSleep() {
  Serial.println(">>> Entering deep sleep - press any button to wake");

  digitalWrite(TFT_BACKLITE, LOW);
  setPixel(0, 0, 0);
  digitalWrite(NEOPIXEL_POWER, LOW);

  // WiFi/mDNS/web server will drop here - they get re-established in
  // setup() on wake, since deep sleep restarts execution from scratch.
  WiFi.disconnect(true);

  // Keep pull-ups active on the button pins during sleep so they read
  // reliably HIGH until pressed.
  rtc_gpio_pullup_en((gpio_num_t)BUTTON1_PIN);
  rtc_gpio_pullup_en((gpio_num_t)BUTTON2_PIN);
  rtc_gpio_pullup_en((gpio_num_t)BUTTON3_PIN);

  uint64_t wakeMask = (1ULL << BUTTON1_PIN) | (1ULL << BUTTON2_PIN) | (1ULL << BUTTON3_PIN);
  esp_sleep_enable_ext1_wakeup(wakeMask, ESP_EXT1_WAKEUP_ANY_LOW);

  delay(50);  // let Serial/pixel writes finish before power-down
  esp_deep_sleep_start();
  // Execution never returns here - on wake, setup() runs again from scratch.
}

void printWakeReason() {
  esp_sleep_wakeup_cause_t cause = esp_sleep_get_wakeup_cause();
  if (cause == ESP_SLEEP_WAKEUP_EXT1) {
    Serial.println(">>> Woke from deep sleep (button press)");
  }
}


// ============================================================
// STARTUP
// ============================================================
void showStartup() {
  tft.fillScreen(ST77XX_BLACK);
  tft.setTextColor(ST77XX_WHITE);
  tft.setTextSize(4);
  tft.setCursor(68, 40);
  tft.print("HERA");

  // tft.setTextSize(1);
  // tft.setCursor(72, 82);
  // tft.print("HEALTH MONITOR");

  delay(700);
}


// ============================================================
// NEOPIXEL
// ============================================================
void setPixel(uint8_t r, uint8_t g, uint8_t b) {
  pixel.setPixelColor(0, pixel.Color(r, g, b));
  pixel.show();
}
