/**
 * The Channels tab — where the assistant can be reached from a phone.
 *
 * One page, one story: what a channel is, whether Telegram is linked and to
 * whom, the three steps to link it, and a single line for the platforms the
 * app cannot write yet. The census of six "not configured" rows is gone: a
 * list of things you cannot act on reads as a broken page.
 *
 * Telegram is the one channel the cockpit writes (documented variables).
 * QR-paired platforms stay "set up in Hermes".
 */
import { useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useGatewayRestart } from '../hooks/useGatewayRestart';
import { panel, inputStyle, primaryButton, hint, StatusDot, PanelGate, FeedbackNote, sectionTitle, stack, row } from '../ui';
import { RestartGatewayRow } from './RestartGatewayRow';
import type { VoiceRouteView } from '../types';
import {
  errorMessage,
  telegramFeedback,
  TELEGRAM_FEEDBACK_TEXT,
  type TelegramFeedback,
} from '../lib/errorCodes';
import { allowedIdCount } from '../lib/channels';

/** Brand names, not UI strings — the same in every language. */
const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram', discord: 'Discord', slack: 'Slack',
  whatsapp: 'WhatsApp', signal: 'Signal', matrix: 'Matrix',
};

interface ChannelInfo { id: string; configured: boolean; tokenPresent?: boolean; allowedUsers?: string }

/** `telegramOnly`: the wizard's version — the Telegram card alone. The voice
 *  route and the other platforms are settings for later, not first steps. */
