/**
 * `type.figure`'s `fontVariant` is a readonly tuple — theme.ts closes the
 * whole type scale with `as const` — which React Native's TextStyle typing
 * rejects when spread directly into a style object (readonly array where a
 * mutable one is expected). Re-exporting a plain mutable copy here means
 * every screen that lines up numbers in a column doesn't have to work
 * around this individually.
 */

import type { TextStyle } from 'react-native';
import { type } from '../theme';

export const figureStyle: TextStyle = {
  ...type.figure,
  fontVariant: [...type.figure.fontVariant],
};
