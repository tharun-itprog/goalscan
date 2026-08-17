/**
 * Offline scoring tests with fixed inputs.
 *
 * Deliberately no network: these assert the engine's behaviour on known
 * panels, so they stay reproducible and can run in CI. The live smoke test
 * (verify.ts) checks that the OFF wiring works; this checks the maths.
 *
 * Run: npx tsx scripts/verify-offline.ts
 */

import { computeHealthScore } from '../src/scoring/health';
import { computeGoalFit } from '../src/scoring/goalfit';
import { computeTargets } from '../src/profile/targets';
import type { Product, Profile } from '../src/types';

const profile: Profile = {
  age: 26, sex: 'male', heightCm: 175, weightKg: 72,
  activity: 'moderate', goal: 'lose_fat',
};
const targets = computeTargets(profile);

/** Build a product with sensible empty defaults, overridden per test. */
function product(overrides: Partial<Product> & { nutriments: Product['nutriments'] }): Product {
  return {
    barcode: '0000000000000',
    name: 'Test', brand: null,
    ingredientsText: null, additiveTags: [],
    servingSizeG: null, isBeverage: false, novaGroup: null,
    source: 'openfoodfacts',
    ...overrides,
  };
}

const EMPTY = {
  energyKcal: null, proteins: null, carbohydrates: null, sugars: null,
  fat: null, saturatedFat: null, fiber: null, salt: null,
  fruitsVegetablesNuts: null,
};

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
}

console.log('\nNOVA drives the processing component');
{
  const coke = (nova: Product['novaGroup']) => product({
    name: 'Cola', isBeverage: true, novaGroup: nova,
    additiveTags: ['en:e150d'],
    // Short ingredient list — this is what fooled the old heuristic.
    ingredientsText: 'Water, sugar, carbon dioxide, colour, acid, flavouring',
    nutriments: { ...EMPTY, energyKcal: 42, sugars: 10.6, proteins: 0, fat: 0, saturatedFat: 0, salt: 0, fiber: 0 },
  });

  const withNova = computeHealthScore(coke(4));
  const withoutNova = computeHealthScore(coke(null));

  check('ultra-processed (NOVA 4) processing points', withNova.breakdown.processing, 0);
  check('fallback heuristic processing points', withoutNova.breakdown.processing, 7);
  console.log(`  NOTE  cola scores ${withNova.value}/100 (${withNova.grade}) with NOVA, ` +
    `${withoutNova.value}/100 (${withoutNova.grade}) without`);
  check('unprocessed (NOVA 1) scores full marks', computeHealthScore(coke(1)).breakdown.processing, 10);
}

console.log('\nWater is the best possible drink and scores like it');
{
  // Regression guard: this returned 78/100 with nutrition 38/60, because the
  // beverage scale used the solid-food floor of -15 -- a score a drink can
  // never reach, since it needs fiber and protein to go negative.
  const water = product({
    name: 'Spring water', isBeverage: true, novaGroup: 1,
    ingredientsText: 'Water',
    nutriments: {
      ...EMPTY, energyKcal: 0, sugars: 0, proteins: 0,
      fat: 0, saturatedFat: 0, salt: 0, fiber: 0,
    },
  });
  const h = computeHealthScore(water);
  check('nutrition is full marks', h.breakdown.nutrition, 60);
  check('overall score', h.value, 100);
  check('grade', h.grade, 'excellent');
}

console.log('\nBreakdown explains itself');
{
  const cola = product({
    isBeverage: true, novaGroup: 4, additiveTags: ['en:e150d'],
    nutriments: { ...EMPTY, energyKcal: 42, sugars: 10.6, proteins: 0, fat: 0, saturatedFat: 0, salt: 0, fiber: 0 },
  });
  const h = computeHealthScore(cola);
  const sugarRow = h.nutritionDetail.find((d) => d.key === 'sugars');
  check('sugar row reports the measured value', sugarRow?.value, 10.6);
  check('sugar row reports points cost', sugarRow?.points, 8);
  check('processing is explained in words', h.processingReason, 'Ultra-processed (NOVA 4)');
  console.log(`  cola now ${h.value}/100 (${h.grade})`);
  for (const d of h.nutritionDetail.filter((x) => x.points > 0)) {
    console.log(`    ${d.label}: ${d.value}${d.unit} -> ${d.points}/${d.maxPoints} ${d.direction}`);
  }
}

console.log('\nBeverage table is stricter than the food table');
{
  const panel = { ...EMPTY, energyKcal: 42, sugars: 10.6, proteins: 0, fat: 0, saturatedFat: 0, salt: 0, fiber: 0 };
  const asDrink = computeHealthScore(product({ isBeverage: true, novaGroup: 4, nutriments: panel }));
  const asFood = computeHealthScore(product({ isBeverage: false, novaGroup: 4, nutriments: panel }));
  const stricter = asDrink.breakdown.nutrition < asFood.breakdown.nutrition;
  if (!stricter) failures++;
  console.log(`  ${stricter ? 'PASS' : 'FAIL'}  same panel scores lower as a drink: ` +
    `${asDrink.breakdown.nutrition}/60 drink vs ${asFood.breakdown.nutrition}/60 food`);
}

console.log('\nGoal fit reflects the goal, not just the product');
{
  // A protein bar: good protein, but meaningful sugar.
  const bar = product({
    name: 'Protein bar', servingSizeG: 60, novaGroup: 4,
    nutriments: { ...EMPTY, energyKcal: 350, proteins: 33, sugars: 15, saturatedFat: 4, salt: 0.5, fiber: 8 },
  });

  const cutting = computeGoalFit(bar, targets, 'lose_fat');
  const bulking = computeGoalFit(bar, computeTargets({ ...profile, goal: 'gain_muscle' }), 'gain_muscle');

  check('same bar on a cutting goal', cutting.verdict, 'caution');
  check('same bar on a muscle-gain goal', bulking.verdict, 'fits');
  console.log(`  cutting reasons:  ${cutting.reasons[0]}`);
  console.log(`  bulking reasons:  ${bulking.reasons[0]}`);
}

console.log('\nMissing serving size is disclosed, not hidden');
{
  const fit = computeGoalFit(
    product({ nutriments: { ...EMPTY, energyKcal: 500, sugars: 40, proteins: 5, saturatedFat: 10, salt: 1, fiber: 2 } }),
    targets, 'lose_fat',
  );
  check('flagged as estimated', fit.servingWasEstimated, true);
  const disclosed = fit.reasons.some((r) => r.includes('No serving size'));
  if (!disclosed) failures++;
  console.log(`  ${disclosed ? 'PASS' : 'FAIL'}  user is told the serving was assumed`);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
