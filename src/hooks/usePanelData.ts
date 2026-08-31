/**
 * usePanelData — the cockpit's shared 3-state loader.
 *
 * Every tab renders loading, error and data — never fewer (house rule 11).
 * The error state distinguishes "the host predates the Hermes connector"
 * (unknown action) from "a wired host failing" — a different user message.
 * Panels that mutate their data locally (the inbox filters verdicts out
 * without a refetch) get setState back; reload(silent) refreshes without
 * flashing the loading state (the status auto-refresh).
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export type PanelState<T> =
  | { kind: 'loading' }
  | { kind: 'error'; unavailable: boolean }
  | { kind: 'data'; data: T };

/** An older host without the Hermes connector answers this way. */
export const HOST_UNAVAILABLE_RE = /unknown action|not supported/i;

export function usePanelData<T>(
  load: () => Promise<T>,
  unavailableRe: RegExp = HOST_UNAVAILABLE_RE,
): {
  state: PanelState<T>;
  setState: Dispatch<SetStateAction<PanelState<T>>>;
  reload: (silent?: boolean) => Promise<void>;
} {
  const [state, setState] = useState<PanelState<T>>({ kind: 'loading' });
  // Refs so `reload` stays referentially stable while callers pass inline
  // closures — the mount effect must run once, not on every render.
  const loadRef = useRef(load);
  loadRef.current = load;
  const reRef = useRef(unavailableRe);
  reRef.current = unavailableRe;

  const reload = useCallback(async (silent = false) => {
    if (!silent) setState({ kind: 'loading' });
    try {
      const data = await loadRef.current();
      setState({ kind: 'data', data });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setState({ kind: 'error', unavailable: reRef.current.test(msg) });
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, setState, reload };
}
