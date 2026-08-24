# Shipping GoalScan

Written in dependency order. Each step is blocked by the one above it, and the
first two have nothing to do with the app stores.

---

## 0. Run it on a real phone first

**Nothing in this app has ever run on a device.** It typechecks, and the
scoring, label normalization, serving resolution and contrast are covered by
four offline suites — but the camera, the permission prompts, the keyboard, and
the network round-trip have not been exercised once.

Expo Go is enough for a first look:

```bash
npx expo start -c
```

For the label scan you also need the proxy running, and the app pointed at your
machine rather than at the phone's own localhost:

```bash
ANTHROPIC_API_KEY=sk-ant-... node server/proxy.mjs
```

```bash
EXPO_PUBLIC_LABEL_SCAN_URL=http://$(ipconfig getifaddr en0):8787 npx expo start -c
```

Expo Go stops being enough once you need a real build; from then on use a
development build (`eas build --profile development`).

---

## 1. Deploy the proxy — this is the actual blocker

`server/proxy.mjs` currently runs on your laptop. A phone in someone else's
hand cannot reach it, so **the label scan is dead in any shipped build until
this is hosted.** Everything else on this page is routine; this is the part
that needs a decision.

The proxy exists because the Anthropic key must never be in the app bundle.
Expo inlines every `EXPO_PUBLIC_*` variable into the JavaScript, so a key put
there is extractable by anyone who downloads the app — and they would be
spending your money.

### Where

Any host that runs a Node process and gives you HTTPS. `server/` has its own
`package.json` so it deploys as a standalone service — point the host at that
directory, not the repo root.

- **Fly.io / Railway / Render** — closest to "it's just a Node server". Free or
  a few dollars a month at this size.
- **Cloudflare Workers** — cheapest and fastest, but needs the HTTP handler
  rewritten against the Workers runtime.

Set these on the host:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key — a **separate** one from any you use elsewhere, so you can revoke it alone |
| `TRUST_PROXY` | `1` — the platform terminates TLS and rewrites `X-Forwarded-For` |
| `RATE_LIMIT_PER_MIN` | defaults to 8 |
| `DAILY_EXTRACTION_CAP` | defaults to 500 (~$2/day at Haiku prices) |

`TRUST_PROXY` matters more than it looks. `X-Forwarded-For` is a client-supplied
header; trusting it on a directly-exposed server lets anyone reset their own
rate limit by inventing an IP. It is only trustworthy behind a terminator that
overwrites it.

### The exposure you are accepting

This endpoint is unauthenticated. Anyone who finds the URL can post images and
spend your money. The rate limit and daily cap bound the damage; they don't
prevent it. Before you publish:

- Set a **billing alert and a hard spend cap** in the Anthropic console. Treat
  this as the real backstop — the in-process counter resets on every redeploy
  and doesn't coordinate across instances.
- Keep this key separate from every other key you own.
- If usage ever justifies it, the proper fix is device attestation (App Attest
  on iOS, Play Integrity on Android). Don't reach for a shared secret in the
  bundle — it's extractable exactly like the API key would be.

Then set the real URL in `eas.json`, replacing `goalscan-proxy.example.com` in
both the `preview` and `production` profiles.

---

## 2. Build

```bash
npm install -g eas-cli
eas login
eas init
```

**Before the first build, change the bundle identifier.** `app.json` currently
says `com.tharunitprog.goalscan` for both platforms — a guess. It is permanent
once published, on both stores.

```bash
eas build --profile preview --platform ios
eas build --profile production --platform all
```

EAS generates and stores the signing certificates for you. This is the step
that needs your Apple and Google accounts; it is not something to hand to
anyone else, including me.

---

## 3. Get it to real testers before the stores

- **iOS — TestFlight.** `eas submit --platform ios`. Internal testers (up to
  100, on your team) need no review. External testers need a light review.
- **Android — internal testing track.** `eas submit --platform android`.

This is where the untested camera path gets tested. Do not skip it.

> Google requires new personal developer accounts to run a closed test with a
> minimum number of testers for a minimum period before production access is
> granted. The exact numbers have changed more than once — check the current
> rule in the Play Console rather than trusting any number written here. It is
> weeks of calendar time, so start it early.

---

## 4. What each store wants

### Both

- **Icon.** `assets/icon.png` is still the Expo template art. Replace it.
- **Screenshots** at the required sizes.
- **A privacy policy at a public URL.** Required by both. It has to cover the
  two things below.
- **Description, category** (Health & Fitness), **age rating**.

### The two privacy facts that are actually true of this app

Get these right; they're the ones a reviewer will check.

1. **Height, weight, age, sex, and activity level are collected and never
   leave the device.** They're in AsyncStorage, used to compute daily targets,
   and no account exists. Serving-size corrections are likewise local.
2. **Label photos leave the device**, to Anthropic, to be transcribed. The
   capture screen says so before the shutter. Barcodes go to Open Food Facts.

On Apple's App Privacy questionnaire the honest answer for (1) is *collected,
not linked to identity, on-device*, and (2) has to be declared as data sent to
a third party.

### Apple specifically

- $99/year Apple Developer Program.
- **Health-adjacent framing is the risk.** The app takes your weight and tells
  you what to eat. Keep every claim descriptive — this product contains 34 g of
  sugar, that is 65% of a general-population daily cap — and never
  prescriptive. The "general-population reference values, not medical advice"
  line on the profile screen is load-bearing; don't remove it.
- `ITSAppUsesNonExemptEncryption: false` is already set, which skips the export
  compliance questionnaire. It's accurate: the app uses HTTPS and nothing else.

### Google specifically

- $25, one time.
- **Data safety form** — the same two facts as above.
- A `CAMERA` permission declaration; the use is obvious and in scope.

---

## 5. Open Food Facts

Already handled, but for the record: product data is ODbL, free to use
commercially with attribution, and the result screen carries it. The
share-alike clause covers redistributing a modified copy of the *database* —
not an app that queries it. Nothing to do here.

---

## 6. What isn't built

Ship-blocking or not, be honest with yourself about these:

| | Blocks a release? |
|---|---|
| The camera path has never run on a device | **Yes** |
| Proxy is not hosted | **Yes** for label scan; the barcode path works without it |
| Placeholder app icon | **Yes** |
| No privacy policy | **Yes** |
| Manual entry (tier 3) | No — the not-found screen says it's coming |
| Swap suggestions | No |
| Scoring weights tuned against real shelf products | No, but it's the thing that decides whether people trust it |

---

## Running costs

| | |
|---|---|
| Apple Developer Program | $99/year |
| Google Play | $25 once |
| Proxy hosting | $0–5/month |
| Label scans | ~$0.004 each, only on an Open Food Facts miss |

At the default 500/day cap, the API is bounded at roughly $2/day.
