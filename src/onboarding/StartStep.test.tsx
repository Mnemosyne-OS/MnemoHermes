/**
 * The wizard's last screen: what the button will do is on screen before the
 * click, each line turns green as it lands, and "Say hello" opens the chat.
 * The sequence itself is tested in lib/startSequence.test.ts.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from '../i18n/useI18n';

let managed = true;
let proxyEnables = true;

vi.mock('../sdk/instance', () => ({
  sdk: {
    invoke: vi.fn((action: string) => {
      switch (action) {
        case 'hermes.status': return Promise.resolve({ installed: true, managed, gatewayRunning: true, gatewayProcess: { managed: true } });
        case 'hermes.proxySetConfig': return Promise.resolve({ enabled: proxyEnables });
        case 'hermes.skills': return Promise.resolve({ mnemosyneMemoryInstalled: true });
        default: return Promise.resolve({});
      }
    }),
  },
}));

import { StartStep } from './StartStep';

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('StartStep', () => {
  beforeEach(() => { managed = true; proxyEnables = true; });

  it('names the three things before the click, then turns them green and offers the chat', async () => {
    const onDone = vi.fn();
    render(<StartStep onDone={onDone} />);
    await act(flush);
    screen.getByText(translate('onboarding.start.brain'));
    screen.getByText(translate('onboarding.start.memory'));
    screen.getByText(translate('onboarding.start.gateway'));

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: translate('onboarding.start.run') }));
      await flush();
    });
    screen.getByText(translate('onboarding.start.brainOk'));
    screen.getByText(translate('onboarding.start.memoryOk'));
    screen.getByText(translate('onboarding.start.gatewayOk'));

    fireEvent.click(screen.getByRole('button', { name: translate('onboarding.start.openChat') }));
    expect(onDone).toHaveBeenCalledWith(true);
  });

  it('offers the brain box only on a hand install', async () => {
    render(<StartStep onDone={() => undefined} />);
    await act(flush);
    expect(screen.queryByText(translate('onboarding.start.useMnemoBrain'))).toBeNull();
  });

  it('shows the brain box on a hand install', async () => {
    managed = false;
    render(<StartStep onDone={() => undefined} />);
    await act(flush);
    screen.getByText(translate('onboarding.start.useMnemoBrain'));
  });

  it('says a brain that stayed off', async () => {
    proxyEnables = false;
    render(<StartStep onDone={() => undefined} />);
    await act(flush);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: translate('onboarding.start.run') }));
      await flush();
    });
    screen.getByText(translate('onboarding.start.brainFail'));
  });
});
