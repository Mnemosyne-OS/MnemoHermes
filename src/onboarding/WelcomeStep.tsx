/** Wizard step 1 — install detection (doc 80 M5), and since doc 123 lot 0
 *  the install itself: a fresh machine sees this screen first, so the one
 *  button every user gets lives here as much as in the Status tab. */
import { useCallback, useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { panel, buttonStyle, StatusDot } from '../ui';
import { ManagedInstallCard } from '../panels/ManagedInstallCard';
import type { HermesStatus } from '../types';

type State = { kind: 'loading' } | { kind: 'installed'; status: HermesStatus } | { kind: 'missing'; status: HermesStatus | null };

export function WelcomeStep() {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const check = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const status = await sdk.invoke<HermesStatus>('hermes.status', {});
      setState(status.installed ? { kind: 'installed', status } : { kind: 'missing', status });
    } catch {
      // The host has no connector: nothing to install THROUGH, only to retry.
      setState({ kind: 'missing', status: null });
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>{t('onboarding.welcome.body')}</p>
      <div style={panel}>
        {state.kind === 'loading' && t('common.loading')}
        {state.kind === 'installed' && (
          <span><StatusDot on={true} />{t('onboarding.welcome.detected')}</span>
        )}
        {state.kind === 'missing' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <span><StatusDot on={false} />{t('onboarding.welcome.notInstalled')}</span>
            {state.status && <ManagedInstallCard status={state.status} onSettled={() => void check()} />}
            <button onClick={() => void check()} style={{ ...buttonStyle, justifySelf: 'start' }}>{t('status.retry')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
