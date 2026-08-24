/**
 * The design system. One theme, not three.
 *
 * Light and approachable, chosen after comparing three directions rendered
 * with the same layout and real data. The reasoning, in short: the result
 * screen's hero is a *sentence* now rather than a number, and prose is where
 * dark-on-light wins — in supermarket lighting, and for the sizeable minority
 * who get halation reading light text on dark.
 *
 * This file deliberately has NO runtime imports, so a plain Node script can
 * check its contrast (scripts/verify-contrast.ts). Font *assets* live in
 * src/fonts.ts; only the family-name strings appear here.
 */

import type { HealthScore, Verdict } from './types';

/**
 * Every value measured against the ground it sits on. The first palette this
 * project shipped failed WCAG AA on four colours — mid-tones that read fine on
 * dark are nowhere near enough on off-white, and saturated greens and ambers
 * are the worst offenders because they carry high luminance while still
 * looking like "a colour". Contrast ratios are in the comments; the test is
 * the authority.
 */
export const colors = {
  /** Warm off-white, not #FFF — softens the jump from the dark scanner. */
  bg: '#FAF8F5',
  surface: '#FFFFFF',
  border: '#E8E2DA',
  text: '#1F1C18', // 16.0:1
  muted: '#6E675E', // 5.3:1
  accent: '#2F6A8A', // 5.6:1
  fits: '#1F7D52', // 4.8:1
  caution: '#A6620F', // 4.5:1
  skip: '#C6453C', // 4.6:1

  /**
   * The scanner is the one dark surface in the app: a viewfinder wants a dark
   * frame, and a white camera screen is unpleasant in a dim aisle. Warm-toned
   * to match the light palette rather than reading as a different product.
   */
  dark: {
    bg: '#1B1A17',
    surface: '#26241F',
    border: '#3A3630',
    text: '#FAF8F5',
    muted: '#A8A199', // 6.1:1

    /**
     * Lighter variants of the semantic colours. A colour is only meaningful
     * relative to what it sits on: the light-ground values above are darkened
     * to clear 4.5:1 on off-white, which drops them to 2.6-3.2:1 here. Same
     * hue, different lightness, so a green still reads as the same green.
     */
    accent: '#6FA8C9', // 6.0:1
    fits: '#4FBE85', // 6.7:1
    caution: '#D9973F', // 6.2:1
    skip: '#E8776D', // 5.4:1
  },
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
  sm: 10,
  md: 16,
  lg: 26,
  pill: 999,
} as const;

/** Font family names. The assets they refer to are loaded in src/fonts.ts. */
export const fonts = {
  regular: 'Outfit_400Regular',
  medium: 'Outfit_600SemiBold',
  bold: 'Outfit_700Bold',
} as const;

/**
 * Type scale. `headline` is the result screen's hero — a full sentence, so it
 * is sized for reading rather than for glancing. `score` stays for the places
 * a bare number still leads, like the breakdown header.
 */
export const type = {
  headline: { fontSize: 29, lineHeight: 37, letterSpacing: -0.3, fontFamily: fonts.bold },
  score: { fontSize: 44, letterSpacing: -1.5, fontFamily: fonts.bold },
  h1: { fontSize: 26, lineHeight: 32, letterSpacing: -0.2, fontFamily: fonts.bold },
  h2: { fontSize: 19, lineHeight: 25, fontFamily: fonts.medium },
  body: { fontSize: 16, lineHeight: 23, fontFamily: fonts.regular },
  bodyStrong: { fontSize: 16, lineHeight: 23, fontFamily: fonts.medium },
  label: { fontSize: 12, letterSpacing: 0.8, fontFamily: fonts.medium },
  small: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  /** Figures that sit in columns and need to line up. */
  figure: { fontSize: 16, fontFamily: fonts.medium, fontVariant: ['tabular-nums'] as const },
} as const;

/** Minimum tap target. Non-negotiable — this is used one-handed, in motion. */
export const HIT_TARGET = 48;

/**
 * Score colour follows the grade band, not the raw value: 74 and 76 should look
 * meaningfully different, because that is the actual claim the grade makes.
 */
export function colorForGrade(grade: HealthScore['grade']): string {
  switch (grade) {
    case 'excellent': return colors.fits;
    case 'good': return colors.accent;
    case 'poor': return colors.caution;
    case 'bad': return colors.skip;
  }
}

export function colorForVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'fits': return colors.fits;
    case 'caution': return colors.caution;
    case 'skip': return colors.skip;
  }
}

export function labelForVerdict(verdict: Verdict): string {
  switch (verdict) {
    case 'fits': return 'FITS';
    case 'caution': return 'CAUTION';
    case 'skip': return 'SKIP';
  }
}
