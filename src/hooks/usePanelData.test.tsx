import { act, renderHook, waitFor } from '@testing-library/react';
import { usePanelData, HOST_UNAVAILABLE_RE } from './usePanelData';

describe('HOST_UNAVAILABLE_RE', () => {
  it('recognises how an older host refuses an action it does not know', () => {
    expect(HOST_UNAVAILABLE_RE.test('Unknown action: hermes.status')).toBe(true);
    expect(HOST_UNAVAILABLE_RE.test('action not supported')).toBe(true);
  });

  it('does not swallow a real failure', () => {
    // Reading a wired host's crash as "your app is too old" sends someone to
    // update software that is already current.
    expect(HOST_UNAVAILABLE_RE.test('GATEWAY_NOT_RUNNING')).toBe(false);
    expect(HOST_UNAVAILABLE_RE.test('ECONNREFUSED')).toBe(false);
  });
});

describe('usePanelData', () => {
  it('loads on mount and lands on data', async () => {
    const { result } = renderHook(() => usePanelData(() => Promise.resolve('payload')));
    expect(result.current.state.kind).toBe('loading');
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'data', data: 'payload' }));
  });

  it('flags a host that predates the connector', async () => {
    const { result } = renderHook(() => usePanelData(() => Promise.reject(new Error('unknown action'))));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'error', unavailable: true }));
  });

  it('flags a wired host that failed as a plain error', async () => {
    const { result } = renderHook(() => usePanelData(() => Promise.reject(new Error('CONFIG_NOT_FOUND'))));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'error', unavailable: false }));
  });

  it('honours the panel-specific idea of "not wired"', async () => {
    const { result } = renderHook(
      () => usePanelData(() => Promise.reject(new Error('NOT_INSTALLED')), /NOT_INSTALLED/),
    );
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'error', unavailable: true }));
  });

  it('classifies a rejection that is not an Error at all', async () => {
    const { result } = renderHook(() => usePanelData(() => Promise.reject('unknown action')));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'error', unavailable: true }));
  });

  it('loads exactly once on mount', async () => {
    // `reload` is memoised with an empty dep list and reads the loader through a
    // ref, so an inline closure passed by a panel does not re-fire the effect on
    // every render. A regression here means four probes per keystroke.
    const load = vi.fn(() => Promise.resolve('x'));
    const { result, rerender } = renderHook(() => usePanelData(load));
    await waitFor(() => expect(result.current.state.kind).toBe('data'));
    rerender();
    rerender();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('shows the loading state on a normal reload', async () => {
    const { result } = renderHook(() => usePanelData(() => Promise.resolve('x')));
    await waitFor(() => expect(result.current.state.kind).toBe('data'));
    // Hold the promise so the assertion sees the loading state, then let it
    // settle INSIDE act: a suite that warns on its first run is a bad template.
    let settling!: Promise<void>;
    act(() => { settling = result.current.reload(); });
    expect(result.current.state.kind).toBe('loading');
    await act(async () => { await settling; });
  });

  it('keeps the old data visible on a SILENT reload', async () => {
    // The auto-refresh uses this: flashing "Loading…" every 30 seconds would
    // make a working panel look like it keeps breaking.
    const { result } = renderHook(() => usePanelData(() => Promise.resolve('x')));
    await waitFor(() => expect(result.current.state.kind).toBe('data'));
    let settling!: Promise<void>;
    act(() => { settling = result.current.reload(true); });
    expect(result.current.state).toEqual({ kind: 'data', data: 'x' });
    await act(async () => { await settling; });
  });

  it('reads the LATEST loader, not the one captured at mount', async () => {
    // Panels pass an inline closure that can close over changed props.
    let answer = 'first';
    const { result, rerender } = renderHook(() => usePanelData(() => Promise.resolve(answer)));
    await waitFor(() => expect(result.current.state).toEqual({ kind: 'data', data: 'first' }));
    answer = 'second';
    rerender();
    await act(async () => { await result.current.reload(true); });
    expect(result.current.state).toEqual({ kind: 'data', data: 'second' });
  });

  it('recovers to data after an error', async () => {
    let fail = true;
    const { result } = renderHook(() => usePanelData(
      () => (fail ? Promise.reject(new Error('boom')) : Promise.resolve('ok')),
    ));
    await waitFor(() => expect(result.current.state.kind).toBe('error'));
    fail = false;
    await act(async () => { await result.current.reload(); });
    expect(result.current.state).toEqual({ kind: 'data', data: 'ok' });
  });
});
