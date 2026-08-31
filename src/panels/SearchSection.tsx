/**
 * Web search routing — the OS's third engine served to the agent (after
 * the brain and the auxiliaries): Mnemosyne's own SearXNG, keyless and
 * local. The engine lives in DOCKER, so the section's whole job is to
 * name the exact obstacle: "launch Docker" is a different sentence from
 * "install Docker", "set it up in Mnemosyne first" or "wait, booting".
 * The code-to-sentence table lives in lib/errorCodes.
 */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { panel, buttonStyle, primaryButton, hint, StatusDot, PanelGate, FeedbackNote, sectionTitle, row } from '../ui';
import {
  errorMessage,
  searchFeedback,
  SEARCH_FEEDBACK_TEXT,
  type SearchFeedback,
} from '../lib/errorCodes';

interface SearchStatus {
  answering: boolean;
  routed: boolean;
}

export function SearchSection() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<SearchStatus>(
    () => sdk.invoke<SearchStatus>('hermes.searchStatus', {}),
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<SearchFeedback>('idle');
  const confirm = useConfirm<'route'>();

  const apply = async () => {
    // Rerouting the agent's web search is a config write: arm, then act.
    if (!confirm.press('route')) return;
    setBusy(true);
    setFeedback('idle');
    try {
      await sdk.invoke('hermes.searchApply', {});
      setFeedback('done');
      void reload(true);
    } catch (err) {
      setFeedback(searchFeedback(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {({ answering, routed }) => (
        <div style={panel}>
          <h2 style={{ ...sectionTitle, margin: '0 0 6px' }}>{t('search.heading')}</h2>
          <p style={{ ...hint, margin: '0 0 14px' }}>{t('search.intro')}</p>

          <div style={{ display: 'grid', gap: 12, fontSize: 13, maxWidth: 520 }}>
            <span>
              <StatusDot on={answering} />
              {answering ? t('search.engineUp') : t('search.engineDown')}
              {routed && (
                <span style={{ marginLeft: 8, color: 'var(--accent, #35c9a6)', fontSize: 12 }}>
                  {t('search.alreadyRouted')}
                </span>
              )}
            </span>

            <div style={row}>
              <button
                onClick={() => void apply()}
                disabled={busy}
                style={routed ? buttonStyle : primaryButton}
              >
                {confirm.armed === 'route' ? t('brain.applyConfirm') : t('search.route')}
              </button>
              {feedback !== 'idle' && feedback !== 'confirm' && (
                <FeedbackNote tone={feedback === 'done' ? 'ok' : 'note'}>
                  {t(SEARCH_FEEDBACK_TEXT[feedback])}
                </FeedbackNote>
              )}
            </div>

            <span style={hint}>{t('search.searchOnly')}</span>
          </div>
        </div>
      )}
    </PanelGate>
  );
}
