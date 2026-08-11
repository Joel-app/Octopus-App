import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import {
  getMyIncidentReports,
  listCustomers,
  submitIncidentReport,
  INCIDENT_TYPES,
  SEVERITY_LEVELS,
  YES_NO,
  type CustomerOption,
  type IncidentReportRow,
} from "@/lib/staff-api";

export default function IncidentScreen() {
  const { staff } = useAuth();
  const theme = useTheme();

  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [reports, setReports] = useState<IncidentReportRow[]>([]);
  const [customerId, setCustomerId] = useState<string | null>(null);

  const [incidentType, setIncidentType] = useState<string>(INCIDENT_TYPES[0]);
  const [description, setDescription] = useState("");
  const [taskActivity, setTaskActivity] = useState("");

  const [injuredPersonName, setInjuredPersonName] = useState("");
  const [injuredPersonContact, setInjuredPersonContact] = useState("");
  const [injuredPersonPosition, setInjuredPersonPosition] = useState("");

  const [firstAidGiven, setFirstAidGiven] = useState<string>(YES_NO[1]);
  const [firstAiderName, setFirstAiderName] = useState("");
  const [treatment, setTreatment] = useState("");
  const [stoppedWork, setStoppedWork] = useState<string>(YES_NO[1]);

  const [potentialSeverity, setPotentialSeverity] = useState<string>(SEVERITY_LEVELS[0]);
  const [investigationNotes, setInvestigationNotes] = useState("");
  const [signatoryName, setSignatoryName] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!staff) return;
    const [c, r] = await Promise.all([
      listCustomers(staff.sessionToken),
      getMyIncidentReports(staff.sessionToken),
    ]);
    setCustomers(c);
    setReports(r);
  }, [staff]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleSubmit() {
    if (!staff || !description || !signatoryName) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const reportNo = await submitIncidentReport(staff.sessionToken, customerId, description, {
        injuredPersonName,
        injuredPersonContact,
        injuredPersonPosition,
        incidentType,
        dateTime: new Date().toISOString(),
        taskActivity,
        firstAidGiven,
        firstAiderName,
        treatment,
        stoppedWork,
        potentialSeverity,
        investigationNotes,
        signatoryName,
      });
      setMessage(`Submitted — report ${reportNo}`);
      setDescription("");
      setSignatoryName("");
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
          <Section title="Incident">
            <FieldLabel>Site</FieldLabel>
            <ChipRow>
              {customers.map((c) => (
                <Chip key={c.id} label={c.name} selected={customerId === c.id} onPress={() => setCustomerId(c.id)} theme={theme} />
              ))}
              <Chip label="Other" selected={customerId === null} onPress={() => setCustomerId(null)} theme={theme} />
            </ChipRow>

            <FieldLabel>Type</FieldLabel>
            <ChipRow>
              {INCIDENT_TYPES.map((t) => (
                <Chip key={t} label={t} selected={incidentType === t} onPress={() => setIncidentType(t)} theme={theme} />
              ))}
            </ChipRow>

            <TextField label="Task/activity at the time" value={taskActivity} onChangeText={setTaskActivity} theme={theme} />
            <TextField label="What happened" value={description} onChangeText={setDescription} theme={theme} multiline />
          </Section>

          <Section title="Injured / affected person">
            <TextField label="Name" value={injuredPersonName} onChangeText={setInjuredPersonName} theme={theme} />
            <TextField label="Contact number" value={injuredPersonContact} onChangeText={setInjuredPersonContact} theme={theme} />
            <TextField label="Position" value={injuredPersonPosition} onChangeText={setInjuredPersonPosition} theme={theme} />
          </Section>

          <Section title="Treatment">
            <FieldLabel>First aid given?</FieldLabel>
            <ChipRow>
              {YES_NO.map((v) => (
                <Chip key={v} label={v} selected={firstAidGiven === v} onPress={() => setFirstAidGiven(v)} theme={theme} />
              ))}
            </ChipRow>
            <TextField label="First aider name" value={firstAiderName} onChangeText={setFirstAiderName} theme={theme} />
            <TextField label="Treatment given" value={treatment} onChangeText={setTreatment} theme={theme} />
            <FieldLabel>Work stopped?</FieldLabel>
            <ChipRow>
              {YES_NO.map((v) => (
                <Chip key={v} label={v} selected={stoppedWork === v} onPress={() => setStoppedWork(v)} theme={theme} />
              ))}
            </ChipRow>
          </Section>

          <Section title="Investigation">
            <FieldLabel>Potential severity</FieldLabel>
            <ChipRow>
              {SEVERITY_LEVELS.map((s) => (
                <Chip key={s} label={s} selected={potentialSeverity === s} onPress={() => setPotentialSeverity(s)} theme={theme} />
              ))}
            </ChipRow>
            <TextField label="Notes" value={investigationNotes} onChangeText={setInvestigationNotes} theme={theme} multiline />
          </Section>

          <Section title="Sign-off">
            <TextField label="Your name (signature)" value={signatoryName} onChangeText={setSignatoryName} theme={theme} />
          </Section>

          {message && <ThemedText type="small">{message}</ThemedText>}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.textPrimary }]}
            disabled={submitting || !description || !signatoryName}
            onPress={handleSubmit}
          >
            <ThemedText style={{ color: theme.bg, fontWeight: "600" }}>
              {submitting ? "Submitting…" : "Submit incident report"}
            </ThemedText>
          </TouchableOpacity>

          <ThemedText type="subtitle" style={styles.historyTitle}>
            Your reports
          </ThemedText>
          {reports.map((r) => (
            <View key={r.id} style={[styles.historyRow, { borderColor: theme.border }]}>
              <ThemedText type="small">
                {r.report_no} · {new Date(r.created_at).toLocaleDateString()}
              </ThemedText>
              <ThemedText type="small" themeColor="textMuted">
                {r.customer_name ?? "Other"} · {r.status}
              </ThemedText>
            </View>
          ))}
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <ThemedText type="small" style={styles.label}>
      {children}
    </ThemedText>
  );
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.chipRow}>{children}</View>;
}

function TextField({
  label,
  value,
  onChangeText,
  theme,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: Record<string, string>;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        style={[
          multiline ? styles.textarea : styles.input,
          { borderColor: theme.border, color: theme.textPrimary },
        ]}
        value={value}
        onChangeText={onChangeText}
        multiline={multiline}
      />
    </View>
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
  section: { marginBottom: 16, gap: 4 },
  sectionTitle: { marginBottom: 8 },
  field: { marginBottom: 8 },
  label: { marginTop: 8, marginBottom: 4 },
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10 },
  textarea: { borderWidth: 1, borderRadius: 8, padding: 10, minHeight: 80, textAlignVertical: "top" },
  button: { borderRadius: 8, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  historyTitle: { marginTop: 24, marginBottom: 8 },
  historyRow: { borderBottomWidth: 1, paddingVertical: 10 },
});
