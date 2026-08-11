import { Colors } from '@/constants/theme';
import { useThemeMode } from '@/lib/theme-context';

// Effective theme is driven by the user's Light/Dark/Auto preference and,
// for 'auto', NSW sunrise/sunset — not the device's OS-level appearance
// setting. See packages/shared/theme.ts.
export function useTheme() {
  const { effectiveTheme } = useThemeMode();
  return Colors[effectiveTheme];
}
