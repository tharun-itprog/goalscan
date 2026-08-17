/**
 * End-to-end check of the scoring pipeline against live Open Food Facts data.
 *
 * Run: npx tsx scripts/verify.ts
 *
 * This is a smoke test, not a unit test suite — it proves the tiers connect
 * and that real products produce sane numbers.
 */

import { lookupBarcode, isScorable } from '../src/api/openfoodfacts';
import { computeHealthScore } from '../src/scoring/health';
import { computeGoalFit } from '../src/scoring/goalfit';
import { computeTargets, basalMetabolicRate, totalDailyEnergyExpenditure } from '../src/profile/targets';
import type { Profile } from '../src/types';

const profile: Profile = {
  age: 26,
  sex: 'male',
  heightCm: 175,
  weightKg: 72,
  activity: 'moderate',
  goal: 'lose_fat',
};

const BARCODES = [
  '3017620422003', // Nutella 400g
  '5449000000996', // Coca-Cola 330ml
  '7622210449283', // Oreo
  '8000500310427', // Kinder Bueno
];

async function main() {
  const targets = computeTargets(profile);

  console.log('='.repeat(72));
  console.log('PROFILE');
  console.log('='.repeat(72));
  console.log(
    `${profile.age}y ${profile.sex}, ${profile.heightCm}cm, ${profile.weightKg}kg, ` +
      `${profile.activity}, goal: ${profile.goal}`,
  );
  console.log(`BMR   ${Math.round(basalMetabolicRate(profile))} kcal`);
  console.log(`TDEE  ${Math.round(totalDailyEnergyExpenditure(profile))} kcal`);
  console.log('\nDAILY TARGETS');
  console.log(
    `  ${targets.calories} kcal | ${targets.proteinG}g protein | ${targets.carbsG}g carbs | ${targets.fatG}g fat`,
  );
  console.log(
    `  caps: ${targets.sugarG}g sugar | ${targets.saturatedFatG}g sat fat | ` +
      `${targets.sodiumMg}mg sodium | ${targets.fiberG}g fiber target`,
  );

  for (const barcode of BARCODES) {
    console.log('\n' + '='.repeat(72));
    const result = await lookupBarcode(barcode);

    if (result.status !== 'found') {
      console.log(`${barcode}  ->  ${result.status.toUpperCase()}` +
        (result.status === 'error' ? `: ${result.message}` : ' (would prompt label scan)'));
      continue;
    }

    const { product } = result;
    const label = [product.brand, product.name].filter(Boolean).join(' — ') || barcode;
    console.log(label);
    console.log('-'.repeat(72));

    if (!isScorable(product.nutriments)) {
      console.log('  Panel too sparse to score — would prompt label scan.');
      continue;
    }

    const health = computeHealthScore(product);
    const fit = computeGoalFit(product, targets, profile.goal);

    console.log(
      `  HEALTH  ${health.value}/100 (${health.grade})   ` +
        `[nutrition ${health.breakdown.nutrition}/60, additives ${health.breakdown.additives}/30, ` +
        `processing ${health.breakdown.processing}/10]`,
    );
    if (health.incomplete) console.log('          (incomplete panel — some fields missing)');

    if (health.flaggedAdditives.length) {
      console.log('  FLAGS');
      for (const a of health.flaggedAdditives) {
        console.log(`    ${a.risk.toUpperCase().padEnd(8)} ${a.code} ${a.name} — ${a.note}`);
      }
    }

    const icon = { fits: 'FITS', caution: 'CAUTION', skip: 'SKIP' }[fit.verdict];
    console.log(`\n  GOAL FIT  ${icon}  (per ${fit.servingSizeG}g serving)`);
    for (const reason of fit.reasons) console.log(`    - ${reason}`);
  }

  console.log('\n' + '='.repeat(72));
  console.log('Data: Open Food Facts, ODbL.');
}

main().catch((err) => {
  console.error('FAILED:', err);
  process.exit(1);
});
