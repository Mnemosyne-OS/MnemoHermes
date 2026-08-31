/** Wizard step 1 — install detection (doc 80 M5). */
import { useCallback, useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { panel, buttonStyle, StatusDot } from '../ui';
import type { HermesStatus } from '../types';

export function WelcomeStep() {
  const { t } = useI18n();
  const [state, setState] = useState<'loading' | 'installed' | 'missing'>('loading');

  const check = useCallback(async () => {
    setState('loading');
    try {
      const status = await sdk.invoke<HermesStatus>('hermes.status', {});
      setState(status.installed ? 'installed' : 'missing');
    } catch {
      setState('missing');
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>{t('onboarding.welcome.body')}</p>
      <div style={panel}>
        {state === 'loading' && t('common.loading')}
        {state === 'installed' && (
          <span><StatusDot on={true} />{t('onboarding.welcome.detected')}</span>
        )}
        {state === 'missing' && (
          <div style={{ display: 'grid', gap: 10 }}>
            <span><StatusDot on={false} />{t('onboarding.welcome.notInstalled')}</span>
            <button onClick={() => void check()} style={{ ...buttonStyle, justifySelf: 'start' }}>{t('status.retry')}</button>
          </div>
        )}
      </div>
    </div>
  );
}
