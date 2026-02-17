import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Emergency Alert",
  slug: "emergency-alert-app",
  version: "1.0.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  scheme: "emergency-alert",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.yourcompany.emergencyalert",
    infoPlist: {
      UIBackgroundModes: ["voip", "audio", "location", "fetch", "remote-notification"],
      NSLocationWhenInUseUsageDescription:
        "We need your location to report your position during an emergency.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "We need your location to report your position during an emergency, even in the background.",
      NSMicrophoneUsageDescription:
        "Microphone access is required for hotline calls.",
    },
    entitlements: {
      "aps-environment": "production",
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#DC2626",
    },
    package: "com.yourcompany.emergencyalert",
    permissions: [
      "ACCESS_FINE_LOCATION",
      "ACCESS_COARSE_LOCATION",
      "ACCESS_BACKGROUND_LOCATION",
      "RECORD_AUDIO",
      "FOREGROUND_SERVICE",
      "RECEIVE_BOOT_COMPLETED",
      "VIBRATE",
      "WAKE_LOCK",
    ],
  },
  plugins: [
    "expo-router",
    [
      "expo-location",
      {
        locationAlwaysAndWhenInUsePermission:
          "Allow Emergency Alert to access your location during emergencies.",
        isAndroidBackgroundLocationEnabled: true,
      },
    ],
    [
      "expo-notifications",
      {
        color: "#DC2626",
      },
    ],
    "expo-secure-store",
    [
      "expo-av",
      {
        microphonePermission:
          "Allow Emergency Alert to access your microphone for hotline calls.",
      },
    ],
    // Custom config plugins for native modules
    "./plugins/withCallKeep",
    "./plugins/withVoipPush",
    "./plugins/withTwilioVoice",
  ],
  extra: {
    eas: {
      projectId: "your-eas-project-id",
    },
    apiBaseUrl: process.env.API_BASE_URL ?? "https://api.yourcompany.com",
    twilioIdentity: process.env.TWILIO_IDENTITY,
  },
});
