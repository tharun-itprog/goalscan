/**
 * Shared types for the whole app.
 *
 * Convention: every nutrient value is **per 100g/100ml** unless the field name
 * says otherwise. Open Food Facts stores things this way, and keeping one unit
 * everywhere avoids a whole category of bugs.
 */

/** Nutrition panel, normalized to per-100g. `null` means "we don't know". */
export interface Nutriments {
  energyKcal: number | null;
  proteins: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  /** Grams of salt. Sodium in mg = salt grams * 400. */
  salt: number | null;
  /** Percent fruit/veg/nut content, if OFF estimated it. Feeds Nutri-Score. */
  fruitsVegetablesNuts: number | null;
}

export interface Product {
  barcode: string;
  name: string | null;
  brand: string | null;
  nutriments: Nutriments;
  /** Raw ingredient text, used for display and additive cross-checking. */
  ingredientsText: string | null;
  /** OFF additive tags, e.g. "en:e471". Lowercased on ingest. */
  additiveTags: string[];
  /** Serving size in grams, if we could parse one. Null forces a fallback. */
  servingSizeG: number | null;
  /** Drinks are scored on a separate, stricter Nutri-Score table. */
  isBeverage: boolean;
  /**
   * NOVA food-processing classification, 1 (unprocessed) to 4 (ultra-processed).
   * Null when OFF hasn't classified the product.
   */
  novaGroup: 1 | 2 | 3 | 4 | null;
  /** Where the data came from — drives the "verify this" UI prompt. */
  source: 'openfoodfacts' | 'label-scan' | 'manual';
}

export type Sex = 'male' | 'female';

export type ActivityLevel =
  | 'sedentary'
  | 'light'
  | 'moderate'
  | 'active'
  | 'very_active';

export type Goal = 'lose_fat' | 'maintain' | 'gain_muscle';

export interface Profile {
  age: number;
  sex: Sex;
  heightCm: number;
  weightKg: number;
  activity: ActivityLevel;
  goal: Goal;
}

/** Daily budgets derived from a Profile. All in grams except calories/sodium. */
export interface DailyTargets {
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  /** WHO free-sugars ceiling. */
  sugarG: number;
  saturatedFatG: number;
  /** Milligrams. */
  sodiumMg: number;
  fiberG: number;
}

export interface HealthScore {
  /** 0-100, higher is better. */
  value: number;
  grade: 'excellent' | 'good' | 'poor' | 'bad';
  breakdown: {
    nutrition: number; // 0-60
    additives: number; // 0-30
    processing: number; // 0-10
  };
  /** Which additives cost points, for the "why" panel. */
  flaggedAdditives: FlaggedAdditive[];
  /** True when we had to score with an incomplete panel. */
  incomplete: boolean;
}

export interface FlaggedAdditive {
  code: string;
  name: string;
  risk: 'high' | 'moderate' | 'low';
  note: string;
}

export type Verdict = 'fits' | 'caution' | 'skip';

export interface GoalFit {
  verdict: Verdict;
  /** Human-readable, ordered most-important-first. Shown directly in the UI. */
  reasons: string[];
  /** Per-serving contribution as a fraction of the daily budget (0-1+). */
  contribution: {
    calories: number;
    protein: number;
    sugar: number;
    saturatedFat: number;
    sodium: number;
    fiber: number;
  };
  /** Grams the contribution figures were computed against. */
  servingSizeG: number;
  /** True when servingSizeG was a category default, not from the label. */
  servingWasEstimated: boolean;
}

export interface ScanResult {
  product: Product;
  health: HealthScore;
  goalFit: GoalFit;
}
