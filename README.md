# Emergency Alert App

A cross-platform (iOS & Android) emergency notification mobile app built with **Expo** (Dev Client) and **React Native**. Designed for offline-first reliability, real-time push alerts, user status responses with geolocation, and recorded hotline calls via Twilio.

## Architecture Overview

```
app/                        # Expo Router screens (file-based routing)
├── _layout.tsx             # Root layout — initializes services
├── index.tsx               # Alert list (home screen)
├── alert/[id].tsx          # Alert detail + user response
└── hotline.tsx             # Emergency hotline call screen

src/
├── types/index.ts          # TypeScript interfaces for all domain models
├── db/schema.ts            # SQLite schema + database initialization
├── services/
│   ├── NotificationService.ts   # Push notification registration & handling
│   ├── LocationService.ts       # GPS capture with fallback
│   ├── OfflineSyncService.ts    # Offline queue + background sync engine
│   ├── CallService.ts           # Twilio Voice SDK + CallKeep integration
│   └── ResponseService.ts       # User alert response + location capture
├── store/
│   └── useAppStore.ts           # Zustand global state
└── hooks/
    ├── useAlerts.ts             # Alert loading + push listener hook
    └── useNetworkStatus.ts      # Network connectivity monitor

plugins/                    # Custom Expo config plugins for native modules
├── withCallKeep.js         # CallKit (iOS) + ConnectionService (Android)
├── withVoipPush.js         # iOS PushKit VoIP entitlement
└── withTwilioVoice.js      # Twilio Voice SDK native config
```

## Key Technical Decisions

### Why Expo Dev Client (not Expo Go)?

Three native modules are required that don't ship with Expo Go:

| Module | Purpose |
|---|---|
| `twilio-voice-react-native` | WebRTC audio for hotline calls via Twilio |
| `react-native-callkeep` | Native call UI (CallKit on iOS, ConnectionService on Android) |
| `react-native-voip-push-notification` | iOS VoIP push to wake app for incoming calls |

The **Expo Dev Client** allows these native modules while keeping the Expo managed workflow (config plugins, EAS Build, OTA updates).

### Offline-First Architecture

1. **Local DB**: All alerts, responses, and call logs are persisted to SQLite (`expo-sqlite`) immediately.
2. **Sync Queue**: Every write operation enqueues a sync item. The `OfflineSyncService` processes the queue when connectivity is available.
3. **Background Sync**: `expo-background-fetch` + `expo-task-manager` attempt sync even when the app is backgrounded.
4. **Network Listener**: `@react-native-community/netinfo` triggers immediate sync when the device comes back online.

### Call Recording

Call recording is handled **server-side by Twilio**, not on-device. When a hotline call is placed:
1. The app connects to Twilio via WebRTC.
2. Twilio's TwiML webhook enables `<Record>` on the call.
3. The recording URL is returned to our backend via Twilio's status callback.
4. The app stores the `recordingUrl` in the call log after sync.

This approach avoids on-device recording permissions and ensures audit-grade recordings.

## Prerequisites

- **Node.js** >= 18
- **Expo CLI**: `npm install -g expo-cli`
- **EAS CLI**: `npm install -g eas-cli`
- **Xcode** (for iOS builds)
- **Android Studio** (for Android builds)
- **Twilio Account** with Voice SDK enabled

## Getting Started

```bash
# 1. Install dependencies
npm install

# 2. Generate native projects
npx expo prebuild

# 3. Run on iOS simulator (Dev Client)
npx expo run:ios

# 4. Run on Android emulator (Dev Client)
npx expo run:android
```

> **Note**: This app cannot run in Expo Go due to native module dependencies. You must use a Dev Client build.

## Environment Variables

Create a `.env` file:

```env
API_BASE_URL=https://api.yourcompany.com
TWILIO_IDENTITY=your-twilio-identity
```

## Backend Requirements

The app expects these API endpoints:

| Endpoint | Method | Purpose |
|---|---|---|
| `/voice/token` | POST | Generate Twilio Access Token (JWT) |
| `/voice/incoming` | POST | TwiML webhook for call routing |
| `/voice/status` | POST | Twilio status callback (recording URL, duration) |
| `/api/responses` | POST | Sync user alert responses |
| `/api/locations` | POST | Sync location updates |
| `/api/calls` | POST | Sync call logs |

## Building for Production

```bash
# Build for both platforms via EAS
eas build --platform all

# Submit to app stores
eas submit --platform ios
eas submit --platform android
```

## Testing

```bash
npm test
```

## License

Proprietary — Internal use only.
