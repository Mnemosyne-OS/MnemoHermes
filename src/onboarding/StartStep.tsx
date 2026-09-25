/**
 * Wizard last step — one button that plugs everything in and starts the
 * assistant, then a list that turns green line by line (lib/startSequence).
 *
 * Rework 2026-09-25: this replaces the separate "brain" step (a developer
 * panel: proxy switch, call caps, YAML to paste) and the old Start button.
 * What the button does is written above it before the click, and each line
 * says what went wrong in plain words when it does.
 */
import { useCallback, useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { panel, primaryButton, buttonStyle, hint, StatusDot } from '../ui';
import { runStartSequence, START_STEPS, type StepId, type StepState } from '../lib/startSequence';
import type { HermesStatus } from '../types';

const IDLE: Record<StepId, StepState> = { brain: { kind: 'wait' }, memory: { kind: 'wait' }, gateway: { kind: 'wait' } };

export function StartStep({ onDone }: { onDone: (openChat: boolean) => void }) {
  const { t } = useI18n();
  const [managed, setManaged] = useState<boolean | null>(null);
  const [useMnemoBrain, setUseMnemoBrain] = useState(false);
  const [steps, setSteps] = useState<Record<StepId, StepState>>(IDLE);
  const [phase, setPhase] = useState<'idle' | 'running' | 'done'>('idle');
  const [gatewayUp, setGatewayUp] = useState(false);

  useEffect(() => {
    let alive = true;
    sdk.invoke<HermesStatus>('hermes.status', {})
      .then((s) => { if (alive) setManaged(s?.managed === true); })
      .catch((err) => { console.warn('[onboarding] hermes.status failed:', err); if (alive) setManaged(false); });
    return () => { alive = false; };
  }, []);

  const run = useCallback(async () => {
    setPhase('running');
    setSteps(IDLE);
    const res = await runStartSequence(
      (action, payload) => sdk.invoke(action, payload ?? {}),
      { useMnemoBrain, locale: getLang() },
      (id, state) => setSteps((cur) => ({ ...cur, [id]: state })),
    );
    setGatewayUp(res.gatewayUp);
    setPhase('done');
  }, [useMnemoBrain]);

  const lineText = (id: StepId, s: StepState): string => {
    if (s.kind === 'ok') return s.kept ? t('onboarding.start.brainKept') : t(`onboarding.start.${id}Ok`);
    if (s.kind === 'fail') {
      if (id === 'memory') return `${t('onboarding.start.memoryFail')} ${t(`skills.installError.${s.code}`)}`;
      return t(`onboarding.start.${id}Fail`);
    }
    return t(`onboarding.start.${id}`);
  };

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary, #aaa)' }}>{t('onboarding.start.body')}</p>

      <div style={{ ...panel, display: 'grid', gap: 10 }}>
        {START_STEPS.map((id) => {
          const s = steps[id];
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontSize: 13 }}>
              <span style={{ width: 14 }}>
                {s.kind === 'ok' ? <StatusDot on /> : s.kind === 'fail' ? <StatusDot on={false} /> : s.kind === 'run' ? '…' : '·'}
              </span>
              <span style={{ color: s.kind === 'fail' ? 'var(--text-secondary, #aaa)' : undefined }}>
                {lineText(id, s)}
                {s.kind === 'fail' && id !== 'memory' && (
                  <span style={{ ...hint, marginLeft: 6 }}><code>{s.code}</code></span>
                )}
              </span>
            </div>
          );
        })}

        {managed === false && phase === 'idle' && (
          <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, marginTop: 4, cursor: 'pointer' }}>
            <input type="checkbox" checked={useMnemoBrain} onChange={(e) => setUseMnemoBrain(e.target.checked)} />
            <span>{t('onboarding.start.useMnemoBrain')}</span>
          </label>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {phase !== 'done' && (
          <button onClick={() => void run()} disabled={phase === 'running' || managed === null} style={primaryButton}>
            {phase === 'running' ? t('onboarding.start.running') : t('onboarding.start.run')}
          </button>
        )}
        {phase === 'done' && gatewayUp && (
          <button onClick={() => onDone(true)} style={primaryButton}>{t('onboarding.start.openChat')}</button>
        )}
        {phase === 'done' && !gatewayUp && (
          <button onClick={() => void run()} style={primaryButton}>{t('onboarding.start.retry')}</button>
        )}
        {phase === 'done' && (
          <button onClick={() => onDone(false)} style={buttonStyle}>{t('onboarding.finishButton')}</button>
        )}
      </div>
      {phase === 'done' && !gatewayUp && <span style={hint}>{t('onboarding.start.gatewayHelp')}</span>}
    </div>
  );
}
