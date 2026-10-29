/**
 * Design tokens, aligned with the seller web portal (Seller/src/app/globals.css and
 * shared/typography.css) so the app and the portal read as one product. The brand palette is the
 * web's: trade-orange for the primary call to action, trade-navy for headers and secondary
 * actions, primary-blue for links and informational accents.
 *
 * `colors` is the light theme and what static styles use today. `darkColors` is the dark
 * counterpart with the same keys; `useThemeColors()` (design/theme.ts) picks between them once the
 * theme toggle ships, so screens written with it need no change then.
 */
import type { TextStyle } from 'react-native';

export const palette = {
  navy: '#032B64',
  orange: '#EC5D03',
  blue: '#034FA6',
  skyBlue: '#0399ED',
  green: '#1E932D',
  gold: '#FC9D05',
  white: '#FFFFFF',
  black: '#000000',

  blue50: '#E5F4FD',
  blue100: '#CCEAFD',
  blue600: '#034FA6',
  blue700: '#023D82',
  orange50: '#FDF2EB',
  orange100: '#FCE5D6',
  orange600: '#BD4A02',
  green50: '#ECF7ED',
  green100: '#D9EFDB',
  green700: '#12581B',
  amber50: '#FFFDF5',
  amber100: '#FFF3D6',
  amber700: '#975E03',
  red50: '#FFF1F0',
  red100: '#FFDAD6',
  red700: '#93000A',
  purple50: '#F5F0FF',
  purple700: '#6B3FA0',
  slate100: '#F1F5F9',
  slate600: '#475569',
} as const;

export const lightColors = {
  primary: palette.orange,
  primaryPressed: palette.orange600,
  onPrimary: palette.white,
  secondary: palette.navy,
  secondaryPressed: '#021F4A',
  onSecondary: palette.white,
  link: palette.blue,
  accent: palette.skyBlue,

  background: '#FCFCFC',
  surface: '#FFFFFF',
  surfaceContainerLow: '#F9F9FB',
  surfaceContainer: '#F4F4F6',
  surfaceContainerHigh: '#EAE7E9',
  onSurface: '#1B1B1D',
  onSurfaceVariant: '#45464D',
  textMuted: '#515F75',
  outline: '#76777D',
  outlineVariant: '#C6C6CD',
  divider: '#E4E2E4',

  error: '#BA1A1A',
  errorContainer: '#FFDAD6',
  onErrorContainer: '#93000A',
  success: palette.green,
  warning: palette.gold,

  scrim: 'rgba(3, 43, 100, 0.45)',
  toast: '#303032',
  onToast: '#F3F0F2',
} as const;

export type ColorTokens = { [K in keyof typeof lightColors]: string };

export const darkColors: ColorTokens = {
  primary: '#FF8A3D',
  primaryPressed: '#EC5D03',
  onPrimary: '#2B1100',
  secondary: '#9DB8E8',
  secondaryPressed: '#7C9BD0',
  onSecondary: '#04152E',
  link: '#7DB4F5',
  accent: '#5CC0F5',

  background: '#121316',
  surface: '#1A1B1F',
  surfaceContainerLow: '#1E1F23',
  surfaceContainer: '#242529',
  surfaceContainerHigh: '#2E2F34',
  onSurface: '#E6E1E5',
  onSurfaceVariant: '#C6C6CD',
  textMuted: '#A3ADBF',
  outline: '#90909A',
  outlineVariant: '#45464D',
  divider: '#33343A',

  error: '#FFB4AB',
  errorContainer: '#93000A',
  onErrorContainer: '#FFDAD6',
  success: '#6FD07C',
  warning: '#FFC25C',

  scrim: 'rgba(0, 0, 0, 0.6)',
  toast: '#E6E1E5',
  onToast: '#1B1B1D',
};

export const colors: ColorTokens = lightColors;

export type ToneColors = { background: string; foreground: string };

/**
 * Status tones, named like the web `StatusBadge` (green, orange, blue, red, gray, purple) plus
 * the amber/emerald/slate names the shared components already use.
 */
export const tones = {
  amber: { background: palette.amber100, foreground: palette.amber700 },
  blue: { background: palette.blue50, foreground: palette.blue700 },
  green: { background: palette.green50, foreground: palette.green700 },
  emerald: { background: palette.green50, foreground: palette.green700 },
  red: { background: palette.red50, foreground: palette.red700 },
  orange: { background: palette.orange50, foreground: palette.orange600 },
  purple: { background: palette.purple50, foreground: palette.purple700 },
  slate: { background: palette.slate100, foreground: palette.slate600 },
  gray: { background: palette.slate100, foreground: palette.slate600 },
} as const satisfies Record<string, ToneColors>;

export type Tone = keyof typeof tones;

export const darkTones: Record<Tone, ToneColors> = {
  amber: { background: '#3A2E0E', foreground: '#FFD479' },
  blue: { background: '#10263F', foreground: '#8EC3FA' },
  green: { background: '#12301A', foreground: '#7FDB8C' },
  emerald: { background: '#12301A', foreground: '#7FDB8C' },
  red: { background: '#3F1714', foreground: '#FFB4AB' },
  orange: { background: '#3A1D0B', foreground: '#FFA66B' },
  purple: { background: '#2A1D40', foreground: '#CDB4F5' },
  slate: { background: '#26282E', foreground: '#B8C0CE' },
  gray: { background: '#26282E', foreground: '#B8C0CE' },
};

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  pill: 999,
} as const;

export const fonts = {
  regular: 'Inter-Regular',
  medium: 'Inter-Medium',
  semibold: 'Inter-SemiBold',
  bold: 'Inter-Bold',
  icons: 'MaterialSymbolsOutlined',
} as const;

/**
 * The web type scale at its mobile breakpoint. Custom font files carry their weight, so each
 * variant names the file rather than setting fontWeight (Android ignores weight on custom fonts).
 */
export const typography = {
  h1: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 29 },
  h2: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 24 },
  h3: { fontFamily: fonts.semibold, fontSize: 18, lineHeight: 22 },
  section: { fontFamily: fonts.bold, fontSize: 15, lineHeight: 20 },
  stat: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30 },
  price: { fontFamily: fonts.bold, fontSize: 20, lineHeight: 26 },
  cardTitle: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 20 },
  body: { fontFamily: fonts.regular, fontSize: 14, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 22 },
  label: { fontFamily: fonts.medium, fontSize: 14, lineHeight: 18 },
  button: { fontFamily: fonts.semibold, fontSize: 14, lineHeight: 18 },
  meta: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 18 },
  small: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
  badge: { fontFamily: fonts.semibold, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: 'monospace', fontSize: 12, lineHeight: 17 },
} as const satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const shadows = {
  sm: {
    shadowColor: '#002D5F',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  md: {
    shadowColor: '#002D5F',
    shadowOpacity: 0.1,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
} as const;

/** The minimum touch target: 48 dp (Material; Apple asks for 44 pt). */
export const HIT_TARGET = 48;

/** Text scales with the system font size up to 200% (accessibility target). */
export const MAX_FONT_SCALE = 2;
