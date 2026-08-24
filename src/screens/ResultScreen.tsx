/**
 * The payoff screen. `goalFit.headline` is the hero — the score is
 * deliberately a row further down, not enlarged, because the headline
 * already answers "is this good for me?" and the score is there to be
 * checked, not re-sold.
 *
 * Three outcome shapes come in from the scanner (success / not_found /
 * error) and each gets its own honest treatment: routed here rather than a
 * shared fallback, per the "handle failure states explicitly" requirement.
 */

import { useState } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import BreakdownScreen from './BreakdownScreen';
import NotFoundScreen from './NotFoundScreen';
import type { ScanOutcome } from './ScannerScreen';
import PrimaryButton from '../components/PrimaryButton';
import {
  colorForGrade,
  colorForVerdict,
  colors,
  labelForVerdict,
  radii,
  spacing,
  type,
  HIT_TARGET,
} from '../theme';
import type { Goal, HealthScore, Profile } from '../types';
import { formatNutrientValue } from '../utils/format';
import { figureStyle } from '../utils/textStyles';

interface Props {
  outcome: ScanOutcome;
  profile: Profile;
  onScanAnother: () => void;
}

export default function ResultScreen({ outcome, profile, onScanAnother }: Props) {
  if (outcome.kind === 'not_found') {
    return <NotFoundScreen onScanAnother={onScanAnother} />;
  }
  if (outcome.kind === 'error') {
    return <ErrorScreen message={outcome.message} onRetry={onScanAnother} />;
  }
  return <SuccessScreen outcome={outcome} profile={profile} onScanAnother={onScanAnother} />;
}

const GOAL_CONTEXT: Record<Goal, string> = {
  lose_fat: 'for fat loss',
  maintain: 'for maintenance',
  gain_muscle: 'for muscle gain',
};

/** Three-bar micro-chart baked into the score row — decorative, so its
 *  pixel dimensions don't map to any theme token (same reasoning as the
 *  spec's own 9px verdict dot). */
const BAR_MAX_HEIGHT = 20;
const BAR_WIDTH = spacing.xs;

function barHeight(value: number, max: number): number {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return Math.max(3, Math.round(fraction * BAR_MAX_HEIGHT));
}

/**
 * Up to three bullets, in priority order, skipping any that don't apply.
 * Never padded to three — a product with no flagged additives and no single
 * dominant penalty legitimately only has one thing worth saying.
 */
function buildBullets(health: HealthScore): string[] {
  const bullets: string[] = [health.processingReason];

  const penalties = health.nutritionDetail.filter((r) => r.direction === 'penalty' && r.points > 0);
  if (penalties.length > 0) {
    const worst = penalties.reduce((a, b) => (b.points > a.points ? b : a));
    bullets.push(
      `${worst.label} costs the most here — ${formatNutrientValue(worst.value, worst.unit)} is ${worst.points} of ${worst.maxPoints} points.`,
    );
  }

  if (health.flaggedAdditives.length > 0) {
    const a = health.flaggedAdditives[0];
    bullets.push(`${a.name} (${a.code.toUpperCase()}) — ${a.note}`);
  }

  return bullets.slice(0, 3);
}

