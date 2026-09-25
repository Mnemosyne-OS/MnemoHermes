/**
 * The guided first steps (doc 80 M5), reworked 2026-09-25 after a field
 * report ("la première install est merdique, sois plus clair").
 *
 * Five steps, one question each:
 *   1. install  — Hermes on the machine. Required: Next waits for it.
 *   2. posture  — how much the agent may do. Optional.
 *   3. profile  — who you are, for the agent. Optional.
 *   4. channel  — Telegram. Optional.
 *   5. start    — one button: brain on, memory skill, gateway up.
 *
 * Gone: the "brain" step (a developer panel — proxy switch, caps, YAML —
 * that people clicked past, leaving the proxy off; the start step now turns
 * it on), and the "Skip" button that did exactly what "Next" did.
 */
import { useCallback, useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { buttonStyle, primaryButton } from '../ui';
import { ChannelsPanel } from '../panels/ChannelsPanel';
import { PostureSection } from '../panels/PostureSection';
import { InstallStep } from './InstallStep';
import { ProfileStep } from './ProfileStep';
import { StartStep } from './StartStep';

export const ONBOARDING_STEPS = ['install', 'posture', 'profile', 'channel', 'start'] as const;
type Step = (typeof ONBOARDING_STEPS)[number];
const OPTIONAL: ReadonlySet<Step> = new Set(['posture', 'profile', 'channel']);

export function OnboardingWizard({ onDone }: { onDone: (openChat: boolean) => void }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const [installed, setInstalled] = useState(false);
  const step: Step = ONBOARDING_STEPS[idx] ?? 'install';
  const last = idx === ONBOARDING_STEPS.length - 1;
  const onReady = useCallback((ok: boolean) => setInstalled(ok), []);
  const blocked = step === 'install' && !installed;

  return (
    <div style={{ display: 'grid', gap: 14, alignContent: 'start', maxWidth: 640 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #666)' }}>
            {t('onboarding.stepOf', { n: idx + 1, total: ONBOARDING_STEPS.length })}
            {OPTIONAL.has(step) && ` · ${t('onboarding.optional')}`}
          </span>
          <h2 style={{ margin: '2px 0 0', fontSize: 16, fontWeight: 600 }}>
            {t(`onboarding.${step}.heading`)}
          </h2>
        </div>
        <button onClick={() => onDone(false)} style={{ ...buttonStyle, fontSize: 12 }}>{t('onboarding.skipAll')}</button>
      </div>

      {step === 'install' && <InstallStep onReady={onReady} />}
      {step === 'posture' && <PostureSection />}
      {step === 'profile' && <ProfileStep />}
      {step === 'channel' && <ChannelsPanel telegramOnly />}
      {step === 'start' && <StartStep onDone={onDone} />}

      <div style={{ display: 'flex', gap: 8 }}>
        {idx > 0 && (
          <button onClick={() => setIdx(idx - 1)} style={buttonStyle}>{t('onboarding.back')}</button>
        )}
        {!last && (
          <button onClick={() => setIdx(idx + 1)} disabled={blocked} style={primaryButton}>
            {t('onboarding.next')}
          </button>
        )}
      </div>
    </div>
  );
}
