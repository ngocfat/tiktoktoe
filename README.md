# TikTokToe - TikTok Automation & IMSDK Management Suite

> A Vibe Coding With Antigravity Project (Powered by Google DeepMind Agentic AI)

TikTokToe is a production-grade mobile application built with React Native and Expo. It encapsulates the complete reverse-engineering pipeline of ByteDance's TikTok Android IMSDK (Instant Messaging SDK) and Web Social APIs into a centralized conversation management, continuous automation, and intelligent daily streak maintenance system.

This project was conceived, designed, and implemented following the **Vibe Coding** paradigm in close collaboration with **Antigravity** - Google DeepMind's agentic AI coding assistant. It demonstrates rapid architectural co-creation, low-level binary protocol decoding, resilient Android native background lifecycle management, and refined user experience design.

---

## 1. Architecture Overview & Vibe Coding Methodology

The Vibe Coding workflow with Antigravity bridges the gap between deep network protocol reverse engineering and production mobile software engineering:
- **Wire-Protocol Recreation**: Translating captured binary Protocol Buffers payloads and proprietary cryptographic signatures (X-Bogus, X-SS-STUB, MD5 stub hashing) from Python research prototypes into pure JavaScript and Kotlin modules.
- **Multi-Tier Robustness**: Unifying a reactive React Native presentation layer, an event-driven background service orchestrator, and low-level Android native modules (Foreground Services, AlarmManager, Headless JS, BootReceiver).
- **Process Resilience & Survivability**: Guaranteeing sub-second schedule execution even when the application is terminated, when Android enters Doze battery-saving mode, or immediately after a device reboot.

---

## 2. Core Capabilities

### 2.1. Authentication & Session Lifecycle
- **Integrated WebView Authentication**: Embedded TikTok web login flow with automated session cookie interceptors capturing `sessionid`, `sid_tt`, `multi_sids`, `ttwid`, and `uid_tt`.
- **Background Token Refresher**: Headless off-screen WebView maintaining background heartbeat pings and dynamically renewing `msToken` and session tickets without disrupting user interactions.

### 2.2. Real-Time IMSDK Synchronization
- **Direct Wire Communication**: Communicates directly with the `/v2/message/get_by_user_init` endpoint utilizing binary Protocol Buffers.
- **Social Profile Resolution**: Fetches profile metadata, high-resolution avatars, nicknames, and unique usernames via TikTok Social Spotlight and Profile endpoints.
- **Inbox Management**: Displays conversation lists with unread counters, timestamps, and real-time message previews.

### 2.3. Automated Messaging & Anti-Ban Protection
- **Continuous & Batch Sending Engine**: Configurable message counts and custom inter-message delays.
- **Safe Mode Guardrails**: Enforces a safety boundary (maximum 5 messages, minimum 5-second delay) by default to prevent triggering TikTok's server-side rate limits and anti-spam filters.
- **Unlocked High-Speed Mode**: Available via Settings with safety confirmations for power users requiring unrestricted throughput.
- **Anti-Collision Fingerprinting**: Appends randomized sequence numbers and nonces to avoid duplicate content rejection.
- **Emergency Circuit Breaker**: Automatically halts scheduled jobs upon detecting moderation or rate-limit response codes from TikTok servers.

### 2.4. Native Daily Streak Automation (24/7 Recurrence)
- **Precise Android Alarm Scheduling**: Direct integration with Android's `AlarmManager` for second-accurate execution independent of application state.
- **Headless JS Execution**: Triggers background tasks through React Native Headless JS when the app process is closed.
- **Reboot Persistence**: Automatically re-registers scheduled alarms upon system restart via `BootReceiver`.

### 2.5. Google Gemini AI Content Generation
- **Dynamic Streak Messaging**: Generates contextual daily streak messages using Google Gemini models (`gemini-2.5-flash`, `gemini-1.5-flash`, etc.).
- **Multiple Persona Tones**: Humorous, warm, poetic, conversational, or concise styles.
- **Resilient Fallback Mechanism**: Built-in curated message templates activate automatically during network drops or API quota exhaustion.

### 2.6. Watermark-Free HD Media Downloader
- **Video Extraction**: Extracts and downloads 1080p watermark-free TikTok videos from standard and shortened URLs (`vt.tiktok.com`).
- **Audio Extraction**: Isolates and saves original soundtrack audio files in MP3 format.
- **Integrated Progress Tracking**: Real-time progress bars with native file opening and sharing dialogs.

### 2.7. Design System & Diagnostics
- **Native Dual Theme**: Dark Mode and Light Mode implementations mirroring TikTok's official design system.
- **Developer & Diagnostic Console**: Real-time logging system with categorized subsystem tags (API, Network, Scheduler, Media Extraction) for ADB and in-app inspection.

### 2.8. Keyword-Driven Video Discovery & Automated Dispatch
- **Dynamic Content Discovery**: Automatically queries TikTok's Explore category streams using native X-Bogus signature generation (Comedy, Pets, Gaming, Food, Sports, Music, Technology, Trending).
- **Intelligent Keyword Mapping**: Automatically parses user-configured keywords (e.g., comedy, pets, memes, esports) to targeted high-engagement video pools.
- **Sliding-Window Deduplication**: Persists a sliding-window history of sent video identifiers per conversation in AsyncStorage to avoid repeating content.
- **Native Chat Card Unfurling**: Dispatches canonical video links via IMSDK Protocol Buffers (Command 100), triggering TikTok's native playable video card preview in direct messages while preserving the daily streak flame.