function SuccessScreen({
  outcome,
  profile,
  onScanAnother,
}: {
  outcome: Extract<ScanOutcome, { kind: 'success' }>;
  profile: Profile;
  onScanAnother: () => void;
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);
  const { product, health, goalFit } = outcome;

  if (showBreakdown) {
    return <BreakdownScreen health={health} onBack={() => setShowBreakdown(false)} />;
  }

  const scoreColor = colorForGrade(health.grade);
  const verdictColor = colorForVerdict(goalFit.verdict);
  const bullets = buildBullets(health);
  const servingUnit = product.isBeverage ? 'ml' : 'g';

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        {product.brand && <Text style={styles.brand}>{product.brand}</Text>}
        <Text style={styles.productName}>{product.name ?? 'Unnamed product'}</Text>

        <View style={styles.verdictRow}>
          <View style={[styles.verdictDot, { backgroundColor: verdictColor }]} />
          <Text style={[styles.verdictLabel, { color: verdictColor }]}>
            {labelForVerdict(goalFit.verdict)}
          </Text>
          <Text style={styles.verdictContext}>{GOAL_CONTEXT[profile.goal]}</Text>
        </View>

        <Text style={styles.headline}>{goalFit.headline}</Text>

        <Pressable
          style={({ pressed }) => [styles.scoreCard, pressed && styles.scoreCardPressed]}
          onPress={() => setShowBreakdown(true)}
          accessibilityRole="button"
          accessibilityLabel={`Score ${health.value} of 100. See the breakdown.`}
        >
          <View style={styles.scoreLeft}>
            <Text style={[styles.scoreValue, { color: scoreColor }]}>{health.value}</Text>
            <Text style={styles.scoreMax}>/100</Text>
            <Text style={styles.scoreGrade}>· {health.grade}</Text>
          </View>
          <View style={styles.scoreRight}>
            <View style={styles.bars}>
              <View style={[styles.bar, { height: barHeight(health.breakdown.nutrition, 60) }]} />
              <View style={[styles.bar, { height: barHeight(health.breakdown.additives, 30) }]} />
              <View style={[styles.bar, { height: barHeight(health.breakdown.processing, 10) }]} />
            </View>
            <Text style={styles.chevron}>›</Text>
          </View>
        </Pressable>

        <Text style={styles.sectionLabel}>ALSO WORTH KNOWING</Text>
        <View style={styles.bulletList}>
          {bullets.map((b, i) => (
            <Text key={i} style={styles.bullet}>
              •  {b}
            </Text>
          ))}
        </View>

        {goalFit.servingWasEstimated ? (
          <Text style={styles.servingLineWarning}>
            Assumed {goalFit.servingSizeG} {servingUnit} serving — no size on the label, so every
            percentage above depends on this guess.
          </Text>
        ) : (
          <Text style={styles.servingLine}>
            per {goalFit.servingSizeG} {servingUnit} serving
          </Text>
        )}

        <View style={styles.actions}>
          <PrimaryButton label="Scan another" onPress={onScanAnother} />
        </View>

        {/* Open Food Facts' ODbL license requires visible attribution. */}
        <Text style={styles.attribution}>Data from Open Food Facts, ODbL</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ErrorScreen({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.errorWrap}>
        <Text style={styles.errorTitle}>Couldn't complete that scan</Text>
        <Text style={styles.errorBody}>{message}</Text>
        <View style={styles.actions}>
          <PrimaryButton label="Retry" onPress={onRetry} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  brand: { ...type.small, color: colors.muted, marginBottom: spacing.xs },
  productName: { ...type.h2, color: colors.text, marginBottom: spacing.md },
  verdictRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  verdictDot: { width: 9, height: 9, borderRadius: 4.5, marginRight: spacing.sm },
  verdictLabel: { ...type.label },
  verdictContext: { ...type.label, color: colors.muted, marginLeft: spacing.xs },
  headline: { ...type.headline, color: colors.text, marginBottom: spacing.lg },
  scoreCard: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
    shadowColor: colors.text,
    shadowOffset: { width: 0, height: spacing.xs / 2 },
    shadowOpacity: 0.08,
    shadowRadius: spacing.sm,
    elevation: 3,
  },
  scoreCardPressed: { opacity: 0.85 },
  scoreLeft: { flexDirection: 'row', alignItems: 'baseline' },
  // type.figure, per the design spec — the score is a row, not a hero, so it
  // deliberately does NOT get a larger size here.
  scoreValue: { ...figureStyle },
  scoreMax: { ...type.body, color: colors.muted, marginLeft: spacing.xs },
  scoreGrade: { ...type.body, color: colors.muted, marginLeft: spacing.sm, textTransform: 'capitalize' },
  scoreRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: BAR_MAX_HEIGHT, gap: spacing.xs },
  bar: { width: BAR_WIDTH, borderRadius: 2, backgroundColor: colors.text },
  chevron: { ...type.h2, color: colors.muted },
  sectionLabel: { ...type.label, color: colors.muted, marginBottom: spacing.sm },
  bulletList: { marginBottom: spacing.lg },
  bullet: { ...type.body, color: colors.text, marginBottom: spacing.sm, lineHeight: 22 },
  servingLine: { ...type.small, color: colors.muted, marginBottom: spacing.lg },
  servingLineWarning: { ...type.small, color: colors.caution, marginBottom: spacing.lg },
  actions: { marginBottom: spacing.lg },
  attribution: { ...type.small, color: colors.muted, textAlign: 'center' },
  errorWrap: { flex: 1, padding: spacing.lg, justifyContent: 'center' },
  errorTitle: { ...type.h1, color: colors.text, marginBottom: spacing.sm },
  errorBody: { ...type.body, color: colors.muted, marginBottom: spacing.xl },
});
