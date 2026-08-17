/**
 * Design tokens for the whole app.
 *
 * Everything visual routes through here — no hex codes in screen files. That's
 * what keeps "dark, high-contrast, editorial" a property of the app rather
 * than a hope about four separate files staying in sync.
 */

import type { HealthScore, Verdict } from './types';

export const colors = {
  bg: '#0F1115',
  surface: '#191D24',
  border: '#2A3038',
  text: '#F2F4F7',
  muted: '#98A2B3',
  fits: '#34D399',
  caution: '#FBBF24',
  skip: '#F87171',
  accent: '#60A5FA',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 20,
  pill: 999,
} as const;

/**
 * Editorial numeral + text stack. No Inter/Roboto default: we lean on the
 * platform system font (San Francisco / Roboto-as-shipped) at deliberate
 * weights rather than importing a typeface, since we can't add dependencies.
 */
export const type = {
  score: {
    fontSize: 96,
    fontWeight: '700' as const,
    fontVariant: ['tabular-nums'] as const,
  },
  h1: { fontSize: 28, fontWeight: '700' as const },
  h2: { fontSize: 20, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  label: { fontSize: 13, fontWeight: '600' as const, letterSpacing: 0.4 },
  small: { fontSize: 13, fontWeight: '400' as const },
};

/**
 * Score color follows grade, not raw value — a 74 and a 76 should look
 * meaningfully different (poor vs excellent band) even though they're one
 * point apart, because that's the actual claim the grade is making.
 */
export function colorForGrade(grade: HealthScore['grade']): string {
  switch (grade) {
    case 'excellent':
      return colors.fits;
    case 'good':
      return colors.accent;
    case 'poor':
      return colors.caution;
    case 'bad':
      return colors.skip;
  }
}

export function colorForVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'fits':
      return colors.fits;
    case 'caution':
      return colors.caution;
    case 'skip':
      return colors.skip;
  }
}

export function labelForVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'fits':
      return 'FITS';
    case 'caution':
      return 'CAUTION';
    case 'skip':
      return 'SKIP';
  }
}
