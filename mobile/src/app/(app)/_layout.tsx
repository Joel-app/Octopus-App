import { Redirect, Tabs } from "expo-router";

import { useAuth } from "@/lib/auth-context";

export default function AppLayout() {
  const { staff, loading } = useAuth();

  if (loading) return null;
  if (!staff) return <Redirect href="/login" />;

  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="index" options={{ title: "Home" }} />
      <Tabs.Screen name="work" options={{ title: "Work" }} />
      <Tabs.Screen name="pays" options={{ title: "Pays" }} />
      <Tabs.Screen name="safety" options={{ title: "Safety" }} />
      <Tabs.Screen name="leave" options={{ title: "Leave" }} />
    </Tabs>
  );
}
