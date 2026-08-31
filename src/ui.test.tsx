/**
 * PanelGate is where house rule 11 stopped being something ten panels each had
 * to remember. These assertions are the rule: three states, and the error state
 * tells a host that predates the connector apart from a wired host that failed.
 */
import { render, screen } from '@testing-library/react';
import { PanelGate, CodeBlock, FeedbackNote } from './ui';
import { translate } from './i18n/useI18n';
import type { PanelState } from './hooks/usePanelData';

const loading: PanelState<string> = { kind: 'loading' };
const data: PanelState<string> = { kind: 'data', data: 'the payload' };
const failed: PanelState<string> = { kind: 'error', unavailable: false };
const notWired: PanelState<string> = { kind: 'error', unavailable: true };

describe('PanelGate', () => {
  it('renders a loading line and no body', () => {
    render(<PanelGate<string> state={loading} onRetry={() => undefined}>{(d) => <p>{d}</p>}</PanelGate>);
    expect(screen.queryByText('the payload')).toBeNull();
    expect(document.body.textContent).toContain(translate('common.loading'));
  });

  it('lets a panel name its own wait', () => {
    render(
      <PanelGate<string> state={loading} onRetry={() => undefined} loadingLabel="status.checking">
        {(d) => <p>{d}</p>}
      </PanelGate>,
    );
    expect(document.body.textContent).toContain(translate('status.checking'));
  });

  it('renders the body only with real data', () => {
    render(<PanelGate<string> state={data} onRetry={() => undefined}>{(d) => <p>{d}</p>}</PanelGate>);
    screen.getByText('the payload');
  });

  it('never calls the body for a non-data state', () => {
    // The point of the render prop: a panel body cannot be handed a half-loaded
    // shape, so it needs no guard of its own.
    const body = vi.fn(() => <p>rendered</p>);
    render(<PanelGate<string> state={loading} onRetry={() => undefined}>{body}</PanelGate>);
    render(<PanelGate<string> state={failed} onRetry={() => undefined}>{body}</PanelGate>);
    expect(body).not.toHaveBeenCalled();
  });

  it('says "not wired" for a host that predates the connector', () => {
    render(<PanelGate<string> state={notWired} onRetry={() => undefined}>{(d) => <p>{d}</p>}</PanelGate>);
    expect(document.body.textContent).toContain(translate('status.notWired'));
  });

  it('says "error" for a wired host that failed', () => {
    // Merging the two would tell someone their install is broken when the app
    // is simply older than the feature, and the fix for each is different.
    render(<PanelGate<string> state={failed} onRetry={() => undefined}>{(d) => <p>{d}</p>}</PanelGate>);
    expect(document.body.textContent).toContain(translate('common.error'));
    expect(document.body.textContent).not.toContain(translate('status.notWired'));
  });

  it('offers a retry on both error kinds', () => {
    for (const state of [failed, notWired]) {
      const { unmount } = render(
        <PanelGate<string> state={state} onRetry={() => undefined}>{(d) => <p>{d}</p>}</PanelGate>,
      );
      screen.getByRole('button');
      unmount();
    }
  });
});

describe('CodeBlock', () => {
  it('wraps process output so a long line stays readable', () => {
    render(<CodeBlock>a very long journal line</CodeBlock>);
    const pre = screen.getByText('a very long journal line');
    expect(pre.style.whiteSpace).toBe('pre-wrap');
    expect(pre.style.overflowY).toBe('auto');
  });

  it('keeps a snippet on one line so what is copied is what is shown', () => {
    render(<CodeBlock variant="snippet">hermes skills install x</CodeBlock>);
    const pre = screen.getByText('hermes skills install x');
    expect(pre.style.overflowX).toBe('auto');
    expect(pre.style.whiteSpace).not.toBe('pre-wrap');
  });
});

describe('FeedbackNote', () => {
  it('renders success and failure in different colours', () => {
    render(<><FeedbackNote tone="ok">yes</FeedbackNote><FeedbackNote tone="note">no</FeedbackNote></>);
    expect(screen.getByText('yes').style.color).not.toBe(screen.getByText('no').style.color);
  });
});
