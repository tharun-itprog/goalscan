/**
 * Turn a user profile into daily nutrient budgets.
 *
 * Chain: Mifflin-St Jeor BMR -> activity multiplier -> TDEE -> goal
 * adjustment -> macro split -> per-nutrient ceilings.
 *
 * These are general-population reference figures, not clinical prescriptions.
 * The UI should frame outputs as "supports your goal", never as medical advice.
 */

import type { ActivityLevel, DailyTargets, Goal, Profile } from '../types';

/**
 * Mifflin-St Jeor basal metabolic rate — calories burned at complete rest.
 * Chosen over Harris-Benedict because it's more accurate for modern
 * populations and is the standard recommendation.
 */
export function basalMetabolicRate(p: Profile): number {
  const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
  return p.sex === 'male' ? base + 5 : base - 161;
}

const ACTIVITY_MULTIPLIER: Record<ActivityLevel, number> = {
  sedentary: 1.2, // desk job, little deliberate exercise
  light: 1.375, // light exercise 1-3 days/week
  moderate: 1.55, // moderate exercise 3-5 days/week
  active: 1.725, // hard exercise 6-7 days/week
  very_active: 1.9, // physical job or twice-daily training
};

/** Total daily energy expenditure — maintenance calories. */
export function totalDailyEnergyExpenditure(p: Profile): number {
  return basalMetabolicRate(p) * ACTIVITY_MULTIPLIER[p.activity];
}

/** Protein grams per kg bodyweight, by goal. */
const PROTEIN_PER_KG: Record<Goal, number> = {
  lose_fat: 2.0, // higher intake preserves lean mass during a deficit
  maintain: 1.6,
  gain_muscle: 1.8,
};

const GOAL_CALORIE_FACTOR: Record<Goal, number> = {
  lose_fat: 0.8, // ~20% deficit
  maintain: 1.0,
  gain_muscle: 1.1, // modest surplus; larger ones mostly add fat
};

export function computeTargets(p: Profile): DailyTargets {
  const bmr = basalMetabolicRate(p);
  const tdee = totalDailyEnergyExpenditure(p);

  // Safety floor: never prescribe below BMR. An aggressive deficit on a
  // sedentary lightweight user can otherwise land under resting requirements.
  const calories = Math.max(bmr, tdee * GOAL_CALORIE_FACTOR[p.goal]);

  const proteinG = PROTEIN_PER_KG[p.goal] * p.weightKg;

  // Fat at 25% of energy, floored at 0.5 g/kg for hormone function.
  const fatG = Math.max((calories * 0.25) / 9, 0.5 * p.weightKg);

  // Carbohydrate takes whatever energy is left over.
  const carbsG = Math.max(0, (calories - proteinG * 4 - fatG * 9) / 4);

  return {
    calories: Math.round(calories),
    proteinG: Math.round(proteinG),
    carbsG: Math.round(carbsG),
    fatG: Math.round(fatG),
    // WHO: free sugars below 10% of total energy.
    sugarG: Math.round((calories * 0.1) / 4),
    // Saturated fat below 10% of total energy.
    saturatedFatG: Math.round((calories * 0.1) / 9),
    // FDA Daily Value. WHO's stricter guidance is 2000 mg.
    sodiumMg: 2300,
    // Institute of Medicine: 14 g per 1000 kcal.
    fiberG: Math.round((calories / 1000) * 14),
  };
}
