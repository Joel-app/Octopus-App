import { StyleSheet, TouchableOpacity, View } from "react-native";

import type { ThemeMode } from "@workforce-app/shared";
import { useTheme } from "@/hooks/use-theme";
import { useThemeMode } from "@/lib/theme-context";
import { ThemedText } from "./themed-text";

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "auto", label: "Auto" },
];

export function ThemeToggle() {
  const { mode, setMode } = useThemeMode();
  const theme = useTheme();

  return (
    <View style={[styles.row, { borderColor: theme.border }]}>
      {OPTIONS.map((option) => {
        const selected = mode === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            onPress={() => setMode(option.value)}
            style={[styles.button, selected && { backgroundColor: theme.hoverBg }]}
          >
            <ThemedText type="smallBold" themeColor={selected ? "textPrimary" : "textSecondary"}>
              {option.label}
            </ThemedText>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 8,
    padding: 2,
    gap: 2,
  },
  button: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
});
