/**
 * Goal fit — the half of the product Yuka doesn't do.
 *
 * The health score answers "is this good?". This answers "is this good FOR ME,
 * given what I'm trying to do?" — by pricing one serving against the user's
 * daily budget and applying goal-specific rules.
 *
 * Output is a verdict plus *reasons with numbers in them*. Reasons build trust;
 * a bare second number just invites arguing. Like the health score, this is
 * pure and deterministic — no model in the loop.
 */

import type {
  DailyTargets,
  Goal,
  GoalFit,
  Product,
  Verdict,
} from '../types';

/**
 * Fallback serving size when the label doesn't declare one.
 *
 * 100 g keeps the arithmetic honest and matches the unit the panel is already
 * in — but it is frequently wrong (nobody eats 100 g of crisps), so we flag it
 * and the UI must let the user correct it.
 */
const DEFAULT_SERVING_G = 100;

/** Thresholds are fractions of the daily budget consumed by ONE serving. */
const LIMIT = {
  sugar: { caution: 0.15, hard: 0.3 },
  sodium: { caution: 0.2, hard: 0.3 },
  saturatedFat: { caution: 0.2, hard: 0.3 },
  calories: { caution: 0.15, hard: 0.25 },
} as const;

/** A serving contributing this much protein/fiber counts as a real positive. */
const GOOD_CONTRIBUTION = 0.15;

/** Grams of protein per 100 kcal above which we call a food protein-dense. */
const PROTEIN_DENSITY_GOOD = 10;

interface Signal {
  severity: 'hard' | 'caution' | 'positive';
  text: string;
}

const pct = (fraction: number) => Math.round(fraction * 100);

/** Round to at most one decimal, dropping a trailing ".0". */
const g = (value: number) =>
  value >= 10 ? Math.round(value).toString() : (Math.round(value * 10) / 10).toString();

export function computeGoalFit(
  product: Product,
  targets: DailyTargets,
  goal: Goal,
): GoalFit {
  const servingWasEstimated = product.servingSizeG === null;
  const servingSizeG = product.servingSizeG ?? DEFAULT_SERVING_G;
  const scale = servingSizeG / 100;

  const n = product.nutriments;
  /** Scale a per-100g value to this serving. Null stays null. */
  const per = (v: number | null): number | null => (v === null ? null : v * scale);

  const kcal = per(n.energyKcal);
  const protein = per(n.proteins);
  const sugar = per(n.sugars);
  const satFat = per(n.saturatedFat);
  const fiber = per(n.fiber);
  // Salt grams -> sodium mg.
  const sodiumMg = n.salt === null ? null : n.salt * 400 * scale;

  const contribution = {
    calories: kcal === null ? 0 : kcal / targets.calories,
    protein: protein === null ? 0 : protein / targets.proteinG,
    sugar: sugar === null ? 0 : sugar / targets.sugarG,
    saturatedFat: satFat === null ? 0 : satFat / targets.saturatedFatG,
    sodium: sodiumMg === null ? 0 : sodiumMg / targets.sodiumMg,
    fiber: fiber === null ? 0 : fiber / targets.fiberG,
  };

  const signals: Signal[] = [];

  // --- Negative signals -----------------------------------------------------

  if (sugar !== null) {
    const c = contribution.sugar;
    if (c >= LIMIT.sugar.hard) {
      signals.push({
        severity: 'hard',
        text: `${g(sugar)} g sugar — ${pct(c)}% of your daily cap in one serving`,
      });
    } else if (c >= LIMIT.sugar.caution) {
      signals.push({
        severity: 'caution',
        text: `${g(sugar)} g sugar — ${pct(c)}% of your daily cap`,
      });
    }
  }

  if (sodiumMg !== null) {
    const c = contribution.sodium;
    if (c >= LIMIT.sodium.hard) {
      signals.push({
        severity: 'hard',
        text: `${Math.round(sodiumMg)} mg sodium — ${pct(c)}% of your daily cap in one serving`,
      });
    } else if (c >= LIMIT.sodium.caution) {
      signals.push({
        severity: 'caution',
        text: `${Math.round(sodiumMg)} mg sodium — ${pct(c)}% of your daily cap`,
      });
    }
  }

  if (satFat !== null) {
    const c = contribution.saturatedFat;
    if (c >= LIMIT.saturatedFat.hard) {
      signals.push({
        severity: 'hard',
        text: `${g(satFat)} g saturated fat — ${pct(c)}% of your daily cap`,
      });
    } else if (c >= LIMIT.saturatedFat.caution) {
      signals.push({
        severity: 'caution',
        text: `${g(satFat)} g saturated fat — ${pct(c)}% of your daily cap`,
      });
    }
  }

  // Calorie density only counts against a cutting goal. On a gaining goal a
  // calorie-dense food is the point, so flagging it would be actively wrong.
  if (kcal !== null && goal === 'lose_fat') {
    const c = contribution.calories;
    if (c >= LIMIT.calories.hard) {
      signals.push({
        severity: 'hard',
        text: `${Math.round(kcal)} kcal — ${pct(c)}% of your daily intake for one serving`,
      });
    } else if (c >= LIMIT.calories.caution) {
      signals.push({
        severity: 'caution',
        text: `${Math.round(kcal)} kcal — ${pct(c)}% of your daily intake`,
      });
    }
  }

  // --- Positive signals -----------------------------------------------------

  if (protein !== null && contribution.protein >= GOOD_CONTRIBUTION) {
    signals.push({
      severity: 'positive',
      text: `${g(protein)} g protein — ${pct(contribution.protein)}% of your daily target`,
    });
  }

  if (protein !== null && kcal !== null && kcal > 0) {
    const density = (protein / kcal) * 100;
    if (density >= PROTEIN_DENSITY_GOOD) {
      signals.push({
        severity: 'positive',
        text: `Protein-dense — ${g(density)} g protein per 100 kcal`,
      });
    }
  }

  if (fiber !== null && contribution.fiber >= GOOD_CONTRIBUTION) {
    signals.push({
      severity: 'positive',
      text: `${g(fiber)} g fiber — ${pct(contribution.fiber)}% of your daily target`,
    });
  }

  // --- Verdict --------------------------------------------------------------

  const hard = signals.filter((s) => s.severity === 'hard');
  const caution = signals.filter((s) => s.severity === 'caution');
  const positive = signals.filter((s) => s.severity === 'positive');

  let verdict: Verdict;
  if (hard.length > 0) {
    verdict = 'skip';
  } else if (caution.length > 0) {
    verdict = 'caution';
  } else {
    verdict = 'fits';
  }

  // On a muscle-gain goal, a strong protein hit outweighs a single soft flag —
  // a high-protein bar with some sugar is still the right buy.
  if (goal === 'gain_muscle' && verdict === 'caution' && positive.length > 0 && caution.length === 1) {
    verdict = 'fits';
  }

  const reasons = [...hard, ...caution, ...positive].map((s) => s.text);

  if (reasons.length === 0) {
    reasons.push('Nothing here works against your goal');
  }

  if (servingWasEstimated) {
    reasons.push(
      `No serving size on the label — figures assume ${DEFAULT_SERVING_G} g. Adjust it for an accurate read.`,
    );
  }

  return {
    verdict,
    reasons,
    contribution,
    servingSizeG,
    servingWasEstimated,
  };
}
