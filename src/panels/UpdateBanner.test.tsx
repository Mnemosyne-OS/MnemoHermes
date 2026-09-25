import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from '../i18n/useI18n';

let published = '{"version":"99.0.0"}';
let fails = false;
const urls: unknown[] = [];

vi.mock('../sdk/instance', () => ({
  sdk: {
    invoke: vi.fn((action: string, payload?: { url?: string }) => {
      if (action !== 'social.fetch') return Promise.reject(new Error(action));
      urls.push(payload?.url);
      return fails ? Promise.reject(new Error('offline')) : Promise.resolve({ body: published, encoding: 'utf8' });
    }),
  },
}));

import { UpdateBanner, CURRENT_VERSION } from './UpdateBanner';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const line = () => translate('update.available', { latest: '99.0.0', current: CURRENT_VERSION });

describe('UpdateBanner', () => {
  beforeEach(() => { published = '{"version":"99.0.0"}'; fails = false; urls.length = 0; localStorage.clear(); });

  it('reads the published manifest and names both versions', async () => {
    render(<UpdateBanner />);
    await act(flush);
    expect(urls).toEqual(['https://raw.githubusercontent.com/Mnemosyne-OS/MnemoHermes/main/mnemo-plugin.json']);
    screen.getByText(line());
    screen.getByText(translate('update.how'));
  });

  it('says nothing when the published version is the one running', async () => {
    published = JSON.stringify({ version: CURRENT_VERSION });
    const { container } = render(<UpdateBanner />);
    await act(flush);
    expect(container.textContent).toBe('');
  });

  it('says nothing when it could not ask', async () => {
    fails = true;
    const { container } = render(<UpdateBanner />);
    await act(flush);
    expect(container.textContent).toBe('');
  });

  it('hides a dismissed version, and speaks again for the next one', async () => {
    const first = render(<UpdateBanner />);
    await act(flush);
    fireEvent.click(screen.getByRole('button', { name: translate('update.dismiss') }));
    expect(screen.queryByText(line())).toBeNull();
    first.unmount();

    render(<UpdateBanner />);
    await act(flush);
    expect(screen.queryByText(line())).toBeNull();

    published = '{"version":"99.0.1"}';
    render(<UpdateBanner />);
    await act(flush);
    screen.getByText(translate('update.available', { latest: '99.0.1', current: CURRENT_VERSION }));
  });
});
