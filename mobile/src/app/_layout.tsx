import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";

import { AuthProvider } from "@/lib/auth-context";
import { ThemeModeProvider, useThemeMode } from "@/lib/theme-context";

function RootLayoutNav() {
  const { effectiveTheme } = useThemeMode();
  return (
    <ThemeProvider value={effectiveTheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="(app)" />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeModeProvider>
      <AuthProvider>
        <RootLayoutNav />
      </AuthProvider>
    </ThemeModeProvider>
  );
}
