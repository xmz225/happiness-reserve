import { Platform } from "react-native";

export const AppColors = {
  primary: "#F4A261",
  secondary: "#E76F51",
  background: "#FFFCF9",
  surface: "#FFFFFF",
  textPrimary: "#2D2D2D",
  textSecondary: "#6B6B6B",
  success: "#A8DADC",
  border: "#E8E0D8",
  warmGlow: "#FFE4C4",
};

const tintColorLight = AppColors.primary;
const tintColorDark = "#FFB87A";

export const Colors = {
  light: {
    text: AppColors.textPrimary,
    textSecondary: AppColors.textSecondary,
    buttonText: "#FFFFFF",
    tabIconDefault: AppColors.textSecondary,
    tabIconSelected: tintColorLight,
    link: AppColors.primary,
    primary: AppColors.primary,
    secondary: AppColors.secondary,
    success: AppColors.success,
    border: AppColors.border,
    backgroundRoot: AppColors.background,
    backgroundDefault: AppColors.surface,
    backgroundSecondary: "#FFF8F3",
    backgroundTertiary: "#FFF0E6",
  },
  dark: {
    text: "#ECEDEE",
    textSecondary: "#9BA1A6",
    buttonText: "#FFFFFF",
    tabIconDefault: "#9BA1A6",
    tabIconSelected: tintColorDark,
    link: tintColorDark,
    primary: tintColorDark,
    secondary: "#FF8A6B",
    success: "#7BC8CB",
    border: "#3D3D3D",
    backgroundRoot: "#1A1918",
    backgroundDefault: "#2A2826",
    backgroundSecondary: "#353331",
    backgroundTertiary: "#403D3A",
  },
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  "2xl": 24,
  "3xl": 32,
  "4xl": 40,
  "5xl": 48,
  inputHeight: 48,
  buttonHeight: 52,
};

export const BorderRadius = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 30,
  "2xl": 40,
  "3xl": 50,
  full: 9999,
};

export const Typography = {
  display: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  title: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  headline: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  h1: {
    fontSize: 32,
    lineHeight: 40,
    fontWeight: "700" as const,
  },
  h2: {
    fontSize: 28,
    lineHeight: 36,
    fontWeight: "700" as const,
  },
  h3: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: "600" as const,
  },
  h4: {
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "600" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
  small: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "400" as const,
  },
  caption: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "400" as const,
  },
  link: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "400" as const,
  },
};

export const Shadows = {
  floatingButton: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 2,
    elevation: 3,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: "system-ui",
    serif: "ui-serif",
    rounded: "ui-rounded",
    mono: "ui-monospace",
  },
  default: {
    sans: "normal",
    serif: "serif",
    rounded: "normal",
    mono: "monospace",
  },
  web: {
    sans: "Nunito, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
