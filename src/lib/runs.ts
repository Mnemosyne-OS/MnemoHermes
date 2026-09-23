/**
 * Tasks (doc 123 lot 1) — the pure decisions of the Tâches tab.
 *
 * The one that matters: the countdown on an approval is HERMES' clock
 * (`approvals.timeout`, read from its config), counted from when the
 * request reached the host. When it hits zero Hermes has decided alone —
 * the card must say so, never keep offering buttons on a question nobody
 * is asking anymore.
 */
import type { RunChoice, RunView } from '../types';

export type RunPhase = 'active' | 'waiting' | 'settled';

export function runPhase(run: RunView): RunPhase {
  if (run.status === 'waiting_for_approval' && run.approval) return 'waiting';
  if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') return 'settled';
  return 'active';
}

/** Seconds left on Hermes' clock, or null when nothing is pending / unreadable. */
export function approvalSecondsLeft(run: RunView, nowMs: number): number | null {
  if (!run.approval) return null;
  const start = Date.parse(run.approval.receivedAt);
  if (Number.isNaN(start)) return null;
  const left = run.approvalTimeoutSec - Math.floor((nowMs - start) / 1000);
  return Math.max(0, left);
}

/** The panel keeps polling while any run can still change. */
export function anyRunLive(runs: RunView[]): boolean {
  return runs.some((r) => runPhase(r) !== 'settled');
}

/** Seconds since the run last gave a sign of life, or null when unreadable. */
export function silentSeconds(run: RunView, nowMs: number): number | null {
  const t = Date.parse(run.lastEventAt);
  if (Number.isNaN(t) || t > nowMs) return null;
  return Math.floor((nowMs - t) / 1000);
}

/** Locale key per choice — the labels cannot drift from the wire's words. */
export const CHOICE_KEYS: Record<RunChoice, string> = {
  once: 'tasks.choiceOnce',
  session: 'tasks.choiceSession',
  always: 'tasks.choiceAlways',
  deny: 'tasks.choiceDeny',
};

export const STATUS_KEYS: Record<RunView['status'], string> = {
  queued: 'tasks.statusQueued',
  running: 'tasks.statusRunning',
  waiting_for_approval: 'tasks.statusWaiting',
  stopping: 'tasks.statusStopping',
  completed: 'tasks.statusCompleted',
  failed: 'tasks.statusFailed',
  cancelled: 'tasks.statusCancelled',
  unknown: 'tasks.statusUnknown',
};

/** Newest first, so the task the human just started is on top. */
export function sortRuns(runs: RunView[]): RunView[] {
  return [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}
