/**
 * Top-level navigation: plain useState over four screens, no router.
 *
 * onboarding -> scanner -> result, with one way back to scanner ("scan
 * another" / retry). Onboarding is reached on first launch with no saved
 * profile, and thereafter only through the profile screen, which both the
 * scanner and the result screen open.
 *
 * `profileReturn` is why profile isn't just another entry in the same
 * useState: the result screen holds a scan the user hasn't finished reading,
 * and sending them back to the scanner would silently discard it.
 *
 * label-capture branches off both scanner (no barcode in hand: `''`) and
 * result's not-found state (barcode known but unscorable) and rejoins at
 * result on success — it produces the same ScanOutcome the barcode path
 * does, so handleScanned is reused rather than duplicated for it.
 */

import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import OnboardingScreen from './src/screens/OnboardingScreen';
import ScannerScreen, { type ScanOutcome } from './src/screens/ScannerScreen';
import LabelCaptureScreen from './src/screens/LabelCaptureScreen';
import ResultScreen from './src/screens/ResultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import { loadProfile } from './src/storage/profile';
import { FONT_MAP } from './src/fonts';
import { colors } from './src/theme';
import type { Profile } from './src/types';

type Screen = 'onboarding' | 'scanner' | 'result' | 'label-capture' | 'profile';

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
  // The barcode a label capture should tag its scan with — '' when there
  // never was one (scanner's no-barcode fallback), the missed code otherwise
  // (not-found's photograph-the-label action).
  const [labelCaptureBarcode, setLabelCaptureBarcode] = useState('');
  /** Where "Back" from the profile screen should land. */
  const [profileReturn, setProfileReturn] = useState<Screen>('scanner');

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
    // Editing an existing profile returns to the profile screen so the changed
    // budgets are visible immediately — the whole reason to have edited it.
    // First-time onboarding has no profile screen to go back to.
    setScreen((current) => (current === 'onboarding' && profile ? 'profile' : 'scanner'));
  }, [profile]);

  const handleScanned = useCallback((result: ScanOutcome) => {
    setOutcome(result);
    setScreen('result');
  }, []);

  const handleScanAnother = useCallback(() => {
    setOutcome(null);
    setScreen('scanner');
  }, []);

  const handleOpenProfile = useCallback((from: Screen) => {
    setProfileReturn(from);
    setScreen('profile');
  }, []);

  const handlePhotographLabel = useCallback((barcode: string) => {
    setLabelCaptureBarcode(barcode);
    setScreen('label-capture');
  }, []);

  const handleLabelCaptureCancel = useCallback(() => {
    setScreen('scanner');
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
          onCancel={profile ? () => setScreen('profile') : undefined}
        />
      )}
      {screen === 'scanner' && profile && (
        <ScannerScreen
          profile={profile}
          onScanned={handleScanned}
          onOpenProfile={() => handleOpenProfile('scanner')}
          onPhotographLabel={handlePhotographLabel}
        />
      )}
      {screen === 'result' && outcome && profile && (
        <ResultScreen
          outcome={outcome}
          profile={profile}
          onScanAnother={handleScanAnother}
          onPhotographLabel={handlePhotographLabel}
          onOpenProfile={() => handleOpenProfile('result')}
        />
      )}
      {screen === 'profile' && profile && (
        <ProfileScreen
          profile={profile}
          onEdit={() => setScreen('onboarding')}
          onBack={() => setScreen(profileReturn)}
        />
      )}
      {screen === 'label-capture' && profile && (
        <LabelCaptureScreen
          barcode={labelCaptureBarcode}
          profile={profile}
          onScanned={handleScanned}
          onCancel={handleLabelCaptureCancel}
        />
      )}
      {/* The scanner and label-capture screens are the app's dark, camera
          screens and need light status-bar content; every other screen sits
          on the light background. */}
      <StatusBar style={screen === 'scanner' || screen === 'label-capture' ? 'light' : 'dark'} />
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
