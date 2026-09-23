/**
 * The Agents tab — the agent army (multi-profile). Census, creation via
 * `hermes profile create`, per-profile Telegram token, per-profile gateway.
 * BotFather stays a human flow: the cockpit guides and takes the token.
 */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { panel, inputStyle, buttonStyle, primaryButton, hint, Pill, StatusDot, PanelGate, FeedbackNote, cardTitle, stack, row } from '../ui';
import { isValidProfileName, normalizeProfileName } from '../lib/hermesConfig';

interface AgentProfileInfo {
  name: string;
  telegramTokenPresent: boolean;
  apiServerPort: number | null;
  gatewayManaged: boolean;
  lastLine: string | null;
}

/** How long a freshly started gateway is given to bind before we re-read. */
const GATEWAY_SETTLE_MS = 3000;

export function AgentsPanel() {
  const { t } = useI18n();
  const { state, reload } = usePanelData<{ profiles: AgentProfileInfo[] }>(
    () => sdk.invoke<{ profiles: AgentProfileInfo[] }>('hermes.agentProfiles', {}),
    /unknown action|not supported|NOT_INSTALLED/i,
  );
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(false);
  const [tgOpen, setTgOpen] = useState<string | null>(null);
  const [tgToken, setTgToken] = useState('');
  const [tgUsers, setTgUsers] = useState('');
  const [tgFeedback, setTgFeedback] = useState<'idle' | 'saved' | 'error'>('idle');
  const [busy, setBusy] = useState<string | null>(null);

  const create = async () => {
    setCreating(true);
    setCreateError(false);
    try {
      await sdk.invoke('hermes.agentProfileCreate', { name: normalizeProfileName(newName) });
      setNewName('');
      void reload(true);
    } catch {
      setCreateError(true);
    } finally {
      setCreating(false);
    }
  };

  const gateway = async (profile: string, action: 'start' | 'stop') => {
    setBusy(profile);
    try {
      await sdk.invoke(action === 'start' ? 'hermes.gatewayStart' : 'hermes.gatewayStop', { profile, ...(action === 'start' ? { locale: getLang() } : {}) });
      if (action === 'start') await new Promise((r) => setTimeout(r, GATEWAY_SETTLE_MS));
    } catch {
      // reload() below shows the honest state either way.
    } finally {
      setBusy(null);
      void reload(true);
    }
  };

  /** Opening a profile's form clears BOTH fields. They are one form reused
   *  across profiles: leaving the allowed-user list behind would carry one
   *  agent's audience into the next agent's save. */
  const openTelegramForm = (profile: string) => {
    setTgOpen(tgOpen === profile ? null : profile);
    setTgToken('');
    setTgUsers('');
    setTgFeedback('idle');
  };

  const saveTelegram = async (profile: string) => {
    setBusy(profile);
    setTgFeedback('idle');
    try {
      await sdk.invoke('hermes.agentProfileTelegram', {
        profile,
        ...(tgToken.trim() ? { token: tgToken.trim() } : {}),
        ...(tgUsers.trim() ? { allowedUsers: tgUsers.trim() } : {})
      });
      setTgFeedback('saved');
      setTgToken('');
      void reload(true);
    } catch {
      setTgFeedback('error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(data) => (
        <div style={stack}>
          <p style={{ ...hint, margin: 0 }}>{t('agents.intro')}</p>

          {data.profiles.map((p) => {
            const isMain = p.name === '';
            const label = isMain ? t('agents.defaultAgent') : p.name;
            const isBusy = busy === p.name;
            return (
              <div key={p.name || '·'} style={panel}>
                <div style={{ ...row, gap: 10 }}>
                  <strong style={{ fontSize: 14 }}>{label}</strong>
                  {p.apiServerPort !== null && <Pill>:{p.apiServerPort}</Pill>}
                  <span style={hint}>
                    <StatusDot on={p.gatewayManaged} />{t('status.gateway')}
                  </span>
                  <span style={hint}>
                    <StatusDot on={p.telegramTokenPresent} />Telegram
                  </span>
                  {/* The main profile's gateway IS the one the Status tab
                      drives: a second stop button here read as "stop
                      Telegram" and stopped everything. Secondary profiles
                      each run their own gateway, so they keep the buttons. */}
                  {isMain ? (
                    <span style={{ ...hint, fontSize: 12 }}>{t('agents.mainGatewayNote')}</span>
                  ) : p.gatewayManaged ? (
                    <button onClick={() => void gateway(p.name, 'stop')} disabled={isBusy} style={buttonStyle}>
                      {t('agents.gatewayStop')}
                    </button>
                  ) : (
                    <button onClick={() => void gateway(p.name, 'start')} disabled={isBusy} style={primaryButton}>
                      {isBusy ? t('status.gatewayStarting') : t('agents.gatewayStart')}
                    </button>
                  )}
                  {/* One door for the main bot: the Channels tab writes the
                      same variables with validation and hints. Secondary
                      profiles have their own .env, so they keep the form. */}
                  {isMain ? (
                    <span style={{ ...hint, fontSize: 12 }}>{t('agents.mainTelegramNote')}</span>
                  ) : (
                    <button onClick={() => openTelegramForm(p.name)} style={{ ...buttonStyle, marginLeft: 'auto' }}>
                      {t('agents.configureTelegram')}
                    </button>
                  )}
                </div>
                {!p.gatewayManaged && p.lastLine && (
                  <p style={{ ...hint, margin: '8px 0 0', fontSize: 11 }}>{p.lastLine}</p>
                )}
                {tgOpen === p.name && (
                  <div style={{ display: 'grid', gap: 10, marginTop: 12, maxWidth: 460, fontSize: 13 }}>
                    <p style={{ ...hint, margin: 0 }}>{t('agents.botfatherHint')}</p>
                    <input
                      type="password"
                      value={tgToken}
                      onChange={(e) => setTgToken(e.target.value)}
                      placeholder={p.telegramTokenPresent ? '••••••••••' : '123456789:AA…'}
                      style={inputStyle}
                    />
                    <input
                      value={tgUsers}
                      onChange={(e) => setTgUsers(e.target.value)}
                      placeholder={t('channels.allowedLabel')}
                      style={inputStyle}
                    />
                    <div style={row}>
                      <button
                        onClick={() => void saveTelegram(p.name)}
                        disabled={isBusy || (!tgToken.trim() && !tgUsers.trim())}
                        style={buttonStyle}
                      >
                        {t('settings.save')}
                      </button>
                      {tgFeedback === 'saved' && <FeedbackNote tone="ok">{t('channels.saved')}</FeedbackNote>}
                      {tgFeedback === 'error' && <FeedbackNote tone="note">{t('common.error')}</FeedbackNote>}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          <div style={panel}>
            <h2 style={cardTitle}>{t('agents.createHeading')}</h2>
            {data.profiles.every((p) => p.name === '') && (
              <p style={{ ...hint, margin: '0 0 12px' }}>{t('agents.onlyMain')}</p>
            )}
            <div style={{ ...row, gap: 8 }}>
              <input
                value={newName}
                onChange={(e) => { setNewName(e.target.value); setCreateError(false); }}
                placeholder="content-creator"
                style={{ ...inputStyle, maxWidth: 220 }}
              />
              <button
                onClick={() => void create()}
                disabled={creating || !isValidProfileName(newName)}
                style={primaryButton}
              >
                {creating ? t('agents.creating') : t('agents.create')}
              </button>
              {createError && <FeedbackNote tone="note">{t('common.error')}</FeedbackNote>}
            </div>
          </div>
        </div>
      )}
    </PanelGate>
  );
}
