"use client";

import Image from "next/image";
import { useThemeMode } from "./ThemeProvider";

export function BrandLogo({ size = 40 }: { size?: number }) {
  const { effectiveTheme } = useThemeMode();
  const src = effectiveTheme === "dark" ? "/brand/logo-mark-white.png" : "/brand/logo-mark-black.png";

  return (
    <Image
      src={src}
      alt="Octopus Labour"
      width={size}
      height={size}
      priority
      style={{ width: size, height: size }}
    />
  );
}
