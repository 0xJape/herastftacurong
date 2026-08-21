# HERA Client Setup Guide

This guide sets up the current HERA prototype on a Windows computer, connects Android phones on the same network, enables the AI assistant, and connects the ESP32-S3 wearable.

## 1. What the client needs

### Computer

- Windows 10 or 11
- Node.js 22 LTS: <https://nodejs.org/>
- A stable Wi-Fi connection
- Arduino IDE 2: <https://www.arduino.cc/en/software>
- USB data cable for the ESP32-S3

### Android phone

- Google Chrome
- Same Wi-Fi network as the HERA computer

### Optional AI service

- GroqCloud account and API key: <https://console.groq.com/keys>

Do not send API keys, Wi-Fi passwords, exported wellness data, or the live database through email or public repositories.

## 2. Files the client must change

| File | Setting | Required value |
|---|---|---|
| `backend/.env` | `GROQ_API_KEY` | Client's Groq API key |
| `backend/.env` | `GROQ_MODEL` | Keep `openai/gpt-oss-20b` unless another supported model is chosen |
| `firmware/secrets.h` | `WIFI_SSID` | Client Wi-Fi name |
| `firmware/secrets.h` | `WIFI_PASSWORD` | Client Wi-Fi password |
| `firmware/hera4.ino` | `WEBSITE_API_URL` | HERA computer hostname or fixed LAN IP |
| `firmware/hera4.ino` | `DEVICE_ID` | Unique ID for each wearable, such as `HERA-001` |

No frontend API URL needs changing. Browser requests use the same host that served the app.

## 3. Install and start the web application

1. Copy the complete `HERA` folder to the client computer. Keep its folder structure unchanged.
2. Open Command Prompt in the `HERA\backend` folder.
3. Run `npm install`.
4. Return to the main `HERA` folder.
5. Double-click `start.bat`.
6. Confirm the browser opens `http://localhost:3000`.

`start.bat` stops an existing listener on port `3000`, starts the HERA backend, and opens the local app. Keep the **HERA Backend** window open while HERA is in use.

### If Windows Firewall asks

Allow Node.js on **Private networks** only. Do not expose prototype port `3000` on a public network.

## 4. Configure the AI assistant

1. Copy `backend/.env.example` to `backend/.env` if `.env` does not exist.
2. Set:

```text
GROQ_API_KEY=client_key_here
GROQ_MODEL=openai/gpt-oss-20b
```

3. Restart HERA by closing its backend window and running `start.bat` again.
4. Open HERA Assistant and send a test message.

If no Groq key is configured, core HERA features still work; AI requests show that the assistant is not configured.

## 5. Open HERA on Android phones

Every phone uses the HERA **computer's** address, not the phone's hostname.

1. Keep HERA running on the computer.
2. Connect computer and phone to the same Wi-Fi.
3. Find the computer name in **Settings → System → About → Device name**.
4. In Android Chrome, try:

```text
http://COMPUTER-NAME.local:3000
```

Example:

```text
http://HERA-PC.local:3000
```

If `.local` does not resolve:

1. Run `ipconfig` on the computer.
2. Find the active Wi-Fi adapter's **IPv4 Address**.
3. Open that address on the phone, for example:

```text
http://192.168.1.20:3000
```

All phones on the permitted local network can use the same computer address. For a reliable installation, reserve the computer's IPv4 address in the router or use production HTTPS hosting.

## 6. Install HERA on Android

For local HTTP access, Chrome may offer only a home-screen shortcut because full PWA installation and offline support require HTTPS outside `localhost`.

1. Open HERA in Chrome.
2. Tap Chrome menu **⋮**.
3. Tap **Add to Home screen** or **Install app** if available.
4. Confirm **Install** or **Add**.

For a full installable app, deploy HERA to an HTTPS domain and open that URL on the phone.

## 7. Configure and flash the wearable

### Create Wi-Fi secrets

1. Copy `firmware/secrets.example.h` to `firmware/secrets.h`.
2. Enter the client Wi-Fi details:

```cpp
#pragma once

const char* WIFI_SSID = "CLIENT_WIFI_NAME";
const char* WIFI_PASSWORD = "CLIENT_WIFI_PASSWORD";
```

