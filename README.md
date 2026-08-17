# GoalScan

Scan a barcode, get two answers instead of one:

1. **Is this product good?** — an objective 0-100 health score, identical for everyone.
2. **Is this good _for me_?** — a verdict measured against *your* daily nutrient budget, derived from your height, weight, activity level, and goal.

Existing scanners answer only the first question. The second is the one people are actually asking in the aisle.

```
Health: 43/100 (poor)
SKIP — 35 g sugar, 67% of your daily cap in one serving
```

## Why the second number is a sentence, not a number

Two scores invites arguing. A verdict with a reason attached — *"76% of your daily sugar cap in one serving"* — is checkable, and checkable builds trust. Every reason the app shows contains the arithmetic behind it.

## How scoring works

**The health score (0-100)** is a weighted composite:

| Component | Weight | Source |
|---|---:|---|
| Nutrition quality | 60 | Nutri-Score point tables (separate, stricter table for beverages) |
| Additives | 30 | Risk table anchored to regulatory action and IARC classifications |
| Processing | 10 | NOVA classification, with an ingredient-count fallback |

**Goal fit** runs Mifflin-St Jeor → TDEE → goal-adjusted calories → per-nutrient daily budgets, then prices one serving against them and applies goal-specific rules. A protein bar with some sugar reads `caution` when you're cutting and `fits` when you're gaining — same product, different answer, which is the entire point.

**No LLM touches either score.** Scoring is pure, deterministic, and unit-tested: the same product returns the same number forever. That is what makes the score defensible when a user asks why. Language models are scoped to reading nutrition labels the database doesn't have, and to writing explanations — never to deciding the number.

## Data honesty

The database is crowdsourced and imperfect, so the engine refuses to score things it can't trust:

- **Physically impossible values** are discarded (nothing edible exceeds 900 kcal/100 g).
- **Internally inconsistent panels** are rejected wholesale — if protein + carbs + fat + fiber exceeds 105 g per 100 g, the panel is fabricated and none of it is usable. One real product claimed 52 g of fiber per 100 g, which an earlier build cheerfully reported as *"448% of your daily fiber target"* — a nonsense figure presented to the user as a benefit.
- **Missing serving sizes** are disclosed rather than silently assumed, because every percentage on screen depends on them.

A rejected product routes to a label scan instead of a confident wrong answer.

## Coverage

Measured against live Open Food Facts data (100-product samples per market, `scorable` = has the macro panel needed to score, `FULL` = scorable **and** has ingredients):

| Market | DB size | scorable | FULL |
|---|---:|---:|---:|
| France | 1,258,948 | 93–96% | 93–96% |
| United Kingdom | 192,509 | 94% | 94% |
| United States | 953,222 | 81–85% | 81–84% |
| India | 22,494 | 53–81% | 45–70% |

US/UK/EU coverage is good enough to ship on. India is not a completeness problem so much as a presence one — 22k products for a market of 1.4 billion — which is why the label-scan fallback matters more than the database there.

## Stack

Expo / React Native (TypeScript). Open Food Facts for product data. No backend — profile and scoring both run on-device.

## The scan cascade

| Tier | Method | Speed | Cost | Coverage |
|---|---|---|---|---|
| 1 | Barcode → Open Food Facts | instant | free | 81–96% (US/UK/EU) |
| 2 | Photograph the label → vision transcription | ~2s | ~$0.004–0.018 | anything with a printed panel |
| 3 | Manual entry | — | free | last resort |

Tier 2 matters more than the miss rate suggests. **A barcode number contains no information about the product** — it's an arbitrary registry key, so a model asked to identify one will invent a fluent, plausible, entirely fabricated nutrition panel. The fallback therefore reads *pixels of an actual label*, never the digits. And because it doesn't depend on the database at all, it works identically in markets where Open Food Facts coverage is thin.

The model transcribes; the engine scores. That boundary is the whole safety argument.

### Basis conversion

EU panels print per 100 g. US Nutrition Facts print **per serving**. The engine assumes per-100 g throughout, so the extractor reports which basis it read and converts before scoring. A 30 g serving read as 100 g understates sugar by more than 3x — enough to turn a `skip` into a `fits`. When the basis can't be determined, or a per-serving panel has no serving size printed, the scan is refused rather than guessed.

## Running it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone.

**For label scanning**, run the proxy in a second terminal:

```bash
ANTHROPIC_API_KEY=sk-... node server/proxy.mjs
```

Then point the app at it. On a physical phone use your machine's LAN IP — `localhost` resolves to the phone itself:

```bash
EXPO_PUBLIC_LABEL_SCAN_URL=http://192.168.1.42:8787 npx expo start
```

**The API key never goes in the app.** Expo inlines every `EXPO_PUBLIC_*` variable into the JavaScript bundle, so a key placed there is extractable by anyone who downloads the app. The proxy exists solely to hold it. The `EXPO_PUBLIC_` variable above is only a URL, which is not a secret.

### Tests

```bash
npx tsx scripts/verify-offline.ts    # scoring assertions
npx tsx scripts/verify-labelscan.ts  # label normalization + basis conversion
npx tsx scripts/verify.ts            # live, hits Open Food Facts
npx tsc --noEmit                     # typecheck
```

The first two need no network and no API key.

## Status

Built and tested: scoring engine, profile targets, goal-fit verdicts, Open Food Facts client, app UI, label-scan extraction and normalization.

Not yet built: label scanning is not wired into the scanner screen, so tier 2 isn't reachable from the UI yet. Swap suggestions ("here's a better option") are designed but unbuilt.

## Attribution and licensing

Product data comes from [Open Food Facts](https://world.openfoodfacts.org), used under the [Open Database License (ODbL)](https://opendatacommons.org/licenses/odbl/1-0/). The database is free to use commercially with attribution; ODbL's share-alike clause applies to redistributing a modified copy of the *database*, not to an application that queries it.

Not medical advice, and deliberately not written to sound like it. Nutrient reference values are general-population figures.
