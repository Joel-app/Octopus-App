import { Redirect } from "expo-router";
import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/brand-logo";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/hooks/use-theme";

export default function LoginScreen() {
  const { staff, loading, signInWithPin } = useAuth();
  const theme = useTheme();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && staff) {
    return <Redirect href="/(app)" />;
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await signInWithPin(pin);
    setSubmitting(false);
    if (result.error) setError(result.error);
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BrandLogo size={72} />
        <ThemedText type="title">Sign in</ThemedText>
        <TextInput
          style={[styles.input, { borderColor: theme.border, color: theme.textPrimary }]}
          value={pin}
          onChangeText={setPin}
          placeholder="PIN"
          placeholderTextColor={theme.textMuted}
          keyboardType="number-pad"
          secureTextEntry
          maxLength={8}
        />
        {error && <ThemedText themeColor="dangerText">{error}</ThemedText>}
        <TouchableOpacity
          style={[styles.button, { backgroundColor: theme.textPrimary }]}
          onPress={handleSubmit}
          disabled={submitting || pin.length === 0}
        >
          <ThemedText style={{ color: theme.bg, fontWeight: "600" }}>
            {submitting ? "Signing in..." : "Sign in"}
          </ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    width: "100%",
    fontSize: 18,
    textAlign: "center",
  },
  button: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: "100%",
    alignItems: "center",
  },
});
