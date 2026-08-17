/**
 * WCAG contrast check across every theme.
 *
 * This exists because the first light palette shipped four colors that failed
 * AA for normal text — and none of them looked obviously wrong. Muted greys
 * and saturated greens/ambers are the usual culprits: a mid-tone that reads
 * fine on a dark ground is nowhere near enough on off-white, and eyeballing
 * hex values does not catch it. Contrast is arithmetic, so it should be a
 * test rather than a judgement call.
 *
 * Run: npx tsx scripts/verify-contrast.ts
 */

// Imports palettes.ts, not themes.ts: the latter binds font assets and so
// pulls in React Native, which cannot be transformed outside Metro.
import { PALETTES, type Palette, type ThemeKey } from '../src/design/palettes';

/** WCAG 2.1 relative luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(fg: string, bg: string): number {
  const [lighter, darker] = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
}

const AA_NORMAL = 4.5;
/** Large text (>=24px, or >=18.66px bold) only needs 3:1. */
const AA_LARGE = 3;

let failures = 0;

for (const [key, palette] of Object.entries(PALETTES) as [ThemeKey, Palette][]) {
  console.log(`\n${key}  (ground ${palette.bg})`);

  // Every colour that can carry body-size text must clear the normal bar.
  // Checked against BOTH ground and surface, since a card sits on one and the
  // page on the other — passing on only one of them is a real failure.
  const textColors: (keyof Palette)[] = ['text', 'muted', 'accent', 'fits', 'caution', 'skip'];

  for (const name of textColors) {
    const color = palette[name];
    const onBg = contrast(color, palette.bg);
    const onSurface = contrast(color, palette.surface);
    const worst = Math.min(onBg, onSurface);

    const pass = worst >= AA_NORMAL;
    if (!pass) failures++;
    console.log(
      `  ${pass ? 'PASS' : 'FAIL'}  ${name.padEnd(8)} ${color}  ` +
        `${worst.toFixed(2)}:1 (bg ${onBg.toFixed(2)}, surface ${onSurface.toFixed(2)})`,
    );
  }

  // Borders aren't text; they only need to be perceptible against the ground.
  const borderContrast = contrast(palette.border, palette.bg);
  const borderOk = borderContrast >= 1.2;
  if (!borderOk) failures++;
  console.log(
    `  ${borderOk ? 'PASS' : 'FAIL'}  ${'border'.padEnd(8)} ${palette.border}  ` +
      `${borderContrast.toFixed(2)}:1 (needs >=1.20 to be visible)`,
  );
}

console.log(
  `\n${failures === 0 ? `All colors pass WCAG AA (>=${AA_NORMAL}:1 for text).` : `${failures} color(s) FAILED.`}`,
);
console.log(`Large text only needs ${AA_LARGE}:1, so the score numeral has more headroom than this check requires.`);
process.exit(failures === 0 ? 0 : 1);
