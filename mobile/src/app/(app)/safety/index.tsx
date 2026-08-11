import { Link } from "expo-router";
import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useTheme } from "@/hooks/use-theme";

const OPTIONS = [
  { href: "/safety/hazard", label: "Hazard Observation" },
  { href: "/safety/incident", label: "Incident Report" },
] as const;

export default function SafetyMenu() {
  const theme = useTheme();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.title}>
          Reporting
        </ThemedText>
        {OPTIONS.map((option) => (
          <Link key={option.href} href={option.href} asChild>
            <TouchableOpacity style={{ ...styles.card, borderColor: theme.border }}>
              <ThemedText type="subtitle">{option.label}</ThemedText>
            </TouchableOpacity>
          </Link>
        ))}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 24, marginBottom: 8 },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 20,
  },
});