Do not commit or share `secrets.h`.

### Set backend address and wearable ID

Edit these lines in `firmware/hera4.ino`:

```cpp
const char* WEBSITE_API_URL = "http://HERA-PC.local:3000/api/wearable/readings";
const char* DEVICE_ID = "HERA-001";
```

If `.local` fails on the ESP32, use the computer's reserved IPv4 address:

```cpp
const char* WEBSITE_API_URL = "http://192.168.1.20:3000/api/wearable/readings";
```

Every wearable must have a different `DEVICE_ID`.

### Arduino setup

1. Install ESP32 board support in Arduino IDE.
2. Select the matching ESP32-S3 board and COM port.
3. Install libraries required by `hera4.ino`:
   - Adafruit GFX Library
   - Adafruit ST7735 and ST7789 Library
   - Adafruit NeoPixel
   - SparkFun MAX3010x Sensor Library
   - QMI8658 library compatible with `#include <QMI8658.h>`
4. Open `firmware/hera4.ino`.
5. Verify/compile it.
6. Upload it to the ESP32-S3.
7. Open Serial Monitor and confirm Wi-Fi connection plus successful HTTP uploads.

## 8. Database and demo data

- Live SQLite data is stored in `backend/hera.db`.
- `backend/hera.db-shm` and `backend/hera.db-wal` are SQLite working files.
- To load demonstration records, stop the backend and run `node seed-demo.js` from `backend`.

Back up `hera.db` only while the backend is stopped. Treat it as sensitive wellness data. Do not replace or delete a client's database without confirmed backup and written approval.

## 9. Client-specific branding changes

Optional branding can be changed in:

- App name and colors: `frontend/manifest.webmanifest`
- Page title and mobile theme metadata: `frontend/index.html`
- Logo and launcher image: `frontend/assets/HERA_LOGO.jpg`
- Main visual styling: `frontend/styles.css`

Keep launcher artwork square. Production Android PWAs work best with dedicated 192×192 and 512×512 PNG icons, including a maskable icon.

## 10. Acceptance checklist

- [ ] `npm install` completes without errors.
- [ ] `start.bat` opens HERA at `http://localhost:3000`.
- [ ] Phone opens HERA through computer hostname or LAN IP.
- [ ] Daily check-in saves and reloads.
- [ ] Cycle entry saves and appears in history.
- [ ] AI assistant responds, if Groq is enabled.
- [ ] ESP32 Serial Monitor reports Wi-Fi connected.
- [ ] Dashboard shows the configured wearable ID and fresh readings.
- [ ] Client knows where `backend/hera.db` is backed up.

## 11. Before real-user or internet deployment

Current build is a local prototype, not a production medical system. Before storing real user health information or exposing HERA to the internet, add:

- HTTPS and a stable domain
- User authentication and per-user authorization
- Restricted CORS and authenticated wearable ingestion
- Encrypted secret management
- Automated encrypted backups and restore testing
- Audit logging, monitoring, rate limits, and security testing
- Privacy policy, retention/deletion process, consent flow, and applicable legal review

Do not port-forward `3000` directly from the router. Use a secured HTTPS deployment instead.

## 12. Common problems

### Phone cannot open HERA

- Confirm backend window remains open.
- Confirm both devices use the same Wi-Fi.
- Try IPv4 instead of `.local`.
- Allow Node.js through Windows Firewall on Private networks.
- Disable guest Wi-Fi/client isolation or use a trusted private network.

### Wearable does not upload

- Confirm `WIFI_SSID` and `WIFI_PASSWORD`.
- Confirm `WEBSITE_API_URL` uses the HERA computer, not the ESP32 or phone address.
- Test the same computer address from a phone first.
- Check Serial Monitor for HTTP status or connection errors.
- Use a reserved IPv4 address if hostname resolution fails.

### AI assistant is unavailable

- Confirm `backend/.env` exists.
- Confirm `GROQ_API_KEY` has no quotes or extra spaces.
- Restart the backend after changing `.env`.
- Confirm the computer has internet access and the selected Groq model remains available.
