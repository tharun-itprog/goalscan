/**
 * Top-level navigation: plain useState over three screens, no router.
 *
 * onboarding -> scanner -> result, with two ways back to onboarding
 * (first launch with no saved profile, or the explicit "edit profile" link
 * on the scanner) and one way back to scanner ("scan another" / retry).
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ScannerScreen, { type ScanOutcome } from './src/screens/ScannerScreen';
import ResultScreen from './src/screens/ResultScreen';
import { loadProfile } from './src/storage/profile';
import { colors } from './src/theme';
import type { Profile } from './src/types';

type Screen = 'onboarding' | 'scanner' | 'result';

export default function App() {
  const [bootstrapping, setBootstrapping] = useState(true);
  const [screen, setScreen] = useState<Screen>('onboarding');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [outcome, setOutcome] = useState<ScanOutcome | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadProfile().then((saved) => {
      if (cancelled) return;
      if (saved) {
        setProfile(saved);
        setScreen('scanner');
      }
      setBootstrapping(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleProfileSaved = useCallback((p: Profile) => {
    setProfile(p);
    setScreen('scanner');
  }, []);

  const handleScanned = useCallback((result: ScanOutcome) => {
    setOutcome(result);
    setScreen('result');
  }, []);

  const handleScanAnother = useCallback(() => {
    setOutcome(null);
    setScreen('scanner');
  }, []);

  const handleEditProfile = useCallback(() => {
    setScreen('onboarding');
  }, []);

  if (bootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <StatusBar style="light" />
      </View>
    );
  }

  return (
    <>
      {screen === 'onboarding' && (
        <OnboardingScreen
          initialProfile={profile}
          onSaved={handleProfileSaved}
          onCancel={profile ? () => setScreen('scanner') : undefined}
        />
      )}
      {screen === 'scanner' && profile && (
        <ScannerScreen
          profile={profile}
          onScanned={handleScanned}
          onEditProfile={handleEditProfile}
        />
      )}
      {screen === 'result' && outcome && (
        <ResultScreen outcome={outcome} onScanAnother={handleScanAnother} />
      )}
      <StatusBar style="light" />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
