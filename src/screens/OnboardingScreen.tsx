/**
 * Collects the Profile that everything downstream (targets -> goal fit) is
 * computed against — one question per screen rather than a single long form.
 * Kept to five steps on purpose: every extra tap between "open the app" and
 * "start scanning" is another chance someone abandons setup, and a single
 * long form hides that cost by making it feel like one screen instead of six
 * decisions.
 */

import { useMemo, useState, type ReactNode } from 'react';
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
import ProgressSteps from '../components/ProgressSteps';
import PrimaryButton from '../components/PrimaryButton';
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

const TOTAL_STEPS = 5;

function ageError(raw: string): string | null {
  if (!raw.trim()) return null; // don't shout "invalid" before they've typed anything
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a number';
  if (n < RANGES.age.min || n > RANGES.age.max) return `Must be ${RANGES.age.min}-${RANGES.age.max}`;
  return null;
}

function heightError(raw: string): string | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a number';
  if (n < RANGES.heightCm.min || n > RANGES.heightCm.max) {
    return `Must be ${RANGES.heightCm.min}-${RANGES.heightCm.max} cm`;
  }
  return null;
}

function weightError(raw: string): string | null {
  if (!raw.trim()) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 'Enter a number';
  if (n < RANGES.weightKg.min || n > RANGES.weightKg.max) {
    return `Must be ${RANGES.weightKg.min}-${RANGES.weightKg.max} kg`;
  }
  return null;
}

export default function OnboardingScreen({ initialProfile, onSaved, onCancel }: Props) {
  const [step, setStep] = useState(0);

  // Numeric fields are kept as strings while editing so the user can clear a
  // field or type "1" of "18" without the input fighting a parsed number.
  const [age, setAge] = useState(initialProfile ? String(initialProfile.age) : '');
  const [heightCm, setHeightCm] = useState(initialProfile ? String(initialProfile.heightCm) : '');
  const [weightKg, setWeightKg] = useState(initialProfile ? String(initialProfile.weightKg) : '');
  // Choice fields start at null (not a silently-preselected default) so
  // Continue staying disabled actually means something on first launch.
  // Editing an existing profile prefills them, same as the numeric fields.
  const [sex, setSex] = useState<Sex | null>(initialProfile?.sex ?? null);
  const [activity, setActivity] = useState<ActivityLevel | null>(initialProfile?.activity ?? null);
  const [goal, setGoal] = useState<Goal | null>(initialProfile?.goal ?? null);
  const [saving, setSaving] = useState(false);

  const ageErr = ageError(age);
  const heightErr = heightError(heightCm);
  const weightErr = weightError(weightKg);

  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return age.trim() !== '' && ageErr === null;
      case 1:
        return sex !== null;
      case 2:
        return heightCm.trim() !== '' && heightErr === null && weightKg.trim() !== '' && weightErr === null;
      case 3:
        return activity !== null;
      case 4:
        return goal !== null;
      default:
        return false;
    }
  }, [step, age, ageErr, sex, heightCm, heightErr, weightKg, weightErr, activity, goal]);

  async function handleContinue() {
    if (!stepValid) return;
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Final step — everything above has already been validated as it was
    // entered, so this is just assembling and persisting the result.
    const profile: Profile = {
      age: Math.round(Number(age)),
      sex: sex as Sex,
      heightCm: Number(heightCm),
      weightKg: Number(weightKg),
      activity: activity as ActivityLevel,
      goal: goal as Goal,
    };
    setSaving(true);
    try {
      await saveProfile(profile);
      onSaved(profile);
    } finally {
      setSaving(false);
    }
  }

  function handleBack() {
    if (step > 0) {
      setStep((s) => s - 1);
    } else if (onCancel) {
      onCancel();
    }
  }

  const showBack = step > 0 || !!onCancel;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ProgressSteps step={step + 1} total={TOTAL_STEPS} />
          <Text style={styles.stepLabel}>STEP {step + 1} OF {TOTAL_STEPS}</Text>

          {step === 0 && (
            <StepBody
              question="How old are you?"
              support="Used to calculate your daily calorie and macro targets."
            >
              <TextInput
                style={styles.input}
                value={age}
                onChangeText={setAge}
                keyboardType="numeric"
                placeholder="e.g. 27"
                placeholderTextColor={colors.muted}
                maxLength={3}
                autoFocus
              />
              {ageErr && <Text style={styles.error}>{ageErr}</Text>}
            </StepBody>
          )}

          {step === 1 && (
            <StepBody question="What's your sex?" support="Metabolic rate differs by sex — this keeps your targets accurate.">
              <SegmentedControl options={SEX_OPTIONS} value={sex} onChange={setSex} />
            </StepBody>
          )}

          {step === 2 && (
            <StepBody question="What's your height and weight?" support="These anchor your basal metabolic rate.">
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
                {heightErr && <Text style={styles.error}>{heightErr}</Text>}
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
                {weightErr && <Text style={styles.error}>{weightErr}</Text>}
              </Field>
            </StepBody>
          )}

          {step === 3 && (
            <StepBody question="How active are you day to day?" support="More activity means a higher calorie budget.">
              <SegmentedControl options={ACTIVITY_OPTIONS} value={activity} onChange={setActivity} />
            </StepBody>
          )}

          {step === 4 && (
            <StepBody question="What's your goal?" support="Every scan is judged against this, not a generic average.">
              <SegmentedControl options={GOAL_OPTIONS} value={goal} onChange={setGoal} />
            </StepBody>
          )}

          <View style={styles.actions}>
            <PrimaryButton
              label={
                saving
                  ? 'Saving…'
                  : step < TOTAL_STEPS - 1
                    ? 'Continue'
                    : initialProfile
                      ? 'Save changes'
                      : 'Start scanning'
              }
              onPress={handleContinue}
              disabled={!stepValid || saving}
            />
            {showBack && (
              <Pressable style={styles.back} onPress={handleBack} disabled={saving}>
                <Text style={styles.backText}>Back</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function StepBody({ question, support, children }: { question: string; support?: string; children: ReactNode }) {
  return (
    <View style={styles.stepBody}>
      <Text style={styles.question}>{question}</Text>
      {support && <Text style={styles.support}>{support}</Text>}
      <View style={styles.stepContent}>{children}</View>
    </View>
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
  content: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  stepLabel: {
    ...type.label,
    color: colors.muted,
    marginTop: spacing.md,
  },
  stepBody: { marginTop: spacing.lg },
  question: { ...type.h1, color: colors.text, marginBottom: spacing.xs },
  support: { ...type.body, color: colors.muted, marginBottom: spacing.lg },
  stepContent: { marginTop: spacing.md },
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
  actions: { marginTop: spacing.xl, gap: spacing.sm },
  back: { alignItems: 'center', paddingVertical: spacing.md },
  backText: { ...type.body, color: colors.muted },
});
