/**
 * Label-scan proxy — tier 2 of the scan cascade.
 *
 * WHY THIS EXISTS: the Anthropic API key must never reach the phone. Expo
 * inlines every EXPO_PUBLIC_* variable into the JavaScript bundle, so a key
 * put there is trivially extractable by anyone who downloads the app, and
 * they'd be spending your money. This process holds the key; the app only
 * ever talks to this endpoint.
 *
 * The model's job here is deliberately narrow: TRANSCRIBE a nutrition panel
 * that is physically in the photo. It does not identify products, does not
 * infer values, and does not score anything — scoring stays in the
 * deterministic engine. That boundary is what keeps a hallucinated number
 * from ever reaching a user.
 *
 * Run:  ANTHROPIC_API_KEY=sk-... node server/proxy.mjs
 *
 * DEPLOYMENT: this is the one piece that cannot stay on a laptop. A published
 * app can't reach localhost, so this has to run somewhere public — and the
 * moment it does, it is an unauthenticated endpoint that spends money on the
 * operator's card. The limits below are the minimum defence: a per-IP rate
 * limit against one abusive client, and a hard daily cap so that a determined
 * one still can't run up an unbounded bill overnight. See DEPLOY.md.
 */

import { createServer } from 'node:http';
import Anthropic from '@anthropic-ai/sdk';

const PORT = process.env.PORT ?? 8787;

/**
 * Abuse limits. Both are deliberately low by default: a real person scans a
 * handful of labels a minute at most, and the failure mode of a limit that is
 * slightly too tight (a retry prompt) is far cheaper than the failure mode of
 * one that is too loose (a five-figure API bill).
 *
 * In-memory on purpose. It resets on redeploy and doesn't coordinate across
 * instances, which is fine for a single small box and is NOT fine once this
 * scales horizontally — at that point the counters belong in Redis or the
 * limit belongs in front of the app, at the CDN.
 */
const RATE_LIMIT_PER_MIN = Number(process.env.RATE_LIMIT_PER_MIN ?? 8);
const DAILY_EXTRACTION_CAP = Number(process.env.DAILY_EXTRACTION_CAP ?? 500);

/** ip -> { count, windowStart } */
const rateWindows = new Map();
let dailyCount = 0;
let dailyDate = new Date().toISOString().slice(0, 10);

/**
 * Only trusted when TRUST_PROXY is set, because X-Forwarded-For is a
 * client-supplied header: taking it at face value on a directly-exposed
 * server lets anyone reset their own rate limit by inventing an IP. Platforms
 * that terminate TLS for you (Fly, Render, Railway, Cloudflare) overwrite it,
 * which is what makes it trustworthy there and only there.
 */
function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Returns an error string when the request should be refused, else null. */
function checkLimits(ip) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== dailyDate) {
    dailyDate = today;
    dailyCount = 0;
  }
  if (dailyCount >= DAILY_EXTRACTION_CAP) {
    return 'Label scanning is at its daily limit. Try again tomorrow.';
  }

  const now = Date.now();
  const window = rateWindows.get(ip);
  if (window === undefined || now - window.windowStart >= 60_000) {
    rateWindows.set(ip, { count: 1, windowStart: now });
    return null;
  }
  if (window.count >= RATE_LIMIT_PER_MIN) {
    return 'Too many label scans in a row. Wait a minute and try again.';
  }
  window.count++;
  return null;
}

// Unbounded Maps are a memory leak with a long enough uptime. Expired windows
// carry no information, so dropping them costs nothing.
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [ip, w] of rateWindows) {
    if (w.windowStart < cutoff) rateWindows.delete(ip);
  }
}, 60_000).unref();

/**
 * Haiku 4.5 — chosen for cost. Transcribing a printed panel is mechanical
 * work, so the cheapest capable model is the right one: roughly $0.004 per
 * scan against $0.018 on Opus 5, at $1/$5 per MTok vs $5/$25.
 *
 * If accuracy on awkward labels (glare, curved packaging, tiny print) turns
 * out to be the bottleneck, move back up — the schema and prompt are
 * model-independent, so it is a one-line change either way.
 */
const MODEL = 'claude-haiku-4-5';

/** Max decoded image bytes. Anthropic caps request size; reject early. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

const client = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

/** Nullable number — structured outputs supports anyOf. */
const nullableNumber = { anyOf: [{ type: 'number' }, { type: 'null' }] };
const nullableString = { anyOf: [{ type: 'string' }, { type: 'null' }] };

const SCHEMA = {
  type: 'object',
  properties: {
    readable: {
      type: 'boolean',
      description: 'False if no nutrition panel is legible in the image.',
    },
    basis: {
      type: 'string',
      enum: ['per_100g', 'per_serving', 'unknown'],
      description:
        'Which column the values were read from. EU panels are per 100g; US Nutrition Facts are per serving.',
    },
    servingSizeG: {
      ...nullableNumber,
      description: 'Declared serving size in grams or millilitres, if printed.',
    },
    productName: nullableString,
    isBeverage: { type: 'boolean' },
    energyKcal: nullableNumber,
    proteins: nullableNumber,
    carbohydrates: nullableNumber,
    sugars: nullableNumber,
    fat: nullableNumber,
    saturatedFat: nullableNumber,
    fiber: nullableNumber,
    // Both appear in the wild: EU prints salt in grams, US prints sodium in mg.
    saltG: nullableNumber,
    sodiumMg: nullableNumber,
    ingredientsText: nullableString,
    additiveCodes: {
      type: 'array',
      items: { type: 'string' },
      description: 'E-numbers visible in the ingredient list, e.g. "E471".',
    },
  },
  required: [
    'readable', 'basis', 'servingSizeG', 'productName', 'isBeverage',
    'energyKcal', 'proteins', 'carbohydrates', 'sugars', 'fat',
    'saturatedFat', 'fiber', 'saltG', 'sodiumMg', 'ingredientsText',
    'additiveCodes',
  ],
  additionalProperties: false,
};

