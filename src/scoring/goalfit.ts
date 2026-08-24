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
 *
 * Every finding is written twice: a short `text` fragment for list rows, and a
 * complete-sentence `headline` for the result screen's largest line. They are
 * generated together so the two can never drift apart.
 */

import type {
  DailyTargets,
  Goal,
  GoalFit,
  Product,
  ServingSource,
  Verdict,
} from '../types';

/**
 * Last-resort serving size, used only when no source could establish one.
 *
 * 100 g matches the unit the panel is already in, so the arithmetic stays
 * honest — but it is frequently wrong (nobody eats 100 g of crisps), which is
 * why every phrase built from it says "per 100 g" rather than "a serving",
 * and why the result screen offers a one-tap correction.
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
  /**
   * How far past its own threshold this signal sits, as a multiple. Lets us
   * compare a sugar overshoot against a sodium one on the same scale — without
   * it, "most important" degrades into "first in the list", and the headline
   * would be decided by the order these checks happen to be written in.
   */
  magnitude: number;
  /** Short fragment, for list rows. */
  text: string;
  /** Complete sentence with the number in it, for the headline slot. */
  headline: string;
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
  const servingSource: ServingSource = product.servingSizeG === null
    ? 'assumed'
    : product.servingSource ?? 'label';
  const scale = servingSizeG / 100;

  /**
   * How a headline refers to the amount it just quoted.
   *
   * Each source gets its own wording, because they are different claims. Only
   * `label` earns the unqualified "a serving" — a package size is our
   * inference, a user figure is theirs, and an assumed one isn't a serving at
   * all, so it names the basis instead.
   */
  const unit = product.isBeverage ? 'ml' : 'g';
  const amount = `${g(servingSizeG)} ${unit}`;
  const PER_SOURCE: Record<ServingSource, string> = {
    label: `in a ${amount} serving`,
    package: `in the ${amount} pack`,
    user: `in your ${amount} serving`,
    assumed: `per 100 ${unit}`,
  };
  const per = PER_SOURCE[servingSource];

  const n = product.nutriments;
  /** Scale a per-100g value to this serving. Null stays null. */
  const scaled = (v: number | null): number | null => (v === null ? null : v * scale);

  const kcal = scaled(n.energyKcal);
  const protein = scaled(n.proteins);
  const sugar = scaled(n.sugars);
  const satFat = scaled(n.saturatedFat);
  const fiber = scaled(n.fiber);
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

  /** Add a penalty signal if the contribution crosses either threshold. */
  function penalty(
    value: number | null,
    fraction: number,
    limit: { caution: number; hard: number },
    amount: string,
    noun: string,
    capName: string,
  ) {
    if (value === null) return;
    if (fraction < limit.caution) return;

    const hard = fraction >= limit.hard;
    signals.push({
      severity: hard ? 'hard' : 'caution',
      magnitude: fraction / limit.hard,
      text: `${amount} ${noun} — ${pct(fraction)}% of your daily ${capName}`,
      headline: `${amount} of ${noun} ${per} — ${pct(fraction)}% of your daily ${capName}.`,
    });
  }

  penalty(sugar, contribution.sugar, LIMIT.sugar, `${g(sugar ?? 0)} g`, 'sugar', 'cap');
  penalty(
    sodiumMg, contribution.sodium, LIMIT.sodium,
    `${Math.round(sodiumMg ?? 0)} mg`, 'sodium', 'limit',
  );
  penalty(
    satFat, contribution.saturatedFat, LIMIT.saturatedFat,
    `${g(satFat ?? 0)} g`, 'saturated fat', 'cap',
  );

  // Calorie density only counts against a cutting goal. On a gaining goal a
  // calorie-dense food is the point, so flagging it would be actively wrong.
  if (kcal !== null && goal === 'lose_fat') {
    const f = contribution.calories;
    if (f >= LIMIT.calories.caution) {
      const hard = f >= LIMIT.calories.hard;
      signals.push({
        severity: hard ? 'hard' : 'caution',
        magnitude: f / LIMIT.calories.hard,
        text: `${Math.round(kcal)} kcal — ${pct(f)}% of your daily intake`,
        headline: `${Math.round(kcal)} calories ${per} — ${pct(f)}% of everything you eat today.`,
      });
    }
  }

  // --- Positive signals -----------------------------------------------------

  if (protein !== null && contribution.protein >= GOOD_CONTRIBUTION) {
    signals.push({
      severity: 'positive',
      magnitude: contribution.protein / GOOD_CONTRIBUTION,
      text: `${g(protein)} g protein — ${pct(contribution.protein)}% of your daily target`,
      headline: `${g(protein)} g of protein ${per} — ${pct(contribution.protein)}% of your daily target.`,
    });
  }

  if (protein !== null && kcal !== null && kcal > 0) {
    const density = (protein / kcal) * 100;
    if (density >= PROTEIN_DENSITY_GOOD) {
      signals.push({
        severity: 'positive',
        magnitude: density / PROTEIN_DENSITY_GOOD,
        text: `Protein-dense — ${g(density)} g protein per 100 kcal`,
        headline: `${g(density)} g of protein for every 100 calories — unusually dense.`,
      });
    }
  }

  if (fiber !== null && contribution.fiber >= GOOD_CONTRIBUTION) {
    signals.push({
      severity: 'positive',
      magnitude: contribution.fiber / GOOD_CONTRIBUTION,
      text: `${g(fiber)} g fiber — ${pct(contribution.fiber)}% of your daily target`,
      headline: `${g(fiber)} g of fiber ${per} — ${pct(contribution.fiber)}% of your daily target.`,
    });
  }

  // --- Verdict --------------------------------------------------------------

  const bySeverity = (s: Signal['severity']) => signals.filter((x) => x.severity === s);
  const hard = bySeverity('hard');
  const caution = bySeverity('caution');
  const positive = bySeverity('positive');

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

  /**
   * The headline is the biggest thing on the result screen, so it is picked by
   * MAGNITUDE within the worst severity present — not by list order. Otherwise
   * saturated fat at 46% of its cap could outrank sugar at 108% purely because
   * of the order these checks run in.
   */
  const worstTier = hard.length ? hard : caution.length ? caution : positive;
  const lead = worstTier.reduce<Signal | null>(
    (best, s) => (best === null || s.magnitude > best.magnitude ? s : best),
    null,
  );

  const headline = lead
    ? lead.headline
    : 'Nothing here works against your goal.';

  // Ranked the same way, so the list agrees with the headline about what
  // matters most rather than telling a slightly different story.
  const ranked = [
    ...[...hard].sort((a, b) => b.magnitude - a.magnitude),
    ...[...caution].sort((a, b) => b.magnitude - a.magnitude),
    ...[...positive].sort((a, b) => b.magnitude - a.magnitude),
  ];

  const reasons = ranked.map((s) => s.text);
  if (reasons.length === 0) {
    reasons.push('Nothing here works against your goal');
  }

  if (servingSource === 'assumed') {
    reasons.push(
      `No serving size on the label — figures are per 100 ${unit}. Set a serving for an accurate read.`,
    );
  } else if (servingSource === 'package') {
    reasons.push(
      `No serving size declared — measured against the whole ${amount} pack.`,
    );
  }

  return {
    verdict,
    headline,
    reasons,
    contribution,
    servingSizeG,
    servingSource,
    servingWasEstimated,
  };
}
