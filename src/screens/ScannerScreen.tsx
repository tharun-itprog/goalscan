/**
 * The camera screen: point at a barcode, get a ScanOutcome, hand it up.
 *
 * Scoring happens here rather than in App.tsx because this is the only screen
 * that has both a freshly-looked-up Product and the Profile needed to derive
 * targets — computing it one level up would mean threading the same two
 * things through App.tsx for no benefit.
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
  /** Optional so this screen doesn't require wiring it in every caller/test. */
  onOpenDesignPreview?: () => void;
}

// expo-camera's BarcodeType union spells these with underscores
// (`upc_a`/`upc_e`), not the `upca`/`upce` shorthand — matching the real type
// keeps this compiling instead of only looking right.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function ScannerScreen({ profile, onScanned, onEditProfile, onOpenDesignPreview }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  const [loading, setLoading] = useState(false);
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
          <ActivityIndicator color={colors.accent} size="large" />
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
            <Pressable style={styles.grantButton} onPress={requestPermission}>
              <Text style={styles.grantButtonText}>Grant camera access</Text>
            </Pressable>
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
          <Text style={styles.hint}>Point the camera at a barcode</Text>
          <Pressable style={styles.editButton} onPress={onEditProfile}>
            <Text style={styles.editButtonText}>Edit profile</Text>
          </Pressable>
        </View>

        <View style={styles.reticleWrap} pointerEvents="none">
          <View style={styles.reticle} />
        </View>

        <View style={styles.bottomBar}>
          {loading && (
            <View style={styles.loadingWrap}>
              <ActivityIndicator color={colors.accent} size="large" />
              <Text style={styles.loadingText}>Looking it up…</Text>
            </View>
          )}
          {!loading && onOpenDesignPreview && (
            <Pressable onPress={onOpenDesignPreview} hitSlop={8}>
              <Text style={styles.designPreviewLink}>Design preview</Text>
            </Pressable>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const RETICLE_SIZE = 260;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
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
  hint: {
    ...type.small,
    color: colors.text,
    backgroundColor: 'rgba(15,17,21,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    overflow: 'hidden',
  },
  editButton: {
    backgroundColor: 'rgba(15,17,21,0.7)',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  editButtonText: { ...type.small, color: colors.text },
  reticleWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  reticle: {
    width: RETICLE_SIZE,
    height: RETICLE_SIZE * 0.6,
    borderRadius: radii.md,
    borderWidth: 3,
    borderColor: colors.accent,
  },
  bottomBar: {
    minHeight: spacing.xxl * 2,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: spacing.xl,
  },
  loadingWrap: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: { ...type.body, color: colors.text },
  designPreviewLink: {
    ...type.small,
    color: colors.muted,
    textDecorationLine: 'underline',
  },
  permissionWrap: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  permissionTitle: { ...type.h1, color: colors.text },
  permissionBody: { ...type.body, color: colors.muted },
  grantButton: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  grantButtonText: { ...type.h2, color: colors.bg },
});
