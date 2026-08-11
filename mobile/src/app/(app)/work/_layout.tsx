import { Stack } from "expo-router";

export default function WorkLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Work" }} />
      <Stack.Screen name="hourly" options={{ title: "Hourly" }} />
      <Stack.Screen name="containers" options={{ title: "Containers" }} />
      <Stack.Screen name="rework" options={{ title: "Rework" }} />
    </Stack>
  );
}
