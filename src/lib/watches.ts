/**
 * The Veilles tab's pure half: what each engine is called, what a run cost,
 * which sentence a refusal gets. Kept out of the panel so it is tested.
 *
 * Two honesties encoded here:
 *  - a run whose cost was not measured shows `—`, never 0 tokens;
 *  - "no engine" is its own state, never folded into "DuckDuckGo".
 */
import { matchCode } from './errorCodes';

export interface SearchEngineStatus {
  engine: string | null;
  source: 'config' | 'env' | 'package' | null;
  ddgsInstalled: boolean;
  braveKey: boolean;
}

export interface WatchRun {
  startedAt: string;
  endedAt: string | null;
  tokens: number | null;
  calls: number;
}

export interface WatchView {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  state: string;
  enabled: boolean;
  deliver: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
  narrowed: boolean;
  reports: Array<{ file: string; at: string; bytes: number }>;
  runs: WatchRun[];
}

export interface WatchesData {
  watches: WatchView[];
  search: SearchEngineStatus;
  telegram: boolean;
  gatewayRunning: boolean;
  keepAwake: { enabled: boolean; holding: boolean };
}

/** Locale key naming the engine Hermes will call. */
export function engineLabelKey(engine: string | null): string {
  switch (engine) {
    case null: return 'watches.engineNone';
    case 'ddgs': return 'watches.engineDdgs';
    case 'brave-free': return 'watches.engineBrave';
    case 'searxng': return 'watches.engineSearxng';
    default: return 'watches.engineOther';
  }
}

/** Offer the free engine while it is not on disk. */
export function offerFreeEngine(s: SearchEngineStatus): boolean {
  return !s.ddgsInstalled;
}

/** `M H * * *` → the hour, or null for any other schedule (made elsewhere). */
export function scheduleHour(schedule: string): number | null {
  const m = /^0 (\d{1,2}) \* \* \*$/.exec(schedule.trim());
  if (!m) return null;
  const h = Number(m[1]);
  return h >= 0 && h <= 23 ? h : null;
}

/**
 * The cost line of a watch: the last FINISHED run's tokens and the mean over
 * the measured finished runs. Unmeasured runs are left out of the mean and
 * counted apart; with none measured, both are null.
 */
export function watchCost(runs: readonly WatchRun[]): { last: number | null; mean: number | null; measured: number; unmeasured: number } {
  const finished = runs.filter((r) => r.endedAt !== null);
  const measured = finished.filter((r) => r.tokens !== null);
  const total = measured.reduce((s, r) => s + (r.tokens ?? 0), 0);
  return {
    last: finished[0]?.tokens ?? null,
    mean: measured.length ? Math.round(total / measured.length) : null,
    measured: measured.length,
    unmeasured: finished.length - measured.length,
  };
}

/** A watch is running right now: its newest run has no end. */
export function runningNow(runs: readonly WatchRun[]): boolean {
  return runs[0] !== undefined && runs[0].endedAt === null;
}

/** 12 400 → "12,4 k" style, locale-aware; null → `—`. */
export function fmtTokens(n: number | null, locale: string): string {
  if (n === null || !Number.isFinite(n)) return '—';
  if (n < 1000) return new Intl.NumberFormat(locale).format(n);
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(n / 1000)} k`;
}

const ACT_ERRORS = [
  ['TELEGRAM_NOT_READY', 'watches.errTelegram'],
  ['INVALID_INPUT', 'watches.errInput'],
  ['VENV_NOT_FOUND', 'watches.errVenv'],
  ['NOT_INSTALLED_AFTER', 'watches.errFreeInstall'],
  ['NOT_INSTALLED', 'watches.errNotInstalled'],
  ['UV_NOT_FOUND', 'watches.errUv'],
  ['NOT_FOUND', 'watches.errNotFound'],
  ['INSTALL_FAILED', 'watches.errFreeInstall'],
  ['ALREADY_RUNNING', 'watches.errBusy'],
  ['INVALID_BRAVE_KEY', 'watches.errBrave'],
  ['NO_REPORT', 'watches.noReport'],
] as const;

/** A host refusal → its sentence. Unknown codes fall back to `common.error`. */
export function actErrorKey(message: string): string {
  return matchCode(ACT_ERRORS, message, 'common.error');
}

/** Hours offered in the form, 0..23. */
export const HOURS: readonly number[] = Array.from({ length: 24 }, (_, h) => h);

/** Default hour: 3 a.m., when nobody is using the machine. */
export const DEFAULT_HOUR = 3;
