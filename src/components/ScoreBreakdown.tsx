/**
 * The "why is it this score?" panel.
 *
 * Collapsed by default — the score and verdict stay the hero of the result
 * screen — but tapping the three-part breakdown expands the full arithmetic
 * behind it: every nutrient's measured value and point cost, the processing
 * classification, and the flagged-additive list. A score a user can check
 * beats a score they have to trust.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';
import type { FlaggedAdditive, HealthScore, NutrientPoints } from '../types';
import Bar from './Bar';

const RISK_ORDER: Record<FlaggedAdditive['risk'], number> = { high: 0, moderate: 1, low: 2 };
const RISK_COLOR: Record<FlaggedAdditive['risk'], string> = {
  high: colors.skip,
  moderate: colors.caution,
  low: colors.muted,
};

/**
 * Mirrors the rounding convention `goalfit.ts` uses for reasons text: whole
 * numbers once a value clears 10, one decimal below that. Keeps the "why"
 * panel's numbers reading like the same voice as the rest of the app.
 */
function formatValue(value: number | null, unit: NutrientPoints['unit']): string {
  if (value === null) return 'Not on the label';
  switch (unit) {
    case 'kcal':
    case 'mg':
      return `${Math.round(value)} ${unit}`;
    case '%':
      return `${Math.round(value)}%`;
    default:
      return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} g`;
  }
}

/**
 * Zero is its own case regardless of direction — "0 penalty" and "0 bonus"
 * are both just "no effect", and a stray +/- on a zero reads as a rounding
 * artifact rather than the neutral result it is.
 */
function pointsLabel({ points, maxPoints, direction }: NutrientPoints): string {
  if (points === 0) return `0 / ${maxPoints}`;
  const sign = direction === 'penalty' ? '−' : '+';
  return `${sign}${points} / ${maxPoints}`;
}

function pointsColor({ points, direction }: NutrientPoints): string {
  if (points === 0) return colors.muted;
  return direction === 'penalty' ? colors.skip : colors.fits;
}

interface Props {
  health: HealthScore;
}

export default function ScoreBreakdown({ health }: Props) {
  const [expanded, setExpanded] = useState(false);
  const sortedAdditives = [...health.flaggedAdditives].sort(
    (a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk],
  );

  return (
    <View style={styles.card}>
      <Bar label="Nutrition" value={health.breakdown.nutrition} max={60} color={colors.accent} />
      <Bar label="Additives" value={health.breakdown.additives} max={30} color={colors.accent} />
      <Bar label="Processing" value={health.breakdown.processing} max={10} color={colors.accent} />
      {health.incomplete && (
        <Text style={styles.quietNote}>Some nutrition data was missing for this product.</Text>
      )}

      <Pressable
        onPress={() => setExpanded((e) => !e)}
        style={styles.toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={expanded ? 'Hide score breakdown' : 'Show score breakdown'}
      >
        <Text style={styles.toggleText}>{expanded ? 'Hide the math' : 'Why this score?'}</Text>
        <Text style={styles.toggleChevron}>{expanded ? '▴' : '▾'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.detail}>
          <Text style={styles.scaleNote}>
            Penalties (−) subtract from the score, bonuses (+) add to it.
          </Text>

          <NutritionSection rows={health.nutritionDetail} />
          <ProcessingSection reason={health.processingReason} />
          <AdditivesSection additives={sortedAdditives} />
        </View>
      )}
    </View>
  );
}

function NutritionSection({ rows }: { rows: NutrientPoints[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Nutrition</Text>
      {rows.map((row) => (
        <View key={row.key} style={styles.detailRow}>
          <View style={styles.detailRowMain}>
            <Text style={styles.detailLabel}>{row.label}</Text>
            <Text style={styles.detailValue}>{formatValue(row.value, row.unit)}</Text>
            <Text style={[styles.detailPoints, { color: pointsColor(row) }]}>
              {pointsLabel(row)}
            </Text>
          </View>
          {/* The protein clause can zero out a real point total. A bare "0" next
              to a measured protein value reads as a bug, so spell out the rule. */}
          {row.disregarded && (
            <Text style={styles.disregardedNote}>
              This would score points, but Nutri-Score withholds the protein
              bonus when the rest of the product is penalized this heavily —
              a deliberate rule, not a miscalculation.
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

function ProcessingSection({ reason }: { reason: string }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Processing</Text>
      <Text style={styles.detailBody}>{reason}</Text>
    </View>
  );
}

function AdditivesSection({ additives }: { additives: FlaggedAdditive[] }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Additives</Text>
      {additives.length === 0 ? (
        <Text style={styles.detailBody}>No additives flagged.</Text>
      ) : (
        additives.map((additive) => (
          <View key={additive.code} style={styles.additiveRow}>
            <View style={styles.additiveHeader}>
              <View style={[styles.riskDot, { backgroundColor: RISK_COLOR[additive.risk] }]} />
              <Text style={styles.additiveName}>
                {additive.name} ({additive.code.toUpperCase()})
              </Text>
            </View>
            <Text style={styles.additiveNote}>{additive.note}</Text>
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  quietNote: { ...type.small, color: colors.muted, marginTop: spacing.xs },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  toggleText: { ...type.label, color: colors.accent, textTransform: 'uppercase' },
  toggleChevron: { ...type.label, color: colors.accent, marginLeft: spacing.xs },
  detail: { marginTop: spacing.md },
  scaleNote: {
    ...type.small,
    color: colors.muted,
    marginBottom: spacing.md,
  },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },
  detailBody: { ...type.body, color: colors.text },
  detailRow: { marginBottom: spacing.sm },
  detailRowMain: { flexDirection: 'row', alignItems: 'center' },
  detailLabel: { ...type.body, color: colors.text, flex: 1 },
  detailValue: {
    ...type.small,
    color: colors.muted,
    fontVariant: ['tabular-nums'],
    width: 92,
    textAlign: 'right',
  },
  detailPoints: {
    ...type.small,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    width: 68,
    textAlign: 'right',
  },
  disregardedNote: {
    ...type.small,
    color: colors.muted,
    marginTop: spacing.xs,
    lineHeight: 18,
  },
  additiveRow: {
    marginBottom: spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  additiveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  additiveName: { ...type.body, color: colors.text, fontWeight: '600' },
  additiveNote: { ...type.small, color: colors.muted },
});
