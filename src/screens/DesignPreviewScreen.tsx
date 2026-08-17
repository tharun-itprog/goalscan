/**
 * Side-by-side design preview: the same scan result, rendered three times,
 * once per direction in `src/design/themes.ts`. Swipe to compare; every
 * visual value on this screen comes from the active `Theme` object — nothing
 * here is hardcoded, and nothing here reuses the old `src/theme.ts`.
 *
 * This is a comparison harness, not a design decision. The three directions
 * are already fully specified; this screen only renders them.
 */

import { useCallback, useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { FONT_MAP, gradeColor, verdictColor, THEMES, type Theme, type ThemeKey } from '../design/themes';
import { sampleGoalFit, sampleHealth, sampleProduct } from './sampleScan';
import type { NutrientPoints } from '../types';

interface Props {
  onChoose: (key: ThemeKey) => void;
}

export default function DesignPreviewScreen({ onChoose }: Props) {
  const [fontsLoaded] = useFonts(FONT_MAP);
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const index = Math.round(e.nativeEvent.contentOffset.x / width);
      setActiveIndex((prev) => (index === prev ? prev : Math.max(0, Math.min(THEMES.length - 1, index))));
    },
    [width],
  );

  // Fonts must be ready before anything paints, or the exercise this screen
  // exists for — judging real typefaces — is defeated by a system-font flash.
  if (!fontsLoaded) {
    return null;
  }

  const activeTheme = THEMES[activeIndex];

  return (
    <View style={[styles.root, { width, height }]}>
      <StatusBar style={activeTheme.isDark ? 'light' : 'dark'} />
      <ScrollView
        style={styles.pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {THEMES.map((theme) => (
          <ThemePage key={theme.key} theme={theme} width={width} onChoose={onChoose} />
        ))}
      </ScrollView>

      <PageIndicator theme={activeTheme} count={THEMES.length} activeIndex={activeIndex} />
    </View>
  );
}

