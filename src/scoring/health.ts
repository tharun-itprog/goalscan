/**
 * The health score: one 0-100 number, same for every user.
 *
 * Weighting (mirrors the shape Yuka popularized, which shoppers already
 * understand):
 *   60  nutrition quality  — Nutri-Score, purely from the nutrition panel
 *   30  additives          — flagged additives cost points
 *   10  processing         — ingredient-count proxy for ultra-processing
 *
 * This function is pure and deterministic. Given the same Product it returns
 * the same score forever, which is the entire reason the LLM is nowhere near
 * this file.
 */

import type { HealthScore, Product } from '../types';
import { assessAdditives } from './additives';
import { computeNutriScore, nutriScoreTo100 } from './nutriscore';

/**
 * Rough count of distinct ingredients.
 *
 * Splitting on commas is imperfect — nested parentheses like
 * "chocolate (sugar, cocoa mass)" inflate the count — but as an
 * ultra-processing proxy the direction is right, and being slightly harsh on
 * compound ingredients is acceptable for a 10-point component.
 */
function countIngredients(text: string | null): number | null {
  if (!text || !text.trim()) return null;
  const parts = text
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
  return parts.length || null;
}

/**
 * 0-10 processing score, NOVA-first.
 *
 * NOVA is a published classification of *how industrially processed* a food
 * is, which is the thing we actually want to measure. The ingredient-count
 * heuristic below is only a fallback, and a weak one: it rated Coca-Cola 7/10
 * for having a short ingredient list, when Coke is textbook NOVA 4. Counting
 * ingredients measures recipe complexity, not processing.
 */
function processingPoints(
  novaGroup: 1 | 2 | 3 | 4 | null,
  ingredientsText: string | null,
): number {
  if (novaGroup !== null) {
    // 1 unprocessed | 2 culinary ingredient | 3 processed | 4 ultra-processed
    return { 1: 10, 2: 8, 3: 5, 4: 0 }[novaGroup];
  }

  // Fallback only — see the caveat above.
  const count = countIngredients(ingredientsText);
  if (count === null) return 5; // neutral — don't reward or punish missing data
  if (count <= 3) return 10;
  if (count <= 7) return 7;
  if (count <= 12) return 4;
  return 1;
}

function gradeFor(value: number): HealthScore['grade'] {
  if (value >= 75) return 'excellent';
  if (value >= 50) return 'good';
  if (value >= 25) return 'poor';
  return 'bad';
}

export function computeHealthScore(product: Product): HealthScore {
  const nutri = computeNutriScore(product.nutriments, product.isBeverage);
  const additives = assessAdditives(product.additiveTags);

  // Nutri-Score occupies 60 of the 100 points.
  const nutrition = Math.round(
    (nutriScoreTo100(nutri.score, product.isBeverage) / 100) * 60,
  );
  const processing = processingPoints(product.novaGroup, product.ingredientsText);

  const value = Math.min(100, Math.max(0, nutrition + additives.points + processing));

  return {
    value,
    grade: gradeFor(value),
    breakdown: { nutrition, additives: additives.points, processing },
    flaggedAdditives: additives.flagged,
    incomplete: nutri.incomplete,
  };
}
