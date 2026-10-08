/**
 * Data connectors — what the agent can fetch from the web beyond a search
 * (2026-10-01: Apify, Google Maps places and the content of a website).
 *
 * The person links THEIR Apify account: their key, their terms, their bill,
 * and the copy says so before the field. The host writes the key into the
 * install's .env and the hosted server into config.yaml; this panel never
 * sees the key again, only "linked or not".
 */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { useGatewayRestart } from '../hooks/useGatewayRestart';
import { panel, inputStyle, primaryButton, buttonStyle, hint, StatusDot, PanelGate, FeedbackNote, sectionTitle, row } from '../ui';
import { RestartGatewayRow } from './RestartGatewayRow';
import { apifyFeedback, APIFY_FEEDBACK_TEXT, errorMessage, type ApifyFeedback } from '../lib/errorCodes';

interface ApifyStatus { tokenPresent: boolean; serverPresent: boolean; serverHosted: boolean; skillPresent?: boolean }

export function ConnectorsSection() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<{ apify: ApifyStatus }>(
    () => sdk.invoke<{ apify: ApifyStatus }>('hermes.connectors', {}),
    /unknown action|not supported|NOT_INSTALLED/i,
  );
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<ApifyFeedback>('idle');
  const confirm = useConfirm<'unlink'>();
  const { restart, run: restartGateway, reset: resetRestart } = useGatewayRestart();

  const write = async (token: string | null) => {
    setBusy(true);
    setFeedback('idle');
    resetRestart();
    try {
      await sdk.invoke('hermes.connectorSetApify', { token });
      setFeedback(token === null ? 'unlinked' : 'saved');
      setKey('');
      void reload(true);
    } catch (err) {
      setFeedback(apifyFeedback(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  };

  const unlink = () => {
    // Removing a key the person may not have elsewhere: arm, then act.
    if (!confirm.press('unlink')) return;
    void write(null);
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {({ apify }) => {
        const linked = apify.tokenPresent && apify.serverHosted;
        return (
          <div style={panel}>
            <div style={{ ...row, gap: 10, marginBottom: 6 }}>
              <h2 style={{ ...sectionTitle, margin: 0 }}>{t('connectors.heading')}</h2>
              <span style={{ fontSize: 13 }}>
                <StatusDot on={linked} />
                {linked ? t('connectors.linked') : t('connectors.notLinked')}
              </span>
            </div>
            <p style={{ ...hint, margin: '0 0 8px' }}>{t('connectors.intro')}</p>
            <p style={{ ...hint, margin: '0 0 14px' }}>{t('connectors.billing')}</p>

            {apify.serverPresent && !apify.serverHosted && (
              <p style={{ ...hint, margin: '0 0 14px' }}>{t('connectors.handMade')}</p>
            )}

            {!linked && (
              <ol style={{ margin: '0 0 16px', paddingLeft: 20, display: 'grid', gap: 6, fontSize: 13 }}>
                <li>{t('connectors.step1')}</li>
                <li>{t('connectors.step2')}</li>
                <li>{t('connectors.step3')}</li>
              </ol>
            )}

            <div style={{ display: 'grid', gap: 14, fontSize: 13, maxWidth: 480 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                {linked ? t('connectors.replaceLabel') : t('connectors.keyLabel')}
                <input
                  type="password"
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  placeholder="apify_api_…"
                  autoComplete="off"
                  spellCheck={false}
                  style={inputStyle}
                />
              </label>

              <div style={row}>
                <button
                  onClick={() => void write(key.trim())}
                  disabled={busy || !key.trim()}
                  style={primaryButton}
                >
                  {linked ? t('connectors.replace') : t('connectors.link')}
                </button>
                {(apify.tokenPresent || apify.serverPresent) && (
                  <button onClick={unlink} disabled={busy} style={buttonStyle}>
                    {confirm.armed === 'unlink' ? t('connectors.unlinkConfirm') : t('connectors.unlink')}
                  </button>
                )}
                {feedback !== 'idle' && (
                  <FeedbackNote tone={feedback === 'saved' || feedback === 'unlinked' ? 'ok' : 'note'}>
                    {t(APIFY_FEEDBACK_TEXT[feedback])}
                  </FeedbackNote>
                )}
              </div>

              {(feedback === 'saved' || feedback === 'unlinked') && (
                <RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} />
              )}

              <span style={hint}>{t('connectors.tools')}</span>
              {/* The skill is what makes Hermes pick Apify over its own
                  OpenStreetMap skill (doc 123 §11.5). An older host does not
                  report it: then nothing is said. */}
              {linked && apify.skillPresent === true && <span style={hint}>{t('connectors.skill')}</span>}
              {linked && apify.skillPresent === false && <span style={hint}>{t('connectors.skillMissing')}</span>}
            </div>
          </div>
        );
      }}
    </PanelGate>
  );
}
