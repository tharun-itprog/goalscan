/**
 * Collects the Profile that everything downstream (targets -> goal fit) is
 * computed against. Kept to six fields on purpose — every extra field is
 * another chance someone abandons setup before ever scanning anything.
 */

import { useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import SegmentedControl from '../components/SegmentedControl';
import { saveProfile } from '../storage/profile';
import { colors, radii, spacing, type } from '../theme';
import type { ActivityLevel, Goal, Profile, Sex } from '../types';

interface Props {
  /** Present when re-opening the form to edit an existing profile. */
  initialProfile?: Profile | null;
  onSaved: (profile: Profile) => void;
  /** Only offered when there's already a saved profile to fall back to. */
  onCancel?: () => void;
}

const SEX_OPTIONS: { value: Sex; label: string }[] = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
];

const ACTIVITY_OPTIONS: { value: ActivityLevel; label: string }[] = [
  { value: 'sedentary', label: 'Sedentary — desk job, little exercise' },
  { value: 'light', label: 'Light — exercise 1-3 days/week' },
  { value: 'moderate', label: 'Moderate — exercise 3-5 days/week' },
  { value: 'active', label: 'Active — hard exercise 6-7 days/week' },
  { value: 'very_active', label: 'Very active — physical job or 2x/day training' },
];

const GOAL_OPTIONS: { value: Goal; label: string }[] = [
  { value: 'lose_fat', label: 'Lose fat' },
  { value: 'maintain', label: 'Maintain' },
  { value: 'gain_muscle', label: 'Gain muscle' },
];

/** Sane physiological ranges — matches the constraint given for this screen. */
const RANGES = {
  age: { min: 13, max: 100 },
  heightCm: { min: 100, max: 250 },
  weightKg: { min: 30, max: 300 },
};

type FieldErrors = Partial<Record<'age' | 'heightCm' | 'weightKg', string>>;

export default function OnboardingScreen({ initialProfile, onSaved, onCancel }: Props) {
  // Numeric fields are kept as strings while editing so the user can clear a
  // field or type "1" of "18" without the input fighting a parsed number.
  const [age, setAge] = useState(initialProfile ? String(initialProfile.age) : '');
  const [heightCm, setHeightCm] = useState(
    initialProfile ? String(initialProfile.heightCm) : '',
  );
  const [weightKg, setWeightKg] = useState(
    initialProfile ? String(initialProfile.weightKg) : '',
  );
  const [sex, setSex] = useState<Sex>(initialProfile?.sex ?? 'female');
  const [activity, setActivity] = useState<ActivityLevel>(
    initialProfile?.activity ?? 'moderate',
  );
  const [goal, setGoal] = useState<Goal>(initialProfile?.goal ?? 'maintain');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  function validate(): { profile: Profile } | { errors: FieldErrors } {
    const nextErrors: FieldErrors = {};

    const ageNum = Number(age);
    if (!age.trim() || !Number.isFinite(ageNum)) {
      nextErrors.age = 'Enter an age';
    } else if (ageNum < RANGES.age.min || ageNum > RANGES.age.max) {
      nextErrors.age = `Must be ${RANGES.age.min}-${RANGES.age.max}`;
    }

    const heightNum = Number(heightCm);
    if (!heightCm.trim() || !Number.isFinite(heightNum)) {
      nextErrors.heightCm = 'Enter a height';
    } else if (heightNum < RANGES.heightCm.min || heightNum > RANGES.heightCm.max) {
      nextErrors.heightCm = `Must be ${RANGES.heightCm.min}-${RANGES.heightCm.max} cm`;
    }

    const weightNum = Number(weightKg);
    if (!weightKg.trim() || !Number.isFinite(weightNum)) {
      nextErrors.weightKg = 'Enter a weight';
    } else if (weightNum < RANGES.weightKg.min || weightNum > RANGES.weightKg.max) {
      nextErrors.weightKg = `Must be ${RANGES.weightKg.min}-${RANGES.weightKg.max} kg`;
    }

    if (Object.keys(nextErrors).length > 0) return { errors: nextErrors };

    return {
      profile: {
        age: Math.round(ageNum),
        sex,
        heightCm: heightNum,
        weightKg: weightNum,
        activity,
        goal,
      },
    };
  }

  async function handleSubmit() {
    const result = validate();
    if ('errors' in result) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      await saveProfile(result.profile);
      onSaved(result.profile);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.title}>
            {initialProfile ? 'Edit profile' : 'Set up your profile'}
          </Text>
          <Text style={styles.subtitle}>
            This drives your daily budget — every scan is judged against it, not
            a generic average.
          </Text>

          <Field label="Age">
            <TextInput
              style={styles.input}
              value={age}
              onChangeText={setAge}
              keyboardType="numeric"
              placeholder="e.g. 27"
              placeholderTextColor={colors.muted}
              maxLength={3}
            />
            {errors.age && <Text style={styles.error}>{errors.age}</Text>}
          </Field>

          <Field label="Sex">
            <SegmentedControl options={SEX_OPTIONS} value={sex} onChange={setSex} />
          </Field>

          <Field label="Height (cm)">
            <TextInput
              style={styles.input}
              value={heightCm}
              onChangeText={setHeightCm}
              keyboardType="numeric"
              placeholder="e.g. 170"
              placeholderTextColor={colors.muted}
              maxLength={3}
            />
            {errors.heightCm && <Text style={styles.error}>{errors.heightCm}</Text>}
          </Field>

          <Field label="Weight (kg)">
            <TextInput
              style={styles.input}
              value={weightKg}
              onChangeText={setWeightKg}
              keyboardType="numeric"
              placeholder="e.g. 65"
              placeholderTextColor={colors.muted}
              maxLength={3}
            />
            {errors.weightKg && <Text style={styles.error}>{errors.weightKg}</Text>}
          </Field>

          <Field label="Activity level">
            <SegmentedControl
              options={ACTIVITY_OPTIONS}
              value={activity}
              onChange={setActivity}
              direction="column"
            />
          </Field>

          <Field label="Goal">
            <SegmentedControl options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
          </Field>

          <Pressable
            style={({ pressed }) => [styles.submit, pressed && styles.submitPressed]}
            onPress={handleSubmit}
            disabled={saving}
          >
            <Text style={styles.submitText}>
              {saving ? 'Saving…' : initialProfile ? 'Save changes' : 'Start scanning'}
            </Text>
          </Pressable>

          {onCancel && (
            <Pressable style={styles.cancel} onPress={onCancel} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  title: { ...type.h1, color: colors.text, marginBottom: spacing.xs },
  subtitle: { ...type.body, color: colors.muted, marginBottom: spacing.xl },
  field: { marginBottom: spacing.lg },
  fieldLabel: {
    ...type.label,
    color: colors.muted,
    marginBottom: spacing.sm,
    textTransform: 'uppercase',
  },
  input: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 4,
  },
  error: { ...type.small, color: colors.skip, marginTop: spacing.xs },
  submit: {
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.md,
  },
  submitPressed: { opacity: 0.85 },
  submitText: { ...type.h2, color: colors.bg },
  cancel: { alignItems: 'center', paddingVertical: spacing.md },
  cancelText: { ...type.body, color: colors.muted },
});