export function ChannelsPanel({ telegramOnly = false }: { telegramOnly?: boolean } = {}) {
  const { t } = useI18n();
  const { state, reload } = usePanelData<{ channels: ChannelInfo[] }>(
    () => sdk.invoke<{ channels: ChannelInfo[] }>('hermes.channels', {}),
    /unknown action|not supported|NOT_INSTALLED/i,
  );
  const [token, setToken] = useState('');
  const [allowed, setAllowed] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TelegramFeedback>('idle');
  const [busy, setBusy] = useState(false);
  const { restart, run: restartGateway, reset: resetRestart } = useGatewayRestart();

  // Which voice answers on a channel (doc 123, 2026-09-23). null = not read
  // yet, or a host without the door: the panel then shows the copy alone.
  const [voiceRoute, setVoiceRoute] = useState<VoiceRouteView | null>(null);
  const [voiceFeedback, setVoiceFeedback] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const loadVoiceRoute = () => sdk.invoke<VoiceRouteView>('hermes.voiceRoute', {}).then(setVoiceRoute).catch(() => setVoiceRoute(null));
  useEffect(() => {
    let alive = true;
    void sdk.invoke<VoiceRouteView>('hermes.voiceRoute', {}).then((v) => { if (alive) setVoiceRoute(v); }).catch(() => { if (alive) setVoiceRoute(null); });
    return () => { alive = false; };
  }, []);
  const chooseVoiceRoute = async (route: 'edge' | 'app') => {
    setVoiceFeedback('saving'); setVoiceError(null); resetRestart();
    try {
      await sdk.invoke('hermes.voiceRouteSet', { route, locale: getLang() });
      await loadVoiceRoute();
      setVoiceFeedback('saved');
    } catch (err) {
      setVoiceError(err instanceof Error ? err.message : String(err));
      setVoiceFeedback('failed');
    }
  };

  const saveTelegram = async () => {
    setBusy(true);
    setFeedback('idle');
    try {
      await sdk.invoke('hermes.channelSetTelegram', {
        ...(token.trim() ? { token: token.trim() } : {}),
        ...(allowed !== null ? { allowedUsers: allowed } : {})
      });
      setFeedback('saved');
      resetRestart();
      setToken('');
      setAllowed(null);
      void reload(true);
    } catch (err) {
      setFeedback(telegramFeedback(errorMessage(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(data) => {
        const telegram = data.channels.find((c) => c.id === 'telegram');
        const linked = telegram?.configured === true;
        const idCount = allowedIdCount(telegram?.allowedUsers);
        const allowedValue = allowed ?? telegram?.allowedUsers ?? '';
        const others = data.channels.filter((c) => c.id !== 'telegram');
        const othersLinked = others.filter((c) => c.configured);
        return (
          <div style={stack}>
            <p style={{ ...hint, margin: 0, fontSize: 13 }}>{t('channels.intro')}</p>

            <div style={panel}>
              <div style={{ ...row, gap: 10, marginBottom: 6 }}>
                <h2 style={{ ...sectionTitle, margin: 0 }}>Telegram</h2>
                <span style={{ fontSize: 13 }}>
                  <StatusDot on={linked} />
                  {linked ? t('channels.linked') : t('channels.notLinked')}
                </span>
              </div>
              {/* Who can talk to it is the fact that costs money: an open bot
                  spends the owner's credits for whoever finds it. Said in
                  the colour of the risk, never hidden behind a count. */}
              {linked && (
                <p style={{ margin: '0 0 14px', fontSize: 13, color: idCount > 0 ? 'var(--text-secondary, #aaa)' : 'var(--danger, #d9534f)' }}>
                  {idCount > 0 ? t('channels.allowedCount', { n: idCount }) : t('channels.openToAll')}
                </p>
              )}

              <ol style={{ margin: '0 0 16px', paddingLeft: 20, display: 'grid', gap: 6, fontSize: 13 }}>
                <li>{t('channels.step1')}</li>
                <li>{t('channels.step2')}</li>
                <li>{t('channels.step3')}</li>
              </ol>

              <div style={{ display: 'grid', gap: 14, fontSize: 13, maxWidth: 480 }}>
                <label style={{ display: 'grid', gap: 6 }}>
                  {t('channels.tokenLabel')}
                  <input
                    type="password"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    placeholder={telegram?.tokenPresent ? '••••••••••' : '123456789:AA…'}
                    style={inputStyle}
                  />
                  {telegram?.tokenPresent && <span style={hint}>{t('channels.tokenKept')}</span>}
                </label>
                <label style={{ display: 'grid', gap: 6 }}>
                  {t('channels.allowedLabel')}
                  <input
                    value={allowedValue}
                    onChange={(e) => setAllowed(e.target.value)}
                    placeholder="123456789, 987654321"
                    style={inputStyle}
                  />
                  <span style={hint}>{t('channels.allowedHint')}</span>
                </label>
                <div style={row}>
                  <button
                    onClick={() => void saveTelegram()}
                    disabled={busy || (!token.trim() && allowed === null)}
                    style={primaryButton}
                  >
                    {t('settings.save')}
                  </button>
                  {feedback !== 'idle' && (
                    <FeedbackNote tone={feedback === 'saved' ? 'ok' : 'note'}>
                      {t(TELEGRAM_FEEDBACK_TEXT[feedback])}
                    </FeedbackNote>
                  )}
                </div>
                {feedback === 'saved' && <RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} />}
              </div>
            </div>

            {!telegramOnly && (<>
            <div style={panel}>
              <h2 style={{ ...sectionTitle, marginBottom: 6 }}>{t('channels.voiceHeading')}</h2>
              <p style={{ ...hint, margin: 0 }}>{t('channels.voiceHint')}</p>
              {voiceRoute && voiceRoute.route === 'other' && (
                <p style={{ ...hint, margin: '8px 0 0' }}>{t('channels.voiceRouteOther')}</p>
              )}
              {voiceRoute && voiceRoute.route !== 'other' && (
                <div style={{ ...stack, gap: 8, marginTop: 10 }}>
                  <label style={{ ...row, gap: 8, alignItems: 'flex-start', opacity: voiceRoute.appAvailable ? 1 : 0.6 }}>
                    <input type="radio" name="voice-route" checked={voiceRoute.route === 'app'} disabled={!voiceRoute.appAvailable || voiceFeedback === 'saving'} onChange={() => void chooseVoiceRoute('app')} />
                    <span>
                      {t('channels.voiceRouteApp')}
                      {voiceRoute.chosen && <span style={hint}> · {t('channels.voiceRouteChosen', { chosen: voiceRoute.chosen })}</span>}
                      {!voiceRoute.appAvailable && voiceRoute.reason && (
                        <span style={{ ...hint, display: 'block' }}>{t(`channels.voiceRouteReason_${voiceRoute.reason}`)}</span>
                      )}
                    </span>
                  </label>
                  <label style={{ ...row, gap: 8, alignItems: 'flex-start' }}>
                    <input type="radio" name="voice-route" checked={voiceRoute.route !== 'app'} disabled={voiceFeedback === 'saving'} onChange={() => void chooseVoiceRoute('edge')} />
                    <span>{t('channels.voiceRouteEdge')}<span style={{ ...hint, display: 'block' }}>{t('channels.voicePrivacy')}</span></span>
                  </label>
                  {voiceFeedback === 'saved' && <FeedbackNote tone="ok">{t('channels.voiceRouteSaved')}</FeedbackNote>}
                  {voiceFeedback === 'failed' && <FeedbackNote tone="note">{voiceError}</FeedbackNote>}
                  {voiceFeedback === 'saved' && <RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} />}
                </div>
              )}
              {!voiceRoute && <p style={{ ...hint, margin: '8px 0 0' }}>{t('channels.voicePrivacy')}</p>}
            </div>

            <div style={panel}>
              <h2 style={{ ...sectionTitle, marginBottom: 6 }}>{t('channels.othersHeading')}</h2>
              <p style={{ ...hint, margin: 0 }}>
                {others.map((c) => CHANNEL_LABELS[c.id] ?? c.id).join(', ')}. {t('channels.othersHint')}
              </p>
              {/* A platform someone linked by hand IS linked: the census is
                  still read, it just no longer prints five grey "no"s. */}
              {othersLinked.length > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: 13 }}>
                  {othersLinked.map((c) => (
                    <span key={c.id} style={{ marginRight: 14 }}>
                      <StatusDot on />{CHANNEL_LABELS[c.id] ?? c.id}
                    </span>
                  ))}
                </p>
              )}
            </div>
            </>)}
          </div>
        );
      }}
    </PanelGate>
  );
}
