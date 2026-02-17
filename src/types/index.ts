// ─── Alert / Event Types ───────────────────────────────────────────

export type AlertSeverity = "critical" | "warning" | "info";

export type AlertStatus = "active" | "resolved" | "expired";

export type UserResponseType = "safe" | "need_assistance" | "evacuating" | "sheltering";

export interface Alert {
  id: string;
  title: string;
  body: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: string; // e.g. "severe_weather", "security", "fire", "medical"
  issuedAt: string; // ISO 8601
  expiresAt: string | null;
  requiresResponse: boolean;
  responseOptions: UserResponseType[];
  metadata?: Record<string, unknown>;
}

export interface UserResponse {
  id: string;
  alertId: string;
  userId: string;
  response: UserResponseType;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  respondedAt: string; // ISO 8601
  syncedAt: string | null; // null = pending sync
}

// ─── Offline Sync Types ────────────────────────────────────────────

export type SyncStatus = "pending" | "syncing" | "synced" | "failed";

export interface SyncQueueItem {
  id: string;
  type: "user_response" | "location_update" | "call_log";
  payload: string; // JSON-serialized
  createdAt: string;
  status: SyncStatus;
  retryCount: number;
  lastError: string | null;
}

// ─── Call / Hotline Types ──────────────────────────────────────────

export type CallStatus = "connecting" | "connected" | "disconnected" | "failed";

export interface CallLog {
  id: string;
  alertId: string | null;
  userId: string;
  hotlineNumber: string;
  startedAt: string;
  endedAt: string | null;
  durationSeconds: number | null;
  recordingUrl: string | null; // populated after backend processing
  status: CallStatus;
  syncedAt: string | null;
}

// ─── Location Types ────────────────────────────────────────────────

export interface LocationSnapshot {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: string;
}

// ─── Auth / User Types ─────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  organizationId: string;
  pushToken: string | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
}

// ─── Network Types ─────────────────────────────────────────────────

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
  type: string | null;
}
