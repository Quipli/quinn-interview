import { useState, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAppStore } from "../../src/store/useAppStore";
import { ResponseService } from "../../src/services/ResponseService";
import { UserResponseType, AlertSeverity } from "../../src/types";

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "#DC2626",
  warning: "#F59E0B",
  info: "#3B82F6",
};

const RESPONSE_OPTIONS: {
  type: UserResponseType;
  label: string;
  icon: string;
  color: string;
  description: string;
}[] = [
  {
    type: "safe",
    label: "I Am Safe",
    icon: "✅",
    color: "#22C55E",
    description: "I am not in danger and do not need assistance.",
  },
  {
    type: "need_assistance",
    label: "Need Assistance",
    icon: "🆘",
    color: "#EF4444",
    description: "I need help. Please send assistance to my location.",
  },
  {
    type: "evacuating",
    label: "Evacuating",
    icon: "🏃",
    color: "#F59E0B",
    description: "I am currently evacuating the area.",
  },
  {
    type: "sheltering",
    label: "Sheltering in Place",
    icon: "🏠",
    color: "#3B82F6",
    description: "I am sheltering in place at my current location.",
  },
];

export default function AlertDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const alerts = useAppStore((s) => s.alerts);
  const auth = useAppStore((s) => s.auth);
  const responses = useAppStore((s) => s.responses);
  const setResponse = useAppStore((s) => s.setResponse);
  const network = useAppStore((s) => s.network);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedResponse, setSelectedResponse] =
    useState<UserResponseType | null>(null);

  const alert = alerts.find((a) => a.id === id);
  const existingResponse = id ? responses[id] : null;

  const handleSubmitResponse = useCallback(
    async (responseType: UserResponseType) => {
      if (!id || !auth.user) return;

      setIsSubmitting(true);
      setSelectedResponse(responseType);

      try {
        const responseService = ResponseService.getInstance();
        const response = await responseService.submitResponse(
          id,
          auth.user.id,
          responseType
        );
        setResponse(id, response);
      } catch (error) {
        console.error("Failed to submit response:", error);
      } finally {
        setIsSubmitting(false);
      }
    },
    [id, auth.user, setResponse]
  );

  if (!alert) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Alert not found.</Text>
      </View>
    );
  }

  const severityColor = SEVERITY_COLORS[alert.severity];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Alert Info */}
      <View style={[styles.alertBanner, { backgroundColor: severityColor }]}>
        <Text style={styles.bannerCategory}>
          {alert.category.replace("_", " ").toUpperCase()}
        </Text>
        <Text style={styles.bannerTitle}>{alert.title}</Text>
        <Text style={styles.bannerTime}>
          Issued: {new Date(alert.issuedAt).toLocaleString()}
        </Text>
      </View>

      <View style={styles.bodySection}>
        <Text style={styles.bodyText}>{alert.body}</Text>
      </View>

      {/* Offline indicator */}
      {!network.isConnected && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            📡 You are offline. Your response will be saved and synced when
            connectivity returns.
          </Text>
        </View>
      )}

      {/* Response Section */}
      {alert.requiresResponse && !existingResponse && (
        <View style={styles.responseSection}>
          <Text style={styles.responseSectionTitle}>
            What is your current status?
          </Text>
          <Text style={styles.responseSectionSubtitle}>
            Your location will be captured with your response.
          </Text>

          {RESPONSE_OPTIONS.filter((opt) =>
            alert.responseOptions.includes(opt.type)
          ).map((option) => (
            <TouchableOpacity
              key={option.type}
              style={[
                styles.responseButton,
                { borderColor: option.color },
                selectedResponse === option.type && {
                  backgroundColor: option.color + "20",
                },
              ]}
              onPress={() => handleSubmitResponse(option.type)}
              disabled={isSubmitting}
              activeOpacity={0.7}
            >
              {isSubmitting && selectedResponse === option.type ? (
                <ActivityIndicator color={option.color} />
              ) : (
                <>
                  <Text style={styles.responseIcon}>{option.icon}</Text>
                  <View style={styles.responseTextContainer}>
                    <Text
                      style={[styles.responseLabel, { color: option.color }]}
                    >
                      {option.label}
                    </Text>
                    <Text style={styles.responseDescription}>
                      {option.description}
                    </Text>
                  </View>
                </>
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Already Responded */}
      {existingResponse && (
        <View style={styles.respondedSection}>
          <Text style={styles.respondedIcon}>✓</Text>
          <Text style={styles.respondedTitle}>Response Submitted</Text>
          <Text style={styles.respondedDetail}>
            You responded:{" "}
            <Text style={styles.respondedValue}>
              {existingResponse.response.replace("_", " ").toUpperCase()}
            </Text>
          </Text>
          <Text style={styles.respondedDetail}>
            At: {new Date(existingResponse.respondedAt).toLocaleString()}
          </Text>
          {existingResponse.latitude && (
            <Text style={styles.respondedDetail}>
              Location: {existingResponse.latitude.toFixed(4)},{" "}
              {existingResponse.longitude?.toFixed(4)}
            </Text>
          )}
          {!existingResponse.syncedAt && (
            <Text style={styles.pendingSync}>⏳ Pending sync to server</Text>
          )}
        </View>
      )}

      {/* Hotline CTA */}
      <TouchableOpacity
        style={styles.hotlineCta}
        onPress={() => router.push("/hotline")}
      >
        <Text style={styles.hotlineCtaIcon}>📞</Text>
        <Text style={styles.hotlineCtaText}>Call Emergency Hotline</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  content: {
    paddingBottom: 40,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 16,
    textAlign: "center",
    marginTop: 40,
  },
  alertBanner: {
    padding: 20,
    paddingTop: 16,
  },
  bannerCategory: {
    color: "#FFFFFF99",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 6,
  },
  bannerTitle: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 6,
  },
  bannerTime: {
    color: "#FFFFFFCC",
    fontSize: 13,
  },
  bodySection: {
    padding: 20,
  },
  bodyText: {
    color: "#D1D5DB",
    fontSize: 15,
    lineHeight: 24,
  },
  offlineBanner: {
    marginHorizontal: 16,
    backgroundColor: "#78350F",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offlineText: {
    color: "#FDE68A",
    fontSize: 13,
    lineHeight: 18,
  },
  responseSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  responseSectionTitle: {
    color: "#F9FAFB",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  responseSectionSubtitle: {
    color: "#6B7280",
    fontSize: 13,
    marginBottom: 16,
  },
  responseButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 2,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  responseIcon: {
    fontSize: 28,
    marginRight: 14,
  },
  responseTextContainer: {
    flex: 1,
  },
  responseLabel: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 2,
  },
  responseDescription: {
    color: "#9CA3AF",
    fontSize: 13,
    lineHeight: 18,
  },
  respondedSection: {
    marginHorizontal: 20,
    backgroundColor: "#064E3B",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 20,
  },
  respondedIcon: {
    color: "#34D399",
    fontSize: 36,
    marginBottom: 8,
  },
  respondedTitle: {
    color: "#ECFDF5",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
  },
  respondedDetail: {
    color: "#A7F3D0",
    fontSize: 13,
    marginBottom: 4,
  },
  respondedValue: {
    fontWeight: "700",
  },
  pendingSync: {
    color: "#FDE68A",
    fontSize: 12,
    marginTop: 8,
  },
  hotlineCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 20,
    backgroundColor: "#1F2937",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
  },
  hotlineCtaIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  hotlineCtaText: {
    color: "#F9FAFB",
    fontSize: 16,
    fontWeight: "600",
  },
});
