/**
 * Fixture scan result for the design preview screen.
 *
 * A realistic chocolate biscuit: meaningful sugar and saturated fat, one
 * flagged additive, a declared serving size, and NOVA 4 (ultra-processed).
 * Run through the real scoring engine — not hand-written — so the three
 * design directions are judged against actual output, not a mockup.
 */

import { computeGoalFit } from '../scoring/goalfit';
import { computeHealthScore } from '../scoring/health';
import { computeTargets } from '../profile/targets';
import type { Product, Profile } from '../types';

export const sampleProduct: Product = {
  barcode: '5000000000000',
  name: 'Chocolate Digestive Biscuits',
  brand: 'Sample Bakery',
  nutriments: {
    energyKcal: 493,
    proteins: 5.8,
    carbohydrates: 64,
    sugars: 34,
    fat: 24.5,
    saturatedFat: 18.5,
    fiber: 2.9,
    salt: 0.85,
    fruitsVegetablesNuts: 0,
  },
  ingredientsText:
    'Wheat flour, sugar, milk chocolate (17%) (sugar, cocoa butter, cocoa mass, ' +
    'whole milk powder, emulsifier: E471), vegetable oils (palm, rapeseed), ' +
    'glucose syrup, raising agents (sodium bicarbonate, malic acid), salt, flavouring',
  additiveTags: ['en:e471'],
  servingSizeG: 25,
  isBeverage: false,
  novaGroup: 4,
  source: 'openfoodfacts',
};

/** Same profile scripts/verify-offline.ts uses, for consistency. */
export const sampleProfile: Profile = {
  age: 26,
  sex: 'male',
  heightCm: 175,
  weightKg: 72,
  activity: 'moderate',
  goal: 'lose_fat',
};

const sampleTargets = computeTargets(sampleProfile);

export const sampleHealth = computeHealthScore(sampleProduct);
export const sampleGoalFit = computeGoalFit(sampleProduct, sampleTargets, sampleProfile.goal);
