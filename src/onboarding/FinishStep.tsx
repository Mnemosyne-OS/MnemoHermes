/** Wizard last step — start the gateway, then hand back to the cockpit. */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { panel, buttonStyle } from '../ui';
import type { HermesStatus } from '../types';
import { waitUntil, GATEWAY_BOOT_MS } from '../hooks/useGatewayRestart';

export function FinishStep({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [gw, setGw] = useState<'idle' | 'starting' | 'up' | 'error'>('idle');

  const start = async () => {
    setGw('starting');
    try {
      try {
        await sdk.invoke('hermes.gatewayStart', { locale: getLang() });
      } catch (err) {
        // A gateway already answering, or one this app already spawned and
        // that is still booting, is not a failure. Field report 2026-09-25:
        // a fixed 4 s wait called a 10-20 s boot "not running", put the
        // button back, and the second click came back ALREADY_MANAGED.
        const msg = err instanceof Error ? err.message : '';
        if (!msg.includes('ALREADY_RUNNING') && !msg.includes('ALREADY_MANAGED')) throw err;
      }
      const up = await waitUntil(async () => {
        const status = await sdk.invoke<HermesStatus>('hermes.status', {});
        return status.gatewayRunning === true;
      }, GATEWAY_BOOT_MS, 1000);
      setGw(up ? 'up' : 'error');
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
