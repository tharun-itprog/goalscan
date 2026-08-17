/**
 * Three design directions, defined completely enough to judge side by side.
 *
 * The previous theme failed for a reason worth recording: its palette was
 * Tailwind's defaults (emerald-400, amber-400, red-400, blue-400) on generic
 * dark grey, with no typeface. That combination is the single most-used look
 * on the web, so the result was competent and characterless. None of these
 * three reuse a framework default, and each commits to a real typeface —
 * type carries more of "this feels designed" than colour does.
 *
 * Colours, radii, and type scale live in palettes.ts, which imports nothing.
 * This file only binds them to font assets. That split is what lets a plain
 * Node script verify the palette (see scripts/verify-contrast.ts) without
 * dragging React Native into the process.
 */

import {
  IBMPlexMono_400Regular,
  IBMPlexMono_600SemiBold,
} from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { Fraunces_400Regular, Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import { Outfit_400Regular, Outfit_600SemiBold, Outfit_700Bold } from '@expo-google-fonts/outfit';

import {
  PALETTES, RADII, SCALES,
  type Palette, type Radii, type Scale, type ThemeKey,
} from './palettes';

export type { ThemeKey } from './palettes';

/** Everything the preview needs to load before rendering. */
export const FONT_MAP = {
  IBMPlexMono_400Regular,
  IBMPlexMono_600SemiBold,
  IBMPlexSans_400Regular,
  IBMPlexSans_600SemiBold,
  Fraunces_400Regular,
  Fraunces_700Bold,
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
};

export interface Theme {
  key: ThemeKey;
  name: string;
  /** One line shown in the preview so the intent is legible, not guessed at. */
  tagline: string;
  isDark: boolean;
  colors: Palette;
  radii: Radii;
  fonts: {
    /** Score and headings. */
    display: string;
    body: string;
    bodyStrong: string;
    /** Numerals in tables. Some directions reuse the display face here. */
    mono: string;
  };
  scale: Scale;
  /** Light surfaces need shadow for separation; dark ones use borders. */
  usesShadow: boolean;
}

/**
 * Precision instrument. Near-black cool ground, hairline rules, monospaced
 * numerals, sharp corners. Acid lime is the single signal colour — phosphor on
 * a measuring device, not a brand accent.
 *
 * The strongest match for what this product actually claims: it shows people
 * arithmetic they can check, and this reads "measured" rather than "marketed".
 */
const clinical: Theme = {
  key: 'clinical',
  name: 'Clinical instrument',
  tagline: 'Reads like a lab result. Precision over warmth.',
  isDark: true,
  colors: PALETTES.clinical,
  radii: RADII.clinical,
  fonts: {
    display: 'IBMPlexMono_600SemiBold',
    body: 'IBMPlexSans_400Regular',
    bodyStrong: 'IBMPlexSans_600SemiBold',
    mono: 'IBMPlexMono_400Regular',
  },
  scale: SCALES.clinical,
  usesShadow: false,
};

/**
 * Magazine feature. Warm off-black, a serif display face at large sizes,
 * terracotta accent, generous whitespace. Most personality of the three, and
 * the most likely to feel like a considered product rather than a utility —
 * but a serif score is a stylistic claim, and some people will find it fussy
 * on a screen they use in a supermarket aisle.
 */
const editorial: Theme = {
  key: 'editorial',
  name: 'Bold editorial',
  tagline: 'Magazine, not app. Opinionated and warm.',
  isDark: true,
  colors: PALETTES.editorial,
  radii: RADII.editorial,
  fonts: {
    display: 'Fraunces_700Bold',
    body: 'IBMPlexSans_400Regular',
    bodyStrong: 'IBMPlexSans_600SemiBold',
    // Fraunces for figures too — the point of this direction is the serif.
    mono: 'Fraunces_400Regular',
  },
  scale: SCALES.editorial,
  usesShadow: false,
};

/**
 * Light and approachable. Warm off-white, soft shadows, rounded geometry, a
 * friendly geometric sans throughout.
 *
 * The least distinctive of the three, deliberately: it sits closest to what
 * shoppers already expect from this category, which is a real advantage for a
 * product used one-handed while holding a jar.
 */
const light: Theme = {
  key: 'light',
  name: 'Light and approachable',
  tagline: 'Friendly and familiar. Easiest to use in an aisle.',
  isDark: false,
  colors: PALETTES.light,
  radii: RADII.light,
  fonts: {
    display: 'Outfit_700Bold',
    body: 'Outfit_400Regular',
    bodyStrong: 'Outfit_600SemiBold',
    mono: 'Outfit_600SemiBold',
  },
  scale: SCALES.light,
  usesShadow: true,
};

export const THEMES: Theme[] = [clinical, editorial, light];

export function themeByKey(key: ThemeKey): Theme {
  const found = THEMES.find((t) => t.key === key);
  if (!found) throw new Error(`Unknown theme: ${key}`);
  return found;
}

/** Score colour follows the grade band, not the raw value. */
export function gradeColor(theme: Theme, grade: 'excellent' | 'good' | 'poor' | 'bad'): string {
  switch (grade) {
    case 'excellent': return theme.colors.fits;
    case 'good': return theme.colors.accent;
    case 'poor': return theme.colors.caution;
    case 'bad': return theme.colors.skip;
  }
}

export function verdictColor(theme: Theme, verdict: 'fits' | 'caution' | 'skip'): string {
  switch (verdict) {
    case 'fits': return theme.colors.fits;
    case 'caution': return theme.colors.caution;
    case 'skip': return theme.colors.skip;
  }
}
