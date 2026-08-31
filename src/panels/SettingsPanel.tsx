/**
 * The Settings tab body — status auto-refresh cadence and the api_server
 * port override the Chat tab reads. Persisted through App's durable-state
 * writer (one document, settings + reviewedIds together).
 */
import { useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { panel, inputStyle, buttonStyle, hint, FeedbackNote, sectionTitle, row } from '../ui';
import { sanitizeSettings, type CockpitSettings } from '../types';
import { PostureSection } from './PostureSection';

export function SettingsPanel({
  settings,
  onSave
}: {
  settings: CockpitSettings;
  onSave: (next: CockpitSettings) => Promise<boolean>;
}) {
  const { t } = useI18n();
  const [refreshSec, setRefreshSec] = useState(settings.statusRefreshSec);
  const [portText, setPortText] = useState(settings.apiPort === null ? '' : String(settings.apiPort));
  const [feedback, setFeedback] = useState<'idle' | 'saved' | 'error'>('idle');

  const save = async () => {
    setFeedback('idle');
    const next = sanitizeSettings({
      statusRefreshSec: refreshSec,
      apiPort: portText.trim() === '' ? null : Number(portText.trim())
    });
    const ok = await onSave(next);
    setFeedback(ok ? 'saved' : 'error');
  };

  const refreshOptions: Array<{ value: number; label: string }> = [
    { value: 0, label: t('settings.refresh.off') },
    { value: 30, label: t('settings.refresh.s30') },
    { value: 60, label: t('settings.refresh.m1') },
    { value: 300, label: t('settings.refresh.m5') }
  ];

  return (
    <div style={panel}>
      <h2 style={{ ...sectionTitle, marginBottom: 16 }}>{t('settings.heading')}</h2>
      <div style={{ display: 'grid', gap: 18, fontSize: 13, maxWidth: 420 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          {t('settings.refresh.label')}
          <select
            value={refreshSec}
            onChange={(e) => setRefreshSec(Number(e.target.value))}
            style={inputStyle}
          >
            {refreshOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 6 }}>
          {t('settings.port.label')}
          <input
            type="number"
            min={1}
            max={65535}
            value={portText}
            onChange={(e) => setPortText(e.target.value)}
            style={inputStyle}
          />
          <span style={hint}>{t('settings.port.hint')}</span>
        </label>

        <div style={row}>
          <button onClick={() => void save()} style={buttonStyle}>{t('settings.save')}</button>
          {feedback === 'saved' && <FeedbackNote tone="ok">{t('settings.saved')}</FeedbackNote>}
          {feedback === 'error' && <FeedbackNote tone="note">{t('settings.saveError')}</FeedbackNote>}
        </div>
      </div>

      <h2 style={{ ...sectionTitle, margin: '28px 0 12px' }}>{t('onboarding.posture.heading')}</h2>
      <PostureSection />
    </div>
  );
}
