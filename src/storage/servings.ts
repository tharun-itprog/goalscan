/**
 * Serving sizes the user has corrected by hand, remembered per barcode.
 *
 * The point is that a correction only has to be made once. Open Food Facts is
 * missing a serving size for roughly half of Indian products and a handful of
 * US ones; if the app forgot the fix on every scan, the person buying the same
 * biscuits each week would retype "45" forever. Stored per barcode, the second
 * scan of a product is already right.
 *
 * These are the user's own numbers about their own food, so they stay on the
 * device — nothing here is sent anywhere.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'goalscan.serving.';

/** Sanity bounds. Outside these, someone has fat-fingered a digit. */
const MIN_G = 1;
const MAX_G = 2000;

export function isPlausibleServing(grams: number): boolean {
  return Number.isFinite(grams) && grams >= MIN_G && grams <= MAX_G;
}

export async function loadServingOverride(barcode: string): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + barcode);
    if (raw === null) return null;
    const value = Number.parseFloat(raw);
    // A corrupted entry must not silently rescale every percentage on screen.
    return isPlausibleServing(value) ? value : null;
  } catch {
    return null;
  }
}

export async function saveServingOverride(barcode: string, grams: number): Promise<void> {
  if (!isPlausibleServing(grams)) return;
  try {
    await AsyncStorage.setItem(PREFIX + barcode, String(grams));
  } catch {
    // A failed write costs the user one retype next scan. Not worth an alert.
  }
}

export async function clearServingOverride(barcode: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(PREFIX + barcode);
  } catch {
    // Same reasoning as above.
  }
}
