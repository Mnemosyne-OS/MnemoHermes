/**
 * The security-posture control (doc 80 M5+): three one-click presets that
 * write BOTH sides of the bridge — Hermes' config.yaml (toolsets,
 * approvals.mode, tirith) and Mnemosyne's brain-proxy call cap. Lives in
 * the isolation-posture wizard step AND in Settings (one component, two
 * homes, the Brain-section pattern).
 *
 * A preset click IS the human gesture, mediated — the covenant forbids the
 * AGENT from steering its config, not the owner from clicking a button.
 */
import { useState } from 'react';
import type { CSSProperties } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { panel, primaryButton, dangerButton, hint, StatusDot, PanelGate, FeedbackNote, stack, row } from '../ui';

type Preset = 'fortress' | 'balanced' | 'yolo';

interface Posture {
  preset: Preset | 'custom';
  approvalsMode: 'manual' | 'smart' | 'off';
  tirithFailOpen: boolean;
  terminalOnMessaging: boolean;
  dailyCallCap: number;
  /** Older hosts omit it. */
  dailyTokenCap?: number;
}

const PRESETS: Preset[] = ['fortress', 'balanced', 'yolo'];

export function PostureSection() {
  const { t } = useI18n();
  const { state, setState, reload } = usePanelData<Posture>(
    () => sdk.invoke<Posture>('hermes.securityPosture', {}),
  );
  const [busy, setBusy] = useState<Preset | null>(null);
  const [applied, setApplied] = useState<Preset | null>(null);
  const confirm = useConfirm<Preset>();

  const apply = async (preset: Preset) => {
    // YOLO opens the shell to every channel, so it alone asks twice. The other
    // two presets tighten things and act on the first press.
    if (preset === 'yolo' && !confirm.press('yolo')) return;
    confirm.cancel();
    setBusy(preset);
    try {
      await sdk.invoke('hermes.applyPreset', { preset });
      setApplied(preset);
      const fresh = await sdk.invoke<Posture>('hermes.securityPosture', {});
      setState({ kind: 'data', data: fresh });
    } catch {
      // The reload shows whichever posture actually landed.
      await reload();
    } finally {
      setBusy(null);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(posture) => {
        const card = (preset: Preset): CSSProperties => ({
          ...panel,
          borderColor: posture.preset === preset ? 'var(--accent, #35c9a6)' : 'var(--border-subtle, #2a2a2a)',
        });

        return (
          <div style={stack}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>
              {t('onboarding.posture.body')}
            </p>

            <div style={{ ...hint, display: 'flex', alignItems: 'center', gap: 6 }}>
              <StatusDot on={posture.preset !== 'custom' && posture.preset !== 'yolo'} />
              {posture.preset === 'custom'
                ? t('onboarding.posture.currentCustom')
                : t('onboarding.posture.current', { name: t(`onboarding.posture.${posture.preset}.title`) })}
            </div>

            {PRESETS.map((preset) => (
              <div key={preset} style={card(preset)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ fontSize: 13 }}>{t(`onboarding.posture.${preset}.title`)}</strong>
                  {posture.preset === preset && (
                    <span style={{ fontSize: 11, color: 'var(--accent, #35c9a6)' }}>
                      {t('onboarding.posture.active')}
                    </span>
                  )}
                </div>
                <p style={{ ...hint, margin: '6px 0 10px' }}>{t(`onboarding.posture.${preset}.body`)}</p>
                <div style={row}>
                  <button
                    onClick={() => void apply(preset)}
                    disabled={busy !== null}
                    style={preset === 'yolo' ? dangerButton : primaryButton}
                  >
                    {busy === preset
                      ? t('onboarding.posture.applying')
                      : confirm.armed === preset
                        ? t('onboarding.posture.confirmYolo')
                        : t('onboarding.posture.apply')}
                  </button>
                  {applied === preset && busy === null && (
                    <FeedbackNote tone="ok">
                      {t('onboarding.posture.applied', { cap: posture.dailyCallCap })}
                    </FeedbackNote>
                  )}
                </div>
              </div>
            ))}

            <p style={{ ...hint, margin: '4px 0 0', fontSize: 11 }}>{t('onboarding.posture.footnote')}</p>
          </div>
        );
      }}
    </PanelGate>
  );
}