---

## 3. Directory Structure

```text
tiktok_auto_app/
├── android/                          # Customized Android native project
│   └── app/src/main/
│       ├── AndroidManifest.xml       # Foreground Service, Alarm & Boot Receiver declarations
│       └── java/com/fatpro/tiktoktoe/
│           ├── MainActivity.kt
│           ├── MainApplication.kt    # Native package registry
│           ├── TikTokBackgroundModule.kt # Native bridge for React Native
│           ├── TikTokForegroundService.kt # Persistent Foreground Service
│           ├── StreakAlarmReceiver.kt # BroadcastReceiver for AlarmManager triggers
│           ├── StreakHeadlessService.kt # React Native Headless JS task entry
│           ├── BootReceiver.kt       # Alarm restoration after device reboot
│           └── BackgroundServicePackage.kt
├── assets/                           # Branding assets, icons, splash screens
├── src/
│   ├── components/                   # Reusable UI components
│   │   ├── BottomNavBar.js
│   │   ├── BackgroundTokenRefresher.js
│   │   ├── DangerSecurityModal.js
│   │   └── index.js                  # Barrel export
│   ├── constants/                    # Constants, theme definitions, session defaults
│   │   ├── theme.js
│   │   ├── ThemeContext.js
│   │   ├── initialSession.js
│   │   ├── realAppSession.js
│   │   └── index.js                  # Barrel export
│   ├── screens/                      # Primary application screens
│   │   ├── HomeScreen.js
│   │   ├── ConversationListScreen.js
│   │   ├── ChatDetailScreen.js
│   │   ├── VideoDownloaderScreen.js
│   │   ├── SettingsScreen.js
│   │   ├── LoginWebViewScreen.js
│   │   └── index.js                  # Barrel export
│   ├── services/                     # Business logic & network services
│   │   ├── tiktokApi.js              # Reverse-engineered IMSDK & Web Social API
│   │   ├── scheduleWorker.js         # Queue management & task dispatcher
│   │   ├── headlessStreakTask.js     # Android Headless JS background handler
│   │   ├── geminiService.js          # Google Gemini AI integration
│   │   ├── tiktokDownloaderService.js # Watermark-free media extractor
│   │   ├── nativeBackgroundService.js # Android Kotlin bridge interface
│   │   ├── debugLoggerService.js     # Diagnostics & real-time log stream
│   │   └── index.js                  # Barrel export
│   └── utils/                        # Binary encoding & cryptographic utilities
│       ├── protobuf.js               # Pure JavaScript binary Protobuf parser
│       ├── signXbogus.js             # X-Bogus URL signer interface
│       ├── xbogus.js                 # X-Bogus cryptographic implementation
│       └── index.js                  # Barrel export
├── App.js                            # Navigation routing & global state hydration
├── app.json                          # Expo configuration metadata
├── index.js                          # Application entry point & Headless task registration
├── package.json                      # Dependencies and lifecycle scripts
├── .gitignore                        # Git ignore rules for native code preservation
└── README.md                         # Project documentation
```

---

## 4. Technical Specifications: TikTok IMSDK Protocol

### 4.1. Mandatory IMSDK Request Headers
- `X-SS-STUB`: Uppercase MD5 hash of the raw binary Protocol Buffers body:
  $$\text{X-SS-STUB} = \text{MD5}(\text{body.bin}).\text{toUpperCase()}$$
- `X-Bogus`: Cryptographic URL signature generated from query parameters, timestamp, and User-Agent.
- `Cookie`: Valid session string containing `sessionid`, `sid_tt`, `uid_tt`, and `multi_sids`.
- `Content-Type`: `application/x-protobuf`

### 4.2. Binary Protobuf Wire Format
The custom parser in `src/utils/protobuf.js` implements a standalone encoder/decoder without external dependencies:
- **Varint Encoding**: 64-bit BigInt support for field IDs, timestamps, and sequence numbers.
- **Length-Delimited Encoding**: UTF-8 strings and nested binary sub-messages.
- **Schema-Less Decoding**: Dynamic extraction of protobuf field tags directly from server response buffers.

---

## 5. Getting Started & Development

### 5.1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0 or yarn
- JDK 17 & Android SDK (API Level 34 or later) for native Android builds
- Physical Android device or Android Emulator

### 5.2. Installation
```bash
cd tiktok_auto_app
npm install
```

### 5.3. Running in Development
- Start Metro bundler:
  ```bash
  npx expo start
  ```
- Run on Android device / emulator:
  ```bash
  npm run android
  ```
- Run in Web browser:
  ```bash
  npm run web
  ```

### 5.4. Building Standalone Release APK
To compile a standalone Android APK:
```bash
cd android
./gradlew assembleRelease
```
The output APK is generated at:
`android/app/build/outputs/apk/release/app-release.apk`

---

## 6. Git Workflow

To push this codebase to a remote repository (GitHub, GitLab, or Bitbucket):

1. Verify local repository status:
   ```bash
   git status
   ```

2. Add remote origin:
   ```bash
   git remote add origin https://github.com/<YOUR_USERNAME>/<YOUR_REPOSITORY>.git
   git branch -M main
   ```

3. Push commits:
   ```bash
   git push -u origin main
   ```

---

## 7. Disclaimer & License

- This project is developed strictly for educational, academic research, and protocol reverse-engineering analysis under the Vibe Coding with Antigravity methodology.
- Users are solely responsible for compliance with the terms of service of third-party platforms.
- License: MIT License.
