/**
 * MnemoHermes' agent handlers (doc 149): every move goes through the call the
 * cockpit's own button makes, nothing moves behind the guided first steps, a
 * gateway is never started twice, and a task only goes to a gateway that is up.
 */
import { describe, expect, it, vi } from 'vitest';
import { clampLimit, hermesAgentHandlers, runLine, type HermesAgentContext } from './hermesAgent';
import type { HermesStatus, RunView } from '../types';

const NOW = Date.parse('2026-10-12T20:00:00Z');

function hermes(over: Partial<HermesStatus> = {}): HermesStatus {
  return {
    installed: true, home: '/h', managed: true, apiServer: { enabled: true, keyPresent: true },
    gatewayRunning: false, gatewayProcess: { managed: false, pid: null, startedAt: null, lastLine: null }, ...over,
  };
}

function run(over: Partial<RunView> = {}): RunView {
  return {
    runId: 'r1', input: 'tidy the desk', status: 'running', startedAt: '2026-10-12T19:59:00Z', lastEventAt: '2026-10-12T19:59:50Z',
    approval: null, approvalTimeoutSec: 300, output: '', error: null, log: [], stream: 'live', ...over,
  };
}

/** A host that answers each action from a table, and records what it was asked. */
function host(answers: Record<string, unknown>) {
  const calls: { action: string; payload: Record<string, unknown> | undefined }[] = [];
  const invoke = vi.fn(<T,>(action: string, payload?: Record<string, unknown>): Promise<T> => {
    calls.push({ action, payload });
    const a = answers[action];
    if (a instanceof Error) return Promise.reject(a);
    if (a === undefined) return Promise.reject(new Error(`UNEXPECTED: ${action}`));
    return Promise.resolve(a as T);
  });
  return { invoke: invoke as unknown as HermesAgentContext['invoke'], mock: invoke, calls, asked: (action: string) => calls.filter((c) => c.action === action).length };
}

function ctx(invoke: HermesAgentContext['invoke'], over: Partial<HermesAgentContext> = {}): HermesAgentContext {
  return { onboardingDone: true, tab: 'chat', setTab: vi.fn(), refresh: vi.fn(), invoke, locale: () => 'fr', ...over };
}
const handlers = (c: HermesAgentContext) => hermesAgentHandlers(() => c, () => NOW);

describe('clampLimit', () => {
  it('never returns a negative, a zero or a fraction', () => {
    expect(clampLimit(-2)).toBe(1);
    expect(clampLimit(0)).toBe(1);
    expect(clampLimit(3.5)).toBe(3);
    expect(clampLimit(999)).toBe(50);
    expect(clampLimit(null)).toBe(10);
  });
});

describe('runLine', () => {
  it('says how long a run has been silent, never that it works', () => {
    expect(runLine(run(), NOW)).toMatchObject({ runId: 'r1', silentSeconds: 10 });
    expect(JSON.stringify(runLine(run(), NOW))).not.toMatch(/working/);
  });
  it('shows an approval as waiting for the person, with Hermes\' clock', () => {
    const waiting = run({ status: 'waiting_for_approval', approval: { requestId: 'q', command: 'rm -rf x', description: 'delete', choices: ['once', 'deny'], smartDenied: false, receivedAt: '2026-10-12T19:59:00Z' } });
    expect(runLine(waiting, NOW).waitsForThePerson).toEqual({ description: 'delete', command: 'rm -rf x', secondsLeft: 240 });
  });
  it('keeps the end of a long output and says it was cut', () => {
    const r = runLine(run({ output: 'a'.repeat(2500) + 'END' }), NOW);
    expect(r.output).toHaveLength(2000);
    expect(r.output!.endsWith('END')).toBe(true);
    expect(r.outputCut).toBe(2503);
  });
});