function PageIndicator({
  theme,
  count,
  activeIndex,
}: {
  theme: Theme;
  count: number;
  activeIndex: number;
}) {
  return (
    <View style={styles.indicatorWrap} pointerEvents="none">
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.indicatorDot,
            {
              backgroundColor: i === activeIndex ? theme.colors.accent : theme.colors.border,
              width: i === activeIndex ? 18 : 6,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ThemePage({
  theme,
  width,
  onChoose,
}: {
  theme: Theme;
  width: number;
  onChoose: (key: ThemeKey) => void;
}) {
  const s = makeStyles(theme);
  const health = sampleHealth;
  const goalFit = sampleGoalFit;
  const scoreColor = gradeColor(theme, health.grade);
  const vColor = verdictColor(theme, goalFit.verdict);
  // Enough rows to judge how data-dense type looks, not the full table.
  const previewRows = health.nutritionDetail.slice(0, 3);
  const flaggedAdditive = health.flaggedAdditives[0];

  return (
    <View style={[s.page, { width }]}>
      <SafeAreaView style={s.safe}>
        <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
          <View style={s.themeHeader}>
            <Text style={s.themeName}>{theme.name}</Text>
            <Text style={s.tagline}>{theme.tagline}</Text>
          </View>

          <View style={s.productBlock}>
            <Text style={s.productName}>{sampleProduct.name}</Text>
            {sampleProduct.brand && <Text style={s.brand}>{sampleProduct.brand}</Text>}
          </View>

          <View style={s.scoreBlock}>
            <View style={s.scoreRow}>
              <Text style={[s.score, { color: scoreColor }]}>{health.value}</Text>
              <Text style={s.scoreMax}>/100</Text>
            </View>
            <Text style={[s.grade, { color: scoreColor }]}>{health.grade.toUpperCase()}</Text>
          </View>

          <View style={[s.verdictBadge, { borderColor: vColor }]}>
            <Text style={[s.verdictText, { color: vColor }]}>{goalFit.verdict.toUpperCase()}</Text>
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Why</Text>
            {goalFit.reasons.map((reason, i) => (
              <Text key={i} style={s.reason}>
                •  {reason}
              </Text>
            ))}
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Breakdown</Text>
            <ScoreBar theme={theme} styles={s} label="Nutrition" value={health.breakdown.nutrition} max={60} />
            <ScoreBar theme={theme} styles={s} label="Additives" value={health.breakdown.additives} max={30} />
            <ScoreBar theme={theme} styles={s} label="Processing" value={health.breakdown.processing} max={10} />
          </View>

          <View style={s.card}>
            <Text style={s.sectionTitle}>Nutrition detail</Text>
            {previewRows.map((row) => (
              <NutrientRow key={row.key} row={row} styles={s} />
            ))}
          </View>

          {flaggedAdditive && (
            <View style={s.card}>
              <Text style={s.sectionTitle}>Flagged additive</Text>
              <Text style={s.additiveName}>
                {flaggedAdditive.name} ({flaggedAdditive.code})
              </Text>
              <Text style={s.additiveNote}>{flaggedAdditive.note}</Text>
            </View>
          )}

          <Pressable style={s.chooseButton} onPress={() => onChoose(theme.key)}>
            <Text style={s.chooseButtonText}>Choose {theme.name}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function ScoreBar({
  theme,
  styles: s,
  label,
  value,
  max,
}: {
  theme: Theme;
  styles: ReturnType<typeof makeStyles>;
  label: string;
  value: number;
  max: number;
}) {
  const fraction = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    <View style={s.barWrap}>
      <View style={s.barLabelRow}>
        <Text style={s.barLabel}>{label}</Text>
        <Text style={s.barValue}>
          {value}/{max}
        </Text>
      </View>
      <View style={s.barTrack}>
        <View
          style={[
            s.barFill,
            { width: `${fraction * 100}%`, backgroundColor: theme.colors.accent, borderRadius: theme.radii.sm },
          ]}
        />
      </View>
    </View>
  );
}

function NutrientRow({ row, styles: s }: { row: NutrientPoints; styles: ReturnType<typeof makeStyles> }) {
  const displayValue =
    row.value === null
      ? 'Not on label'
      : `${row.value >= 10 ? Math.round(row.value) : Math.round(row.value * 10) / 10} ${row.unit}`;
  const sign = row.points === 0 ? '' : row.direction === 'penalty' ? '−' : '+';
  return (
    <View style={s.nutrientRow}>
      <Text style={s.nutrientLabel}>{row.label}</Text>
      <Text style={s.nutrientValue}>{displayValue}</Text>
      <Text style={s.nutrientPoints}>
        {sign}
        {row.points}/{row.maxPoints}
      </Text>
    </View>
  );
}

function makeStyles(theme: Theme) {
  const cardShape = theme.usesShadow
    ? {
        shadowColor: theme.colors.text,
        shadowOpacity: 0.08,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 6 },
        elevation: 3,
      }
    : {
        borderWidth: 1,
        borderColor: theme.colors.border,
      };

  return StyleSheet.create({
    page: { flex: 1 },
    safe: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: 20, paddingBottom: 48 },
    themeHeader: { marginBottom: 20, alignItems: 'center' },
    themeName: {
      fontFamily: theme.fonts.bodyStrong,
      fontSize: theme.scale.label,
      letterSpacing: theme.scale.labelTracking,
      color: theme.colors.accent,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    tagline: {
      fontFamily: theme.fonts.body,
      fontSize: theme.scale.small,
      color: theme.colors.muted,
      textAlign: 'center',
    },
    productBlock: { alignItems: 'center', marginBottom: 12 },
    productName: {
      fontFamily: theme.fonts.display,
      fontSize: theme.scale.h1,
      color: theme.colors.text,
      textAlign: 'center',
    },
    brand: {
      fontFamily: theme.fonts.body,
      fontSize: theme.scale.body,
      color: theme.colors.muted,
      marginTop: 2,
    },
    scoreBlock: { alignItems: 'center', marginVertical: 12 },
    scoreRow: { flexDirection: 'row', alignItems: 'flex-end' },
    score: {
      fontFamily: theme.fonts.display,
      fontSize: theme.scale.score,
      letterSpacing: theme.scale.scoreTracking,
    },
    scoreMax: {
      fontFamily: theme.fonts.mono,
      fontSize: theme.scale.h2,
      color: theme.colors.muted,
      marginBottom: theme.scale.score * 0.12,
    },
    grade: {
      fontFamily: theme.fonts.bodyStrong,
      fontSize: theme.scale.label,
      letterSpacing: theme.scale.labelTracking,
      marginTop: 4,
    },
    verdictBadge: {
      alignSelf: 'center',
      borderWidth: 2,
      borderRadius: theme.radii.pill,
      paddingHorizontal: 24,
      paddingVertical: 8,
      marginBottom: 16,
    },
    verdictText: {
      fontFamily: theme.fonts.bodyStrong,
      fontSize: theme.scale.label,
      letterSpacing: theme.scale.labelTracking,
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radii.lg,
      padding: 16,
      marginBottom: 14,
      ...cardShape,
    },
    sectionTitle: {
      fontFamily: theme.fonts.bodyStrong,
      fontSize: theme.scale.label,
      letterSpacing: theme.scale.labelTracking,
      color: theme.colors.muted,
      textTransform: 'uppercase',
      marginBottom: 10,
    },
    reason: {
      fontFamily: theme.fonts.body,
      fontSize: theme.scale.body,
      color: theme.colors.text,
      marginBottom: 8,
      lineHeight: theme.scale.body * 1.4,
    },
    barWrap: { marginBottom: 12 },
    barLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    barLabel: {
      fontFamily: theme.fonts.body,
      fontSize: theme.scale.small,
      color: theme.colors.muted,
    },
    barValue: {
      fontFamily: theme.fonts.mono,
      fontSize: theme.scale.small,
      color: theme.colors.text,
    },
    barTrack: {
      height: 8,
      borderRadius: theme.radii.sm,
      backgroundColor: theme.colors.border,
      overflow: 'hidden',
    },
    barFill: { height: '100%' },
    nutrientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 8,
    },
    nutrientLabel: {
      fontFamily: theme.fonts.body,
      fontSize: theme.scale.body,
      color: theme.colors.text,
      flex: 1,
    },
    nutrientValue: {
      fontFamily: theme.fonts.mono,
      fontSize: theme.scale.small,
      color: theme.colors.muted,
      width: 84,
      textAlign: 'right',
    },
    nutrientPoints: {
      fontFamily: theme.fonts.mono,
      fontSize: theme.scale.small,
      color: theme.colors.text,
      width: 60,
      textAlign: 'right',
    },
    additiveName: {
      fontFamily: theme.fonts.bodyStrong,
      fontSize: theme.scale.body,
      color: theme.colors.text,
      marginBottom: 4,
    },
    additiveNote: {
      fontFamily: theme.fonts.body,
      fontSize: theme.scale.small,
      color: theme.colors.muted,
    },
    chooseButton: {
      backgroundColor: theme.colors.accent,
      borderRadius: theme.radii.md,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 8,
    },
    chooseButtonText: {
      fontFamily: theme.fonts.bodyStrong,
      fontSize: theme.scale.h2,
      color: theme.colors.bg,
    },
  });
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  pager: { flex: 1 },
  indicatorWrap: {
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  indicatorDot: {
    height: 6,
    borderRadius: 3,
  },
});
