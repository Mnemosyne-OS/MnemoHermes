import { describe, it, expect } from 'vitest';
import {
  canInstall,
  canReinstall,
  downloadMb,
  elapsedSeconds,
  formatClock,
  installErrorKey,
  installPhase,
  showsUpdateButton,
  STAGE_KEYS,
} from './managedInstall';
import type { HermesStatus, ManagedInstallState } from '../types';

const status = (over: Partial<HermesStatus> = {}): HermesStatus => ({
  installed: false,
  home: null,
  managed: false,
  apiServer: { enabled: false, keyPresent: false },
  gatewayRunning: null,
  gatewayProcess: { managed: false, pid: null, startedAt: null, lastLine: null },
  ...over,
});

const run = (over: Partial<ManagedInstallState> = {}): ManagedInstallState => ({
  running: false,
  stage: null,
  pct: null,
  startedAt: null,
  finishedAt: null,
  error: null,
  cancelled: false,
  output: [],
  installed: null,
  home: 'H',
  pin: { tag: 'v2026.9.21', version: '0.21.4', bytes: 74_685_046 },
  ...over,
});

describe('installPhase — five answers, never a boolean', () => {
  it('reads each outcome', () => {
    expect(installPhase(null)).toBe('idle');
    expect(installPhase(run({ running: true, stage: 'deps' }))).toBe('running');
    expect(installPhase(run({ stage: 'done' }))).toBe('done');
    expect(installPhase(run({ error: 'CHECKSUM_MISMATCH:x', stage: 'verify' }))).toBe('failed');
    expect(installPhase(run({ cancelled: true, stage: 'download' }))).toBe('cancelled');
  });

  it('a stop by the human is cancelled even when a stage is left behind, and beats a stale error', () => {
    expect(installPhase(run({ cancelled: true, stage: 'deps', error: null }))).toBe('cancelled');
  });
});

describe('the buttons', () => {
  it('Install only when nothing is installed and no job runs', () => {
    expect(canInstall(status(), null)).toBe(true);
    expect(canInstall(status(), run({ running: true }))).toBe(false);
    expect(canInstall(status({ installed: true }), null)).toBe(false);
  });

  it('Reinstall only on the managed install; Update only on a hand install', () => {
    const managed = status({ installed: true, managed: true, home: 'M' });
    const hand = status({ installed: true, managed: false, home: 'D' });
    expect(canReinstall(managed, null)).toBe(true);
    expect(canReinstall(managed, run({ running: true }))).toBe(false);
    expect(canReinstall(hand, null)).toBe(false);
    expect(showsUpdateButton(hand)).toBe(true);
    expect(showsUpdateButton(managed)).toBe(false);
    expect(showsUpdateButton(status())).toBe(false);
  });
});

describe('the clock is measured', () => {
  const now = Date.parse('2026-09-22T20:01:30Z');
  it('counts from startedAt while running', () => {
    expect(elapsedSeconds(run({ running: true, startedAt: '2026-09-22T20:00:00Z' }), now)).toBe(90);
  });
  it('is null with no start, when not running, on an unreadable date, and on a start in the future', () => {
    expect(elapsedSeconds(run({ running: true, startedAt: null }), now)).toBeNull();
    expect(elapsedSeconds(run({ running: false, startedAt: '2026-09-22T20:00:00Z' }), now)).toBeNull();
    expect(elapsedSeconds(run({ running: true, startedAt: 'yesterday' }), now)).toBeNull();
    expect(elapsedSeconds(run({ running: true, startedAt: '2026-09-22T21:00:00Z' }), now)).toBeNull();
    expect(elapsedSeconds(null, now)).toBeNull();
  });
  it('formats m:ss', () => {
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(5)).toBe('0:05');
    expect(formatClock(90)).toBe('1:30');
    expect(formatClock(3661)).toBe('61:01');
    expect(formatClock(-3)).toBe('0:00');
  });
});

describe('sentences', () => {
  it('a gateway in the way has its own line; everything else is the failure line', () => {
    expect(installErrorKey('GATEWAY_RUNNING')).toBe('status.installBusy');
    expect(installErrorKey('CHECKSUM_MISMATCH:abc')).toBe('status.installFailed');
    expect(installErrorKey(null)).toBe('status.installFailed');
  });
  it('every stage the host can name has a label key', () => {
    for (const stage of ['python', 'download', 'verify', 'extract', 'venv', 'deps', 'config', 'check', 'done'] as const) {
      expect(STAGE_KEYS[stage]).toMatch(/^status\.stage/);
    }
  });
  it('the download size is rounded MB, or null when unknown — never 0', () => {
    expect(downloadMb(74_685_046)).toBe(75);
    expect(downloadMb(null)).toBeNull();
    expect(downloadMb(0)).toBeNull();
    expect(downloadMb(Number.NaN)).toBeNull();
  });
});
