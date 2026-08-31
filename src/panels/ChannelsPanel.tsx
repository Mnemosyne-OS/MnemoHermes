/**
 * The Channels tab — messaging-platform census (host-side .env prefix
 * heuristic) and the Telegram form, the one channel the cockpit can write
 * (documented variables). QR-paired platforms stay "manage in Hermes".
 */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { panel, inputStyle, buttonStyle, hint, StatusDot, PanelGate, FeedbackNote, sectionTitle, cardTitle, stack, row } from '../ui';
import {
  errorMessage,
  telegramFeedback,
  TELEGRAM_FEEDBACK_TEXT,
  type TelegramFeedback,
} from '../lib/errorCodes';

/** Brand names, not UI strings — the same in every language. */
const CHANNEL_LABELS: Record<string, string> = {
  telegram: 'Telegram', discord: 'Discord', slack: 'Slack',
  whatsapp: 'WhatsApp', signal: 'Signal', matrix: 'Matrix',
};

interface ChannelInfo { id: string; configured: boolean; tokenPresent?: boolean; allowedUsers?: string }

export function ChannelsPanel() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<{ channels: ChannelInfo[] }>(
    () => sdk.invoke<{ channels: ChannelInfo[] }>('hermes.channels', {}),
    /unknown action|not supported|NOT_INSTALLED/i,
  );
  const [token, setToken] = useState('');
  const [allowed, setAllowed] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<TelegramFeedback>('idle');
  const [busy, setBusy] = useState(false);

  const saveTelegram = async () => {
    setBusy(true);
    setFeedback('idle');
    try {
      await sdk.invoke('hermes.channelSetTelegram', {
        ...(token.trim() ? { token: token.trim() } : {}),
        ...(allowed !== null ? { allowedUsers: allowed } : {})
      });
      setFeedback('saved');
      setToken('');
      setAllowed(null);
      void reload();
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
        const allowedValue = allowed ?? telegram?.allowedUsers ?? '';
        return (
          <div style={stack}>
            <div style={panel}>
              <h2 style={sectionTitle}>{t('channels.heading')}</h2>
              <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
                {data.channels.map((c) => (
                  <div key={c.id}>
                    <StatusDot on={c.configured} />
                    {CHANNEL_LABELS[c.id] ?? c.id}{' '}
                    <span style={{ color: 'var(--text-muted, #666)' }}>
                      {c.configured ? t('channels.configured') : t('channels.notConfigured')}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ ...hint, margin: '12px 0 0' }}>{t('channels.othersHint')}</p>
            </div>

            <div style={panel}>
              <h2 style={{ ...cardTitle, marginBottom: 12 }}>{t('channels.telegramHeading')}</h2>
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
                  <span style={hint}>{t('channels.tokenHint')}</span>
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
                    style={buttonStyle}
                  >
                    {t('settings.save')}
                  </button>
                  {feedback !== 'idle' && (
                    <FeedbackNote tone={feedback === 'saved' ? 'ok' : 'note'}>
                      {t(TELEGRAM_FEEDBACK_TEXT[feedback])}
                    </FeedbackNote>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </PanelGate>
  );
}
