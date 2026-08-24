/**
 * Five-segment progress bar for onboarding. A bare "Step N of 5" told a
 * screen reader user where they were but gave a sighted user nothing to
 * glance at — this sits above the step label and answers "how much is left"
 * at a look.
 */

import { StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';

interface Props {
  /** 1-indexed current step. */
  step: number;
  total: number;
}

export default function ProgressSteps({ step, total }: Props) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.segment, i < step ? styles.segmentFilled : styles.segmentEmpty]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  segmentFilled: { backgroundColor: colors.text },
  segmentEmpty: { backgroundColor: colors.border },
});
