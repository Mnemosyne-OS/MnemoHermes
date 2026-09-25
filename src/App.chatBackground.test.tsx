/**
 * Field report 2026-09-25: a person asked Hermes a question, opened Status to
 * see whether the gateway was alive, and the question was cancelled — the Chat
 * panel unmounted on the tab switch and its unmount aborted the stream. Four
 * questions lost that way in fifteen minutes. The reply must run on while
 * another tab is open, and be there on return.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from './i18n/useI18n';

type StreamOpts = { signal?: AbortSignal; onChunk?: (t: string) => void };
const streams: Array<{ opts: StreamOpts; resolve: (v: unknown) => void }> = [];

vi.mock('./sdk/instance', () => ({
  sdk: {
    invoke: vi.fn((action: string) => action === 'state.get'
      ? Promise.resolve({ state: { onboardingDone: true } })
      : Promise.reject(new Error(`not in this test: ${action}`))),
    stream: vi.fn((_action: string, _payload: unknown, opts: StreamOpts) =>
      new Promise((resolve) => { streams.push({ opts, resolve }); })),
  },
}));

import App from './App';

const tabButton = (key: string) => screen.getByRole('button', { name: new RegExp(`^${translate(key)}`) });

describe('a chat reply across a tab switch', () => {
  beforeEach(() => { streams.length = 0; });

  it('keeps streaming while another tab is open, and shows on return', async () => {
    render(<App />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(await screen.findByRole('button', { name: translate('tabs.chat') }));

    const input = await screen.findByPlaceholderText(translate('chat.placeholder'));
    fireEvent.change(input, { target: { value: 'what is in my notes?' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => { await Promise.resolve(); });
    expect(streams).toHaveLength(1);

    fireEvent.click(tabButton('tabs.status'));
    const { opts, resolve } = streams[0];
    expect(opts.signal?.aborted).toBe(false);
    // The tab says a reply is still coming.
    expect(screen.getByLabelText(translate('tabs.chatBusy'))).toBeTruthy();

    await act(async () => {
      opts.onChunk?.('Your notes talk about bees.');
      resolve({ text: 'Your notes talk about bees.' });
      await Promise.resolve();
    });
    expect(opts.signal?.aborted).toBe(false);
    expect(screen.queryByLabelText(translate('tabs.chatBusy'))).toBeNull();

    fireEvent.click(tabButton('tabs.chat'));
    screen.getByText('Your notes talk about bees.');
    expect(document.body.textContent).not.toContain(translate('chat.stopped'));
  });

  it('still aborts when the window itself goes away', async () => {
    const { unmount } = render(<App />);
    await act(async () => { await Promise.resolve(); });
    fireEvent.click(await screen.findByRole('button', { name: translate('tabs.chat') }));
    const input = await screen.findByPlaceholderText(translate('chat.placeholder'));
    fireEvent.change(input, { target: { value: 'hello' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await act(async () => { await Promise.resolve(); });
    unmount();
    expect(streams[0].opts.signal?.aborted).toBe(true);
  });
});
