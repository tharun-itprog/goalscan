/**
 * Serving-size resolution and how each source is worded.
 *
 * This exists because the serving size is a multiplier on every percentage the
 * result screen shows, so getting it from the wrong field is worse than not
 * having it. Two failure modes are guarded here specifically:
 *
 *   - Open Food Facts normalizes "0.6 cup dry" oats to 144 *ml*. Treating that
 *     as 144 g would overstate a bowl of oats by roughly two thirds.
 *   - A 500 g bag of pasta is not one serving, however tempting it is to use
 *     the package size when nothing else is available.
 *
 * Run: npx tsx scripts/verify-serving.ts
 */

import { resolveServing, packageQuantityG } from '../src/api/openfoodfacts';
import { computeGoalFit } from '../src/scoring/goalfit';
import { computeTargets } from '../src/profile/targets';
import type { Product } from '../src/types';

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}${ok ? '' : `, expected ${JSON.stringify(expected)}`}`);
}

console.log('\nDeclared serving sizes are read from wherever OFF put them');
{
  const text = resolveServing({ serving_size: '1 bar (40 g)' }, false);
  check('free text', text?.grams, 40);
  check('free text is label-sourced', text?.source, 'label');

  // The real Coca-Cola Zero record: the text defeats a regex, the number doesn't.
  const flOz = resolveServing(
    { serving_size: '1 can (12 fl oz)', serving_quantity: 354.882, serving_quantity_unit: 'ml' },
    true,
  );
  check('US fl oz via serving_quantity', Math.round(flOz?.grams ?? 0), 355);
  check('still counts as the label', flOz?.source, 'label');
}

console.log('\nMillilitres are not grams unless the product is a drink');
{
  // The real Quick 1-Minute Oats record. 144 ml of dry oats is about 85 g.
  const oats = resolveServing(
    { serving_size: '0.6 cup dry (0.6 cup)', serving_quantity: 144, serving_quantity_unit: 'ml' },
    false,
  );
  check('volume on a solid is refused', oats, null);

  const juice = resolveServing(
    { serving_size: '1 cup', serving_quantity: 240, serving_quantity_unit: 'ml' },
    true,
  );
  check('volume on a drink is accepted', juice?.grams, 240);
}

console.log('\nA small package is one serving; a large one is not');
{
  // Parle-G, the commonest miss in the Indian data.
  const biscuits = resolveServing(
    { product_quantity: 45, product_quantity_unit: 'g' },
    false,
  );
  check('45 g packet', biscuits?.grams, 45);
  check('labelled as a package, not a serving', biscuits?.source, 'package');

  check('500 g bag is refused', resolveServing({ product_quantity: 500, product_quantity_unit: 'g' }, false), null);
  check('330 ml can', resolveServing({ product_quantity: 330, product_quantity_unit: 'ml' }, true)?.grams, 330);
  check('2 L bottle is refused', resolveServing({ product_quantity: 2000, product_quantity_unit: 'ml' }, true), null);
  check('nothing at all', resolveServing({}, false), null);

  // Package size is still reported even when it's too big to be a serving --
  // that's what makes the "whole pack" shortcut offerable.
  check('pack size survives for the UI', packageQuantityG({ product_quantity: 500, product_quantity_unit: 'g' }, false), 500);
}

console.log('\nEach source is worded as the claim it actually is');
{
  const targets = computeTargets({
    age: 26, sex: 'male', heightCm: 175, weightKg: 72,
    activity: 'moderate', goal: 'lose_fat',
  });

  const base: Product = {
    barcode: '1', name: 'Biscuits', brand: null,
    nutriments: {
      energyKcal: 495, proteins: 6.2, carbohydrates: 62, sugars: 34,
      fat: 24, saturatedFat: 12.5, fiber: 2.8, salt: 0.9, fruitsVegetablesNuts: null,
    },
    ingredientsText: null, additiveTags: [],
    servingSizeG: 45, servingSource: 'label', packageQuantityG: 45,
    isBeverage: false, novaGroup: 4, source: 'openfoodfacts',
  };

  const label = computeGoalFit(base, targets, 'lose_fat');
  check('label', label.headline.includes('in a 45 g serving'), true);
  check('label source passes through', label.servingSource, 'label');

  const pack = computeGoalFit({ ...base, servingSource: 'package' }, targets, 'lose_fat');
  check('package', pack.headline.includes('in the 45 g pack'), true);
  check('package is disclosed in the reasons', pack.reasons.some((r) => r.includes('whole 45 g pack')), true);

  const user = computeGoalFit({ ...base, servingSource: 'user' }, targets, 'lose_fat');
  check('user', user.headline.includes('in your 45 g serving'), true);

  const assumed = computeGoalFit({ ...base, servingSizeG: null, servingSource: null }, targets, 'lose_fat');
  check('assumed says per 100 g', assumed.headline.includes('per 100 g'), true);
  check('assumed never claims a serving', assumed.headline.includes('serving'), false);
  check('assumed source', assumed.servingSource, 'assumed');

  // The whole point of the correction: a smaller serving can change the verdict.
  const wholePack = computeGoalFit({ ...base, servingSizeG: 200, servingSource: 'user' }, targets, 'lose_fat');
  const oneBiscuit = computeGoalFit({ ...base, servingSizeG: 10, servingSource: 'user' }, targets, 'lose_fat');
  check('200 g of biscuits', wholePack.verdict, 'skip');
  check('10 g of biscuits', oneBiscuit.verdict, 'fits');
  console.log(`  200 g: ${wholePack.headline}`);
  console.log(`   10 g: ${oneBiscuit.headline}`);
}

console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
process.exit(failures === 0 ? 0 : 1);
