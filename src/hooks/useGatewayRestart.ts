/**
 * useGatewayRestart — the button a "saved, now restart the gateway" note
 * carries. Channels and Tools both write config the gateway only reads at
 * start; telling the person to go restart it on another tab is a note
 * without a control, which reads as a note without a next step.
 *
 * Stop then start, then the verdict comes from a status read after the
 * gateway had time to bind — never from the two calls returning, which
 * only says the requests were accepted.
 */
import { useCallback, useState } from 'react';
import type { HermesStatus } from '../types';
import { sdk } from '../sdk/instance';
import { getLang } from '../i18n/useI18n';

/** How long a freshly started gateway is given to bind before we re-read. */
export const GATEWAY_SETTLE_MS = 3000;
/** How long the old gateway is given to die before the new one is started. */
export const STOP_WAIT_MS = 8000;

/** Poll `check` every 400 ms until it is true or the budget is spent. */
export async function waitUntil(check: () => Promise<boolean>, budgetMs: number, stepMs = 400): Promise<boolean> {
  const until = Date.now() + budgetMs;
  for (;;) {
    if (await check()) return true;
    if (Date.now() >= until) return false;
    await new Promise((r) => setTimeout(r, stepMs));
  }
}

export type RestartState = 'idle' | 'running' | 'ok' | 'failed';

export function useGatewayRestart(): { restart: RestartState; run: () => Promise<void>; reset: () => void } {
  const [restart, setRestart] = useState<RestartState>('idle');
  const run = useCallback(async () => {
    setRestart('running');
    try {
      await sdk.invoke('hermes.gatewayStop', {});
      // Sweep 2026-09-23: stop() fires taskkill and returns; starting in the
      // same breath raced the old process for the port. Wait until the host
      // no longer manages a gateway and none answers, bounded.
      const gone = await waitUntil(async () => {
        const s = await sdk.invoke<HermesStatus>('hermes.status', {});
        return !s.gatewayProcess.managed && s.gatewayRunning !== true;
      }, STOP_WAIT_MS);
      if (!gone) { setRestart('failed'); return; }
      await sdk.invoke('hermes.gatewayStart', { locale: getLang() });
      await new Promise((r) => setTimeout(r, GATEWAY_SETTLE_MS));
      const status = await sdk.invoke<HermesStatus>('hermes.status', {});
      // "managed" says a process was spawned; "running" says it answers. When
      // the host measured the second, that is the verdict.
      const up = status.gatewayRunning !== null ? status.gatewayRunning === true : status.gatewayProcess.managed;
      setRestart(up ? 'ok' : 'failed');
    } catch {
      // The status read is the only witness; a thrown call is a failed restart.
      setRestart('failed');
    }
  }, []);
  const reset = useCallback(() => setRestart('idle'), []);
  return { restart, run, reset };
}
