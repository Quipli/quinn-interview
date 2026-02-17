const {
  withInfoPlist,
  withAndroidManifest,
  withAppBuildGradle,
} = require("expo/config-plugins");

/**
 * Expo Config Plugin: twilio-voice-react-native
 *
 * iOS: Adds microphone usage description and audio background mode.
 * Android: Adds audio permissions and Twilio's Firebase messaging service.
 */
function withTwilioVoice(config) {
  // ─── iOS ─────────────────────────────────────────────────────
  config = withInfoPlist(config, (mod) => {
    // Microphone permission
    if (!mod.modResults.NSMicrophoneUsageDescription) {
      mod.modResults.NSMicrophoneUsageDescription =
        "Microphone access is required for hotline calls.";
    }

    // Background audio mode
    const bgModes = mod.modResults.UIBackgroundModes ?? [];
    if (!bgModes.includes("audio")) bgModes.push("audio");
    mod.modResults.UIBackgroundModes = bgModes;

    return mod;
  });

  // ─── Android ─────────────────────────────────────────────────
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // Audio permissions
    const permissions = [
      "android.permission.RECORD_AUDIO",
      "android.permission.MODIFY_AUDIO_SETTINGS",
      "android.permission.BLUETOOTH",
      "android.permission.BLUETOOTH_CONNECT",
    ];

    if (!manifest["uses-permission"]) {
      manifest["uses-permission"] = [];
    }

    for (const perm of permissions) {
      const exists = manifest["uses-permission"].some(
        (p) => p.$?.["android:name"] === perm
      );
      if (!exists) {
        manifest["uses-permission"].push({
          $: { "android:name": perm },
        });
      }
    }

    // Add Twilio's messaging service for incoming call notifications
    const app = manifest.application?.[0];
    if (app) {
      if (!app.service) app.service = [];

      const serviceExists = app.service.some(
        (s) =>
          s.$?.["android:name"] ===
          "com.twiliovoicereactnative.VoiceFirebaseMessagingService"
      );

      if (!serviceExists) {
        app.service.push({
          $: {
            "android:name":
              "com.twiliovoicereactnative.VoiceFirebaseMessagingService",
            "android:exported": "false",
          },
          "intent-filter": [
            {
              action: [
                {
                  $: {
                    "android:name": "com.google.firebase.MESSAGING_EVENT",
                  },
                },
              ],
            },
          ],
        });
      }
    }

    return mod;
  });

  return config;
}

module.exports = withTwilioVoice;
