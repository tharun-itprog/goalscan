/**
 * Label-scan normalization tests. No network, no API key, no cost.
 *
 * These exercise the riskiest code in the tier-2 path: converting whatever
 * basis a label happens to use onto the per-100g basis the scoring engine
 * assumes. A silent error here doesn't crash — it just scores every US
 * product wrong, which is far worse.
 *
 * Run: npx tsx scripts/verify-labelscan.ts
 */

import { scanLabel } from '../src/api/labelScan';
import { computeHealthScore } from '../src/scoring/health';

/** Minimal proxy response; individual tests override what they care about. */
const BASE = {
  readable: true,
  basis: 'per_100g' as const,
  servingSizeG: null as number | null,
  productName: 'Test Product',
  isBeverage: false,
  energyKcal: 400, proteins: 8, carbohydrates: 60, sugars: 30,
  fat: 12, saturatedFat: 5, fiber: 3, saltG: 0.8, sodiumMg: null as number | null,
  ingredientsText: 'Oats, sugar, palm oil',
  additiveCodes: [] as string[],
};

/** Replace global fetch so the module under test sees a scripted proxy. */
function mockProxy(body: unknown, ok = true) {
  globalThis.fetch = (async () => ({
    ok,
    status: ok ? 200 : 502,
    json: async () => body,
  })) as unknown as typeof fetch;
}

let failures = 0;
function check(label: string, actual: unknown, expected: unknown) {
  const ok = Object.is(actual, expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}${ok ? '' : `, expected ${expected}`}`);
}

async function main() {
  console.log('\nEU label (per 100g) passes through unscaled');
  {
    mockProxy({ ...BASE, basis: 'per_100g' });
    const r = await scanLabel('fake', '123');
    check('status', r.status, 'extracted');
    if (r.status === 'extracted') {
      check('sugars stay 30g/100g', r.product.nutriments.sugars, 30);
    }
  }

  console.log('\nUS label (per serving) is rescaled to per 100g');
  {
    // 30g serving containing 12g sugar => 40g sugar per 100g.
    mockProxy({
      ...BASE, basis: 'per_serving', servingSizeG: 30,
      energyKcal: 150, sugars: 12, proteins: 2, carbohydrates: 20,
      fat: 6, saturatedFat: 2.5, fiber: 1, saltG: 0.2,
    });
    const r = await scanLabel('fake', '123');
    check('status', r.status, 'extracted');
    if (r.status === 'extracted') {
      check('sugars scaled to per-100g', r.product.nutriments.sugars, 40);
      check('energy scaled to per-100g', r.product.nutriments.energyKcal, 500);
      check('serving size preserved for goal fit', r.product.servingSizeG, 30);
    }
  }

  console.log('\nUnconvertible panels are refused, not guessed');
  {
    mockProxy({ ...BASE, basis: 'per_serving', servingSizeG: null });
    check('per-serving with no serving size', (await scanLabel('f', '1')).status, 'needs_serving_size');

    mockProxy({ ...BASE, basis: 'unknown' });
    check('unknown basis', (await scanLabel('f', '1')).status, 'needs_serving_size');
  }

  console.log('\nIllegible and implausible panels are rejected');
  {
    mockProxy({ ...BASE, readable: false });
    check('readable=false', (await scanLabel('f', '1')).status, 'unreadable');

    // Macros summing past 105 g per 100 g cannot all be true.
    mockProxy({ ...BASE, proteins: 60, carbohydrates: 50, fat: 30, fiber: 10 });
    check('impossible macro sum', (await scanLabel('f', '1')).status, 'unreadable');
  }

  console.log('\nSodium (US) converts to salt (engine basis)');
  {
    mockProxy({ ...BASE, saltG: null, sodiumMg: 400 });
    const r = await scanLabel('fake', '123');
    if (r.status === 'extracted') {
      check('400mg sodium -> 1g salt', r.product.nutriments.salt, 1);
    } else {
      failures++;
      console.log('  FAIL  expected extraction to succeed');
    }
  }

  console.log('\nExtracted products flow into the scoring engine');
  {
    mockProxy({ ...BASE, additiveCodes: ['E471', 'E330'] });
    const r = await scanLabel('fake', '123');
    if (r.status === 'extracted') {
      const health = computeHealthScore(r.product);
      check('source marked for the UI', r.product.source, 'label-scan');
      check('E471 was recognized', health.flaggedAdditives[0]?.code, 'E471');
      console.log(`  NOTE  scored ${health.value}/100 (${health.grade}) from a photographed label`);
    } else {
      failures++;
      console.log('  FAIL  expected extraction to succeed');
    }
  }

  console.log('\nProxy failures surface as errors, not bad data');
  {
    mockProxy({ error: 'Extraction failed' }, false);
    const r = await scanLabel('fake', '123');
    check('non-200 from proxy', r.status, 'error');
  }

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) FAILED.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main();
