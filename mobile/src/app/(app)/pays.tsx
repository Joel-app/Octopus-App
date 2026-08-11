import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { formatMoney } from "@/lib/format";
import { getMyPay, type PayItem } from "@/lib/staff-api";
import { useTheme } from "@/hooks/use-theme";

type Period = "day" | "week" | "month";

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function getRange(period: Period, anchor: Date): { start: Date; end: Date } {
  if (period === "day") {
    return { start: anchor, end: anchor };
  }
  if (period === "week") {
    const day = anchor.getDay(); // 0 = Sunday
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(anchor);
    start.setDate(anchor.getDate() + mondayOffset);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  const start = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const end = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  return { start, end };
}

function shiftAnchor(period: Period, anchor: Date, direction: 1 | -1): Date {
  const next = new Date(anchor);
  if (period === "day") next.setDate(next.getDate() + direction);
  else if (period === "week") next.setDate(next.getDate() + 7 * direction);
  else next.setMonth(next.getMonth() + direction);
  return next;
}

export default function PaysScreen() {
  const { staff } = useAuth();
  const theme = useTheme();
  const [period, setPeriod] = useState<Period>("week");
  const [anchor, setAnchor] = useState(() => new Date());
  const [items, setItems] = useState<PayItem[]>([]);
  const [loading, setLoading] = useState(true);

  const { start, end } = getRange(period, anchor);

  const load = useCallback(async () => {
    if (!staff) return;
    setLoading(true);
    const rows = await getMyPay(staff.sessionToken, toISODate(start), toISODate(end));
    setItems(rows);
    setLoading(false);
  }, [staff, period, anchor]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    load();
  }, [load]);

  const total = items.reduce((sum, r) => sum + r.amount, 0);

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <SafeAreaView edges={["bottom"]}>
          <View style={[styles.toggleRow, { borderColor: theme.border }]}>
            {(["day", "week", "month"] as Period[]).map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleButton, period === p && { backgroundColor: theme.hoverBg }]}
                onPress={() => setPeriod(p)}
              >
                <ThemedText type="smallBold" themeColor={period === p ? "textPrimary" : "textSecondary"}>
                  {p[0].toUpperCase() + p.slice(1)}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.navRow}>
            <TouchableOpacity onPress={() => setAnchor(shiftAnchor(period, anchor, -1))}>
              <ThemedText>{"< Prev"}</ThemedText>
            </TouchableOpacity>
            <ThemedText type="small">
              {toISODate(start)} – {toISODate(end)}
            </ThemedText>
            <TouchableOpacity onPress={() => setAnchor(shiftAnchor(period, anchor, 1))}>
              <ThemedText>{"Next >"}</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedText type="title" style={styles.total}>
            {formatMoney(total)}
          </ThemedText>

          {loading && <ThemedText type="small">Loading…</ThemedText>}
          {!loading && items.length === 0 && <ThemedText type="small">No completed shifts.</ThemedText>}

          {items.map((item, i) => (
            <View key={i} style={[styles.row, { borderColor: theme.border }]}>
              <View style={{ flex: 1 }}>
                <ThemedText type="small">
                  {item.item_date} · {item.customer_name}
                </ThemedText>
                <ThemedText type="small" themeColor="textMuted">
                  {item.label}
                </ThemedText>
              </View>
              <ThemedText type="smallBold">{formatMoney(item.amount)}</ThemedText>
            </View>
          ))}
        </SafeAreaView>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, gap: 12 },
  toggleRow: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
    gap: 2,
    marginBottom: 16,
  },
  toggleButton: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  navRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  total: { fontSize: 40, marginBottom: 16 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
});
