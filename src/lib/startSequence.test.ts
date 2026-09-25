import { runStartSequence, type Invoke, type StepId, type StepState } from './startSequence';

interface Host {
  managed: boolean;
  gatewayUp: boolean;
  /** How many status reads before a started gateway answers. */
  answersAfter: number;
  proxyEnables: boolean;
  skillOnShelf: boolean | 'unreadable';
  skillError: string | null;
}

function fakeHost(over: Partial<Host> = {}) {
  const h: Host = { managed: true, gatewayUp: false, answersAfter: 1, proxyEnables: true, skillOnShelf: false, skillError: null, ...over };
  const calls: string[] = [];
  let started = false;
  let reads = 0;
  const invoke: Invoke = <T,>(action: string, payload?: Record<string, unknown>): Promise<T> => {
    calls.push(action === 'hermes.proxySetConfig' ? `${action}:${JSON.stringify(payload)}` : action);
    const r = (v: unknown) => Promise.resolve(v as T);
    switch (action) {
      case 'hermes.status': {
        if (started) reads += 1;
        const up = h.gatewayUp || (started && reads >= h.answersAfter);
        return r({ installed: true, managed: h.managed, gatewayRunning: up, gatewayProcess: { managed: started, pid: null, startedAt: null, lastLine: null } });
      }
      case 'hermes.proxySetConfig': return r({ enabled: h.proxyEnables });
      case 'hermes.proxyApplyConfig': return r({});
      case 'hermes.skills':
        return h.skillOnShelf === 'unreadable' ? Promise.reject(new Error('boom')) : r({ mnemosyneMemoryInstalled: h.skillOnShelf });
      case 'hermes.skillInstall': return h.skillError ? Promise.reject(new Error(h.skillError)) : r({ lines: [] });
      case 'hermes.gatewayStop': h.gatewayUp = false; started = false; return r({});
      case 'hermes.gatewayStart': started = true; reads = 0; return r({ pid: 1 });
      default: return Promise.reject(new Error(`unexpected ${action}`));
    }
  };
  return { invoke, calls };
}

async function run(host: ReturnType<typeof fakeHost>, useMnemoBrain = false) {
  const final: Partial<Record<StepId, StepState>> = {};
  const res = await runStartSequence(host.invoke, { useMnemoBrain, bootMs: 50, stopMs: 50, stepMs: 1 }, (id, s) => { final[id] = s; });
  return { res, final };
}

describe('runStartSequence', () => {
  it('on a managed install, switches the brain proxy on and never rewrites the model block', async () => {
    const host = fakeHost();
    const { res, final } = await run(host);
    expect(host.calls).toContain('hermes.proxySetConfig:{"enabled":true}');
    expect(host.calls).not.toContain('hermes.proxyApplyConfig');
    expect(final).toEqual({ brain: { kind: 'ok' }, memory: { kind: 'ok' }, gateway: { kind: 'ok' } });
    expect(res.gatewayUp).toBe(true);
  });

  it('on a hand install, leaves the brain alone unless asked', async () => {
    const host = fakeHost({ managed: false });
    const { final } = await run(host);
    expect(host.calls.some((c) => c.startsWith('hermes.proxy'))).toBe(false);
    expect(final.brain).toEqual({ kind: 'ok', kept: true });
  });

  it('on a hand install with the box ticked, switches the proxy on and writes the model block', async () => {
    const host = fakeHost({ managed: false });
    await run(host, true);
    expect(host.calls).toContain('hermes.proxySetConfig:{"enabled":true}');
    expect(host.calls).toContain('hermes.proxyApplyConfig');
  });

  it('says a brain that did not switch on, and still starts the rest', async () => {
    const host = fakeHost({ proxyEnables: false });
    const { final, res } = await run(host);
    expect(final.brain).toEqual({ kind: 'fail', code: 'PROXY_NOT_ENABLED' });
    expect(final.memory).toEqual({ kind: 'ok' });
    expect(res.gatewayUp).toBe(true);
  });

  it('installs the memory skill before starting the gateway', async () => {
    const host = fakeHost();
    await run(host);
    expect(host.calls.indexOf('hermes.skillInstall')).toBeGreaterThan(-1);
    expect(host.calls.indexOf('hermes.skillInstall')).toBeLessThan(host.calls.indexOf('hermes.gatewayStart'));
  });

  it('does not reinstall a skill on the shelf', async () => {
    const host = fakeHost({ skillOnShelf: true });
    await run(host);
    expect(host.calls).not.toContain('hermes.skillInstall');
  });

  it('tries the install on an unread shelf and takes ALREADY_INSTALLED as installed', async () => {
    const host = fakeHost({ skillOnShelf: 'unreadable', skillError: 'ALREADY_INSTALLED' });
    const { final } = await run(host);
    expect(host.calls).toContain('hermes.skillInstall');
    expect(final.memory).toEqual({ kind: 'ok' });
  });

  it('says a refused skill and still starts the gateway', async () => {
    const host = fakeHost({ skillError: 'CLI_NOT_FOUND' });
    const { final, res } = await run(host);
    expect(final.memory).toEqual({ kind: 'fail', code: 'CLI_NOT_FOUND' });
    expect(res.gatewayUp).toBe(true);
  });

  it('leaves a running gateway alone when nothing new landed', async () => {
    const host = fakeHost({ gatewayUp: true, skillOnShelf: true });
    const { final } = await run(host);
    expect(host.calls).not.toContain('hermes.gatewayStop');
    expect(host.calls).not.toContain('hermes.gatewayStart');
    expect(final.gateway).toEqual({ kind: 'ok' });
  });

  it('restarts a running gateway when the skill just landed, so it reads it', async () => {
    const host = fakeHost({ gatewayUp: true });
    const { final } = await run(host);
    expect(host.calls.indexOf('hermes.gatewayStop')).toBeGreaterThan(host.calls.indexOf('hermes.skillInstall'));
    expect(host.calls.indexOf('hermes.gatewayStart')).toBeGreaterThan(host.calls.indexOf('hermes.gatewayStop'));
    expect(final.gateway).toEqual({ kind: 'ok' });
  });

  it('waits for a gateway that takes several reads to answer', async () => {
    const host = fakeHost({ answersAfter: 5 });
    const { final } = await run(host);
    expect(final.gateway).toEqual({ kind: 'ok' });
  });

  it('says a gateway that never answers', async () => {
    const host = fakeHost({ answersAfter: 1_000_000 });
    const { final, res } = await run(host);
    expect(final.gateway).toEqual({ kind: 'fail', code: 'NOT_ANSWERING' });
    expect(res.gatewayUp).toBe(false);
  });
});
