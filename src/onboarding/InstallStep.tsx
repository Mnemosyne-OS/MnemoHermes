/**
 * Wizard step 1 — get Hermes on the machine.
 *
 * Rework 2026-09-25 (Tony: "la première install est merdique"): one question
 * per screen. Either Hermes is here (a green line, Next) or it is not (one
 * button, what it downloads, how big, then a progress line). The installer's
 * raw output stays one click away instead of filling the screen, and Next is
 * held until Hermes is installed: every later step writes into Hermes, so
 * reaching them without it was a row of errors.
 */
import { useCallback, useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { panel, buttonStyle, StatusDot, hint } from '../ui';
import { ManagedInstallCard } from '../panels/ManagedInstallCard';
import type { HermesStatus } from '../types';

type State =
  | { kind: 'loading' }
  | { kind: 'installed'; status: HermesStatus }
  | { kind: 'missing'; status: HermesStatus }
  | { kind: 'noHost' };

export function InstallStep({ onReady }: { onReady: (installed: boolean) => void }) {
  const { t } = useI18n();
  const [state, setState] = useState<State>({ kind: 'loading' });

  const check = useCallback(async () => {
    try {
      const status = await sdk.invoke<HermesStatus>('hermes.status', {});
      setState(status.installed ? { kind: 'installed', status } : { kind: 'missing', status });
    } catch (err) {
      // No connector on this host: nothing to install THROUGH, only to retry.
      console.warn('[onboarding] hermes.status failed:', err);
      setState({ kind: 'noHost' });
    }
  }, []);

  useEffect(() => { void check(); }, [check]);
  useEffect(() => { onReady(state.kind === 'installed'); }, [state.kind, onReady]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>{t('onboarding.install.body')}</p>
      <div style={panel}>
        {state.kind === 'loading' && t('common.loading')}
        {state.kind === 'installed' && (
          <span style={{ fontSize: 13 }}>
            <StatusDot on />
            {state.status.managed ? t('onboarding.install.readyManaged') : t('onboarding.install.readyOwn')}
          </span>
        )}
        {state.kind === 'missing' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontSize: 13 }}><StatusDot on={false} />{t('onboarding.install.missing')}</span>
            <ManagedInstallCard status={state.status} onSettled={() => void check()} />
          </div>
        )}
        {state.kind === 'noHost' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <span style={{ fontSize: 13 }}><StatusDot on={false} />{t('onboarding.install.noHost')}</span>
            <button onClick={() => void check()} style={{ ...buttonStyle, justifySelf: 'start' }}>{t('status.retry')}</button>
          </div>
        )}
      </div>
      {state.kind !== 'installed' && state.kind !== 'loading' && (
        <span style={hint}>{t('onboarding.install.needed')}</span>
      )}
    </div>
  );
}
