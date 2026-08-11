import { Stack } from "expo-router";

export default function SafetyLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Safety" }} />
      <Stack.Screen name="hazard" options={{ title: "Hazard Observation" }} />
      <Stack.Screen name="incident" options={{ title: "Incident Report" }} />
    </Stack>
  );
}
