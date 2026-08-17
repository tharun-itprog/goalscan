/**
 * Additive risk table.
 *
 * Scope note: these are *flags for the user's attention*, not medical claims.
 * Every entry is anchored to something checkable — a regulatory action, an
 * IARC classification, or a named body of research — and the note text says
 * which. We do not assert health outcomes, and the UI must not either.
 *
 * Anything not in this table scores as unflagged. That is deliberate: a
 * missing entry should never silently penalize a product.
 */

import type { FlaggedAdditive } from '../types';

type Risk = 'high' | 'moderate' | 'low';

interface AdditiveEntry {
  name: string;
  risk: Risk;
  note: string;
}

/** Keyed by bare E-number, lowercase, no "e" prefix. */
const ADDITIVES: Record<string, AdditiveEntry> = {
  // --- Azo dyes flagged by the Southampton study; EU requires an on-pack
  // warning that they "may have an adverse effect on activity and attention
  // in children". ---
  '102': { name: 'Tartrazine', risk: 'high', note: 'EU requires a child attention/activity warning on pack.' },
  '104': { name: 'Quinoline Yellow', risk: 'high', note: 'EU requires a child attention/activity warning on pack.' },
  '110': { name: 'Sunset Yellow FCF', risk: 'high', note: 'EU requires a child attention/activity warning on pack.' },
  '122': { name: 'Carmoisine', risk: 'high', note: 'EU requires a child attention/activity warning on pack.' },
  '124': { name: 'Ponceau 4R', risk: 'high', note: 'EU requires a child attention/activity warning on pack.' },
  '129': { name: 'Allura Red AC', risk: 'high', note: 'EU requires a child attention/activity warning on pack.' },

  // --- Regulatory bans / IARC classifications ---
  '171': { name: 'Titanium dioxide', risk: 'high', note: 'Banned as a food additive in the EU since 2022 over genotoxicity concerns.' },
  '249': { name: 'Potassium nitrite', risk: 'high', note: 'Curing salt. Can form nitrosamines; IARC classifies processed meat as Group 1.' },
  '250': { name: 'Sodium nitrite', risk: 'high', note: 'Curing salt. Can form nitrosamines; IARC classifies processed meat as Group 1.' },
  '251': { name: 'Sodium nitrate', risk: 'high', note: 'Curing salt. Can form nitrosamines during cooking.' },
  '252': { name: 'Potassium nitrate', risk: 'high', note: 'Curing salt. Can form nitrosamines during cooking.' },
  '320': { name: 'BHA', risk: 'high', note: 'IARC Group 2B — possibly carcinogenic to humans.' },
  '321': { name: 'BHT', risk: 'moderate', note: 'Synthetic antioxidant; long-running safety debate, permitted at limited levels.' },
  '951': { name: 'Aspartame', risk: 'moderate', note: 'IARC Group 2B (2023); JECFA kept the existing acceptable daily intake.' },
  '952': { name: 'Cyclamate', risk: 'high', note: 'Banned as a food additive in the United States.' },

  // --- Moderate: permitted, but with active research or sensitivity reports ---
  '133': { name: 'Brilliant Blue FCF', risk: 'moderate', note: 'Synthetic dye; restricted in some jurisdictions.' },
  '150d': { name: 'Sulphite ammonia caramel', risk: 'moderate', note: 'Can contain 4-MEI, which California lists under Proposition 65.' },
  '220': { name: 'Sulphur dioxide', risk: 'moderate', note: 'Declarable allergen; can trigger reactions in people with asthma.' },
  '221': { name: 'Sodium sulphite', risk: 'moderate', note: 'Declarable allergen; can trigger reactions in people with asthma.' },
  '223': { name: 'Sodium metabisulphite', risk: 'moderate', note: 'Declarable allergen; can trigger reactions in people with asthma.' },
  '407': { name: 'Carrageenan', risk: 'moderate', note: 'Thickener; degraded forms are under ongoing review for gut inflammation.' },
  '433': { name: 'Polysorbate 80', risk: 'moderate', note: 'Emulsifier; subject of ongoing gut-microbiome research.' },
  '466': { name: 'Carboxymethyl cellulose', risk: 'moderate', note: 'Emulsifier; subject of ongoing gut-microbiome research.' },
  '471': { name: 'Mono- and diglycerides', risk: 'moderate', note: 'Emulsifier; can carry trans fats depending on the manufacturing process.' },
  '621': { name: 'Monosodium glutamate', risk: 'moderate', note: 'Generally recognized as safe; some people report sensitivity.' },
  '950': { name: 'Acesulfame K', risk: 'moderate', note: 'Approved sweetener; EFSA re-evaluation ongoing.' },
  '955': { name: 'Sucralose', risk: 'moderate', note: 'Approved sweetener; research continues on heated-cooking byproducts.' },

  // --- Low: well-characterized, widely considered benign ---
  '300': { name: 'Ascorbic acid (vitamin C)', risk: 'low', note: 'Vitamin C, used as an antioxidant.' },
  '306': { name: 'Tocopherols (vitamin E)', risk: 'low', note: 'Vitamin E, used as a natural antioxidant.' },
  '322': { name: 'Lecithins', risk: 'low', note: 'Common emulsifier, typically from soy or sunflower.' },
  '330': { name: 'Citric acid', risk: 'low', note: 'Common acidity regulator.' },
  '415': { name: 'Xanthan gum', risk: 'low', note: 'Fermentation-derived thickener.' },
  '440': { name: 'Pectin', risk: 'low', note: 'Gelling agent, naturally present in fruit.' },
  '500': { name: 'Sodium bicarbonate', risk: 'low', note: 'Baking soda, used as a raising agent.' },
};

/** Points deducted from the 30-point additive budget, per additive found. */
const PENALTY: Record<Risk, number> = { high: 10, moderate: 4, low: 0 };

/**
 * Pull the bare E-number out of an Open Food Facts additive tag.
 *
 * OFF tags look like "en:e471" or "en:e471-mono-and-diglycerides". We want
 * "471". Returns null for tags that don't carry an E-number at all.
 */
export function normalizeAdditiveTag(tag: string): string | null {
  const match = /(?:^|:)e(\d{3,4}[a-z]?)/i.exec(tag.toLowerCase());
  return match ? match[1] : null;
}

export interface AdditiveAssessment {
  /** 0-30, higher is better. 30 means nothing flagged. */
  points: number;
  flagged: FlaggedAdditive[];
}

/**
 * Score a product's additive list.
 *
 * Only `high` and `moderate` entries cost points. `low` entries are still
 * returned so the UI can show the full picture without implying a penalty.
 */
export function assessAdditives(additiveTags: string[]): AdditiveAssessment {
  const flagged: FlaggedAdditive[] = [];
  const seen = new Set<string>();
  let penalty = 0;

  for (const tag of additiveTags) {
    const code = normalizeAdditiveTag(tag);
    if (!code || seen.has(code)) continue;
    seen.add(code);

    const entry = ADDITIVES[code];
    if (!entry) continue;

    flagged.push({
      code: `E${code.toUpperCase()}`,
      name: entry.name,
      risk: entry.risk,
      note: entry.note,
    });
    penalty += PENALTY[entry.risk];
  }

  // Sort worst-first so the UI can show the most important flag at the top.
  const order: Record<Risk, number> = { high: 0, moderate: 1, low: 2 };
  flagged.sort((a, b) => order[a.risk] - order[b.risk]);

  return { points: Math.max(0, 30 - penalty), flagged };
}
