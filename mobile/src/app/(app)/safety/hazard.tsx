import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import {
  getMyHazardReports,
  listCustomers,
  submitHazardReport,
  HAZARD_CATEGORIES,
  SEVERITY_LEVELS,
  type CustomerOption,
  type HazardReportRow,
} from "@/lib/staff-api";

export default function HazardScreen() {
  const { staff } = useAuth();
  const theme = useTheme();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [reports, setReports] = useState<HazardReportRow[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [category, setCategory] = useState<string>(HAZARD_CATEGORIES[0]);
  const [severity, setSeverity] = useState<string>(SEVERITY_LEVELS[0]);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!staff) return;
    const [c, r] = await Promise.all([
      listCustomers(staff.sessionToken),
      getMyHazardReports(staff.sessionToken),
    ]);
    setCustomers(c);
    setReports(r);
  }, [staff]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit() {
    if (!staff || !description) return;
    setSubmitting(true);
    setMessage(null);
    try {
      await submitHazardReport(staff.sessionToken, customerId, category, description, severity);
      setDescription("");
      setMessage("Hazard report submitted.");
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SafeAreaView edges={["bottom"]}>
          <ThemedText type="small">Site</ThemedText>
          <View style={styles.chipRow}>
            {customers.map((c) => (
              <Chip key={c.id} label={c.name} selected={customerId === c.id} onPress={() => setCustomerId(c.id)} theme={theme} />
            ))}
            <Chip label="Other" selected={customerId === null} onPress={() => setCustomerId(null)} theme={theme} />
          </View>

          <ThemedText type="small" style={styles.label}>
            Category
          </ThemedText>
          <View style={styles.chipRow}>
            {HAZARD_CATEGORIES.map((c) => (
              <Chip key={c} label={c} selected={category === c} onPress={() => setCategory(c)} theme={theme} />
            ))}
          </View>

          <ThemedText type="small" style={styles.label}>
            Risk rating
          </ThemedText>
          <View style={styles.chipRow}>
            {SEVERITY_LEVELS.map((s) => (
              <Chip key={s} label={s} selected={severity === s} onPress={() => setSeverity(s)} theme={theme} />
            ))}
          </View>

          <ThemedText type="small" style={styles.label}>
            Description
          </ThemedText>
          <TextInput
            style={[styles.textarea, { borderColor: theme.border, color: theme.textPrimary }]}
            multiline
            numberOfLines={4}
            value={description}
            onChangeText={setDescription}
          />

          {message && <ThemedText type="small">{message}</ThemedText>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.textPrimary }]}
            disabled={submitting || !description}
            onPress={handleSubmit}
          >
            <ThemedText style={{ color: theme.bg, fontWeight: "600" }}>
              {submitting ? "Submitting…" : "Submit"}
            </ThemedText>
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.historyTitle}>
            Your reports
          </ThemedText>
          {reports.map((r) => (
            <View key={r.id} style={[styles.historyRow, { borderColor: theme.border }]}>
              <ThemedText type="small">
                {new Date(r.created_at).toLocaleDateString()} · {r.customer_name ?? "Other"} · {r.category}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {r.severity} · {r.status}
              </ThemedText>
            </View>
          ))}
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function Chip({
  label,
  selected,
  onPress,
  theme,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  theme: Record<string, string>;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, { borderColor: theme.border }, selected && { backgroundColor: theme.hoverBg }]}
      onPress={onPress}
    >
      <ThemedText type="small">{label}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 160, gap: 8 },
  label: { marginTop: 12 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  textarea: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 90, textAlignVertical: "top" },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 16 },
  historyTitle: { marginTop: 24, marginBottom: 8 },
  historyRow: { borderBottomWidth: 1, paddingVertical: 10 },
});
