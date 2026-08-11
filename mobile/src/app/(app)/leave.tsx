import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import {
  cancelLeaveRequest,
  getMyLeaveRequests,
  submitLeaveRequest,
  LEAVE_TYPES,
  type LeaveRequestRow,
} from "@/lib/staff-api";

export default function LeaveScreen() {
  const { staff } = useAuth();
  const theme = useTheme();

  const [type, setType] = useState<string>(LEAVE_TYPES[0]);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [requests, setRequests] = useState<LeaveRequestRow[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!staff) return;
    setRequests(await getMyLeaveRequests(staff.sessionToken));
  }, [staff]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit() {
    if (!staff || !startDate || !endDate) return;
    setSubmitting(true);
    setError(null);
    try {
      await submitLeaveRequest(staff.sessionToken, type, startDate, endDate);
      setStartDate("");
      setEndDate("");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel(id: string) {
    if (!staff) return;
    await cancelLeaveRequest(staff.sessionToken, id);
    await refresh();
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SafeAreaView edges={["bottom"]}>
          <ThemedText type="title" style={styles.title}>
            Request leave
          </ThemedText>

          <ThemedText type="small">Type</ThemedText>
          <View style={styles.chipRow}>
            {LEAVE_TYPES.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, { borderColor: theme.border }, type === t && { backgroundColor: theme.hoverBg }]}
                onPress={() => setType(t)}
              >
                <ThemedText type="small">{t}</ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <ThemedText type="small" style={styles.label}>
            Start date (YYYY-MM-DD)
          </ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-08-20"
            placeholderTextColor={theme.textMuted}
          />

          <ThemedText type="small" style={styles.label}>
            End date (YYYY-MM-DD)
          </ThemedText>
          <TextInput
            style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-08-22"
            placeholderTextColor={theme.textMuted}
          />

          {error && <ThemedText themeColor="dangerText">{error}</ThemedText>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.textPrimary }]}
            disabled={submitting || !startDate || !endDate}
            onPress={handleSubmit}
          >
            <ThemedText style={{ color: theme.bg, fontWeight: "600" }}>
              {submitting ? "Submitting…" : "Submit request"}
            </ThemedText>
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.historyTitle}>
            Your requests
          </ThemedText>
          {requests.length === 0 && <ThemedText type="small">No leave requests yet.</ThemedText>}
          {requests.map((r) => (
            <View key={r.id} style={[styles.historyRow, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small">
                  {r.start_date} → {r.end_date} · {r.type}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {r.status}
                </ThemedText>
              </View>
              {r.status === "pending" && (
                <TouchableOpacity onPress={() => handleCancel(r.id)}>
                  <ThemedText type="small" themeColor="dangerText">
                    Cancel
                  </ThemedText>
                </TouchableOpacity>
              )}
            </View>
          ))}
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 160, gap: 8 },
  title: { fontSize: 24, marginBottom: 8 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 8 },
  chip: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  label: { marginTop: 8, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  historyTitle: { marginTop: 24, marginBottom: 8 },
  historyRow: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, paddingVertical: 10, gap: 8 },
});
