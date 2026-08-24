/**
 * Tier 1 of the scan cascade: Open Food Facts barcode lookup.
 *
 * OFF is a free, ODbL-licensed collaborative database. Two obligations come
 * with using it and both are handled here or in the UI:
 *   1. Send an identifying User-Agent (they ask for this explicitly).
 *   2. Attribute OFF visibly in the app (see the result screen footer).
 *
 * A miss here is expected and normal, not an error — coverage measured at
 * 81-96% for US/UK/EU and far lower elsewhere. The caller falls through to
 * tier 2 (photograph the label) rather than showing a failure.
 */

import type { Nutriments, Product, ServingSource } from '../types';

const BASE = 'https://world.openfoodfacts.org/api/v2/product';

// OFF asks that apps identify themselves. Update the contact if you fork this.
const USER_AGENT = 'GoalScan/0.1 (github.com/tharun-itprog/goalscan)';

const TIMEOUT_MS = 8000;

/** Only request what we score with — smaller payloads, faster scans. */
const FIELDS = [
  'code',
  'product_name',
  'brands',
  'nutriments',
  'ingredients_text',
  'additives_tags',
  'serving_size',
  // OFF normalizes fl oz / cups into these, which the free-text field can't
  // give us. Measured on 300 US products: serving_size parses for 97%, and
  // serving_quantity covers every remaining one -- all of them fl-oz drinks.
  'serving_quantity',
  'serving_quantity_unit',
  'product_quantity',
  'product_quantity_unit',
  'categories_tags',
  'quantity',
  'nova_group',
].join(',');

export type LookupResult =
  | { status: 'found'; product: Product }
  /** Barcode is valid but OFF has no record — fall through to a label scan. */
  | { status: 'not_found' }
  /** Network or server problem — worth offering a retry. */
  | { status: 'error'; message: string };

/**
 * Parse OFF's free-text serving size into grams.
 *
 * Handles "30 g", "250ml", "1 bar (40 g)". Returns null for anything we can't
 * read confidently — guessing here would silently corrupt every percentage on
 * the result screen, so a null (which the UI surfaces) is much safer.
 */
export function parseServingSizeG(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*(g|ml)\b/i.exec(raw);
  if (!match) return null;
  const value = parseFloat(match[1].replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Largest package we're willing to treat as one serving when nothing declares
 * a serving size. A 45 g biscuit packet or a 250 ml bottle is eaten in one go;
 * a 500 g bag of pasta plainly isn't. The cut-off is a judgement call, so the
 * result screen labels this basis "whole pack" rather than passing it off as a
 * declared serving.
 */
const SINGLE_SERVE_MAX_G = 60;
const SINGLE_SERVE_MAX_ML = 500;

/**
 * OFF's normalized numeric serving size.
 *
 * This is how US labels get read at all: "1 can (12 fl oz)" defeats the text
 * regex, but OFF has already converted it to 354.882 ml.
 *
 * The unit guard is the load-bearing part. OFF also normalizes volumes for
 * solids -- "0.6 cup dry" oats comes back as 144 *ml* -- and 144 ml of dry
 * oats is nowhere near 144 g. Millilitres are only safely interchangeable with
 * grams for water-based drinks, so that's the only place we accept them.
 */
function servingFromNormalizedField(
  raw: Record<string, unknown>,
  isBeverage: boolean,
): number | null {
  const value = Number.parseFloat(String(raw.serving_quantity));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = String(raw.serving_quantity_unit ?? '').toLowerCase();
  if (unit === 'g') return value;
  if (unit === 'ml' && isBeverage) return value;
  return null;
}

/** Net contents of the package, same unit guard as above. */
export function packageQuantityG(
  raw: Record<string, unknown>,
  isBeverage: boolean,
): number | null {
  const value = Number.parseFloat(String(raw.product_quantity));
  if (!Number.isFinite(value) || value <= 0) return null;
  const unit = String(raw.product_quantity_unit ?? '').toLowerCase();
  if (unit === 'g') return value;
  if (unit === 'ml' && isBeverage) return value;
  // Older records carry only the free-text quantity ("250 ml").
  return unit === '' ? parseServingSizeG(raw.quantity as string) : null;
}

/**
 * Establish a serving size from the best source available, best first.
 *
 * Measured on OFF samples: the text field alone covers 97% of US products but
 * only 50% of Indian ones. Adding the normalized field and the single-serve
 * package rule takes the US to 100% and India from 50% to 71%.
 */
export function resolveServing(
  raw: Record<string, unknown>,
  isBeverage: boolean,
): { grams: number; source: Exclude<ServingSource, 'assumed'> } | null {
  const declared = parseServingSizeG(raw.serving_size as string);
  if (declared !== null) return { grams: declared, source: 'label' };

  const normalized = servingFromNormalizedField(raw, isBeverage);
  if (normalized !== null) return { grams: normalized, source: 'label' };

  const pack = packageQuantityG(raw, isBeverage);
  const cap = isBeverage ? SINGLE_SERVE_MAX_ML : SINGLE_SERVE_MAX_G;
  if (pack !== null && pack <= cap) return { grams: pack, source: 'package' };

  return null;
}

/**
 * Read a numeric field, treating anything non-numeric as unknown.
 *
 * `max` rejects physically impossible values. OFF is crowdsourced, and bad
 * entries do get through — we measured one product claiming 52 g of fiber per
 * 100 g, which the goal-fit engine happily reported as "448% of your daily
 * fiber target", i.e. a nonsense number presented to the user as a benefit.
 * Discarding the field is strictly better than scoring on a fabrication.
 */
function num(
  source: Record<string, unknown>,
  key: string,
  max = 100,
): number | null {
  const value = source[key];
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < 0 || value > max) return null;
  return value;
}

/** OFF sends nova_group as a number or a numeric string; accept both. */
function parseNovaGroup(value: unknown): 1 | 2 | 3 | 4 | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return null;
}