describe('the handlers', () => {
  it('nothing moves behind the guided first steps', async () => {
    const h = host({ 'hermes.status': hermes() });
    const c = ctx(h.invoke, { onboardingDone: false });
    expect(() => handlers(c).showTab({ tab: 'tasks' })).toThrow(/^ONBOARDING/);
    await expect(handlers(c).startGateway({})).rejects.toThrow(/^ONBOARDING/);
    expect(h.asked('hermes.gatewayStart')).toBe(0);
    expect(() => handlers(ctx(h.invoke, { onboardingDone: null })).showTab({ tab: 'tasks' })).toThrow(/^NOT_READY/);
  });

  it('startGateway makes the Start button\'s call, then shows the Status tab', async () => {
    const h = host({ 'hermes.status': hermes(), 'hermes.gatewayStart': {} });
    const c = ctx(h.invoke);
    await expect(handlers(c).startGateway({})).resolves.toMatchObject({ gateway: 'starting' });
    expect(h.calls.find((x) => x.action === 'hermes.gatewayStart')!.payload).toEqual({ locale: 'fr' });
    expect(c.setTab).toHaveBeenCalledWith('status');
  });

  it('startGateway never starts a gateway that is up or starting', async () => {
    const up = host({ 'hermes.status': hermes({ gatewayRunning: true }) });
    await expect(handlers(ctx(up.invoke)).startGateway({})).resolves.toMatchObject({ already: true });
    const booting = host({ 'hermes.status': hermes({ gatewayProcess: { managed: true, pid: 1, startedAt: null, lastLine: null } }) });
    await expect(handlers(ctx(booting.invoke)).startGateway({})).rejects.toThrow(/^BUSY/);
    expect(up.asked('hermes.gatewayStart') + booting.asked('hermes.gatewayStart')).toBe(0);
  });

  it('a second start while the first is on its way is refused, not sent', async () => {
    let release: () => void = () => {};
    const h = host({ 'hermes.status': hermes() });
    h.mock.mockImplementation((action: string): Promise<unknown> => {
      if (action === 'hermes.status') return Promise.resolve(hermes());
      return new Promise<unknown>((resolve) => { release = () => resolve({}); });
    });
    const hs = handlers(ctx(h.invoke));
    const first = hs.startGateway({}) as Promise<unknown>;
    await vi.waitFor(() => expect(h.mock).toHaveBeenCalledWith('hermes.gatewayStart', { locale: 'fr' }));
    await expect(hs.startGateway({})).rejects.toThrow(/^BUSY/);
    release();
    await first;
  });

  it('a refused start is said with the host\'s reason', async () => {
    const h = host({ 'hermes.status': hermes(), 'hermes.gatewayStart': new Error('NOT_INSTALLED') });
    await expect(handlers(ctx(h.invoke)).startGateway({})).rejects.toThrow(/^START_REFUSED: NOT_INSTALLED/);
  });

  it('stopGateway only stops the gateway the cockpit started', async () => {
    const elsewhere = host({ 'hermes.status': hermes({ gatewayRunning: true }) });
    await expect(handlers(ctx(elsewhere.invoke)).stopGateway({})).rejects.toThrow(/^NOT_MANAGED/);
    const ours = host({ 'hermes.status': hermes({ gatewayRunning: true, gatewayProcess: { managed: true, pid: 1, startedAt: null, lastLine: null } }), 'hermes.gatewayStop': {} });
    const c = ctx(ours.invoke, { tab: 'status' });
    await expect(handlers(c).stopGateway({})).resolves.toEqual({ stopped: true });
    expect(c.refresh).toHaveBeenCalledOnce();
  });

  it('startTask only goes to a gateway that is up, through the Tasks tab\'s call', async () => {
    const down = host({ 'hermes.status': hermes() });
    await expect(handlers(ctx(down.invoke)).startTask({ task: 'x' })).rejects.toThrow(/^GATEWAY_DOWN/);
    expect(down.asked('hermes.runStart')).toBe(0);
    const up = host({ 'hermes.status': hermes({ gatewayRunning: true }), 'hermes.runStart': run() });
    const c = ctx(up.invoke);
    await expect(handlers(c).startTask({ task: ' tidy ' })).resolves.toMatchObject({ runId: 'r1' });
    expect(up.calls.find((x) => x.action === 'hermes.runStart')!.payload).toEqual({ input: 'tidy' });
    expect(c.setTab).toHaveBeenCalledWith('tasks');
    await expect(handlers(c).startTask({ task: '  ' })).rejects.toThrow(/^BAD_ARG/);
  });

  it('stopTask names the tasks when the id is unknown, and leaves a finished one alone', async () => {
    const h = host({ 'hermes.runList': { runs: [run(), run({ runId: 'r2', status: 'completed' })] }, 'hermes.runStop': {} });
    await expect(handlers(ctx(h.invoke)).stopTask({ runId: 'zz' })).rejects.toThrow(/^NOT_FOUND: .*r1, r2/);
    await expect(handlers(ctx(h.invoke)).stopTask({ runId: 'r2' })).resolves.toMatchObject({ already: true });
    expect(h.asked('hermes.runStop')).toBe(0);
    await expect(handlers(ctx(h.invoke)).stopTask({ runId: 'r1' })).resolves.toEqual({ runId: 'r1', stopping: true });
    expect(h.asked('hermes.runStop')).toBe(1);
  });

  it('tasks are newest first and bounded', async () => {
    const h = host({ 'hermes.runList': { runs: [run({ runId: 'old', startedAt: '2026-10-12T10:00:00Z' }), run({ runId: 'new' })] } });
    const r = (await handlers(ctx(h.invoke)).tasks({ limit: 1 })) as { runId: string }[];
    expect(r.map((x) => x.runId)).toEqual(['new']);
  });

  it('showTab refuses a tab that does not exist', () => {
    const c = ctx(host({}).invoke);
    expect(() => handlers(c).showTab({ tab: 'billing' })).toThrow(/^BAD_ARG/);
    handlers(c).showTab({ tab: 'inbox' });
    expect(c.setTab).toHaveBeenCalledWith('inbox');
  });
});