const SYSTEM = `You transcribe nutrition labels from photographs. You are an OCR step, not an analyst.

Rules, in priority order:

1. Transcribe only what is legibly printed in the image. Never infer, estimate, or recall a value from knowledge of the product. If a field is not printed or not readable, return null for it. A null is always correct; a plausible guess is a fabrication that will be shown to a user as fact.

2. Report the basis honestly. EU-style panels list values per 100g or per 100ml. US Nutrition Facts panels list values per serving. If you read a per-serving column, return basis "per_serving" and the serving size. If you genuinely cannot tell, return "unknown".

3. Do not convert units yourself. Report salt in grams if the label prints salt, sodium in milligrams if the label prints sodium. Report energy in kcal; if only kJ is printed, divide by 4.184.

4. If no nutrition panel is legible in the image, set readable to false and every value to null. A blurry, cropped, or absent panel is a false, not a best effort.

5. additiveCodes should list only E-numbers actually printed in the ingredients, formatted like "E471".`;

/**
 * An error whose message is safe to show a user.
 *
 * Everything else gets a generic reply. The distinction matters: the SDK's
 * error messages are the raw upstream response body, so passing `err.message`
 * through sends Anthropic's internals — a 401's full JSON among them — to
 * anyone who can POST here. Failing that way is silent, which is why the class
 * exists rather than a rule to remember.
 */
class ClientSafeError extends Error {}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function readBody(req, limitBytes) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > limitBytes) throw new Error('payload too large');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function extract(imageBase64, mediaType) {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM,
    // NOTE: no `effort` here. It is valid on Opus/Sonnet 5-tier models but is
    // REJECTED by Haiku 4.5, so sending it would 400 every request. Haiku also
    // does no thinking unless asked, which is what we want for transcription.
    output_config: { format: { type: 'json_schema', schema: SCHEMA } },
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Transcribe the nutrition panel and ingredient list from this photo.' },
        ],
      },
    ],
  });

  // Structured outputs can still stop early or be refused — check before
  // parsing, or a truncated response becomes a confusing JSON error.
  if (response.stop_reason === 'refusal') {
    throw new ClientSafeError("That photo couldn't be processed. Try a photo of just the nutrition panel.");
  }
  if (response.stop_reason === 'max_tokens') {
    throw new ClientSafeError('That label was too long to read in one go. Try framing just the panel.');
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock) throw new Error('Model returned no text content');

  return { data: JSON.parse(textBlock.text), usage: response.usage };
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    // No key, no counts, no client detail — health checks are public.
    return json(res, 200, { ok: true, model: MODEL });
  }

  if (req.method !== 'POST' || req.url !== '/extract') {
    return json(res, 404, { error: 'Not found' });
  }

  const limitError = checkLimits(clientIp(req));
  if (limitError) {
    console.warn(`[extract] refused: ${limitError}`);
    return json(res, 429, { error: limitError });
  }

  try {
    // base64 inflates by ~4/3, so allow headroom over the decoded limit.
    const raw = await readBody(req, Math.ceil(MAX_IMAGE_BYTES * 1.4));
    const { imageBase64, mediaType = 'image/jpeg' } = JSON.parse(raw);

    if (typeof imageBase64 !== 'string' || imageBase64.length === 0) {
      return json(res, 400, { error: 'imageBase64 is required' });
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mediaType)) {
      return json(res, 400, { error: `Unsupported mediaType: ${mediaType}` });
    }

    const { data, usage } = await extract(imageBase64, mediaType);
    dailyCount++;
    console.log(
      `[extract] readable=${data.readable} basis=${data.basis} ` +
        `in=${usage.input_tokens} out=${usage.output_tokens} ` +
        `daily=${dailyCount}/${DAILY_EXTRACTION_CAP}`,
    );
    return json(res, 200, data);
  } catch (err) {
    // Full detail to the operator's log; only vetted text to the client.
    console.error('[extract] error:', err instanceof Error ? err.message : err);
    const safe = err instanceof ClientSafeError
      ? err.message
      : "Couldn't read that label right now. Try again in a moment.";
    return json(res, 502, { error: safe });
  }
});

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Refusing to start.');
  process.exit(1);
}

server.listen(PORT, () => {
  console.log(`Label-scan proxy on port ${PORT} (model: ${MODEL})`);
  console.log(`Limits: ${RATE_LIMIT_PER_MIN}/min per IP, ${DAILY_EXTRACTION_CAP}/day total.`);
  if (process.env.TRUST_PROXY !== '1') {
    console.log('TRUST_PROXY is off — rate limiting by socket address.');
    console.log('Set TRUST_PROXY=1 only when running behind a TLS terminator.');
  }
  console.log('On a phone in development, point the app at this machine\'s LAN IP, not localhost.');
});
