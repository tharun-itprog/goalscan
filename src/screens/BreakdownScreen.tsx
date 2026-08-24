/**
 * The "why is it this score?" screen — reached by tapping the score row on
 * the result screen. A score a user can check beats a score they have to
 * trust, so this shows every nutrient's measured value and point cost, the
 * processing classification, and the flagged-additive list: the full
 * arithmetic behind the one number on the result screen.
 */

import type { ReactNode } from 'react';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type, HIT_TARGET } from '../theme';
import type { FlaggedAdditive, HealthScore, NutrientPoints } from '../types';
import { formatNutrientValue, formatPoints } from '../utils/format';
import { figureStyle } from '../utils/textStyles';

const RISK_ORDER: Record<FlaggedAdditive['risk'], number> = { high: 0, moderate: 1, low: 2 };
const RISK_COLOR: Record<FlaggedAdditive['risk'], string> = {
  high: colors.skip,
  moderate: colors.caution,
  low: colors.muted,
};

function pointsColor(row: NutrientPoints): string {
  if (row.points === 0) return colors.muted;
  return row.direction === 'penalty' ? colors.skip : colors.fits;
}

interface Props {
  health: HealthScore;
  onBack: () => void;
}

export default function BreakdownScreen({ health, onBack }: Props) {
  const sortedAdditives = [...health.flaggedAdditives].sort(
    (a, b) => RISK_ORDER[a.risk] - RISK_ORDER[b.risk],
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={onBack} style={styles.backRow} hitSlop={8} accessibilityRole="button">
          <Text style={styles.backChevron}>‹</Text>
          <Text style={styles.backText}>Back</Text>
        </Pressable>

        <Text style={styles.title}>Why {health.value}?</Text>
        <Text style={styles.explainer}>
          Penalties (−) subtract from the score below; bonuses (+) add to it.
        </Text>

        <Section title="Nutrition">
          {health.nutritionDetail.map((row) => (
            <View key={row.key} style={styles.row}>
              <View style={styles.rowMain}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{formatNutrientValue(row.value, row.unit)}</Text>
                <Text style={[styles.rowPoints, { color: pointsColor(row) }]}>{formatPoints(row)}</Text>
              </View>
              {/* The protein clause can zero out a real point total. A bare "0"
                  next to a measured protein value reads as a bug, so spell out
                  the rule rather than leaving it silent. */}
              {row.disregarded && (
                <Text style={styles.note}>
                  This would score points, but the bonus is withheld when the rest
                  of the product is penalized this heavily — a deliberate rule,
                  not a miscalculation.
                </Text>
              )}
            </View>
          ))}
          {health.incomplete && (
            <Text style={styles.note}>Some nutrition data was missing for this product.</Text>
          )}
        </Section>

        <Section title="Processing">
          <Text style={styles.body}>{health.processingReason}</Text>
        </Section>

        <Section title="Additives">
          {sortedAdditives.length === 0 ? (
            <Text style={styles.body}>No additives flagged.</Text>
          ) : (
            sortedAdditives.map((additive) => (
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
        </Section>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: HIT_TARGET,
    marginLeft: -spacing.sm,
    marginBottom: spacing.sm,
  },
  backChevron: { ...type.h1, color: colors.text, marginRight: spacing.xs },
  backText: { ...type.body, color: colors.text },
  title: { ...type.h1, color: colors.text, marginBottom: spacing.xs },
  explainer: { ...type.body, color: colors.muted, marginBottom: spacing.xl },
  section: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sectionTitle: {
    ...type.label,
    color: colors.muted,
    textTransform: 'uppercase',
    marginBottom: spacing.md,
  },
  row: { marginBottom: spacing.sm },
  rowMain: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { ...type.body, color: colors.text, flex: 1 },
  rowValue: {
    ...figureStyle,
    color: colors.muted,
    width: 92,
    textAlign: 'right',
  },
  rowPoints: {
    ...figureStyle,
    width: 56,
    textAlign: 'right',
  },
  note: { ...type.small, color: colors.muted, marginTop: spacing.xs, lineHeight: 18 },
  body: { ...type.body, color: colors.text },
  additiveRow: { marginBottom: spacing.md },
  additiveHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.xs },
  riskDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },
  additiveName: { ...type.bodyStrong, color: colors.text },
  additiveNote: { ...type.small, color: colors.muted },
});
