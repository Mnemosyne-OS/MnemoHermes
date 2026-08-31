/**
 * MnemoHermes — the Hermes Agent cockpit shell (doc 80).
 *
 * App owns the durable state (doc 73: one document holding settings,
 * reviewedIds and the onboarding flag — always written together so no save
 * wipes another) and the tab chrome. Every tab lives in src/panels/, the
 * guided first steps in src/onboarding/.
 */
import { useCallback, useEffect, useState } from 'react';
import { sdk } from './sdk/instance';
import { useI18n } from './i18n/useI18n';
import { panel, buttonStyle, Logo } from './ui';
import {
  DEFAULT_SETTINGS,
  MAX_REVIEWED_IDS,
  sanitizeReviewed,
  sanitizeSettings,
  type ChatMessage,
  type CockpitSettings,
} from './types';
import { StatusPanel } from './panels/StatusPanel';
import { ChatPanel } from './panels/ChatPanel';
import { AgentsPanel } from './panels/AgentsPanel';
import { ChannelsPanel } from './panels/ChannelsPanel';
import { ToolsPanel } from './panels/ToolsPanel';
import { SkillsPanel } from './panels/SkillsPanel';
import { InboxPanel } from './panels/InboxPanel';
import { BrainSection } from './panels/BrainSection';
import { SearchSection } from './panels/SearchSection';
import { SettingsPanel } from './panels/SettingsPanel';
import { OnboardingWizard } from './onboarding/OnboardingWizard';

type Tab = 'status' | 'chat' | 'agents' | 'channels' | 'tools' | 'skills' | 'inbox' | 'settings';

const TABS: Tab[] = ['status', 'chat', 'agents', 'channels', 'tools', 'skills', 'inbox', 'settings'];

export default function App() {
  const { t } = useI18n();
  const [tab, setTab] = useState<Tab>('status');
  const [settings, setSettings] = useState<CockpitSettings | null>(null);
  const [reviewedIds, setReviewedIds] = useState<string[]>([]);
  const [onboardingDone, setOnboardingDone] = useState<boolean | null>(null);
  // Session-scoped on purpose: survives tab switches, dies with the window.
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);

  // Outside the host (plain browser dev) the bridge is absent — defaults apply.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await sdk.invoke<{
          state?: { settings?: unknown; reviewedIds?: unknown; onboardingDone?: unknown } | null;
        }>('state.get', {});
        if (cancelled) return;
        setSettings(sanitizeSettings(res?.state?.settings));
        setReviewedIds(sanitizeReviewed(res?.state?.reviewedIds));
        setOnboardingDone(res?.state?.onboardingDone === true);
      } catch {
        if (!cancelled) {
          setSettings(DEFAULT_SETTINGS);
          // Outside the host there is nothing to onboard — show the tabs.
          setOnboardingDone(true);
        }
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const persist = useCallback(async (
    nextSettings: CockpitSettings,
    nextReviewed: string[],
    nextOnboardingDone: boolean,
  ): Promise<boolean> => {
    try {
      await sdk.invoke('state.set', {
        state: { settings: nextSettings, reviewedIds: nextReviewed, onboardingDone: nextOnboardingDone },
      });
      return true;
    } catch {
      // Saved in-memory for the session either way; only persistence failed.
      return false;
    }
  }, []);

  const saveSettings = useCallback(async (next: CockpitSettings): Promise<boolean> => {
    setSettings(next);
    return persist(next, reviewedIds, onboardingDone === true);
  }, [persist, reviewedIds, onboardingDone]);

  const keepItem = useCallback((key: string) => {
    // Compute outside the updater: persisting is a side effect, and React
    // may replay updaters (StrictMode) — one write per click, not two.
    const next = [...reviewedIds.filter((k) => k !== key), key].slice(-MAX_REVIEWED_IDS);
    setReviewedIds(next);
    void persist(settings ?? DEFAULT_SETTINGS, next, onboardingDone === true);
  }, [persist, settings, reviewedIds, onboardingDone]);

  const finishOnboarding = useCallback(() => {
    setOnboardingDone(true);
    void persist(settings ?? DEFAULT_SETTINGS, reviewedIds, true);
  }, [persist, settings, reviewedIds]);

  const restartOnboarding = useCallback(() => {
    setOnboardingDone(false);
    void persist(settings ?? DEFAULT_SETTINGS, reviewedIds, false);
  }, [persist, settings, reviewedIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 20, boxSizing: 'border-box' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <Logo />
        <div>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>{t('app.title')}</h1>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--text-muted, #666)' }}>{t('app.tagline')}</p>
        </div>
      </header>

      {onboardingDone === null && <div style={panel}>{t('common.loading')}</div>}
      {onboardingDone === false && (
        <main style={{ flex: 1, overflowY: 'auto' }}>
          <OnboardingWizard onDone={finishOnboarding} />
        </main>
      )}

      {onboardingDone === true && (
        <>
          <nav style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border-subtle, #2a2a2a)', flexWrap: 'wrap' }}>
            {TABS.map((id) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                style={{
                  padding: '8px 14px',
                  border: 'none',
                  borderBottom: tab === id ? '2px solid var(--accent, #35c9a6)' : '2px solid transparent',
                  background: 'none',
                  color: tab === id ? 'var(--text-primary, #e0e0e0)' : 'var(--text-secondary, #aaa)',
                  fontSize: 13,
                  cursor: 'pointer'
                }}
              >
                {t(`tabs.${id}`)}
              </button>
            ))}
          </nav>

          <main style={{ flex: 1, overflowY: 'auto' }}>
            {tab === 'status' && <StatusPanel refreshSec={settings?.statusRefreshSec ?? 0} reviewedIds={reviewedIds} />}
            {tab === 'chat' && (
              <ChatPanel
                apiPort={settings?.apiPort ?? null}
                messages={chatMessages}
                setMessages={setChatMessages}
              />
            )}
            {tab === 'agents' && <AgentsPanel />}
            {tab === 'channels' && <ChannelsPanel />}
            {tab === 'tools' && <ToolsPanel />}
            {tab === 'skills' && <SkillsPanel />}
            {tab === 'inbox' && <InboxPanel reviewedIds={reviewedIds} onKeep={keepItem} />}
            {tab === 'settings' && (
              <div style={{ display: 'grid', gap: 12 }}>
                <BrainSection />
                <SearchSection />
                {settings === null
                  ? <div style={panel}>{t('common.loading')}</div>
                  : <SettingsPanel settings={settings} onSave={saveSettings} />}
                <button onClick={restartOnboarding} style={{ ...buttonStyle, justifySelf: 'start' }}>
                  {t('onboarding.rerun')}
                </button>
              </div>
            )}
          </main>
        </>
      )}
    </div>
  );
}
