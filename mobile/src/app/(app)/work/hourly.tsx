import { useCallback, useEffect, useState } from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { formatDuration, formatMoney } from "@/lib/format";
import {
  getMyPay,
  getMyShiftToday,
  getSignOnStatus,
  endBreak,
  signOff,
  signOn,
  startBreak,
  type PayItem,
  type ShiftToday,
  type SignOnStatus,
} from "@/lib/staff-api";
import { useTheme } from "@/hooks/use-theme";

export default function HourlyWorkScreen() {
  const { staff } = useAuth();
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [shift, setShift] = useState<ShiftToday | null>(null);
  const [status, setStatus] = useState<SignOnStatus | null>(null);
  const [now, setNow] = useState(() => new Date());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [payToday, setPayToday] = useState<PayItem | null>(null);

  const refresh = useCallback(async () => {
    if (!staff) return;
    const s = await getMyShiftToday(staff.sessionToken, "hourly");
    setShift(s);
    if (s) {
      const st = await getSignOnStatus(staff.sessionToken, s.shift_id);
      setStatus(st);
    }
  }, [staff]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  async function handleSignOff() {
    if (!staff || !shift) return;
    await withBusy(() => signOff(staff.sessionToken, shift.shift_id));
    const today = new Date().toISOString().slice(0, 10);
    const rows = await getMyPay(staff.sessionToken, today, today);
    setPayToday(rows.find((r) => r.label === "Hourly") ?? null);
  }

  if (loading) return null;

  if (!shift) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedText type="subtitle">Not rostered for hourly work today.</ThemedText>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const openBreak = status?.breaks.find((b) => !b.end_time) ?? null;
  const signedOff = !!status?.sign_off_time;

  let elapsedMs = 0;
  if (status) {
    const start = new Date(status.sign_on_time).getTime();
    const end = status.sign_off_time ? new Date(status.sign_off_time).getTime() : now.getTime();
    let breakMs = 0;
    for (const b of status.breaks) {
      const bStart = new Date(b.start_time).getTime();
      const bEnd = b.end_time ? new Date(b.end_time).getTime() : now.getTime();
      breakMs += bEnd - bStart;
    }
    elapsedMs = end - start - breakMs;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="subtitle">{shift.customer_name}</ThemedText>
        <ThemedText type="small">{shift.role}</ThemedText>

        {!status && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: theme.textPrimary }]}
            disabled={busy}
            onPress={() => staff && withBusy(() => signOn(staff.sessionToken, shift.shift_id))}
          >
            <ThemedText style={{ color: theme.bg, fontWeight: "600" }}>Sign on</ThemedText>
          </TouchableOpacity>
        )}

        {status && (
          <>
            <ThemedText type="title" style={styles.timer}>
              {formatDuration(elapsedMs)}
            </ThemedText>
            <ThemedText type="small">
              {signedOff ? "Signed off" : openBreak ? "On break" : "Working"}
            </ThemedText>

            {!signedOff && (
              <>
                <TouchableOpacity
                  style={[styles.button, { borderColor: theme.border, borderWidth: 1 }]}
                  disabled={busy}
                  onPress={() =>
                    staff &&
                    withBusy(() =>
                      openBreak
                        ? endBreak(staff.sessionToken, shift.shift_id)
                        : startBreak(staff.sessionToken, shift.shift_id)
                    )
                  }
                >
                  <ThemedText>{openBreak ? "End break" : "Start break"}</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, { backgroundColor: theme.dangerText }]}
                  disabled={busy || !!openBreak}
                  onPress={handleSignOff}
                >
                  <ThemedText style={{ color: "#fff", fontWeight: "600" }}>Sign off</ThemedText>
                </TouchableOpacity>
              </>
            )}

            {signedOff && payToday && (
              <ThemedText type="subtitle">Pay: {formatMoney(payToday.amount)}</ThemedText>
            )}
          </>
        )}

        {error && <ThemedText themeColor="dangerText">{error}</ThemedText>}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24, gap: 16, alignItems: "center", justifyContent: "center" },
  timer: { fontSize: 48 },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
});
