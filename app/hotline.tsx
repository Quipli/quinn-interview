import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAppStore } from "../src/store/useAppStore";
import { CallService } from "../src/services/CallService";
import { CallStatus } from "../src/types";

// TODO: Move to environment config
const HOTLINE_NUMBER = "+18005551234";

const STATUS_DISPLAY: Record<
  CallStatus,
  { label: string; color: string; icon: string }
> = {
  connecting: { label: "Connecting...", color: "#F59E0B", icon: "📡" },
  connected: { label: "Connected", color: "#22C55E", icon: "🟢" },
  disconnected: { label: "Call Ended", color: "#6B7280", icon: "⏹️" },
  failed: { label: "Call Failed", color: "#EF4444", icon: "❌" },
};

export default function HotlineScreen() {
  const activeAlert = useAppStore((s) => s.activeAlert);
  const setCallState = useAppStore((s) => s.setCallState);
  const network = useAppStore((s) => s.network);

  const [callStatus, setCallStatus] = useState<CallStatus | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [durationInterval, setDurationInterval] = useState<ReturnType<
    typeof setInterval
  > | null>(null);

  const handleStatusChange = useCallback(
    (status: CallStatus, callId: string) => {
      setCallStatus(status);
      setCallState(callId, status);

      if (status === "connected") {
        const interval = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
        setDurationInterval(interval);
      }

      if (status === "disconnected" || status === "failed") {
        if (durationInterval) {
          clearInterval(durationInterval);
          setDurationInterval(null);
        }
      }
    },
    [setCallState, durationInterval]
  );

  const handleCall = useCallback(async () => {
    const callService = CallService.getInstance();
    await callService.makeHotlineCall(
      HOTLINE_NUMBER,
      activeAlert?.id ?? null,
      handleStatusChange
    );
  }, [activeAlert, handleStatusChange]);

  const handleEndCall = useCallback(async () => {
    const callService = CallService.getInstance();
    await callService.endCall();
    setCallStatus("disconnected");
    setCallDuration(0);
    if (durationInterval) {
      clearInterval(durationInterval);
      setDurationInterval(null);
    }
  }, [durationInterval]);

  const handleToggleMute = useCallback(async () => {
    const callService = CallService.getInstance();
    const newMuted = !isMuted;
    await callService.toggleMute(newMuted);
    setIsMuted(newMuted);
  }, [isMuted]);

  const handleToggleSpeaker = useCallback(async () => {
    const callService = CallService.getInstance();
    const newSpeaker = !isSpeaker;
    await callService.toggleSpeaker(newSpeaker);
    setIsSpeaker(newSpeaker);
  }, [isSpeaker]);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  const isInCall = callStatus === "connecting" || callStatus === "connected";

  return (
    <View style={styles.container}>
      {/* Header Info */}
      <View style={styles.header}>
        <Text style={styles.headerIcon}>📞</Text>
        <Text style={styles.headerTitle}>Emergency Hotline</Text>
        <Text style={styles.headerNumber}>{HOTLINE_NUMBER}</Text>
        <Text style={styles.headerNote}>
          This call will be recorded for audit purposes.
        </Text>
      </View>

      {/* Call Status */}
      {callStatus && (
        <View style={styles.statusContainer}>
          <Text style={styles.statusIcon}>
            {STATUS_DISPLAY[callStatus].icon}
          </Text>
          <Text
            style={[
              styles.statusLabel,
              { color: STATUS_DISPLAY[callStatus].color },
            ]}
          >
            {STATUS_DISPLAY[callStatus].label}
          </Text>
          {callStatus === "connected" && (
            <Text style={styles.duration}>{formatDuration(callDuration)}</Text>
          )}
          {callStatus === "connecting" && (
            <ActivityIndicator
              color="#F59E0B"
              style={{ marginTop: 8 }}
            />
          )}
        </View>
      )}

      {/* In-Call Controls */}
      {callStatus === "connected" && (
        <View style={styles.callControls}>
          <TouchableOpacity
            style={[
              styles.controlButton,
              isMuted && styles.controlButtonActive,
            ]}
            onPress={handleToggleMute}
          >
            <Text style={styles.controlIcon}>{isMuted ? "🔇" : "🎤"}</Text>
            <Text style={styles.controlLabel}>
              {isMuted ? "Unmute" : "Mute"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.controlButton,
              isSpeaker && styles.controlButtonActive,
            ]}
            onPress={handleToggleSpeaker}
          >
            <Text style={styles.controlIcon}>{isSpeaker ? "🔊" : "🔈"}</Text>
            <Text style={styles.controlLabel}>Speaker</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Action Buttons */}
      <View style={styles.actions}>
        {!isInCall ? (
          <TouchableOpacity
            style={[
              styles.callButton,
              !network.isConnected && styles.callButtonDisabled,
            ]}
            onPress={handleCall}
            disabled={!network.isConnected}
          >
            <Text style={styles.callButtonIcon}>📞</Text>
            <Text style={styles.callButtonText}>Call Hotline</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={handleEndCall}
          >
            <Text style={styles.endCallButtonText}>End Call</Text>
          </TouchableOpacity>
        )}

        {!network.isConnected && (
          <Text style={styles.offlineWarning}>
            📡 You must be online to place a call.
          </Text>
        )}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          By placing this call, you consent to the recording of this
          conversation for safety and audit purposes. Recordings are stored
          securely and retained per company policy.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
    paddingHorizontal: 20,
  },
  header: {
    alignItems: "center",
    paddingTop: 40,
    paddingBottom: 24,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  headerTitle: {
    color: "#F9FAFB",
    fontSize: 24,
    fontWeight: "800",
    marginBottom: 4,
  },
  headerNumber: {
    color: "#9CA3AF",
    fontSize: 18,
    fontFamily: "monospace",
    marginBottom: 8,
  },
  headerNote: {
    color: "#6B7280",
    fontSize: 13,
    fontStyle: "italic",
  },
  statusContainer: {
    alignItems: "center",
    paddingVertical: 20,
  },
  statusIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 18,
    fontWeight: "700",
  },
  duration: {
    color: "#D1D5DB",
    fontSize: 32,
    fontFamily: "monospace",
    fontWeight: "300",
    marginTop: 8,
  },
  callControls: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 24,
    marginBottom: 24,
  },
  controlButton: {
    alignItems: "center",
    backgroundColor: "#1F2937",
    width: 72,
    height: 72,
    borderRadius: 36,
    justifyContent: "center",
  },
  controlButtonActive: {
    backgroundColor: "#374151",
  },
  controlIcon: {
    fontSize: 24,
    marginBottom: 2,
  },
  controlLabel: {
    color: "#9CA3AF",
    fontSize: 11,
  },
  actions: {
    alignItems: "center",
    paddingVertical: 20,
  },
  callButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#22C55E",
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 50,
    width: "100%",
  },
  callButtonDisabled: {
    backgroundColor: "#374151",
    opacity: 0.6,
  },
  callButtonIcon: {
    fontSize: 22,
    marginRight: 10,
  },
  callButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  endCallButton: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EF4444",
    paddingHorizontal: 40,
    paddingVertical: 18,
    borderRadius: 50,
    width: "100%",
  },
  endCallButtonText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "800",
  },
  offlineWarning: {
    color: "#FDE68A",
    fontSize: 13,
    marginTop: 12,
    textAlign: "center",
  },
  disclaimer: {
    position: "absolute",
    bottom: 40,
    left: 20,
    right: 20,
  },
  disclaimerText: {
    color: "#4B5563",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
  },
});
