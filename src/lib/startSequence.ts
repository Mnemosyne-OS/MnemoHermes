/**
 * The wizard's last click, as a sequence the screen follows line by line:
 * the brain, the memory skill, the gateway (onboarding rework 2026-09-25).
 *
 * 🚨 The brain line exists because of a field report: the managed install
 * points Hermes' model at the brain proxy (127.0.0.1:7439), but the proxy is
 * opt-in and only a checkbox on a developer panel turned it on. A person who
 * clicked Next past that panel had an agent talking to a closed port — every
 * chat turn hung until they gave up. On a managed install the proxy is now
 * switched on here; on a hand install Hermes keeps the model its config names
 * unless the person ticks the box that says it will be replaced.
 *
 * Each step's failure is said and never stops the next one: a gateway that
 * starts without the skill is still an assistant, and the line that failed
 * says what to fix.
 */
import { installErrorCode } from './skills';
import { GATEWAY_BOOT_MS, STOP_WAIT_MS, waitUntil } from '../hooks/useGatewayRestart';
import type { HermesStatus } from '../types';

export type StepId = 'brain' | 'memory' | 'gateway';
export const START_STEPS: readonly StepId[] = ['brain', 'memory', 'gateway'];

/** `kept` = the brain line on a hand install left alone on purpose. */
export type StepState =
  | { kind: 'wait' }
  | { kind: 'run' }
  | { kind: 'ok'; kept?: boolean }
  | { kind: 'fail'; code: string };

export type Invoke = <T = unknown>(action: string, payload?: Record<string, unknown>) => Promise<T>;

export interface StartOptions {
  /** Hand install only: replace the model in Hermes' config with the brain proxy. */
  useMnemoBrain: boolean;
  /** The app's language, for the voice of spoken replies (doc 123). */
  locale?: string;
  /** Test seam for the gateway waits. */
  bootMs?: number;
  stopMs?: number;
  stepMs?: number;
}

const codeOf = (err: unknown): string => (err instanceof Error ? err.message : String(err)).slice(0, 120);

/** Runs the three steps in order, reporting each state as it changes. */
export async function runStartSequence(
  invoke: Invoke,
  opts: StartOptions,
  report: (id: StepId, state: StepState) => void,
): Promise<{ gatewayUp: boolean }> {
  const bootMs = opts.bootMs ?? GATEWAY_BOOT_MS;
  const stopMs = opts.stopMs ?? STOP_WAIT_MS;
  const stepMs = opts.stepMs ?? 1000;

  let status: HermesStatus | null = null;
  try {
    status = await invoke<HermesStatus>('hermes.status', {});
  } catch (err) {
    console.warn('[start] hermes.status failed:', err);
  }
  const managed = status?.managed === true;

  // 1. The brain.
  report('brain', { kind: 'run' });
  if (!managed && !opts.useMnemoBrain) {
    report('brain', { kind: 'ok', kept: true });
  } else {
    try {
      const proxy = await invoke<{ enabled?: boolean }>('hermes.proxySetConfig', { enabled: true });
      if (proxy?.enabled !== true) throw new Error('PROXY_NOT_ENABLED');
      // A managed install already carries the brain block (the installer
      // wrote it); only a hand install has its model replaced, on request.
      if (!managed) await invoke('hermes.proxyApplyConfig', {});
      report('brain', { kind: 'ok' });
    } catch (err) {
      console.warn('[start] brain not switched on:', err);
      report('brain', { kind: 'fail', code: codeOf(err) });
    }
  }

  // 2. The memory skill. Installed before the gateway starts, since Hermes
  //    reads its skills at start.
  report('memory', { kind: 'run' });
  let skillJustInstalled = false;
  let onShelf = false;
  try {
    const shelf = await invoke<{ mnemosyneMemoryInstalled?: boolean }>('hermes.skills', {});
    onShelf = shelf?.mnemosyneMemoryInstalled === true;
  } catch (err) {
    // An unread shelf is not a missing skill: install anyway, the host
    // answers ALREADY_INSTALLED when it is there.
    console.warn('[start] hermes.skills unreadable, installing anyway:', err);
  }
  if (onShelf) {
    report('memory', { kind: 'ok' });
  } else {
    try {
      await invoke('hermes.skillInstall', {});
      skillJustInstalled = true;
      report('memory', { kind: 'ok' });
    } catch (err) {
      const code = installErrorCode(codeOf(err));
      if (code === 'ALREADY_INSTALLED') report('memory', { kind: 'ok' });
      else {
        console.warn('[start] memory skill not installed:', code);
        report('memory', { kind: 'fail', code });
      }
    }
  }

  // 3. The gateway: started, or restarted when it was already running and a
  //    skill it has not read just landed.
  report('gateway', { kind: 'run' });
  const readStatus = () => invoke<HermesStatus>('hermes.status', {});
  const answering = async () => (await readStatus()).gatewayRunning === true;
  try {
    const alreadyUp = status?.gatewayRunning === true;
    if (alreadyUp && !skillJustInstalled) {
      report('gateway', { kind: 'ok' });
      return { gatewayUp: true };
    }
    if (alreadyUp) {
      await invoke('hermes.gatewayStop', {});
      const gone = await waitUntil(async () => {
        const s = await readStatus();
        return !s.gatewayProcess.managed && s.gatewayRunning !== true;
      }, stopMs, stepMs);
      if (!gone) throw new Error('STOP_TIMEOUT');
    }
    try {
      await invoke('hermes.gatewayStart', opts.locale ? { locale: opts.locale } : {});
    } catch (err) {
      // Already answering, or already spawned by this app and still booting:
      // both are a start in progress, not a failure.
      const code = codeOf(err);
      if (!code.includes('ALREADY_RUNNING') && !code.includes('ALREADY_MANAGED')) throw err;
    }
    const up = await waitUntil(answering, bootMs, stepMs);
    report('gateway', up ? { kind: 'ok' } : { kind: 'fail', code: 'NOT_ANSWERING' });
    return { gatewayUp: up };
  } catch (err) {
    console.warn('[start] gateway not started:', err);
    report('gateway', { kind: 'fail', code: codeOf(err) });
    return { gatewayUp: false };
  }
}
