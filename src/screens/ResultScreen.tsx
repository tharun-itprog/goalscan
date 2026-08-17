/**
 * The payoff screen. The score is the hero — everything else supports it.
 *
 * Three outcome shapes come in from the scanner (success / not_found / error)
 * and each gets its own honest treatment rather than a shared fallback,
 * per the "handle failure states explicitly" requirement.
 */

import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import ScoreBreakdown from '../components/ScoreBreakdown';
import type { ScanOutcome } from './ScannerScreen';
import { colorForGrade, colorForVerdict, colors, labelForVerdict, radii, spacing, type } from '../theme';

interface Props {
  outcome: ScanOutcome;
  onScanAnother: () => void;
}

export default function ResultScreen({ outcome, onScanAnother }: Props) {
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {outcome.kind === 'success' && <SuccessView outcome={outcome} />}
        {outcome.kind === 'not_found' && <NotFoundView />}
        {outcome.kind === 'error' && <ErrorView message={outcome.message} />}

        <Pressable style={styles.scanAnother} onPress={onScanAnother}>
          <Text style={styles.scanAnotherText}>
            {outcome.kind === 'error' ? 'Retry' : 'Scan another'}
          </Text>
        </Pressable>

        <Text style={styles.attribution}>Data from Open Food Facts, ODbL</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function SuccessView({ outcome }: { outcome: Extract<ScanOutcome, { kind: 'success' }> }) {
  const { product, health, goalFit } = outcome;
  const scoreColor = colorForGrade(health.grade);
  const verdictColor = colorForVerdict(goalFit.verdict);

  return (
    <>
      <View style={styles.hero}>
        {(product.name || product.brand) && (
          <Text style={styles.productName}>
            {product.name ?? 'Unnamed product'}
            {product.brand ? ` · ${product.brand}` : ''}
          </Text>
        )}
        <View style={styles.scoreRow}>
          <Text style={[styles.score, { color: scoreColor }]}>{health.value}</Text>
          <Text style={styles.scoreMax}>/100</Text>
        </View>
        <Text style={[styles.grade, { color: scoreColor }]}>{health.grade.toUpperCase()}</Text>
      </View>

      <ScoreBreakdown health={health} />

      <View style={[styles.verdictBadge, { borderColor: verdictColor }]}>
        <Text style={[styles.verdictText, { color: verdictColor }]}>
          {labelForVerdict(goalFit.verdict)}
        </Text>
      </View>

      {goalFit.servingWasEstimated && (
        <View style={styles.estimateWarning}>
          <Text style={styles.estimateWarningText}>
            ⚠ No serving size on the label — percentages below assume a{' '}
            {goalFit.servingSizeG} g serving.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Why</Text>
        {goalFit.reasons.map((reason, i) => (
          <Text key={i} style={styles.reason}>
            •  {reason}
          </Text>
        ))}
      </View>
    </>
  );
}

function NotFoundView() {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Not in the database yet</Text>
      <Text style={styles.body}>
        Open Food Facts doesn't have enough nutrition data on this product to
        score it honestly.
      </Text>
      <Text style={styles.body}>
        Photographing the nutrition label to fill this gap is planned as the
        next feature — it isn't built yet, so there's no scan to fall back to
        here.
      </Text>
    </View>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Couldn't complete that scan</Text>
      <Text style={styles.body}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { alignItems: 'center', marginBottom: spacing.lg },
  productName: {
    ...type.body,
    color: colors.muted,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  scoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
  score: { ...type.score, fontVariant: ['tabular-nums'] },
  scoreMax: { ...type.h2, color: colors.muted, marginBottom: spacing.md },
  grade: { ...type.label, letterSpacing: 2, marginTop: spacing.xs },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  verdictBadge: {
    alignSelf: 'center',
    borderWidth: 2,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  verdictText: { ...type.h1, letterSpacing: 2 },
  estimateWarning: {
    backgroundColor: '#2A2412',
    borderWidth: 1,
    borderColor: colors.caution,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  estimateWarningText: { ...type.small, color: colors.caution },
  sectionTitle: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  body: { ...type.body, color: colors.text, marginBottom: spacing.sm },
  reason: { ...type.body, color: colors.text, marginBottom: spacing.sm, lineHeight: 22 },
  scanAnother: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  scanAnotherText: { ...type.h2, color: colors.bg },
  attribution: { ...type.small, color: colors.muted, textAlign: 'center' },
});
