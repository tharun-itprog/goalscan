/**
 * Nutri-Score point tables (2017 algorithm, general-foods variant).
 *
 * This is the objective nutrition half of the health score. It is deliberately
 * a lookup-table implementation with no cleverness: the whole point is that the
 * same product always produces the same number, and that we can show a user
 * exactly which threshold their product fell into.
 *
 * Reference: the published Nutri-Score computation. Beverages and cheeses use
 * different tables; see `isBeverage` handling in health.ts for where that
 * would hook in if we add it.
 */

import type { Nutriments, NutrientPoints } from '../types';

/**
 * Returns how many threshold boundaries `value` has crossed.
 *
 * Thresholds are the *upper bound* of each band, so a value equal to a
 * threshold stays in the lower band (Nutri-Score uses <= comparisons).
 */
function pointsFromThresholds(value: number, thresholds: number[]): number {
  let points = 0;
  for (const t of thresholds) {
    if (value > t) points += 1;
    else break;
  }
  return points;
}

// --- Negative components: more is worse, 0-10 points each ---

const ENERGY_KJ = [335, 670, 1005, 1340, 1675, 2010, 2345, 2680, 3015, 3350];
const SUGARS_G = [4.5, 9, 13.5, 18, 22.5, 27, 31, 36, 40, 45];
const SAT_FAT_G = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const SODIUM_MG = [90, 180, 270, 360, 450, 540, 630, 720, 810, 900];

// --- Beverage tables ---
// Drinks get their own, far stricter energy and sugar scales. Scoring a soda
// on the general table makes it look fine, because 10 g of sugar per 100 ml is
// unremarkable next to solid food — but you drink 330 ml, not 100 ml.
const BEVERAGE_ENERGY_KJ = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270];
const BEVERAGE_SUGARS_G = [0, 1.5, 3, 4.5, 6, 7.5, 9, 10.5, 12, 13.5];

// --- Positive components: more is better, 0-5 points each ---

const FIBER_G = [0.9, 1.9, 2.8, 3.7, 4.7];
const PROTEIN_G = [1.6, 3.2, 4.8, 6.4, 8.0];

/** Fruit/veg/nut % uses a non-linear jump: 0, 1, 2, then straight to 5. */
function fruitVegPoints(percent: number, isBeverage: boolean): number {
  if (isBeverage) {
    // Beverages can earn up to 10 here, so juice isn't punished like soda.
    if (percent > 80) return 10;
    if (percent > 60) return 4;
    if (percent > 40) return 2;
    return 0;
  }
  if (percent > 80) return 5;
  if (percent > 60) return 2;
  if (percent > 40) return 1;
  return 0;
}

/** Convert OFF's salt-in-grams to the sodium-in-mg that Nutri-Score wants. */
export function saltToSodiumMg(saltG: number): number {
  // Salt is ~2.5x sodium by mass, so sodium mg = salt g * 1000 / 2.5.
  return saltG * 400;
}

export interface NutriScoreResult {
  /** Raw Nutri-Score points. Roughly -15 (best) to 40 (worst). */
  score: number;
  /** Letter grade a European shopper would recognize. */
  grade: 'a' | 'b' | 'c' | 'd' | 'e';
  negativePoints: number;
  positivePoints: number;
  /** True if any input we needed was missing and defaulted to zero. */
  incomplete: boolean;
  /** Per-nutrient working, so the UI can show why the score is what it is. */
  detail: NutrientPoints[];
}

/**
 * Compute Nutri-Score from a per-100g nutrition panel.
 *
 * Missing values contribute zero points. That is optimistic for the negative
 * components, which is why we return `incomplete` — callers should surface it
 * rather than presenting the score as authoritative.
 */