/** True if the product's OFF categories mark it as a drink. */
function detectBeverage(categoriesTags: unknown): boolean {
  if (!Array.isArray(categoriesTags)) return false;
  return (categoriesTags as string[]).some((tag) => {
    const t = tag.toLowerCase();
    return (
      t.includes('beverage') ||
      t.includes('drink') ||
      t.includes('sodas') ||
      t.includes('juice') ||
      t.includes('water')
    );
  });
}

/**
 * Cross-field sanity check: macros can't sum past the mass they're measured in.
 *
 * A panel claiming 60 g protein + 50 g carbs + 30 g fat per 100 g is internally
 * inconsistent, so we can't trust any of it. 105 allows for label rounding.
 */
function macrosArePlausible(n: Nutriments): boolean {
  const sum =
    (n.proteins ?? 0) + (n.carbohydrates ?? 0) + (n.fat ?? 0) + (n.fiber ?? 0);
  return sum <= 105;
}

function normalizeNutriments(raw: Record<string, unknown>): Nutriments {
  return {
    // Pure fat is ~900 kcal/100g — nothing edible exceeds it.
    energyKcal: num(raw, 'energy-kcal_100g', 900),
    proteins: num(raw, 'proteins_100g'),
    carbohydrates: num(raw, 'carbohydrates_100g'),
    sugars: num(raw, 'sugars_100g'),
    fat: num(raw, 'fat_100g'),
    saturatedFat: num(raw, 'saturated-fat_100g'),
    fiber: num(raw, 'fiber_100g'),
    salt: num(raw, 'salt_100g'),
    fruitsVegetablesNuts:
      num(raw, 'fruits-vegetables-nuts_100g') ??
      num(raw, 'fruits-vegetables-nuts-estimate-from-ingredients_100g'),
  };
}

/**
 * True when we have enough of the panel to produce a meaningful score.
 *
 * Below this bar we'd be scoring mostly zeros and presenting it as fact, so
 * the caller should treat a sparse hit the same as a miss and offer a label
 * scan instead.
 */
export function isScorable(n: Nutriments): boolean {
  const core = [n.energyKcal, n.sugars, n.saturatedFat, n.salt, n.proteins, n.fiber];
  return core.filter((v) => v !== null).length >= 5;
}

export async function lookupBarcode(barcode: string): Promise<LookupResult> {
  const url = `${BASE}/${encodeURIComponent(barcode)}?fields=${FIELDS}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });

    if (response.status === 404) return { status: 'not_found' };
    if (!response.ok) {
      return { status: 'error', message: `Open Food Facts returned ${response.status}` };
    }

    const body = (await response.json()) as {
      status?: number;
      product?: Record<string, unknown>;
    };

    // OFF answers 200 with status:0 for unknown barcodes, so check the body
    // rather than trusting the HTTP status alone.
    if (body.status === 0 || !body.product) return { status: 'not_found' };

    const raw = body.product;
    // Needed before the serving resolver runs: whether a millilitre figure can
    // stand in for grams depends entirely on this.
    const isBeverage = detectBeverage(raw.categories_tags);
    const serving = resolveServing(raw, isBeverage);
    const nutrimentsRaw = (raw.nutriments as Record<string, unknown>) ?? {};
    const nutriments = normalizeNutriments(nutrimentsRaw);

    // An internally inconsistent panel is worse than no panel: we'd score a
    // fabrication and present it with full confidence. Treat it as a miss so
    // the caller falls through to a label scan.
    if (!macrosArePlausible(nutriments)) return { status: 'not_found' };

    const product: Product = {
      barcode,
      name: (raw.product_name as string)?.trim() || null,
      brand: (raw.brands as string)?.split(',')[0]?.trim() || null,
      nutriments,
      ingredientsText: (raw.ingredients_text as string)?.trim() || null,
      additiveTags: Array.isArray(raw.additives_tags)
        ? (raw.additives_tags as string[]).map((t) => t.toLowerCase())
        : [],
      servingSizeG: serving?.grams ?? null,
      servingSource: serving?.source ?? null,
      packageQuantityG: packageQuantityG(raw, isBeverage),
      isBeverage,
      novaGroup: parseNovaGroup(raw.nova_group),
      source: 'openfoodfacts',
    };

    return { status: 'found', product };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'error',
      message: aborted ? 'Lookup timed out' : 'Could not reach Open Food Facts',
    };
  } finally {
    clearTimeout(timer);
  }
}
