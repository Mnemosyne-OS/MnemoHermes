/**
 * 🪤 This file is a .tsx ON PURPOSE, and it is the canary for a one-word hole.
 *
 * The vitest `include` glob and the ESLint test override in this family of
 * cartridges used to end in `.test.ts` rather than `.test.{ts,tsx}`. A glob
 * that narrow collects no rendering test AND says nothing about it: the suite
 * stays green and the test count never moves. If these assertions ever stop
 * running, the glob narrowed again.
 */
import { act, renderHook } from '@testing-library/react';
import { useConfirm } from './useConfirm';

describe('useConfirm', () => {
  it('starts disarmed', () => {
    const { result } = renderHook(() => useConfirm<string>());
    expect(result.current.armed).toBeNull();
  });

  it('arms on the first press and does NOT act', () => {
    const { result } = renderHook(() => useConfirm<string>());
    let acted = true;
    act(() => { acted = result.current.press('yolo'); });
    expect(acted).toBe(false);
    expect(result.current.armed).toBe('yolo');
  });

  it('acts on the second press of the same target', () => {
    const { result } = renderHook(() => useConfirm<string>());
    act(() => { result.current.press('yolo'); });
    let acted = false;
    act(() => { acted = result.current.press('yolo'); });
    expect(acted).toBe(true);
  });

  it('disarms itself once it has acted, so a third press arms again', () => {
    // Otherwise the control stays hot and the NEXT click forgets a chronicle
    // with no confirmation at all.
    const { result } = renderHook(() => useConfirm<string>());
    act(() => { result.current.press('reject'); });
    act(() => { result.current.press('reject'); });
    expect(result.current.armed).toBeNull();

    let acted = true;
    act(() => { acted = result.current.press('reject'); });
    expect(acted).toBe(false);
  });

  it('moves the arming when a DIFFERENT target is pressed, and acts on neither', () => {
    // Two rows in the inbox: arming one then clicking the other must not
    // forget the second on a single click.
    const { result } = renderHook(() => useConfirm<string>());
    act(() => { result.current.press('v1:1'); });
    let acted = true;
    act(() => { acted = result.current.press('v1:2'); });
    expect(acted).toBe(false);
    expect(result.current.armed).toBe('v1:2');
  });

  it('cancel disarms without acting', () => {
    const { result } = renderHook(() => useConfirm<string>());
    act(() => { result.current.press('model'); });
    act(() => { result.current.cancel(); });
    expect(result.current.armed).toBeNull();

    let acted = true;
    act(() => { acted = result.current.press('model'); });
    expect(acted).toBe(false);
  });

  it('keeps two independent controls apart within one panel', () => {
    // BrainSection arms "model" and "aux" through the same hook: arming one
    // must never let the other fire on a single press.
    const { result } = renderHook(() => useConfirm<string>());
    act(() => { result.current.press('model'); });
    expect(result.current.armed).toBe('model');
    let acted = true;
    act(() => { acted = result.current.press('aux'); });
    expect(acted).toBe(false);
  });
});
