import { StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BrandLogo } from "@/components/brand-logo";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/lib/auth-context";

export default function HomeScreen() {
  const { staff, signOut } = useAuth();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BrandLogo size={56} />
        <ThemedText type="title">Hi, {staff?.fullName}</ThemedText>
        <ThemedText type="small">Sign-on and work logging coming soon.</ThemedText>
        <ThemeToggle />
        <TouchableOpacity onPress={signOut}>
          <ThemedText type="link">Sign out</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: 24 },
});
