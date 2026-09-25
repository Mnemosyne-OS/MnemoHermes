/**
 * The line under the header that says a newer MnemoHermes is published, and
 * how to get it (lib/updateCheck). Asked when the window opens, then every
 * six hours while it stays open. Closing it hides THAT version only: the next
 * one speaks again.
 */
import { useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { buttonStyle, hint } from '../ui';
import { checkForUpdate, REMOTE_MANIFEST_URL, REPO_URL, type UpdateCheck } from '../lib/updateCheck';
import manifest from '../../mnemo-plugin.json';

export const CURRENT_VERSION: string = manifest.version;
const RECHECK_MS = 6 * 60 * 60 * 1000;
const DISMISS_KEY = 'mnemohermes.updateDismissed';

function readDismissed(): string | null {
  try { return localStorage.getItem(DISMISS_KEY); } catch { return null; }
}

export function UpdateBanner() {
  const { t } = useI18n();
  const [check, setCheck] = useState<UpdateCheck>({ kind: 'unknown' });
  const [dismissed, setDismissed] = useState<string | null>(readDismissed);

  useEffect(() => {
    let alive = true;
    const run = async () => {
      const res = await checkForUpdate(
        () => sdk.invoke<{ body?: unknown; encoding?: unknown }>('social.fetch', { url: REMOTE_MANIFEST_URL }),
        CURRENT_VERSION,
      );
      if (alive) setCheck(res);
    };
    void run();
    const id = setInterval(() => { void run(); }, RECHECK_MS);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (check.kind !== 'newer' || dismissed === check.latest) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, check.latest); } catch (err) {
      // Not remembered: it hides for this window only and speaks again next time.
      console.warn('[update-check] dismissal not saved:', err);
    }
    setDismissed(check.latest);
  };

  return (
    <div role="status" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', marginBottom: 12, border: '1px solid var(--accent, #35c9a6)', borderRadius: 6, fontSize: 13 }}>
      <div style={{ flex: 1, display: 'grid', gap: 4 }}>
        <strong>{t('update.available', { latest: check.latest, current: CURRENT_VERSION })}</strong>
        <span style={hint}>{t('update.how')}</span>
        <code style={{ fontSize: 11, userSelect: 'all' }}>{REPO_URL}</code>
      </div>
      <button onClick={dismiss} aria-label={t('update.dismiss')} title={t('update.dismiss')} style={{ ...buttonStyle, padding: '2px 8px' }}>×</button>
    </div>
  );
}
