import { useEffect, useCallback } from "react";
import { useAppStore } from "../store/useAppStore";
import { NotificationService } from "../services/NotificationService";
import { Alert } from "../types";
import { getDatabase } from "../db/schema";

/**
 * Hook that initializes push notifications and loads cached alerts from SQLite.
 * Mount this once at the app root.
 */
export function useAlerts() {
  const addAlert = useAppStore((s) => s.addAlert);
  const setAlerts = useAppStore((s) => s.setAlerts);
  const alerts = useAppStore((s) => s.alerts);

  const handleAlertReceived = useCallback(
    (alert: Alert) => {
      addAlert(alert);
    },
    [addAlert]
  );

  useEffect(() => {
    const notificationService = NotificationService.getInstance();

    // Register for push and start listening
    notificationService.registerForPushNotifications().then((token) => {
      if (token) {
        // TODO: Send token to backend for this user
        console.log("Push token:", token);
      }
    });

    notificationService.startListening(handleAlertReceived);

    // Load cached alerts from local DB
    loadCachedAlerts().then((cached) => {
      if (cached.length > 0) {
        setAlerts(cached);
      }
    });

    return () => {
      notificationService.stopListening();
    };
  }, [handleAlertReceived, setAlerts]);

  return { alerts };
}

async function loadCachedAlerts(): Promise<Alert[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
    id: string;
    title: string;
    body: string;
    severity: string;
    status: string;
    category: string;
    issued_at: string;
    expires_at: string | null;
    requires_response: number;
    response_options: string | null;
    metadata: string | null;
  }>(`SELECT * FROM alerts ORDER BY issued_at DESC LIMIT 50`);

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity as Alert["severity"],
    status: row.status as Alert["status"],
    category: row.category,
    issuedAt: row.issued_at,
    expiresAt: row.expires_at,
    requiresResponse: row.requires_response === 1,
    responseOptions: row.response_options
      ? JSON.parse(row.response_options)
      : ["safe", "need_assistance"],
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  }));
}
