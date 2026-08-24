/**
 * Shared number formatting for the nutrition breakdown.
 *
 * Split out of the result/breakdown screens because both need the exact same
 * rounding rule — a serving showing "10.6g" on one screen and "11g" on the
 * other would read as two different products.
 */

import type { NutrientPoints } from '../types';

/**
 * Mirrors the rounding convention `scoring/goalfit.ts` uses for its reasons
 * text: whole numbers once a value clears 10, one decimal below that. Keeps
 * every screen's numbers reading like the same voice.
 */
export function formatNutrientValue(value: number | null, unit: NutrientPoints['unit']): string {
  if (value === null) return 'not on the label';
  switch (unit) {
    case 'kcal':
    case 'mg':
      return `${Math.round(value)} ${unit}`;
    case '%':
      return `${Math.round(value)}%`;
    default:
      return `${value >= 10 ? Math.round(value) : Math.round(value * 10) / 10} g`;
  }
}

/**
 * Zero is its own case regardless of direction — "0 penalty" and "0 bonus"
 * both just mean "no effect", and a stray +/- on a zero reads as a rounding
 * artifact rather than the neutral result it is.
 */
export function formatPoints(row: Pick<NutrientPoints, 'points' | 'direction'>): string {
  if (row.points === 0) return '0';
  const sign = row.direction === 'penalty' ? '−' : '+';
  return `${sign}${row.points}`;
}
