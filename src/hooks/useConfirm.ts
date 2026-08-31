/**
 * useConfirm — the cockpit's two-press gesture.
 *
 * Five controls in this cartridge do something a stray click should not do:
 * rewriting the agent's model block, rerouting its web search, opening every
 * channel to a shell (YOLO), forgetting a chronicle. They all had their own
 * copy of "first press arms, second press acts", and one of them is enough
 * out of step to arm nothing.
 *
 * The target is compared by identity, so callers pass a string (a preset name,
 * an item key) rather than a fresh object per render.
 */
import { useCallback, useState } from 'react';

export interface Confirm<T> {
  /** What is currently armed, or null. Panels read it to relabel the button. */
  armed: T | null;
  /**
   * Press the control. Returns `true` when this press is the CONFIRMATION and
   * the caller should act; `false` when it only armed the control.
   */
  press: (target: T) => boolean;
  /** Disarm without acting — opening a different control, or finishing one. */
  cancel: () => void;
}

export function useConfirm<T>(): Confirm<T> {
  const [armed, setArmed] = useState<T | null>(null);

  const press = useCallback((target: T): boolean => {
    if (armed === target) {
      setArmed(null);
      return true;
    }
    setArmed(target);
    return false;
  }, [armed]);

  const cancel = useCallback(() => setArmed(null), []);

  return { armed, press, cancel };
}
