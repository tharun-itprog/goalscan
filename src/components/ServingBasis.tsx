/**
 * The serving size, stated and editable.
 *
 * Every percentage on the result screen is one multiplication away from this
 * number, so when we don't have it the screen used to end on an apology:
 * "assumed 100 g, so every percentage above depends on this guess". True, but
 * a dead end — it told the user their answer was unreliable and gave them no
 * way to fix it.
 *
 * This is that same disclosure turned into a control. The basis is always
 * shown, always says where it came from, and is always one tap from being
 * corrected — including when we did get a serving size from the label, since
 * "I ate half the bag" is a legitimate thing to tell the app.
 */

import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing, type, HIT_TARGET } from '../theme';
import type { ServingSource } from '../types';

interface Props {
  grams: number;
  source: ServingSource;
  /** 'g' or 'ml' — beverages are measured in millilitres throughout. */
  unit: string;
  /** Net contents, when known. Becomes the most useful shortcut on offer. */
  packageQuantityG: number | null;
  onChange: (grams: number) => void;
}

const SOURCE_NOTE: Record<ServingSource, string> = {
  label: 'from the label',
  package: 'the whole pack — no serving size declared',
  user: 'you set this',
  assumed: 'assumed — nothing on the label said',
};

/** Common real-world servings, so the commonest correction is one tap. */
const PRESETS = { solid: [25, 30, 50, 100], beverage: [200, 250, 330, 500] };

const round = (v: number) => (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10);

export default function ServingBasis({
  grams, source, unit, packageQuantityG, onChange,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(round(grams)));

  const assumed = source === 'assumed';

  function open() {
    setDraft(String(round(grams)));
    setEditing(true);
  }

  function commit(value: number) {
    // Reject rather than silently clamp: a rescale the user didn't ask for
    // would quietly change every number above this card.
    if (!Number.isFinite(value) || value <= 0 || value > 2000) return;
    onChange(round(value));
    setEditing(false);
  }

  if (!editing) {
    return (
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={`Measured against ${round(grams)} ${unit}, ${SOURCE_NOTE[source]}. Change it.`}
        style={({ pressed }) => [
          styles.card,
          assumed && styles.cardAssumed,
          pressed && styles.pressed,
        ]}
      >
        <View style={styles.cardText}>
          <Text style={styles.label}>MEASURED AGAINST</Text>
          <Text style={styles.value}>
            {round(grams)} {unit}
            <Text style={[styles.note, assumed && styles.noteAssumed]}>
              {'  ·  '}{SOURCE_NOTE[source]}
            </Text>
          </Text>
        </View>
        <Text style={styles.action}>Change</Text>
      </Pressable>
    );
  }

  const presets = unit === 'ml' ? PRESETS.beverage : PRESETS.solid;
  const pack = packageQuantityG === null ? null : round(packageQuantityG);
  const chips: { label: string; value: number }[] = presets.map((v) => ({
    label: `${v} ${unit}`,
    value: v,
  }));
  if (pack !== null && !presets.includes(pack)) {
    chips.push({ label: `whole pack · ${pack} ${unit}`, value: pack });
  }

  return (
    <View style={[styles.card, styles.cardEditing]}>
      <Text style={styles.label}>HOW MUCH ARE YOU HAVING?</Text>

      <View style={styles.inputRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          keyboardType="decimal-pad"
          returnKeyType="done"
          onSubmitEditing={() => commit(Number.parseFloat(draft))}
          autoFocus
          selectTextOnFocus
          style={styles.input}
          accessibilityLabel={`Serving size in ${unit}`}
        />
        <Text style={styles.inputUnit}>{unit}</Text>
      </View>

      <View style={styles.chips}>
        {chips.map((c) => (
          <Pressable
            key={c.label}
            onPress={() => setDraft(String(c.value))}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.chip,
              Number.parseFloat(draft) === c.value && styles.chipActive,
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.chipText,
                Number.parseFloat(draft) === c.value && styles.chipTextActive,
              ]}
            >
              {c.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.editActions}>
        <Pressable
          onPress={() => setEditing(false)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
        >
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable
          onPress={() => commit(Number.parseFloat(draft))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editButton, styles.useButton, pressed && styles.pressed]}
        >
          <Text style={styles.useText}>Use this</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: HIT_TARGET,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.lg,
  },
  // A guessed basis is the one case worth colouring: it's the difference
  // between a checked number and an unchecked one.
  cardAssumed: { borderColor: colors.caution, borderLeftWidth: 3 },
  cardEditing: { flexDirection: 'column', alignItems: 'stretch', paddingVertical: spacing.md },
  pressed: { opacity: 0.7 },
  cardText: { flex: 1, marginRight: spacing.sm },
  label: { ...type.label, color: colors.muted, marginBottom: spacing.xs },
  value: { ...type.body, color: colors.text },
  note: { ...type.small, color: colors.muted },
  noteAssumed: { color: colors.caution },
  action: { ...type.label, color: colors.accent },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  input: {
    ...type.h2,
    color: colors.text,
    minWidth: 96,
    minHeight: HIT_TARGET,
    borderBottomWidth: 2,
    borderBottomColor: colors.accent,
    paddingHorizontal: spacing.sm,
  },
  inputUnit: { ...type.body, color: colors.muted, marginLeft: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.md },
  chip: {
    minHeight: HIT_TARGET - spacing.md,
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  chipText: { ...type.small, color: colors.muted },
  chipTextActive: { color: colors.accent },
  editActions: { flexDirection: 'row', gap: spacing.sm },
  editButton: {
    flex: 1,
    minHeight: HIT_TARGET,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
  },
  useButton: { backgroundColor: colors.text, borderColor: colors.text },
  cancelText: { ...type.label, color: colors.muted },
  useText: { ...type.label, color: colors.bg },
});
