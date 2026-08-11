import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";
import {
  addJob,
  addNcr,
  getCrewCandidates,
  getJobsForShift,
  getMyShiftToday,
  getRateOptions,
  pauseJob,
  resumeJob,
  setJobCrew,
  startJob,
  finaliseJob,
  NCR_ISSUES,
  type CrewCandidate,
  type Job,
  type RateOption,
  type ShiftToday,
} from "@/lib/staff-api";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";

export function JobWorkScreen({ jobType }: { jobType: "container" | "rework" }) {
  const { staff } = useAuth();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ShiftToday | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [candidates, setCandidates] = useState<CrewCandidate[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [rateOptions, setRateOptions] = useState<RateOption[]>([]);
  const [selectedRateOption, setSelectedRateOption] = useState<RateOption | null>(null);
  const [quantity, setQuantity] = useState("");
  const [containerNumber, setContainerNumber] = useState("");
  const [cartonCount, setCartonCount] = useState("");
  const [skuCount, setSkuCount] = useState("");
  const [notes, setNotes] = useState("");

  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [editorMode, setEditorMode] = useState<"crew" | "participation" | "ncr" | null>(null);
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());
  const [participationValues, setParticipationValues] = useState<Record<string, string>>({});
  const [selectedIssues, setSelectedIssues] = useState<Set<string>>(new Set());

  const isManager = shift?.role === "Manager";

  const refresh = useCallback(async () => {
    if (!staff) return;
    const s = await getMyShiftToday(staff.sessionToken, jobType);
    setShift(s);
    if (s) {
      const [jobRows, crewRows, rateRows] = await Promise.all([
        getJobsForShift(staff.sessionToken, s.shift_id),
        getCrewCandidates(staff.sessionToken, s.shift_id),
        getRateOptions(staff.sessionToken, s.shift_id, jobType),
      ]);
      setJobs(jobRows);
      setCandidates(crewRows);
      setRateOptions(rateRows);
      setSelectedRateOption((prev) => prev ?? rateRows[0] ?? null);
    }
  }, [staff, jobType]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function withBusy(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function handleAddJob() {
    if (!staff || !shift || !selectedRateOption) return;
    await withBusy(() =>
      addJob(staff.sessionToken, shift.shift_id, jobType, selectedRateOption.position_or_type, {
        size: jobType === "container" ? (selectedRateOption.size ?? undefined) : undefined,
        quantity: jobType === "rework" ? Number(quantity) || undefined : undefined,
        containerNumber: jobType === "container" ? containerNumber || undefined : undefined,
        cartonCount: jobType === "container" ? Number(cartonCount) || undefined : undefined,
        skuCount: jobType === "container" ? Number(skuCount) || undefined : undefined,
        notes: jobType === "rework" ? notes || undefined : undefined,
      })
    );
    setShowAddForm(false);
    setQuantity("");
    setContainerNumber("");
    setCartonCount("");
    setSkuCount("");
    setNotes("");
  }

  function openCrewEditor(job: Job) {
    setExpandedJobId(job.job_id);
    setEditorMode("crew");
    setSelectedStaffIds(new Set(job.crew.map((c) => c.staff_id)));
  }

  async function saveCrew(jobId: string) {
    if (!staff) return;
    await withBusy(() => setJobCrew(staff.sessionToken, jobId, Array.from(selectedStaffIds)));
    setEditorMode(null);
    setExpandedJobId(null);
  }

  function openParticipationEditor(job: Job) {
    setExpandedJobId(job.job_id);
    setEditorMode("participation");
    const even = job.crew.length > 0 ? (100 / job.crew.length).toFixed(1) : "0";
    const initial: Record<string, string> = {};
    for (const c of job.crew) initial[c.staff_id] = String(c.participation_pct ?? even);
    setParticipationValues(initial);
  }

  async function saveFinalise(jobId: string) {
    if (!staff) return;
    const participation = Object.entries(participationValues).map(([staff_id, v]) => ({
      staff_id,
      participation_pct: Number(v) || 0,
    }));
    await withBusy(() => finaliseJob(staff.sessionToken, jobId, participation));
    setEditorMode(null);
    setExpandedJobId(null);
  }

  function openNcrEditor(job: Job) {
    setExpandedJobId(job.job_id);
    setEditorMode("ncr");
    setSelectedIssues(new Set());
  }

  async function saveNcr(jobId: string) {
    if (!staff) return;
    await withBusy(() => addNcr(staff.sessionToken, jobId, Array.from(selectedIssues)));
    setEditorMode(null);
    setExpandedJobId(null);
  }

  if (loading) return null;

  if (!shift) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.notRostered}>
          <ThemedText type="subtitle">Not rostered for {jobType} work today.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <SafeAreaView edges={["bottom"]}>
          <ThemedText type="subtitle">{shift.customer_name}</ThemedText>
          <ThemedText type="small" style={styles.roleLabel}>
            {shift.role}
          </ThemedText>

          {isManager && (
            <TouchableOpacity
              style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}
              onPress={() => setShowAddForm((v) => !v)}
            >
              <ThemedText>{showAddForm ? "Cancel" : `+ Add ${jobType}`}</ThemedText>
            </TouchableOpacity>
          )}

          {showAddForm && (
            <View style={[styles.card, { borderColor: theme.border }]}>
              {rateOptions.length === 0 ? (
                <ThemedText type="small" themeColor="dangerText">
                  No {jobType} rate cards set up for this site yet — ask an admin to add one before
                  logging a job (pay can't be calculated otherwise).
                </ThemedText>
              ) : (
                <>
                  <ThemedText type="small">Type{jobType === "container" ? " / size" : ""}</ThemedText>
                  <View style={styles.row}>
                    {rateOptions.map((opt) => {
                      const key = `${opt.position_or_type}::${opt.size ?? ""}`;
                      const selected =
                        selectedRateOption?.position_or_type === opt.position_or_type &&
                        selectedRateOption?.size === opt.size;
                      return (
                        <TouchableOpacity
                          key={key}
                          onPress={() => setSelectedRateOption(opt)}
                          style={[
                            styles.chip,
                            { borderColor: theme.border },
                            selected && { backgroundColor: theme.hoverBg },
                          ]}
                        >
                          <ThemedText type="small">
                            {jobType === "container" ? `${opt.position_or_type} (${opt.size})` : opt.position_or_type}
                          </ThemedText>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </>
              )}
              {jobType === "container" ? (
                <>
                  <FormField
                    label="Container number"
                    value={containerNumber}
                    onChangeText={setContainerNumber}
                    theme={theme}
                  />
                  <FormField
                    label="Carton count"
                    value={cartonCount}
                    onChangeText={setCartonCount}
                    theme={theme}
                    keyboardType="number-pad"
                  />
                  <FormField
                    label="SKU count"
                    value={skuCount}
                    onChangeText={setSkuCount}
                    theme={theme}
                    keyboardType="number-pad"
                  />
                </>
              ) : (
                <>
                  <FormField
                    label="Quantity"
                    value={quantity}
                    onChangeText={setQuantity}
                    theme={theme}
                    keyboardType="number-pad"
                  />
                  <FormField label="Notes" value={notes} onChangeText={setNotes} theme={theme} />
                </>
              )}
              {rateOptions.length > 0 && (
                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.textPrimary }]}
                  disabled={busy || !selectedRateOption}
                  onPress={handleAddJob}
                >
                  <ThemedText style={{ color: theme.bg, fontWeight: "600" }}>Create</ThemedText>
                </TouchableOpacity>
              )}
            </View>
          )}

          {error && <ThemedText themeColor="dangerText">{error}</ThemedText>}

          {jobs.map((job) => (
            <View key={job.job_id} style={[styles.card, { borderColor: theme.border }]}>
              <ThemedText type="smallBold">
                {job.job_type === "container"
                  ? `${job.container_number ?? job.type} (${job.size ?? "—"})`
                  : `${job.type} × ${job.quantity ?? 0}`}
              </ThemedText>
              <ThemedText type="small">Status: {job.status}</ThemedText>
              <ThemedText type="small">
                Crew: {job.crew.length === 0 ? "none assigned" : job.crew.map((c) => c.full_name).join(", ")}
              </ThemedText>
              {job.ncr.length > 0 && (
                <ThemedText type="small" themeColor="dangerText">
                  NCR: {job.ncr.map((n) => n.issues.join("/")).join("; ")}
                </ThemedText>
              )}

              {isManager && job.status !== "finalised" && (
                <View style={styles.row}>
                  {job.status === "pending" && (
                    <>
                      <SmallButton label="Assign crew" onPress={() => openCrewEditor(job)} theme={theme} />
                      {job.crew.length > 0 && (
                        <SmallButton
                          label="Start"
                          onPress={() => staff && withBusy(() => startJob(staff.sessionToken, job.job_id))}
                          theme={theme}
                        />
                      )}
                    </>
                  )}
                  {job.status === "started" && (
                    <>
                      <SmallButton
                        label="Pause"
                        onPress={() => staff && withBusy(() => pauseJob(staff.sessionToken, job.job_id))}
                        theme={theme}
                      />
                      <SmallButton label="Raise NCR" onPress={() => openNcrEditor(job)} theme={theme} />
                      <SmallButton label="Finalise" onPress={() => openParticipationEditor(job)} theme={theme} />
                    </>
                  )}
                  {job.status === "paused" && (
                    <SmallButton
                      label="Resume"
                      onPress={() => staff && withBusy(() => resumeJob(staff.sessionToken, job.job_id))}
                      theme={theme}
                    />
                  )}
                </View>
              )}

              {expandedJobId === job.job_id && editorMode === "crew" && (
                <View style={styles.editor}>
                  {candidates.map((c) => {
                    const selected = selectedStaffIds.has(c.staff_id);
                    return (
                      <TouchableOpacity
                        key={c.staff_id}
                        style={[
                          styles.chip,
                          { borderColor: theme.border },
                          selected && { backgroundColor: theme.hoverBg },
                        ]}
                        onPress={() => {
                          const next = new Set(selectedStaffIds);
                          selected ? next.delete(c.staff_id) : next.add(c.staff_id);
                          setSelectedStaffIds(next);
                        }}
                      >
                        <ThemedText type="small">
                          {c.full_name} ({c.role})
                        </ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  <SmallButton label="Save crew" onPress={() => saveCrew(job.job_id)} theme={theme} />
                </View>
              )}

              {expandedJobId === job.job_id && editorMode === "participation" && (
                <View style={styles.editor}>
                  {job.crew.map((c) => (
                    <View key={c.staff_id} style={styles.participationRow}>
                      <ThemedText type="small" style={{ flex: 1 }}>
                        {c.full_name}
                      </ThemedText>
                      <TextInput
                        style={[styles.participationInput, { borderColor: theme.border, color: theme.textPrimary }]}
                        keyboardType="decimal-pad"
                        value={participationValues[c.staff_id] ?? ""}
                        onChangeText={(v) => setParticipationValues((prev) => ({ ...prev, [c.staff_id]: v }))}
                      />
                      <ThemedText type="small">%</ThemedText>
                    </View>
                  ))}
                  <SmallButton label="Confirm finalise" onPress={() => saveFinalise(job.job_id)} theme={theme} />
                </View>
              )}

              {expandedJobId === job.job_id && editorMode === "ncr" && (
                <View style={styles.editor}>
                  {NCR_ISSUES.map((issue) => {
                    const selected = selectedIssues.has(issue);
                    return (
                      <TouchableOpacity
                        key={issue}
                        style={[
                          styles.chip,
                          { borderColor: theme.border },
                          selected && { backgroundColor: theme.hoverBg },
                        ]}
                        onPress={() => {
                          const next = new Set(selectedIssues);
                          selected ? next.delete(issue) : next.add(issue);
                          setSelectedIssues(next);
                        }}
                      >
                        <ThemedText type="small">{issue}</ThemedText>
                      </TouchableOpacity>
                    );
                  })}
                  <SmallButton label="Submit NCR" onPress={() => saveNcr(job.job_id)} theme={theme} />
                </View>
              )}
            </View>
          ))}
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

function FormField({
  label,
  value,
  onChangeText,
  theme,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  theme: Record<string, string>;
  keyboardType?: "default" | "number-pad" | "decimal-pad";
}) {
  return (
    <View style={styles.field}>
      <ThemedText type="small">{label}</ThemedText>
      <TextInput
        style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

function SmallButton({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: Record<string, string>;
}) {
  return (
    <TouchableOpacity
      style={[styles.smallButton, { borderColor: theme.border }]}
      onPress={onPress}
    >
      <ThemedText type="small">{label}</ThemedText>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 160, gap: 12 },
  notRostered: { flex: 1, padding: 24, alignItems: "center", justifyContent: "center" },
  roleLabel: { marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 8,
    marginTop: 12,
  },
  field: { gap: 4, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
  },
  smallButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  editor: { gap: 8, marginTop: 8 },
  participationRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  participationInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    width: 60,
    textAlign: "right",
  },
});
