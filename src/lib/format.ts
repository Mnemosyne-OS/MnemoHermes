/**
 * Number and label formatting the panels share.
 *
 * The house discipline these encode: an unknown is never a zero, and a small
 * number is never nothing (doc 75 / the fabricated-values pattern). Both rules
 * are cheap to state and easy to break in JSX, so they live here with tests.
 */

/** What the interface renders for a measurement nobody made. */
export const UNKNOWN = '—';

/**
 * micro-USD → a `$` amount that never prints `0.0000` for a real spend. A
 * fraction-of-a-cent day is not a free day, so a nonzero total that would
 * round away gets two more decimals instead of a lie.
 */
export function fmtUsd(micro: number): string {
  if (!Number.isFinite(micro)) return UNKNOWN;
  const usd = micro / 1_000_000;
  const four = usd.toFixed(4);
  return micro > 0 && four === '0.0000' ? usd.toFixed(6) : four;
}

/**
 * Renders a count that may not have been measured. `null` and `undefined` are
 * the unknown; `0` is a real, measured zero and prints as `0`.
 *
 * ⚠️ Deliberately NOT applied to the brain proxy's `callsToday / dailyCallCap`
 * line: a cap of 0 is ambiguous in the host (blocked, or no cap at all?), and
 * a formatter that picks one meaning would make the interface state something
 * nobody measured. That line stays a plain pair until the host says which.
 */
export function fmtCount(n: number | null | undefined): string {
  return typeof n === 'number' && Number.isFinite(n) ? String(n) : UNKNOWN;
}
