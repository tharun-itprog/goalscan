/**
 * Shown when a barcode misses Open Food Facts, or hits a panel too sparse to
 * score honestly (see `isScorable` in api/openfoodfacts.ts) — both are the
 * same dead end from the user's point of view.
 *
 * Leads with the fallback rather than apologising: photographing the label
 * is the feature this state exists to advertise, not a consolation prize for
 * a failure. The label-scan flow itself isn't wired up yet (see
 * api/labelScan.ts), so both actions here are inert rather than faking a scan.
 */

import { useState } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import { colors, spacing, type } from '../theme';

// Emoji glyphs render through the system's colour-emoji table, not whatever
// custom fontFamily is applied — reusing type.score only for its numeric
// size keeps this the same scale as the rest of the type ramp without
// forcing the Outfit family onto a character it doesn't cover.
const ICON_SIZE = type.score.fontSize;

interface Props {
  onScanAnother: () => void;
}

export default function NotFoundScreen({ onScanAnother }: Props) {
  const [comingSoon, setComingSoon] = useState<'photo' | 'manual' | null>(null);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <Text style={styles.icon}>📷</Text>
        <Text style={styles.title}>We don't have this one yet</Text>
        <Text style={styles.body}>
          Open Food Facts doesn't have enough nutrition data on this product
          to score it honestly. Photographing the label works for any
          product, in any market, regardless of database coverage.
        </Text>

        <View style={styles.actions}>
          <PrimaryButton label="Photograph the label" onPress={() => setComingSoon('photo')} />
          <SecondaryButton label="Enter it by hand" onPress={() => setComingSoon('manual')} />
          {comingSoon && <Text style={styles.comingSoon}>That's coming soon — not built yet.</Text>}
        </View>

        <Pressable onPress={onScanAnother} hitSlop={8} style={styles.scanAnother}>
          <Text style={styles.scanAnotherText}>Scan another barcode</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  icon: { fontSize: ICON_SIZE, marginBottom: spacing.md },
  title: { ...type.h1, color: colors.text, marginBottom: spacing.sm },
  body: { ...type.body, color: colors.muted, marginBottom: spacing.xl },
  actions: { gap: spacing.sm },
  comingSoon: { ...type.small, color: colors.muted, textAlign: 'center', marginTop: spacing.xs },
  scanAnother: { alignItems: 'center', marginTop: spacing.xl, paddingVertical: spacing.sm },
  scanAnotherText: { ...type.body, color: colors.muted, textDecorationLine: 'underline' },
});
