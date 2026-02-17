import { Platform } from "react-native";
import { CallLog, CallStatus } from "../types";
import { getDatabase } from "../db/schema";
import { OfflineSyncService } from "./OfflineSyncService";

/**
 * CallService manages hotline calls via Twilio Voice SDK.
 *
 * Native dependencies (require Expo Dev Client):
 * - twilio-voice-react-native: WebRTC audio + Twilio integration
 * - react-native-callkeep: CallKit (iOS) / ConnectionService (Android)
 * - react-native-voip-push-notification: iOS VoIP push for incoming calls
 *
 * Call recording is handled server-side by Twilio — the TwiML webhook
 * enables <Record> on the call, and the recording URL is returned via
 * the status callback to our backend.
 */

// Lazy imports — these modules are only available in Dev Client builds
let TwilioVoice: any = null;
let RNCallKeep: any = null;

try {
  TwilioVoice = require("twilio-voice-react-native");
} catch {
  console.warn("twilio-voice-react-native not available — using stub");
}

try {
  RNCallKeep = require("react-native-callkeep").default;
} catch {
  console.warn("react-native-callkeep not available — using stub");
}

// CallKeep configuration
const CALLKEEP_OPTIONS = {
  ios: {
    appName: "Emergency Alert",
    supportsVideo: false,
    maximumCallGroups: 1,
    maximumCallsPerCallGroup: 1,
  },
  android: {
    alertTitle: "Permissions Required",
    alertDescription: "This app needs to access your phone accounts for hotline calls.",
    cancelButton: "Cancel",
    okButton: "OK",
    additionalPermissions: [],
    selfManaged: true,
  },
};

export type CallEventCallback = (status: CallStatus, callId: string) => void;

export class CallService {
  private static instance: CallService;
  private activeCallId: string | null = null;
  private activeCallSid: string | null = null;
  private callStartTime: Date | null = null;
  private eventCallback: CallEventCallback | null = null;

  static getInstance(): CallService {
    if (!CallService.instance) {
      CallService.instance = new CallService();
    }
    return CallService.instance;
  }

  /**
   * Initialize CallKeep and Twilio Voice SDK.
   * Must be called once at app startup.
   */
  async initialize(): Promise<void> {
    if (RNCallKeep) {
      await RNCallKeep.setup(CALLKEEP_OPTIONS);

      if (Platform.OS === "android") {
        RNCallKeep.setAvailable(true);
      }

      // Register CallKeep event handlers
      RNCallKeep.addEventListener("endCall", this.handleCallKeepEndCall);
      RNCallKeep.addEventListener("didPerformSetMutedCallAction", this.handleMuteToggle);
    }

    if (TwilioVoice) {
      // Register Twilio Voice event handlers
      TwilioVoice.voice().on("callInvite", this.handleIncomingCall);
      TwilioVoice.voice().on("cancel", this.handleCallCancelled);
    }
  }

  /**
   * Place an outbound call to the hotline number.
   * The call is routed through Twilio, which handles recording server-side.
   *
   * @param hotlineNumber - The phone number to call
   * @param alertId - Optional alert ID to associate with this call
   * @param onStatusChange - Callback for call status updates
   */
  async makeHotlineCall(
    hotlineNumber: string,
    alertId: string | null,
    onStatusChange: CallEventCallback
  ): Promise<string> {
    this.eventCallback = onStatusChange;
    const callId = this.generateId();
    this.activeCallId = callId;
    this.callStartTime = new Date();

    // Persist call log locally (offline-safe)
    const callLog: CallLog = {
      id: callId,
      alertId,
      userId: "", // TODO: get from auth state
      hotlineNumber,
      startedAt: this.callStartTime.toISOString(),
      endedAt: null,
      durationSeconds: null,
      recordingUrl: null,
      status: "connecting",
      syncedAt: null,
    };
    await this.persistCallLog(callLog);
    onStatusChange("connecting", callId);

    if (!TwilioVoice) {
      // Fallback: open native dialer (no recording capability)
      console.warn("Twilio SDK not available — falling back to native dialer");
      const { Linking } = require("react-native");
      await Linking.openURL(`tel:${hotlineNumber}`);
      return callId;
    }

    try {
      // Fetch access token from backend
      const token = await this.fetchTwilioToken();

      // Place the call via Twilio Voice SDK
      const call = await TwilioVoice.voice().connect(token, {
        params: {
          To: hotlineNumber,
          AlertId: alertId ?? "",
          CallId: callId,
        },
      });

      this.activeCallSid = call.getSid();

      // Listen for call state changes
      call.on("connected", () => {
        this.updateCallStatus(callId, "connected");
        onStatusChange("connected", callId);

        // Report to CallKeep so native UI shows the call
        if (RNCallKeep) {
          RNCallKeep.startCall(callId, hotlineNumber, hotlineNumber, "number", false);
          RNCallKeep.setCurrentCallActive(callId);
        }
      });

      call.on("disconnected", () => {
        this.handleCallEnd(callId);
        onStatusChange("disconnected", callId);
      });

      call.on("connectFailure", (error: any) => {
        console.error("Call connection failed:", error);
        this.updateCallStatus(callId, "failed");
        onStatusChange("failed", callId);
      });
    } catch (error) {
      console.error("Failed to place call:", error);
      this.updateCallStatus(callId, "failed");
      onStatusChange("failed", callId);
    }

    return callId;
  }

