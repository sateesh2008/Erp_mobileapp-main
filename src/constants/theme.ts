/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import "@/global.css";

import { Platform } from "react-native";

export const Colors = {
  light: {
    text: "#17175F",
    background: "#F7F8FF",
    backgroundElement: "#E9EBFB",
    backgroundSelected: "#DDE1FA",
    textSecondary: "#596080",
    primary: "#1E32CC",
    primaryDark: "#13137F",
    primaryLight: "#EEF0FC",
    secondary: "#334BD6",
    accent: "#DDE1FA",
    surface: "#FFFFFF",
    border: "#D9DDF2",
    success: "#1E8056",
    warning: "#9A6500",
    error: "#B74755",
  },
  dark: {
    text: "#F7F8FF",
    background: "#0D0D3D",
    backgroundElement: "#17175F",
    backgroundSelected: "#2937A0",
    textSecondary: "#C8CCEA",
    primary: "#7D8AFF",
    primaryDark: "#5E6BE8",
    primaryLight: "#232765",
    secondary: "#AAB3FF",
    accent: "#2937A0",
    surface: "#15164F",
    border: "#363B78",
    success: "#65C99A",
    warning: "#F0BD55",
    error: "#FF8992",
  },
} as const;

export const AppColors = {
  ink: "#17175F",
  muted: "#596080",
  line: "#D9DDF2",
  white: "#FFFFFF",
  canvas: "#F7F8FF",
  navy: "#13137F",
  blue: "#1E32CC",
  paleBlue: "#EEF0FC",
  teal: "#334BD6",
  paleTeal: "#E9EBFB",
  orange: "#9A6500",
  paleOrange: "#FFF5D9",
  red: "#B74755",
  paleRed: "#FDECEF",
  green: "#1E8056",
  paleGreen: "#E6F6EE",
  plum: "#5750A8",
  softLilac: "#F0EFFF",
  blueTint: "#E9EBFB",
  blueAccent: "#334BD6",
  goldTint: "#FFF5D9",
  goldAccent: "#9A6500",
  purpleTint: "#F0EFFF",
  purpleAccent: "#5750A8",
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: "system-ui",
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: "ui-serif",
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: "ui-rounded",
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "var(--font-display)",
    serif: "var(--font-serif)",
    rounded: "var(--font-rounded)",
    mono: "var(--font-mono)",
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
