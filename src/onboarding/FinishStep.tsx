/** Wizard last step — start the gateway, then hand back to the cockpit. */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { panel, buttonStyle } from '../ui';
import type { HermesStatus } from '../types';

export function FinishStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [gw, setGw] = useState<'idle' | 'starting' | 'up' | 'error'>('idle');

  const start = async () => {
    setGw('starting');
    try {
      try {
        await sdk.invoke('hermes.gatewayStart', { locale: getLang() });
      } catch (err) {
        // A gateway already answering is a success, not a failure.
        if (!(err instanceof Error && err.message.includes('ALREADY_RUNNING'))) throw err;
      }
      await new Promise((r) => setTimeout(r, 4000));
      const status = await sdk.invoke<HermesStatus>('hermes.status', {});
      setGw(status.gatewayRunning ? 'up' : 'error');
    } catch {
      setGw('error');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>{t('onboarding.finish.body')}</p>
      <div style={{ ...panel, display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        {gw !== 'up' && (
          <button
            onClick={() => void start()}
            disabled={gw === 'starting'}
            style={{ ...buttonStyle, borderColor: 'var(--accent, #35c9a6)' }}
          >
            {gw === 'starting' ? t('status.gatewayStarting') : t('status.gatewayStart')}
          </button>
        )}
        {gw === 'up' && (
          <span style={{ color: 'var(--accent, #35c9a6)', fontSize: 13 }}>{t('onboarding.finish.started')}</span>
        )}
        {gw === 'error' && (
          <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{t('chat.errNotRunning')}</span>
        )}
      </div>
      <button onClick={onDone} style={{ ...buttonStyle, borderColor: 'var(--accent, #35c9a6)', justifySelf: 'start' }}>
        {t('onboarding.finishButton')}
      </button>
    </div>
  );
}
