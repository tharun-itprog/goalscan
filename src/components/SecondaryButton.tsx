/**
 * Outlined companion to PrimaryButton — used where an action matters but
 * shouldn't compete with the screen's one primary CTA (not-found's "enter it
 * by hand", the scanner's "photograph the label" fallback).
 *
 * `tone` picks which half of the palette to draw from. The scanner is the
 * app's one dark screen, and colors.dark.* exists specifically so this button
 * still clears contrast there — see theme.ts's note on why the light-ground
 * accent fails on a dark ground.
 */

import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radii, spacing, type, HIT_TARGET } from '../theme';

interface Props {
  label: string;
  onPress: () => void;
  tone?: 'light' | 'dark';
}

export default function SecondaryButton({ label, onPress, tone = 'light' }: Props) {
  const palette = tone === 'dark' ? colors.dark : colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { borderColor: palette.border },
        pressed && { opacity: 0.7 },
      ]}
      accessibilityRole="button"
    >
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: HIT_TARGET,
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  text: {
    ...type.h2,
  },
});
