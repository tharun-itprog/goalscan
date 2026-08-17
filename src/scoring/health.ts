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
): { points: number; reason: string } {
  if (novaGroup !== null) {
    // 1 unprocessed | 2 culinary ingredient | 3 processed | 4 ultra-processed
    const table = {
      1: { points: 10, reason: 'Unprocessed or minimally processed (NOVA 1)' },
      2: { points: 8, reason: 'Processed culinary ingredient (NOVA 2)' },
      3: { points: 5, reason: 'Processed food (NOVA 3)' },
      4: { points: 0, reason: 'Ultra-processed (NOVA 4)' },
    } as const;
    return table[novaGroup];
  }

  // Fallback only — see the caveat above.
  const count = countIngredients(ingredientsText);
  if (count === null) {
    return { points: 5, reason: 'No processing data available — scored neutral' };
  }
  const points = count <= 3 ? 10 : count <= 7 ? 7 : count <= 12 ? 4 : 1;
  return {
    points,
    reason: `Estimated from ${count} ingredient${count === 1 ? '' : 's'} (no processing classification available)`,
  };
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

  const value = Math.min(
    100,
    Math.max(0, nutrition + additives.points + processing.points),
  );

  return {
    value,
    grade: gradeFor(value),
    breakdown: {
      nutrition,
      additives: additives.points,
      processing: processing.points,
    },
    nutritionDetail: nutri.detail,
    processingReason: processing.reason,
    flaggedAdditives: additives.flagged,
    incomplete: nutri.incomplete,
  };
}
