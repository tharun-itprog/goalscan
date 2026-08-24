/**
 * Font assets, kept apart from src/theme.ts on purpose.
 *
 * Importing a font package drags React Native in, which makes the module
 * unloadable outside Metro. Isolating the assets here is what lets a plain
 * Node script import the theme and verify its contrast.
 */

import {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
} from '@expo-google-fonts/outfit';

/** Pass to `useFonts()`. Keys must match the names in `theme.fonts`. */
export const FONT_MAP = {
  Outfit_400Regular,
  Outfit_600SemiBold,
  Outfit_700Bold,
};