export function computeNutriScore(n: Nutriments, isBeverage = false): NutriScoreResult {
  let incomplete = false;

  const need = <T,>(v: T | null): T | null => {
    if (v === null || v === undefined || Number.isNaN(v as number)) {
      incomplete = true;
      return null;
    }
    return v;
  };

  const kcal = need(n.energyKcal);
  const sugars = need(n.sugars);
  const satFat = need(n.saturatedFat);
  const salt = need(n.salt);
  const fiber = need(n.fiber);
  const protein = need(n.proteins);

  // Energy is tabulated in kilojoules; OFF hands us kilocalories.
  const energyKj = kcal === null ? 0 : kcal * 4.184;
  const sodiumMg = salt === null ? 0 : saltToSodiumMg(salt);

  const energyPoints = pointsFromThresholds(energyKj, isBeverage ? BEVERAGE_ENERGY_KJ : ENERGY_KJ);
  const sugarPoints = pointsFromThresholds(sugars ?? 0, isBeverage ? BEVERAGE_SUGARS_G : SUGARS_G);
  const satFatPoints = pointsFromThresholds(satFat ?? 0, SAT_FAT_G);
  const sodiumPoints = pointsFromThresholds(sodiumMg, SODIUM_MG);

  const negativePoints = energyPoints + sugarPoints + satFatPoints + sodiumPoints;

  // fruitsVegetablesNuts is frequently absent; treating it as 0 is the
  // conservative choice here (it only ever *helps* a score).
  const fvPoints = fruitVegPoints(n.fruitsVegetablesNuts ?? 0, isBeverage);
  const fiberPoints = pointsFromThresholds(fiber ?? 0, FIBER_G);
  const proteinPoints = pointsFromThresholds(protein ?? 0, PROTEIN_G);

  // The protein clause: heavily-penalized products don't get to redeem
  // themselves on protein alone, unless they're genuinely fruit/veg-rich.
  // Without this, processed meat would score far better than it should.
  const countProtein = negativePoints < 11 || fvPoints >= (isBeverage ? 10 : 5);
  const positivePoints =
    fvPoints + fiberPoints + (countProtein ? proteinPoints : 0);

  const score = negativePoints - positivePoints;

  const detail: NutrientPoints[] = [
    { key: 'energy', label: 'Energy', value: kcal, unit: 'kcal', points: energyPoints, maxPoints: 10, direction: 'penalty' },
    { key: 'sugars', label: 'Sugars', value: sugars, unit: 'g', points: sugarPoints, maxPoints: 10, direction: 'penalty' },
    { key: 'saturatedFat', label: 'Saturated fat', value: satFat, unit: 'g', points: satFatPoints, maxPoints: 10, direction: 'penalty' },
    { key: 'sodium', label: 'Sodium', value: salt === null ? null : Math.round(sodiumMg), unit: 'mg', points: sodiumPoints, maxPoints: 10, direction: 'penalty' },
    { key: 'fiber', label: 'Fiber', value: fiber, unit: 'g', points: fiberPoints, maxPoints: 5, direction: 'bonus' },
    {
      key: 'protein', label: 'Protein', value: protein, unit: 'g',
      points: countProtein ? proteinPoints : 0,
      maxPoints: 5, direction: 'bonus',
      // Surfaced so a user who sees a high-protein product earn nothing here
      // gets an explanation rather than assuming the app is broken.
      disregarded: !countProtein && proteinPoints > 0,
    },
    { key: 'fruitVeg', label: 'Fruit, veg & nuts', value: n.fruitsVegetablesNuts, unit: '%', points: fvPoints, maxPoints: isBeverage ? 10 : 5, direction: 'bonus' },
  ];

  return {
    score,
    grade: gradeFromScore(score, isBeverage),
    negativePoints,
    positivePoints,
    incomplete,
    detail,
  };
}

function gradeFromScore(score: number, isBeverage: boolean): NutriScoreResult['grade'] {
  if (isBeverage) {
    // Only water earns an A among drinks, so the bands sit much lower.
    if (score <= 1) return 'b';
    if (score <= 5) return 'c';
    if (score <= 9) return 'd';
    return 'e';
  }
  if (score <= -1) return 'a';
  if (score <= 2) return 'b';
  if (score <= 10) return 'c';
  if (score <= 18) return 'd';
  return 'e';
}

/**
 * Map raw Nutri-Score points onto a 0-100 scale where higher is better.
 *
 * Solid foods span roughly -15..40: negative scores are reachable because
 * fiber and protein earn bonus points that offset the penalties.
 *
 * Beverages need their own range, and specifically their own FLOOR. A drink
 * has effectively no fiber or protein, so it cannot earn its way below zero —
 * zero points is the best a beverage can do, and that best is plain water.
 * Reusing the food floor of -15 made that unreachable ideal the anchor, so
 * water scored 62% of the nutrition component instead of 100% and came out at
 * 78/100 overall. The ceiling is 20 rather than 40 for the same reason: with
 * no saturated fat or sodium to speak of, a drink's realistic worst case is
 * energy and sugar maxing out at ~20 combined.
 */
export function nutriScoreTo100(score: number, isBeverage = false): number {
  const BEST = isBeverage ? 0 : -15;
  const WORST = isBeverage ? 20 : 40;
  const normalized = (WORST - score) / (WORST - BEST);
  return Math.round(Math.min(1, Math.max(0, normalized)) * 100);
}
