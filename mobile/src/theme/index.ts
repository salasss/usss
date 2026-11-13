import type { TextStyle, ViewStyle } from 'react-native';

/** usss palette: warm near-black surfaces, cream text, peach / rose / lilac accents. */
export const colors = {
  background: '#161213',
  surface: '#221D1E',
  surfaceRaised: '#2D2627',
  surfaceSunken: '#1B1617',
  border: 'rgba(246, 231, 215, 0.08)',
  borderStrong: 'rgba(246, 231, 215, 0.16)',
  overlay: 'rgba(12, 9, 10, 0.72)',

  cream: '#F6E7D7',
  creamDeep: '#EBD6C1',
  text: '#F8EFE6',
  textSecondary: '#B8ABA3',
  textMuted: '#7F736D',
  textOnCream: '#2A2122',
  textOnAccent: '#2B1B1D',

  peach: '#F7B49A',
  coral: '#F2918A',
  rose: '#EE7C93',
  pink: '#F4A6BC',
  lilac: '#C3A8F2',
  lavender: '#A890E8',
  butter: '#F5D58C',
  mint: '#9BDDB8',

  heart: '#EF5B6B',
  online: '#7BD88F',
  danger: '#FF7A7A',
} as const;

/** Gradient stops, used with expo-linear-gradient. */
export const gradients = {
  warm: ['#F9C29E', '#F29AAE'],
  lilac: ['#F3A9C4', '#B9A0F2'],
  sunset: ['#F7B49A', '#EE7C93', '#B9A0F2'],
  butter: ['#F8DFA0', '#F5B98C'],
  mint: ['#B8EBCB', '#8FCFE0'],
} as const satisfies Record<string, readonly [string, string, ...string[]]>;

/**
 * Font files embedded by the expo-font config plugin (see app.json), one
 * family per weight. No fontWeight on top: Android would measure the text
 * with one face and draw it with another, clipping the end of words.
 */
export const fonts = {
  display: 'Fraunces_700Bold',
  displaySemiBold: 'Fraunces_600SemiBold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semiBold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const typography = {
  logo: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, letterSpacing: -0.5 },
  hero: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.4 },
  title: { fontFamily: fonts.display, fontSize: 26, lineHeight: 32, letterSpacing: -0.2 },
  subtitle: { fontFamily: fonts.displaySemiBold, fontSize: 20, lineHeight: 26 },
  heading: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 21 },
  bodyStrong: { fontFamily: fonts.semiBold, fontSize: 15, lineHeight: 21 },
  label: { fontFamily: fonts.semiBold, fontSize: 13, lineHeight: 17 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16 },
  tiny: { fontFamily: fonts.semiBold, fontSize: 11, lineHeight: 14 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const radii = {
  sm: 12,
  md: 18,
  lg: 24,
  xl: 30,
  pill: 999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const shadows = {
  soft: {
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const satisfies Record<string, ViewStyle>;

/** Height of the floating tab bar, used by screens to keep content above it. */
export const TAB_BAR_HEIGHT = 66;
export const TAB_BAR_GAP = 12;
