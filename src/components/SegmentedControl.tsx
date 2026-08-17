/**
 * Tappable segmented option group — the profile form uses this three times
 * (sex, activity, goal) instead of a picker library, per the no-new-deps
 * constraint. Generic over the option value so each call site keeps its own
 * union type.
 */

import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing, type } from '../theme';

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Stack vertically for longer labels (e.g. activity level sentences). */
  direction?: 'row' | 'column';
}

export default function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  direction = 'row',
}: Props<T>) {
  return (
    <View style={[styles.group, direction === 'column' && styles.groupColumn]}>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  groupColumn: {
    flexDirection: 'column',
  },
  option: {
    flexGrow: 1,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  optionSelected: {
    borderColor: colors.accent,
    backgroundColor: '#1E2A3D',
  },
  optionText: {
    ...type.body,
    color: colors.muted,
  },
  optionTextSelected: {
    color: colors.text,
    fontWeight: '600',
  },
});
