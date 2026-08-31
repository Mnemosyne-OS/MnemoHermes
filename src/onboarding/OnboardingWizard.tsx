/**
 * The M5 guided first steps (doc 80): five skippable steps, "Skip
 * everything" always visible, rerunnable from Settings. The brain step and
 * the channel step ARE the cockpit panels — one component, two homes.
 */
import { useState } from 'react';
import { useI18n } from '../i18n/useI18n';
import { buttonStyle } from '../ui';
import { BrainSection } from '../panels/BrainSection';
import { ChannelsPanel } from '../panels/ChannelsPanel';
import { PostureSection } from '../panels/PostureSection';
import { WelcomeStep } from './WelcomeStep';
import { ProfileStep } from './ProfileStep';
import { FinishStep } from './FinishStep';

const ONBOARDING_STEPS = ['welcome', 'brain', 'posture', 'profile', 'channel', 'finish'] as const;

export function OnboardingWizard({ onDone }: { onDone: () => void }) {
  const { t } = useI18n();
  const [idx, setIdx] = useState(0);
  const step = ONBOARDING_STEPS[idx] ?? 'welcome';
  const last = idx === ONBOARDING_STEPS.length - 1;

  return (
    <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
            {t(`onboarding.${step}.heading`)}
          </h2>
          <span style={{ fontSize: 12, color: 'var(--text-muted, #666)' }}>
            {t('onboarding.stepOf', { n: idx + 1, total: ONBOARDING_STEPS.length })}
          </span>
        </div>
        {/* The lazy human's rights, always visible: skip everything, no guilt. */}
        <button onClick={onDone} style={buttonStyle}>{t('onboarding.skipAll')}</button>
      </div>

      {step === 'welcome' && <WelcomeStep />}
      {step === 'brain' && <BrainSection />}
      {step === 'posture' && <PostureSection />}
      {step === 'profile' && <ProfileStep />}
      {step === 'channel' && <ChannelsPanel />}
      {step === 'finish' && <FinishStep onDone={onDone} />}

      <div style={{ display: 'flex', gap: 8 }}>
        {idx > 0 && (
          <button onClick={() => setIdx(idx - 1)} style={buttonStyle}>{t('onboarding.back')}</button>
        )}
        {!last && (
          <>
            <button onClick={() => setIdx(idx + 1)} style={{ ...buttonStyle, borderColor: 'var(--accent, #35c9a6)' }}>
              {t('onboarding.next')}
            </button>
            <button onClick={() => setIdx(idx + 1)} style={buttonStyle}>{t('onboarding.skip')}</button>
          </>
        )}
      </div>
    </div>
  );
}