  /**
   * End the active call.
   */
  async endCall(): Promise<void> {
    if (TwilioVoice && this.activeCallSid) {
      const activeCall = TwilioVoice.voice().getActiveCall();
      if (activeCall) {
        activeCall.disconnect();
      }
    }

    if (RNCallKeep && this.activeCallId) {
      RNCallKeep.endCall(this.activeCallId);
    }

    if (this.activeCallId) {
      this.handleCallEnd(this.activeCallId);
    }
  }

  /**
   * Toggle mute on the active call.
   */
  async toggleMute(muted: boolean): Promise<void> {
    if (TwilioVoice) {
      const activeCall = TwilioVoice.voice().getActiveCall();
      if (activeCall) {
        activeCall.mute(muted);
      }
    }
  }

  /**
   * Toggle speaker on the active call.
   */
  async toggleSpeaker(enabled: boolean): Promise<void> {
    if (TwilioVoice) {
      TwilioVoice.voice().setAudioDevice(enabled ? "speaker" : "earpiece");
    }
  }

  // ─── Private Helpers ───────────────────────────────────────────

  private handleCallEnd = async (callId: string): Promise<void> => {
    const endTime = new Date();
    const durationSeconds = this.callStartTime
      ? Math.round((endTime.getTime() - this.callStartTime.getTime()) / 1000)
      : null;

    const db = await getDatabase();
    await db.runAsync(
      `UPDATE call_logs SET status = 'disconnected', ended_at = ?, duration_seconds = ? WHERE id = ?`,
      [endTime.toISOString(), durationSeconds, callId]
    );

    // Queue for sync
    const syncService = OfflineSyncService.getInstance();
    await syncService.enqueue("call_log", {
      callId,
      endedAt: endTime.toISOString(),
      durationSeconds,
    });

    this.activeCallId = null;
    this.activeCallSid = null;
    this.callStartTime = null;
  };

  private handleCallKeepEndCall = ({ callUUID }: { callUUID: string }): void => {
    this.endCall();
  };

  private handleMuteToggle = ({ muted }: { muted: boolean }): void => {
    this.toggleMute(muted);
  };

  private handleIncomingCall = (_callInvite: any): void => {
    // For v1, we don't handle inbound calls — hotline is outbound only.
    // Reject incoming Twilio calls gracefully.
    _callInvite.reject();
  };

  private handleCallCancelled = (): void => {
    if (this.activeCallId && this.eventCallback) {
      this.eventCallback("disconnected", this.activeCallId);
    }
  };

  private async updateCallStatus(callId: string, status: CallStatus): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(`UPDATE call_logs SET status = ? WHERE id = ?`, [status, callId]);
  }

  private async persistCallLog(callLog: CallLog): Promise<void> {
    const db = await getDatabase();
    await db.runAsync(
      `INSERT INTO call_logs (id, alert_id, user_id, hotline_number, started_at, ended_at, duration_seconds, recording_url, status, synced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        callLog.id,
        callLog.alertId,
        callLog.userId,
        callLog.hotlineNumber,
        callLog.startedAt,
        callLog.endedAt,
        callLog.durationSeconds,
        callLog.recordingUrl,
        callLog.status,
        callLog.syncedAt,
      ]
    );
  }

  private async fetchTwilioToken(): Promise<string> {
    // TODO: Replace with actual backend endpoint
    const response = await fetch("https://api.yourcompany.com/voice/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // TODO: Add auth token
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch Twilio token: ${response.status}`);
    }

    const data = await response.json();
    return data.token;
  }

  private generateId(): string {
    return `call-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  destroy(): void {
    if (RNCallKeep) {
      RNCallKeep.removeEventListener("endCall");
      RNCallKeep.removeEventListener("didPerformSetMutedCallAction");
    }
  }
}
