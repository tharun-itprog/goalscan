/**
 * Persistence for the one thing this app needs to remember across launches:
 * the user's profile. Everything else (scan results) is transient and lives
 * in component state.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Profile } from '../types';

const KEY = 'goalscan.profile';

export async function loadProfile(): Promise<Profile | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Profile;
    // Cheap shape check — a corrupted or pre-migration blob should behave like
    // "no profile" rather than crashing the app on launch.
    if (
      typeof parsed.age !== 'number' ||
      typeof parsed.heightCm !== 'number' ||
      typeof parsed.weightKg !== 'number' ||
      typeof parsed.sex !== 'string' ||
      typeof parsed.activity !== 'string' ||
      typeof parsed.goal !== 'string'
    ) {
      return null;
    }
    return parsed;
  } catch {
    // Storage read failures are rare but not worth surfacing — onboarding is
    // a perfectly good fallback UI.
    return null;
  }
}

export async function saveProfile(profile: Profile): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(profile));
}
