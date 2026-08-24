/**
 * The camera screen: point at a barcode, get a ScanOutcome, hand it up.
 *
 * Scoring (targets -> health -> goal fit) lives in scan/evaluate.ts, not
 * here — this screen and LabelCaptureScreen both produce a fresh Product and
 * need the same chain run on it, and the two are called from different
 * places at different times, so the chain has to live somewhere they can
 * both reach rather than inline in either one.
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
import { evaluateProduct } from '../scan/evaluate';
import { colors, radii, spacing, type } from '../theme';
import type { Goal, Profile, ScanResult } from '../types';

export type ScanOutcome =
  | ({ kind: 'success' } & ScanResult)
  /**
   * Covers both a genuine OFF miss and a hit too sparse to score honestly.
   * `barcode` rides along so the "photograph the label" fallback reachable
   * from this dead end can still tag the eventual scan with the code that
   * missed, instead of scanning blind the way the no-barcode-in-hand
   * fallback on this screen has to.
   */
  | { kind: 'not_found'; barcode: string }
  | { kind: 'error'; message: string };

interface Props {
  profile: Profile;
  onScanned: (outcome: ScanOutcome) => void;
  onOpenProfile: () => void;
  onPhotographLabel: (barcode: string) => void;
}

// expo-camera's BarcodeType union spells these with underscores
// (`upc_a`/`upc_e`), not the `upca`/`upce` shorthand — matching the real type
// keeps this compiling instead of only looking right.
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e'] as const;

export default function ScannerScreen({ profile, onScanned, onOpenProfile, onPhotographLabel }: Props) {
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
          onScanned({ kind: 'not_found', barcode: result.data });
          return;
        }
        if (lookup.status === 'error') {
          onScanned({ kind: 'error', message: lookup.message });
          return;
        }

        // Found but too sparse to score honestly — same dead end as a miss.
        if (!isScorable(lookup.product.nutriments)) {
          onScanned({ kind: 'not_found', barcode: result.data });
          return;
        }

        onScanned({ kind: 'success', ...evaluateProduct(lookup.product, profile) });
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
          {/* Names the goal rather than the action. Every verdict this screen
              produces is relative to it, so it belongs on screen — and a
              person who wants to change it looks for what it says now, not
              for the word "edit". The generous hitSlop is deliberate: the
              visible pill stays light over a live camera feed, but the touch
              target still clears the design system's 48pt minimum. */}
          <Pressable
            style={({ pressed }) => [styles.goalPill, pressed && { opacity: 0.7 }]}
            onPress={onOpenProfile}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={`Goal: ${GOAL_LABEL[profile.goal]}. Open your profile.`}
          >
            <Text style={styles.goalPillText}>{GOAL_LABEL[profile.goal]}</Text>
            <Text style={styles.goalPillChevron}>›</Text>
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
                // No barcode was ever scanned here, so there's nothing to tag
                // the eventual label scan with — an empty string, not a
                // sentinel, since barcode is a plain string everywhere
                // downstream (Product.barcode included) and every consumer
                // already has to tolerate "we don't know" some other way.
                onPress={() => onPhotographLabel('')}
              />
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

/** Short enough for a camera-overlay pill; the profile screen spells it out. */
const GOAL_LABEL: Record<Goal, string> = {
  lose_fat: 'Losing fat',
  maintain: 'Maintaining',
  gain_muscle: 'Gaining muscle',
};

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
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.dark.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.dark.border,
  },
  goalPillText: { ...type.small, color: colors.dark.text },
  goalPillChevron: { ...type.small, color: colors.dark.muted, marginLeft: spacing.sm },
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
