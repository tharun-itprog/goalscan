/**
 * The camera screen: point at a barcode, get a ScanOutcome, hand it up.
 *
 * Scoring happens here rather than in App.tsx because this is the only screen
 * that has both a freshly-looked-up Product and the Profile needed to derive
 * targets — computing it one level up would mean threading the same two
 * things through App.tsx for no benefit.
 *
 * This is the app's one dark screen — a viewfinder wants a dark frame — so it
 * draws exclusively from `colors.dark.*`. See theme.ts for why the light-
 * ground semantic colours can't just be reused here.
 */

import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import SecondaryButton from '../components/SecondaryButton';
import { isScorable, lookupBarcode } from '../api/openfoodfacts';
import { computeTargets } from '../profile/targets';
import { computeHealthScore } from '../scoring/health';
import { computeGoalFit } from '../scoring/goalfit';
import { colors, radii, spacing, type } from '../theme';
import type { GoalFit, HealthScore, Product, Profile } from '../types';

export type ScanOutcome =
  | { kind: 'success'; product: Product; health: HealthScore; goalFit: GoalFit }
  /** Covers both a genuine OFF miss and a hit too sparse to score honestly. */
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

interface Props {
  profile: Profile;
  onScanned: (outcome: ScanOutcome) => void;
  onEditProfile: () => void;
}

// expo-camera's BarcodeType union spells these with underscores
// (`upc_a`/`upc_e`), not the `upca`/`upce` shorthand — matching the real type
// keeps this compiling instead of only looking right.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function ScannerScreen({ profile, onScanned, onEditProfile }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
  // Toggled by the "no barcode" fallback button below — the label-scan flow
  // isn't wired up yet, so this just tells the user it's coming rather than
  // pretending to do something.
  const [showComingSoon, setShowComingSoon] = useState(false);
  // Guards against onBarcodeScanned firing repeatedly for the same code while
  // a lookup is in flight — CameraView keeps scanning every frame until the
  // component unmounts or is told otherwise.
  const lockedRef = useRef(false);

  const handleBarcodeScanned = useCallback(
    async (result: BarcodeScanningResult) => {
      if (lockedRef.current) return;
      lockedRef.current = true;
      setLoading(true);

      try {
        const lookup = await lookupBarcode(result.data);

        if (lookup.status === 'not_found') {
          onScanned({ kind: 'not_found' });
          return;
        }
        if (lookup.status === 'error') {
          onScanned({ kind: 'error', message: lookup.message });
          return;
        }

        // Found but too sparse to score honestly — same dead end as a miss.
        if (!isScorable(lookup.product.nutriments)) {
          onScanned({ kind: 'not_found' });
          return;
        }

        const targets = computeTargets(profile);
        const health = computeHealthScore(lookup.product);
        const goalFit = computeGoalFit(lookup.product, targets, profile.goal);
        onScanned({ kind: 'success', product: lookup.product, health, goalFit });
      } catch {
        onScanned({ kind: 'error', message: 'Something went wrong reading that scan.' });
      } finally {
        setLoading(false);
        // lockedRef intentionally stays true — this screen instance is about
        // to be replaced by the result screen. A fresh ScannerScreen mount
        // (via "Scan another") gets its own ref at false.
      }
    },
    [profile, onScanned],
  );

  if (!permission) {
    // Permission status hasn't resolved yet — show a neutral loading state
    // rather than flashing a "please grant access" prompt that would
    // immediately disappear once the async check resolves.
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionWrap}>
          <ActivityIndicator color={colors.dark.accent} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.permissionWrap}>
          <Text style={styles.permissionTitle}>Camera access needed</Text>
          <Text style={styles.permissionBody}>
            GoalScan reads barcodes through the camera to look up products. It
            doesn't take photos or store camera data.
          </Text>
          {permission.canAskAgain ? (
            <View style={styles.permissionButton}>
              <SecondaryButton label="Grant camera access" onPress={requestPermission} tone="dark" />
            </View>
          ) : (
            <Text style={styles.permissionBody}>
              Access was denied. Enable the camera for GoalScan in your device
              Settings to continue.
            </Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.topBar}>
          <View />
          <Pressable style={styles.editButton} onPress={onEditProfile} hitSlop={8}>
            <Text style={styles.editButtonText}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.centerWrap} pointerEvents="none">
          <View style={styles.reticle}>
            <View style={styles.scanLine} />
          </View>
          <Text style={styles.title}>Point at the barcode</Text>
          <Text style={styles.hint}>It scans automatically once it's in frame.</Text>
        </View>

        <View style={styles.bottomBar}>
          {loading ? (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.dark.accent} size="large" />
              <Text style={styles.loadingText}>Looking it up…</Text>
            </View>
          ) : (
            <View style={styles.fallbackWrap} pointerEvents="box-none">
              <SecondaryButton
                label="No barcode? Photograph the label"
                tone="dark"
                onPress={() => setShowComingSoon(true)}
              />
              {showComingSoon && <Text style={styles.comingSoon}>Label scanning is coming soon.</Text>}
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const RETICLE_SIZE = 260;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.dark.bg },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  editButton: {
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  editButtonText: { ...type.small, color: colors.dark.text },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE * 0.6,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.dark.accent,
    marginBottom: spacing.lg,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  scanLine: {
    height: 1,
    backgroundColor: colors.dark.accent,
    marginHorizontal: spacing.md,
  },
  title: { ...type.h2, color: colors.dark.text, textAlign: 'center' },
  hint: { ...type.small, color: colors.dark.muted, textAlign: 'center', marginTop: spacing.xs },
  bottomBar: {
    minHeight: spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
  },
  fallbackWrap: { width: '100%', alignItems: 'center', gap: spacing.sm },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: { ...type.body, color: colors.dark.text },
  comingSoon: { ...type.small, color: colors.dark.muted },
  permissionWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: { ...type.h1, color: colors.dark.text },
  permissionBody: { ...type.body, color: colors.dark.muted },
  permissionButton: { marginTop: spacing.md },
});
