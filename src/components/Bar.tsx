/**
 * Small labeled proportion bar — used for the three health-score components.
 * Deliberately dumb: caller does the /max math, this just draws it.
 */

import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../theme';

interface Props {
  label: string;
  value: number;
  max: number;
  color: string;
}

export default function Bar({ label, value, max, color }: Props) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>
          {value}/{max}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${fraction * 100}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.md },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  label: { ...type.small, color: colors.muted },
  value: { ...type.small, color: colors.text, fontVariant: ['tabular-nums'] },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 4,
  },
});
