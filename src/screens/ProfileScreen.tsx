/**
 * What the app knows about you, and the numbers it derived from that.
 *
 * This screen exists because the profile was effectively invisible after
 * onboarding: you set it once, it disappeared behind a small pill on a live
 * camera feed, and the daily budgets computed from it — the denominator of
 * every percentage the result screen prints — were never shown at all.
 *
 * Same principle as the score breakdown: a number the user can't inspect is a
 * number they have to take on faith. "22% of your daily cap" only means
 * something once you can see that the cap is 52 g and where 52 came from.
 */

import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import PrimaryButton from '../components/PrimaryButton';
import SecondaryButton from '../components/SecondaryButton';
import {
  basalMetabolicRate,
  computeTargets,
  totalDailyEnergyExpenditure,
} from '../profile/targets';
import { colors, radii, spacing, type } from '../theme';
import type { ActivityLevel, Goal, Profile } from '../types';
import { figureStyle } from '../utils/textStyles';

interface Props {
  profile: Profile;
  onEdit: () => void;
  onBack: () => void;
}

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentary',
  light: 'Lightly active',
  moderate: 'Moderately active',
  active: 'Active',
  very_active: 'Very active',
};

const GOAL_LABEL: Record<Goal, string> = {
  lose_fat: 'losing fat',
  maintain: 'maintaining',
  gain_muscle: 'gaining muscle',
};

/**
 * Each budget says what kind of number it is. A cap and a target are opposite
 * instructions, and a row of bare numbers hides that: 52 g of sugar is a
 * ceiling to stay under, 144 g of protein is a floor to reach.
 */
interface Row {
  label: string;
  value: string;
  kind: 'target' | 'cap';
}

export default function ProfileScreen({ profile, onEdit, onBack }: Props) {
  const targets = computeTargets(profile);
  const bmr = Math.round(basalMetabolicRate(profile));
  const tdee = Math.round(totalDailyEnergyExpenditure(profile));

  const rows: Row[] = [
    { label: 'Calories', value: `${targets.calories} kcal`, kind: 'target' },
    { label: 'Protein', value: `${targets.proteinG} g`, kind: 'target' },
    { label: 'Fiber', value: `${targets.fiberG} g`, kind: 'target' },
    { label: 'Sugar', value: `${targets.sugarG} g`, kind: 'cap' },
    { label: 'Saturated fat', value: `${targets.saturatedFatG} g`, kind: 'cap' },
    { label: 'Sodium', value: `${targets.sodiumMg} mg`, kind: 'cap' },
  ];

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Your profile</Text>

        <View style={styles.card}>
          <Text style={styles.stats}>
            {profile.age} · {profile.sex === 'male' ? 'Male' : 'Female'} ·{' '}
            {profile.heightCm} cm · {profile.weightKg} kg
          </Text>
          <Text style={styles.context}>
            {ACTIVITY_LABEL[profile.activity]}, {GOAL_LABEL[profile.goal]}
          </Text>
        </View>

        <Text style={styles.sectionLabel}>YOUR DAILY BUDGET</Text>
        <View style={styles.card}>
          {rows.map((row, i) => (
            <View key={row.label} style={[styles.row, i > 0 && styles.rowDivided]}>
              <Text style={styles.rowLabel}>{row.label}</Text>
              <View style={styles.rowRight}>
                <Text style={styles.rowValue}>{row.value}</Text>
                <Text style={[styles.rowKind, row.kind === 'cap' && styles.rowKindCap]}>
                  {row.kind === 'cap' ? 'cap' : 'target'}
                </Text>
              </View>
            </View>
          ))}
        </View>

        <Text style={styles.explainer}>
          Every percentage on a scan result is measured against these. They come
          from Mifflin-St Jeor: {bmr} kcal at rest, {tdee} kcal with your
          activity, then adjusted for {GOAL_LABEL[profile.goal]}.
        </Text>

        <Text style={styles.disclaimer}>
          General-population reference values, not medical advice.
        </Text>

        <View style={styles.actions}>
          <PrimaryButton label="Edit profile" onPress={onEdit} />
        </View>
        <SecondaryButton label="Back" onPress={onBack} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...type.h1, color: colors.text, marginBottom: spacing.lg },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.xl,
  },
  stats: { ...type.body, color: colors.text, marginTop: spacing.sm },
  context: { ...type.small, color: colors.muted, marginTop: spacing.xs, marginBottom: spacing.sm },
  sectionLabel: { ...type.label, color: colors.muted, marginBottom: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  rowDivided: { borderTopWidth: 1, borderTopColor: colors.border },
  rowLabel: { ...type.body, color: colors.text },
  rowRight: { flexDirection: 'row', alignItems: 'baseline' },
  rowValue: { ...figureStyle, color: colors.text },
  rowKind: { ...type.small, color: colors.fits, marginLeft: spacing.sm, width: 44, textAlign: 'right' },
  rowKindCap: { color: colors.caution },
  explainer: { ...type.small, color: colors.muted, lineHeight: 20, marginBottom: spacing.md },
  disclaimer: { ...type.small, color: colors.muted, marginBottom: spacing.xl },
  actions: { marginBottom: spacing.sm },
});
