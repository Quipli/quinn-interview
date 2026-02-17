import { create } from "zustand";
import {
  Alert,
  AuthState,
  CallStatus,
  NetworkState,
  UserResponse,
} from "../types";

interface AppState {
  // Auth
  auth: AuthState;
  setAuth: (auth: Partial<AuthState>) => void;
  clearAuth: () => void;

  // Alerts
  alerts: Alert[];
  activeAlert: Alert | null;
  setAlerts: (alerts: Alert[]) => void;
  addAlert: (alert: Alert) => void;
  setActiveAlert: (alert: Alert | null) => void;
  updateAlertStatus: (alertId: string, status: Alert["status"]) => void;

  // Responses
  responses: Record<string, UserResponse>; // keyed by alertId
  setResponse: (alertId: string, response: UserResponse) => void;

  // Call
  activeCallId: string | null;
  callStatus: CallStatus | null;
  setCallState: (callId: string | null, status: CallStatus | null) => void;

  // Network
  network: NetworkState;
  setNetwork: (network: NetworkState) => void;

  // Sync
  pendingSyncCount: number;
  setPendingSyncCount: (count: number) => void;
}

const initialAuthState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
};

export const useAppStore = create<AppState>((set) => ({
  // ─── Auth ────────────────────────────────────────────────────
  auth: initialAuthState,
  setAuth: (auth) =>
    set((state) => ({ auth: { ...state.auth, ...auth } })),
  clearAuth: () => set({ auth: initialAuthState }),

  // ─── Alerts ──────────────────────────────────────────────────
  alerts: [],
  activeAlert: null,
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) =>
    set((state) => {
      // Deduplicate by id
      const exists = state.alerts.some((a) => a.id === alert.id);
      if (exists) return state;
      return { alerts: [alert, ...state.alerts] };
    }),
  setActiveAlert: (alert) => set({ activeAlert: alert }),
  updateAlertStatus: (alertId, status) =>
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === alertId ? { ...a, status } : a
      ),
    })),

  // ─── Responses ───────────────────────────────────────────────
  responses: {},
  setResponse: (alertId, response) =>
    set((state) => ({
      responses: { ...state.responses, [alertId]: response },
    })),

  // ─── Call ────────────────────────────────────────────────────
  activeCallId: null,
  callStatus: null,
  setCallState: (callId, status) =>
    set({ activeCallId: callId, callStatus: status }),

  // ─── Network ─────────────────────────────────────────────────
  network: { isConnected: true, isInternetReachable: null, type: null },
  setNetwork: (network) => set({ network }),

  // ─── Sync ────────────────────────────────────────────────────
  pendingSyncCount: 0,
  setPendingSyncCount: (count) => set({ pendingSyncCount: count }),
}));
