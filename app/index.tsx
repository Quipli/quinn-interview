import { View, Text, FlatList, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAppStore } from "../src/store/useAppStore";
import { Alert as AlertType, AlertSeverity } from "../src/types";
import { formatDistanceToNow } from "date-fns";

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  critical: "#DC2626",
  warning: "#F59E0B",
  info: "#3B82F6",
};

const SEVERITY_LABELS: Record<AlertSeverity, string> = {
  critical: "CRITICAL",
  warning: "WARNING",
  info: "INFO",
};

export default function AlertListScreen() {
  const router = useRouter();
  const alerts = useAppStore((s) => s.alerts);
  const network = useAppStore((s) => s.network);
  const pendingSyncCount = useAppStore((s) => s.pendingSyncCount);

  const renderAlert = ({ item }: { item: AlertType }) => {
    const severityColor = SEVERITY_COLORS[item.severity];
    const timeAgo = formatDistanceToNow(new Date(item.issuedAt), {
      addSuffix: true,
    });

    return (
      <TouchableOpacity
        style={[styles.alertCard, { borderLeftColor: severityColor }]}
        onPress={() => router.push(`/alert/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.alertHeader}>
          <View
            style={[styles.severityBadge, { backgroundColor: severityColor }]}
          >
            <Text style={styles.severityText}>
              {SEVERITY_LABELS[item.severity]}
            </Text>
          </View>
          <Text style={styles.timeText}>{timeAgo}</Text>
        </View>
        <Text style={styles.alertTitle}>{item.title}</Text>
        <Text style={styles.alertBody} numberOfLines={2}>
          {item.body}
        </Text>
        {item.requiresResponse && (
          <View style={styles.responseRequired}>
            <Text style={styles.responseRequiredText}>Response Required</Text>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyIcon}>🛡️</Text>
      <Text style={styles.emptyTitle}>No Active Alerts</Text>
      <Text style={styles.emptySubtitle}>
        You will be notified immediately when an emergency event occurs.
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Status Bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusItem}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: network.isConnected ? "#22C55E" : "#EF4444",
              },
            ]}
          />
          <Text style={styles.statusText}>
            {network.isConnected ? "Online" : "Offline"}
          </Text>
        </View>
        {pendingSyncCount > 0 && (
          <View style={styles.statusItem}>
            <Text style={styles.syncBadge}>{pendingSyncCount} pending</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.hotlineButton}
          onPress={() => router.push("/hotline")}
        >
          <Text style={styles.hotlineButtonText}>📞 Hotline</Text>
        </TouchableOpacity>
      </View>

      {/* Alert List */}
      <FlatList
        data={alerts}
        renderItem={renderAlert}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={
          alerts.length === 0 ? styles.emptyList : styles.list
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#111827",
  },
  statusBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#1F2937",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
  },
  statusItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    color: "#9CA3AF",
    fontSize: 13,
  },
  syncBadge: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "600",
  },
  hotlineButton: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  hotlineButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
  },
  alertCard: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  alertHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  severityText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  timeText: {
    color: "#6B7280",
    fontSize: 12,
  },
  alertTitle: {
    color: "#F9FAFB",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 4,
  },
  alertBody: {
    color: "#9CA3AF",
    fontSize: 14,
    lineHeight: 20,
  },
  responseRequired: {
    marginTop: 10,
    backgroundColor: "#7C3AED20",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  responseRequiredText: {
    color: "#A78BFA",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    color: "#F9FAFB",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  emptySubtitle: {
    color: "#6B7280",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
});
