/**
 * Managed install — the Status tab's reading of one install job the host
 * runs (doc 123 §4 lot 0: Hermes fetched, built and configured by the app,
 * one click, no terminal).
 *
 * Pure: the decisions the panel makes live here so they can be tested
 * without mounting anything. Two of them matter:
 *   - a job is FIVE things, not a boolean (idle / running / done / failed /
 *     cancelled — a human who pressed Stop did not suffer a failure);
 *   - the clock is MEASURED from `startedAt`: no start time = no clock,
 *     never "0 s" (a zero nobody measured reads as "just started" forever).
 */
import type { HermesStatus, ManagedInstallState } from '../types';

export type InstallPhase = 'idle' | 'running' | 'done' | 'failed' | 'cancelled';

export function installPhase(run: ManagedInstallState | null): InstallPhase {
  if (!run) return 'idle';
  if (run.running) return 'running';
  if (run.cancelled) return 'cancelled';
  if (run.error) return 'failed';
  if (run.stage === 'done') return 'done';
  return 'idle';
}

/** The Install button appears only where installing is the missing gesture. */
export function canInstall(status: HermesStatus, run: ManagedInstallState | null): boolean {
  return !status.installed && installPhase(run) !== 'running';
}

/** Re-install is offered ONLY on the install the app owns: `hermes update`
 *  needs the git checkout the official installer leaves, the managed one has
 *  none, and a hand install is the human's to update. */
export function canReinstall(status: HermesStatus, run: ManagedInstallState | null): boolean {
  return status.installed && status.managed && installPhase(run) !== 'running';
}

/** `hermes update` is for a hand install; the managed one re-installs instead. */
export function showsUpdateButton(status: HermesStatus): boolean {
  return status.installed && !status.managed;
}

/** Seconds since the job started, or null when no start was recorded. */
export function elapsedSeconds(run: ManagedInstallState | null, nowMs: number): number | null {
  if (!run || !run.running || !run.startedAt) return null;
  const start = Date.parse(run.startedAt);
  if (Number.isNaN(start) || start > nowMs) return null;
  return Math.floor((nowMs - start) / 1000);
}

/** `m:ss` — a clock a human reads, not a byte count. */
export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** A refusal code from `hermes.managedInstall` → the sentence for it. Unknown
 *  codes fall on the generic failure line, and the code itself is shown raw. */
export function installErrorKey(error: string | null): string {
  if (error === 'GATEWAY_RUNNING') return 'status.installBusy';
  return 'status.installFailed';
}

/** Locale key per stage, so the label cannot drift from the host's stage name. */
export const STAGE_KEYS: Record<NonNullable<ManagedInstallState['stage']>, string> = {
  python: 'status.stagePython',
  download: 'status.stageDownload',
  verify: 'status.stageVerify',
  extract: 'status.stageExtract',
  venv: 'status.stageVenv',
  deps: 'status.stageDeps',
  config: 'status.stageConfig',
  check: 'status.stageCheck',
  done: 'status.stageDone',
};

/** Rounded MB of the pinned download, for the hint. null when unknown. */
export function downloadMb(bytes: number | null | undefined): number | null {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return null;
  return Math.round(bytes / 1_000_000);
}
