const { withInfoPlist, withAndroidManifest } = require("expo/config-plugins");

/**
 * Expo Config Plugin: react-native-callkeep
 *
 * iOS: Adds VoIP background mode and CallKit entitlements to Info.plist.
 * Android: Adds MANAGE_OWN_CALLS and CALL_PHONE permissions, plus
 *          ConnectionService declaration to AndroidManifest.xml.
 */
function withCallKeep(config) {
  // ─── iOS ─────────────────────────────────────────────────────
  config = withInfoPlist(config, (mod) => {
    const bgModes = mod.modResults.UIBackgroundModes ?? [];
    if (!bgModes.includes("voip")) bgModes.push("voip");
    if (!bgModes.includes("audio")) bgModes.push("audio");
    mod.modResults.UIBackgroundModes = bgModes;
    return mod;
  });

  // ─── Android ─────────────────────────────────────────────────
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;

    // Add permissions
    const permissions = [
      "android.permission.MANAGE_OWN_CALLS",
      "android.permission.CALL_PHONE",
      "android.permission.READ_PHONE_STATE",
      "android.permission.FOREGROUND_SERVICE",
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

    // Add ConnectionService to the main application
    const app = manifest.application?.[0];
    if (app) {
      if (!app.service) app.service = [];

      const serviceExists = app.service.some(
        (s) =>
          s.$?.["android:name"] ===
          "io.wazo.callkeep.VoiceConnectionService"
      );

      if (!serviceExists) {
        app.service.push({
          $: {
            "android:name": "io.wazo.callkeep.VoiceConnectionService",
            "android:permission": "android.permission.BIND_TELECOM_CONNECTION_SERVICE",
            "android:foregroundServiceType": "phoneCall",
          },
          "intent-filter": [
            {
              action: [
                {
                  $: {
                    "android:name":
                      "android.telecom.ConnectionService",
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

module.exports = withCallKeep;
