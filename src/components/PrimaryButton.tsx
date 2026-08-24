/**
 * The app's one CTA style: inverted (dark-on-light) so it reads as the single
 * obvious next action wherever it appears — result screen, onboarding,
 * not-found. Reused rather than restyled per-screen so the "what do I tap
 * next" language stays identical everywhere.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, type, HIT_TARGET } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}

export default function PrimaryButton({ label, onPress, disabled }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Text style={styles.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: HIT_TARGET,
    backgroundColor: colors.text,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.85,
  },
  text: {
    ...type.h2,
    color: colors.bg,
  },
});
