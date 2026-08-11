import { Image } from "react-native";

import { useThemeMode } from "@/lib/theme-context";

const LOGO_WHITE = require("../../assets/brand/logo-mark-white.png");
const LOGO_BLACK = require("../../assets/brand/logo-mark-black.png");

export function BrandLogo({ size = 56 }: { size?: number }) {
  const { effectiveTheme } = useThemeMode();
  const source = effectiveTheme === "dark" ? LOGO_WHITE : LOGO_BLACK;

  return <Image source={source} style={{ width: size, height: size }} resizeMode="contain" />;
}
