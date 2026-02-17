const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

/**
 * Expo Config Plugin: react-native-voip-push-notification
 *
 * iOS only: Enables PushKit VoIP entitlements so the app can receive
 * VoIP push notifications that wake the app for incoming calls.
 *
 * This is required by Apple for any app that uses CallKit for incoming calls.
 * Note: Apple will reject apps that use VoIP push for non-call purposes.
 */
function withVoipPush(config) {
  // Add VoIP push entitlement
  config = withEntitlementsPlist(config, (mod) => {
    mod.modResults["aps-environment"] =
      mod.modResults["aps-environment"] ?? "production";
    return mod;
  });

  // Ensure VoIP background mode is present
  config = withInfoPlist(config, (mod) => {
    const bgModes = mod.modResults.UIBackgroundModes ?? [];
    if (!bgModes.includes("voip")) bgModes.push("voip");
    if (!bgModes.includes("remote-notification")) {
      bgModes.push("remote-notification");
    }
    mod.modResults.UIBackgroundModes = bgModes;
    return mod;
  });

  return config;
}

module.exports = withVoipPush;
