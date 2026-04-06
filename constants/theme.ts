export const colors = {
  bg: '#0D0D0F',
  surface: '#17171A',
  surface2: '#1E1E23',
  border: '#2A2A32',
  accent: '#FF4C6A',
  accent2: '#FF8C42',
  purple: '#7B5CF5',
  teal: '#14B8A6',
  text1: '#F2F2F5',
  text2: '#8F8FA0',
  text3: '#5A5A6A',
} as const;

export const Colors = {
  light: {
    text: '#11181C',
    background: '#FFFFFF',
    tint: colors.accent,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: colors.accent,
  },
  dark: {
    text: colors.text1,
    background: colors.bg,
    tint: colors.accent,
    icon: colors.text2,
    tabIconDefault: colors.text3,
    tabIconSelected: colors.accent,
  },
} as const;

export const Fonts = {
  rounded: 'System',
  mono: 'Courier',
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 24,
  full: 9999,
} as const;
