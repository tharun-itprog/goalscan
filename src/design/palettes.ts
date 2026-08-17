/**
 * Pure design data — colors, radii, type scale. Zero imports, by design.
 *
 * Split out from themes.ts because that file binds font *assets*, which pulls
 * in React Native and makes the module unimportable outside Metro. Keeping the
 * palette dependency-free means a plain Node script can check it, which is how
 * scripts/verify-contrast.ts catches accessibility failures before a human
 * squints at a screen and fails to notice them.
 */

export type ThemeKey = 'clinical' | 'editorial' | 'light';

export interface Palette {
  bg: string;
  surface: string;
  border: string;
  text: string;
  muted: string;
  /** The direction's signature colour. Used sparingly, for emphasis. */
  accent: string;
  fits: string;
  caution: string;
  skip: string;
}

export interface Radii {
  sm: number;
  md: number;
  lg: number;
  pill: number;
}

export interface Scale {
  score: number;
  scoreTracking: number;
  h1: number;
  h2: number;
  body: number;
  label: number;
  labelTracking: number;
  small: number;
}

/** Contrast ratios in comments are measured against that theme's own ground. */
export const PALETTES: Record<ThemeKey, Palette> = {
  clinical: {
    bg: '#08090B',
    surface: '#101318',
    border: '#1E232B',
    text: '#E8EBEF',
    // 5.2:1. The first pass used #6E7681 at 4.34:1, failing WCAG AA for normal
    // text — muted greys are exactly where that slips through, because they
    // look deliberately quiet whether or not they're legible.
    muted: '#7B8390',
    accent: '#D6FF3F',
    fits: '#3DD68C',
    caution: '#E8A33D',
    skip: '#E5484D',
  },
  editorial: {
    bg: '#14110E',
    surface: '#1D1915',
    border: '#2F2822',
    text: '#F5F0E8',
    muted: '#A3968A',
    accent: '#E07A5F',
    fits: '#81B29A',
    caution: '#E0A458',
    // 4.56:1 on the card surface. #C05746 measured 4.20 against the page but
    // only 3.90 against a card — a reminder that one ground passing doesn't
    // mean both do, which is why the check tests each colour against both.
    skip: '#D66B58',
  },
  light: {
    bg: '#FAF8F5',
    surface: '#FFFFFF',
    border: '#E8E2DA',
    text: '#1F1C18',
    // Every value here was darkened after measurement. The first pass failed
    // AA for normal text on four of them (accent 4.23, muted 4.41,
    // caution 3.15, fits 3.19). Light grounds are where this goes wrong: a
    // mid-tone that reads fine on dark is nowhere near enough on off-white,
    // and saturated greens and ambers are the worst because they carry high
    // luminance while still looking like "a colour".
    muted: '#6E675E', // 5.26:1
    accent: '#2F6A8A', // 5.58:1
    fits: '#1F7D52', // 4.82:1
    caution: '#A6620F', // 4.53:1
    skip: '#C6453C', // 4.59:1 — already passing, left alone
  },
};

export const RADII: Record<ThemeKey, Radii> = {
  // Instruments don't have rounded corners.
  clinical: { sm: 2, md: 4, lg: 6, pill: 999 },
  editorial: { sm: 8, md: 14, lg: 22, pill: 999 },
  light: { sm: 10, md: 16, lg: 26, pill: 999 },
};

export const SCALES: Record<ThemeKey, Scale> = {
  clinical: { score: 80, scoreTracking: -3, h1: 22, h2: 16, body: 15, label: 11, labelTracking: 1.2, small: 12 },
  editorial: { score: 104, scoreTracking: -4, h1: 30, h2: 20, body: 16, label: 12, labelTracking: 1.6, small: 13 },
  light: { score: 88, scoreTracking: -2, h1: 26, h2: 19, body: 16, label: 12, labelTracking: 0.8, small: 13 },
};
