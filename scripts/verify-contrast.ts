/**
 * WCAG contrast check for the design system.
 *
 * This exists because the first palette shipped four colours that failed AA
 * for normal text, and none of them looked obviously wrong. Muted greys and
 * saturated greens/ambers are the usual culprits: a mid-tone that reads fine
 * on a dark ground is nowhere near enough on off-white, and eyeballing hex
 * values does not catch it. Contrast is arithmetic, so it is a test.
 *
 * Run: npx tsx scripts/verify-contrast.ts
 */

import { colors } from '../src/theme';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const ch = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

function contrast(fg: string, bg: string): number {
  const [lighter, darker] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;
let failures = 0;

/**
 * Text colours are checked against BOTH grounds they can appear on. Passing on
 * only one is a real failure: an earlier palette cleared the page background
 * at 4.20 and failed on a card at 3.90, and a hand check missed it.
 */
function checkGroup(
  title: string,
  entries: [string, string][],
  ground: string,
  surface: string,
) {
  console.log(`\n${title}  (ground ${ground}, surface ${surface})`);
  for (const [name, color] of entries) {
    const onBg = contrast(color, ground);
    const onSurface = contrast(color, surface);
    const worst = Math.min(onBg, onSurface);
    const pass = worst >= AA_NORMAL;
    if (!pass) failures++;
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${color}  ` +
        `${worst.toFixed(2)}:1 (bg ${onBg.toFixed(2)}, surface ${onSurface.toFixed(2)})`,
    );
  }
}

checkGroup(
  'Light surfaces',
  [
    ['text', colors.text],
    ['muted', colors.muted],
    ['accent', colors.accent],
    ['fits', colors.fits],
    ['caution', colors.caution],
    ['skip', colors.skip],
  ],
  colors.bg,
  colors.surface,
);

// The scanner is the app's one dark surface. Verdict colours can appear there
// too — a scan result preview overlays the viewfinder — so they're checked
// against the dark ground as well, not just the light one.
checkGroup(
  'Dark scanner',
  [
    ['text', colors.dark.text],
    ['muted', colors.dark.muted],
    ['accent', colors.dark.accent],
    ['fits', colors.dark.fits],
    ['caution', colors.dark.caution],
    ['skip', colors.dark.skip],
  ],
  colors.dark.bg,
  colors.dark.surface,
);

// Borders aren't text; they only need to be perceptible against their ground.
console.log('\nBorders');
for (const [name, color, ground] of [
  ['light', colors.border, colors.bg],
  ['dark', colors.dark.border, colors.dark.bg],
] as [string, string, string][]) {
  const r = contrast(color, ground);
  const ok = r >= 1.2;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${color}  ${r.toFixed(2)}:1 (needs >=1.20)`);
}

console.log(
  `\n${failures === 0 ? `All colours pass WCAG AA (>=${AA_NORMAL}:1 for text).` : `${failures} colour(s) FAILED.`}`,
);
process.exit(failures === 0 ? 0 : 1);
