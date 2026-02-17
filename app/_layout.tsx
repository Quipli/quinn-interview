import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useNetworkStatus } from "../src/hooks/useNetworkStatus";
import { useAlerts } from "../src/hooks/useAlerts";
import { OfflineSyncService } from "../src/services/OfflineSyncService";
import { CallService } from "../src/services/CallService";
import { LocationService } from "../src/services/LocationService";

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  useNetworkStatus();
  useAlerts();

  useEffect(() => {
    async function bootstrap() {
      try {
        // Initialize core services
        await LocationService.getInstance().requestPermissions();
        await OfflineSyncService.getInstance().initialize();
        await CallService.getInstance().initialize();
      } catch (error) {
        console.error("Bootstrap error:", error);
      } finally {
        await SplashScreen.hideAsync();
      }
    }

    bootstrap();

    return () => {
      OfflineSyncService.getInstance().destroy();
      CallService.getInstance().destroy();
    };
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#DC2626" },
          headerTintColor: "#FFFFFF",
          headerTitleStyle: { fontWeight: "bold" },
          contentStyle: { backgroundColor: "#111827" },
        }}
      >
        <Stack.Screen
          name="index"
          options={{ title: "Emergency Alerts" }}
        />
        <Stack.Screen
          name="alert/[id]"
          options={{ title: "Alert Details" }}
        />
        <Stack.Screen
          name="hotline"
          options={{ title: "Emergency Hotline" }}
        />
      </Stack>
    </>
  );
}
