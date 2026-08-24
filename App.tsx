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
import { useFonts } from 'expo-font';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ScannerScreen, { type ScanOutcome } from './src/screens/ScannerScreen';
import ResultScreen from './src/screens/ResultScreen';
import { loadProfile } from './src/storage/profile';
import { FONT_MAP } from './src/fonts';
import { colors } from './src/theme';
import type { Profile } from './src/types';

type Screen = 'onboarding' | 'scanner' | 'result';

export default function App() {
  // React Native has no font-weight synthesis for custom fonts — every text
  // style in the design system carries its weight via fontFamily, so any
  // text drawn before these resolve falls back to the system font and
  // undoes the whole design. Nothing renders until this is true.
  const [fontsLoaded] = useFonts(FONT_MAP);
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

  if (!fontsLoaded) {
    // Render nothing until the custom faces are ready, rather than the
    // spinner below — that would itself draw a frame while text elsewhere
    // is still queued to render in the system font.
    return <View style={styles.loading} />;
  }

  if (bootstrapping) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
        <StatusBar style="dark" />
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
        <ScannerScreen profile={profile} onScanned={handleScanned} onEditProfile={handleEditProfile} />
      )}
      {screen === 'result' && outcome && profile && (
        <ResultScreen outcome={outcome} profile={profile} onScanAnother={handleScanAnother} />
      )}
      {/* The scanner is the app's one dark screen and needs light status-bar
          content; every other screen sits on the light background. */}
      <StatusBar style={screen === 'scanner' ? 'light' : 'dark'} />
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
