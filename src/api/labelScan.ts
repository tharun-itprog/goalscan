/**
 * Tier 2 of the scan cascade: read the nutrition panel off the packet.
 *
 * Runs when the barcode misses, or when Open Food Facts has the product but
 * too little of its panel to score honestly. Because the user is already
 * holding the product with the camera open, asking for one more photo costs
 * almost nothing — and unlike a barcode, a photographed label works in every
 * market regardless of database coverage.
 *
 * The model transcribes; this module normalizes; the deterministic engine
 * scores. No model output ever becomes a score directly.
 */

import type { Nutriments, Product } from '../types';

/**
 * The proxy holds the API key — see server/proxy.mjs for why the key can't
 * live in the app. This URL is not a secret, so EXPO_PUBLIC_ is correct here.
 * On a physical phone this must be your machine's LAN IP; localhost resolves
 * to the phone itself.
 */
const PROXY_URL =
  process.env.EXPO_PUBLIC_LABEL_SCAN_URL ?? 'http://localhost:8787';

const TIMEOUT_MS = 30_000; // vision calls are slower than a barcode lookup

/** Shape returned by the proxy. Mirrors the schema in server/proxy.mjs. */
interface ExtractionResponse {
  readable: boolean;
  basis: 'per_100g' | 'per_serving' | 'unknown';
  servingSizeG: number | null;
  productName: string | null;
  isBeverage: boolean;
  energyKcal: number | null;
  proteins: number | null;
  carbohydrates: number | null;
  sugars: number | null;
  fat: number | null;
  saturatedFat: number | null;
  fiber: number | null;
  saltG: number | null;
  sodiumMg: number | null;
  ingredientsText: string | null;
  additiveCodes: string[];
}

export type LabelScanResult =
  | { status: 'extracted'; product: Product }
  /** No legible panel in the photo — ask for a clearer shot. */
  | { status: 'unreadable' }
  /**
   * Panel was read but can't be safely converted to the per-100g basis the
   * engine needs. Distinct from 'unreadable' because retaking the photo won't
   * help; we need the serving size from the user instead.
   */
  | { status: 'needs_serving_size'; productName: string | null }
  | { status: 'error'; message: string };

/**
 * Rescale a per-serving panel onto a per-100g basis.
 *
 * US Nutrition Facts panels are per serving; EU panels are per 100g. The
 * scoring engine assumes per-100g throughout, so a per-serving panel fed in
 * unconverted would silently misscore everything — a 30g serving read as 100g
 * understates sugar by more than 3x, turning a "skip" into a "fits".
 */
function toPer100g(raw: ExtractionResponse): Nutriments | null {
  if (raw.basis === 'unknown') return null;

  let factor = 1;
  if (raw.basis === 'per_serving') {
    // Without a serving size there is no conversion to make. Guessing one
    // would corrupt every number downstream, so we refuse instead.
    if (!raw.servingSizeG || raw.servingSizeG <= 0) return null;
    factor = 100 / raw.servingSizeG;
  }

  const scale = (v: number | null): number | null =>
    v === null ? null : v * factor;

  // Prefer printed salt; fall back to converting sodium (salt g = sodium mg / 400).
  const saltG =
    raw.saltG !== null
      ? raw.saltG
      : raw.sodiumMg !== null
        ? raw.sodiumMg / 400
        : null;

  return {
    energyKcal: scale(raw.energyKcal),
    proteins: scale(raw.proteins),
    carbohydrates: scale(raw.carbohydrates),
    sugars: scale(raw.sugars),
    fat: scale(raw.fat),
    saturatedFat: scale(raw.saturatedFat),
    fiber: scale(raw.fiber),
    salt: scale(saltG),
    // Not printed on labels; the Nutri-Score fruit/veg bonus stays unearned.
    fruitsVegetablesNuts: null,
  };
}

/**
 * Same plausibility bar the Open Food Facts path applies.
 *
 * A model misreading a column can produce an internally inconsistent panel
 * just as easily as a bad crowdsourced entry, and the consequence is
 * identical: a confident score built on a fabrication.
 */
function isPlausible(n: Nutriments): boolean {
  const values = [
    n.energyKcal, n.proteins, n.carbohydrates, n.sugars,
    n.fat, n.saturatedFat, n.fiber, n.salt,
  ];
  if (values.some((v) => v !== null && (v < 0 || v > 900))) return false;

  const macroSum =
    (n.proteins ?? 0) + (n.carbohydrates ?? 0) + (n.fat ?? 0) + (n.fiber ?? 0);
  return macroSum <= 105;
}

/**
 * Send a label photo for transcription.
 *
 * @param imageBase64 raw base64, no `data:` prefix
 * @param barcode     the code that missed, so the result stays linked to it
 */
export async function scanLabel(
  imageBase64: string,
  barcode: string,
  mediaType: 'image/jpeg' | 'image/png' = 'image/jpeg',
): Promise<LabelScanResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${PROXY_URL}/extract`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, mediaType }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.json().catch(() => null);
      return {
        status: 'error',
        message: detail?.error ?? `Label service returned ${response.status}`,
      };
    }

    const raw = (await response.json()) as ExtractionResponse;

    if (!raw.readable) return { status: 'unreadable' };

    const nutriments = toPer100g(raw);
    if (nutriments === null) {
      return { status: 'needs_serving_size', productName: raw.productName };
    }
    if (!isPlausible(nutriments)) return { status: 'unreadable' };

    const product: Product = {
      barcode,
      name: raw.productName?.trim() || null,
      brand: null, // not reliably on the nutrition panel
      nutriments,
      ingredientsText: raw.ingredientsText?.trim() || null,
      additiveTags: (raw.additiveCodes ?? []).map((c) => c.toLowerCase()),
      servingSizeG: raw.servingSizeG,
      isBeverage: raw.isBeverage,
      // NOVA is a database classification, not something printed on a packet.
      // Null makes health.ts fall back to the ingredient-count heuristic.
      novaGroup: null,
      source: 'label-scan',
    };

    return { status: 'extracted', product };
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    return {
      status: 'error',
      message: aborted
        ? 'Label scan timed out'
        : 'Could not reach the label service. Is the proxy running?',
    };
  } finally {
    clearTimeout(timer);
  }
}
