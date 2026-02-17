import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import Constants from "expo-constants";
import { Alert } from "../types";
import { getDatabase } from "../db/schema";

// Configure how notifications appear when app is foregrounded
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const severity = data?.severity as string | undefined;

    return {
      shouldShowAlert: true,
      shouldPlaySound: severity === "critical",
      shouldSetBadge: true,
      priority:
        severity === "critical"
          ? Notifications.AndroidNotificationPriority.MAX
          : Notifications.AndroidNotificationPriority.HIGH,
    };
  },
});

export class NotificationService {
  private static instance: NotificationService;
  private responseListener: Notifications.Subscription | null = null;
  private receivedListener: Notifications.Subscription | null = null;

  static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Register for push notifications and return the Expo push token.
   * Must be called on a physical device.
   */
  async registerForPushNotifications(): Promise<string | null> {
    if (!Device.isDevice) {
      console.warn("Push notifications require a physical device");
      return null;
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== "granted") {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== "granted") {
      console.warn("Push notification permission not granted");
      return null;
    }

    // Android: create high-priority channel for emergency alerts
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync("emergency", {
        name: "Emergency Alerts",
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 250, 500],
        sound: "emergency-alert.wav",
        enableLights: true,
        lightColor: "#DC2626",
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync("general", {
        name: "General Notifications",
        importance: Notifications.AndroidImportance.HIGH,
        sound: "default",
      });
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data;
  }

  /**
   * Listen for incoming notifications and persist alerts to local DB.
   */
  startListening(onAlertReceived: (alert: Alert) => void): void {
    // Notification received while app is foregrounded
    this.receivedListener = Notifications.addNotificationReceivedListener(
      async (notification) => {
        const alert = this.parseAlertFromNotification(notification);
        if (alert) {
          await this.persistAlert(alert);
          onAlertReceived(alert);
        }
      }
    );

    // User tapped on a notification
    this.responseListener = Notifications.addNotificationResponseReceivedListener(
      async (response) => {
        const alert = this.parseAlertFromNotification(response.notification);
        if (alert) {
          await this.persistAlert(alert);
          onAlertReceived(alert);
        }
      }
    );
  }

  stopListening(): void {
    if (this.receivedListener) {
      Notifications.removeNotificationSubscription(this.receivedListener);
      this.receivedListener = null;
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
      this.responseListener = null;
    }
  }

  private parseAlertFromNotification(
    notification: Notifications.Notification
  ): Alert | null {
    const data = notification.request.content.data;
    if (!data?.id) return null;

    return {
      id: data.id as string,
      title: notification.request.content.title ?? "Emergency Alert",
      body: notification.request.content.body ?? "",
      severity: (data.severity as Alert["severity"]) ?? "warning",
      status: "active",
      category: (data.category as string) ?? "general",
      issuedAt: (data.issuedAt as string) ?? new Date().toISOString(),
      expiresAt: (data.expiresAt as string) ?? null,
      requiresResponse: Boolean(data.requiresResponse),
      responseOptions: (data.responseOptions as Alert["responseOptions"]) ?? [
        "safe",
        "need_assistance",
      ],
      metadata: data.metadata as Record<string, unknown> | undefined,
    };
  }

  private async persistAlert(alert: Alert): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT OR REPLACE INTO alerts 
       (id, title, body, severity, status, category, issued_at, expires_at, requires_response, response_options, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alert.id,
        alert.title,
        alert.body,
        alert.severity,
        alert.status,
        alert.category,
        alert.issuedAt,
        alert.expiresAt,
        alert.requiresResponse ? 1 : 0,
        JSON.stringify(alert.responseOptions),
        alert.metadata ? JSON.stringify(alert.metadata) : null,
      ]
    );
  }
}
