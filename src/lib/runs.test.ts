import { describe, it, expect } from 'vitest';
import { anyRunLive, approvalSecondsLeft, runPhase, silentSeconds, sortRuns, CHOICE_KEYS, STATUS_KEYS } from './runs';
import type { RunView } from '../types';

const run = (over: Partial<RunView> = {}): RunView => ({
  runId: 'run_1',
  input: 'range mes téléchargements',
  status: 'running',
  startedAt: '2026-09-22T22:00:00Z',
  lastEventAt: '2026-09-22T22:00:10Z',
  approval: null,
  approvalTimeoutSec: 300,
  output: '',
  error: null,
  log: [],
  stream: 'live',
  ...over,
});

const approval = { requestId: 'req', command: 'rm -rf ***', description: null, choices: ['once', 'deny'] as const, smartDenied: false, receivedAt: '2026-09-22T22:01:00Z' };

describe('runPhase', () => {
  it('waiting only with a pending approval, settled on the three ends', () => {
    expect(runPhase(run())).toBe('active');
    expect(runPhase(run({ status: 'waiting_for_approval', approval: { ...approval, choices: [...approval.choices] } }))).toBe('waiting');
    // A gateway status says waiting but the host holds no request: nothing to answer — active, not waiting.
    expect(runPhase(run({ status: 'waiting_for_approval', approval: null }))).toBe('active');
    for (const status of ['completed', 'failed', 'cancelled'] as const) expect(runPhase(run({ status }))).toBe('settled');
  });
});

describe('approvalSecondsLeft — Hermes\' clock, from when the request reached us', () => {
  const r = run({ status: 'waiting_for_approval', approval: { ...approval, choices: [...approval.choices] }, approvalTimeoutSec: 120 });
  it('counts down and floors at zero', () => {
    expect(approvalSecondsLeft(r, Date.parse('2026-09-22T22:01:30Z'))).toBe(90);
    expect(approvalSecondsLeft(r, Date.parse('2026-09-22T22:05:00Z'))).toBe(0);
  });
  it('is null without a request or with an unreadable date', () => {
    expect(approvalSecondsLeft(run(), Date.now())).toBeNull();
    expect(approvalSecondsLeft(run({ approval: { ...approval, choices: [...approval.choices], receivedAt: 'x' } }), Date.now())).toBeNull();
  });
});

describe('the rest', () => {
  it('polls while any run can still change', () => {
    expect(anyRunLive([run({ status: 'completed' }), run({ status: 'failed' })])).toBe(false);
    expect(anyRunLive([run({ status: 'completed' }), run()])).toBe(true);
    expect(anyRunLive([])).toBe(false);
  });
  it('measures silence, never fabricates it', () => {
    expect(silentSeconds(run(), Date.parse('2026-09-22T22:00:40Z'))).toBe(30);
    expect(silentSeconds(run({ lastEventAt: 'nope' }), Date.now())).toBeNull();
    expect(silentSeconds(run({ lastEventAt: '2099-01-01T00:00:00Z' }), Date.now())).toBeNull();
  });
  it('sorts newest first and has a key for every choice and status', () => {
    const a = run({ runId: 'a', startedAt: '2026-09-22T22:00:00Z' });
    const b = run({ runId: 'b', startedAt: '2026-09-22T23:00:00Z' });
    expect(sortRuns([a, b]).map((r) => r.runId)).toEqual(['b', 'a']);
    expect(Object.keys(CHOICE_KEYS)).toEqual(['once', 'session', 'always', 'deny']);
    expect(Object.keys(STATUS_KEYS).length).toBe(8);
  });
});
