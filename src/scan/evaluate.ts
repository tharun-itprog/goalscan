/**
 * The one place a Product becomes a ScanResult.
 *
 * Both scan tiers end up with a Product and need the same three-step chain
 * — targets, health, goal fit — to turn it into something the result screen
 * can render. Before this existed, ScannerScreen ran that chain inline, and
 * label-scan would have needed its own copy. Two copies of a call chain
 * don't stay identical; a change to one (say, an argument order swap) lands
 * in only one path and the other silently drifts. One function, called from
 * both, makes that class of bug impossible instead of just unlikely.
 */

import { computeTargets } from '../profile/targets';
import { computeHealthScore } from '../scoring/health';
import { computeGoalFit } from '../scoring/goalfit';
import type { Product, Profile, ScanResult } from '../types';

export function evaluateProduct(product: Product, profile: Profile): ScanResult {
  const targets = computeTargets(profile);
  const health = computeHealthScore(product);
  const goalFit = computeGoalFit(product, targets, profile.goal);
  return { product, health, goalFit };
}
