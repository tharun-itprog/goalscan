/**
 * Tappable option-card group — onboarding's choice steps (sex, activity,
 * goal) use this instead of a picker library, per the no-new-deps
 * constraint. Generic over the option value so each call site keeps its own
 * union type.
 *
 * Cards, not pills: onboarding is one question per screen now, so each
 * option can afford to be a full-width, easy-to-hit row rather than a
 * cramped chip — that's also what makes the longer activity-level sentences
 * readable without truncating.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type, HIT_TARGET } from '../theme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  /** Null before the user has made an explicit choice — onboarding wants a
   *  real tap, not a silently-preselected default, before Continue enables. */
  value: T | null;
  onChange: (value: T) => void;
}

/**
 * Selected fill is a low-alpha tint of `colors.text` rather than a new
 * palette entry — "a tinted fill" per the design spec, derived from a token
 * that already exists instead of inventing a new colour.
 */
function tint(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const SELECTED_FILL = tint(colors.text, 0.05);

export default function SegmentedControl<T extends string>({ options, value, onChange }: Props<T>) {
  return (
    <View style={styles.group}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
            accessibilityRole="button"
            accessibilityState={{ selected }}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: spacing.sm,
  },
  option: {
    minHeight: HIT_TARGET,
    justifyContent: 'center',
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.text,
    borderWidth: 2,
    backgroundColor: SELECTED_FILL,
  },
  optionText: {
    ...type.body,
    color: colors.text,
  },
  optionTextSelected: {
    ...type.bodyStrong,
    color: colors.text,
  },
});
