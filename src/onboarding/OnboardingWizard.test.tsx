/**
 * The wizard's frame: five steps, Next held on the install step until Hermes
 * is there (every later step writes into it), and no "brain" step any more.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from '../i18n/useI18n';

let installed = false;

vi.mock('../sdk/instance', () => ({
  sdk: {
    invoke: vi.fn((action: string) => {
      if (action === 'hermes.status') return Promise.resolve({ installed, managed: true, gatewayRunning: false, gatewayProcess: { managed: false } });
      if (action === 'hermes.managedInstallStatus') return Promise.resolve({ running: false, stage: null, pct: null, startedAt: null, finishedAt: null, error: null, cancelled: false, output: [], installed: null, pin: { version: '0.21.4', bytes: 74685046 } });
      return Promise.reject(new Error(`not in this test: ${action}`));
    }),
    inferModel: vi.fn(),
  },
}));

import { OnboardingWizard, ONBOARDING_STEPS } from './OnboardingWizard';

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
const next = () => screen.getByRole('button', { name: translate('onboarding.next') });

describe('OnboardingWizard', () => {
  beforeEach(() => { installed = false; });

  it('has five steps and no brain step', () => {
    expect(ONBOARDING_STEPS).toEqual(['install', 'posture', 'profile', 'channel', 'start']);
  });

  it('holds Next while Hermes is not installed', async () => {
    render(<OnboardingWizard onDone={() => undefined} />);
    await act(flush);
    screen.getByText(translate('onboarding.install.missing'));
    expect((next() as HTMLButtonElement).disabled).toBe(true);
  });

  it('lets Next through once Hermes is installed', async () => {
    installed = true;
    render(<OnboardingWizard onDone={() => undefined} />);
    await act(flush);
    screen.getByText(translate('onboarding.install.readyManaged'));
    expect((next() as HTMLButtonElement).disabled).toBe(false);
    await act(async () => { fireEvent.click(next()); await flush(); });
    screen.getByText(translate('onboarding.posture.heading'));
    screen.getByText(new RegExp(translate('onboarding.optional')));
  });

  it('"Set up later" leaves without opening the chat', async () => {
    const onDone = vi.fn();
    render(<OnboardingWizard onDone={onDone} />);
    await act(flush);
    fireEvent.click(screen.getByRole('button', { name: translate('onboarding.skipAll') }));
    expect(onDone).toHaveBeenCalledWith(false);
  });
});
