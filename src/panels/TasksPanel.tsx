/**
 * The Tâches tab (doc 123 lot 1): give the agent a task, watch it run, and
 * ANSWER when it parks on a gated action. The host follows the run's event
 * stream; this panel polls `hermes.runList` while anything is live.
 *
 * Two honesties this panel keeps:
 *   - the countdown is Hermes' own `approvals.timeout`; at zero the buttons
 *     go away and the line says Hermes decided alone;
 *   - "last sign of life N s ago" is measured; "working" is never claimed.
 */
import { useCallback, useEffect, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { panel, inputStyle, buttonStyle, primaryButton, dangerButton, hint, PanelGate, CodeBlock, sectionTitle, row, StatusDot } from '../ui';
import type { RunChoice, RunView } from '../types';
import { anyRunLive, approvalSecondsLeft, runPhase, silentSeconds, sortRuns, CHOICE_KEYS, STATUS_KEYS } from '../lib/runs';

const WATCH_MS = 2000;

export function TasksPanel() {
  const { t } = useI18n();
  const { state, setState, reload } = usePanelData<{ runs: RunView[] }>(
    () => sdk.invoke<{ runs: RunView[] }>('hermes.runList', {}),
  );
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const live = state.kind === 'data' && anyRunLive(state.data.runs);

  // Poll and tick only while a run can still change (rule 13's cousin).
  useEffect(() => {
    if (!live) return;
    const poll = setInterval(() => { void reload(true); }, WATCH_MS);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [live, reload]);

  const start = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setBusy('start');
    setRefusal(null);
    try {
      await sdk.invoke<RunView>('hermes.runStart', { input: text });
      setInput('');
      await reload(true);
    } catch (err) {
      setRefusal(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, [input, reload]);

  const answer = useCallback(async (runId: string, choice: RunChoice) => {
    setBusy(runId);
    setRefusal(null);
    try {
      const view = await sdk.invoke<RunView>('hermes.runApprove', { runId, choice });
      setState((s) => (s.kind === 'data' ? { kind: 'data', data: { runs: s.data.runs.map((r) => (r.runId === runId ? view : r)) } } : s));
    } catch (err) {
      setRefusal(err instanceof Error ? err.message : String(err));
      await reload(true);
    } finally {
      setBusy(null);
    }
  }, [reload, setState]);

  const stop = useCallback(async (runId: string) => {
    setBusy(runId);
    try {
      await sdk.invoke('hermes.runStop', { runId });
    } catch (err) {
      setRefusal(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
      await reload(true);
    }
  }, [reload]);

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {({ runs }) => (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={panel}>
            <h2 style={{ ...sectionTitle, margin: '0 0 6px' }}>{t('tasks.heading')}</h2>
            <p style={{ ...hint, margin: '0 0 12px' }}>{t('tasks.intro')}</p>
            <div style={{ ...row, gap: 8 }}>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void start(); }}
                placeholder={t('tasks.placeholder')}
                disabled={busy === 'start'}
                style={{ ...inputStyle, flex: 1, minWidth: 240 }}
              />
              <button onClick={() => void start()} disabled={busy === 'start' || !input.trim()} style={primaryButton}>
                {busy === 'start' ? t('tasks.starting') : t('tasks.start')}
              </button>
            </div>
            {refusal && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
                {t('tasks.refused')} <code>{refusal}</code>
              </span>
            )}
          </div>

          {runs.length === 0 && <span style={hint}>{t('tasks.empty')}</span>}

          {sortRuns(runs).map((run) => {
            const phase = runPhase(run);
            const left = approvalSecondsLeft(run, nowMs);
            const silent = silentSeconds(run, nowMs);
            const expired = phase === 'waiting' && left === 0;
            return (
              <div key={run.runId} style={{ ...panel, borderColor: phase === 'waiting' && !expired ? 'var(--accent, #35c9a6)' : undefined }}>
                <div style={{ ...row, justifyContent: 'space-between' }}>
                  <strong style={{ fontSize: 13 }}>{run.input}</strong>
                  <span style={{ fontSize: 12 }}>
                    <StatusDot on={phase === 'active'} />
                    {t(STATUS_KEYS[run.status])}
                  </span>
                </div>
                {phase !== 'settled' && silent !== null && (
                  <span style={{ ...hint, fontSize: 11 }}>
                    {t('tasks.lastSign', { s: silent })}
                    {run.stream === 'lost' && ` · ${t('tasks.streamLost')}`}
                  </span>
                )}

                {phase === 'waiting' && run.approval && (
                  <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                    <span style={{ fontSize: 13 }}>{t('tasks.approvalTitle')}</span>
                    <CodeBlock variant="snippet">{run.approval.command ?? t('tasks.noCommand')}</CodeBlock>
                    {run.approval.description && <span style={hint}>{run.approval.description}</span>}
                    {run.approval.smartDenied && <span style={hint}>{t('tasks.smartDenied')}</span>}
                    {expired ? (
                      <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{t('tasks.expired')}</span>
                    ) : (
                      <>
                        <span style={hint}>{t('tasks.countdown', { s: left ?? '—' })}</span>
                        <div style={{ ...row, gap: 8 }}>
                          {run.approval.choices.map((c) => (
                            <button
                              key={c}
                              onClick={() => void answer(run.runId, c)}
                              disabled={busy === run.runId}
                              style={c === 'deny' ? dangerButton : c === 'once' ? primaryButton : buttonStyle}
                            >
                              {t(CHOICE_KEYS[c])}
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {run.output && (
                  <div style={{ marginTop: 8, fontSize: 13, whiteSpace: 'pre-wrap' }}>{run.output}</div>
                )}
                {run.error && (
                  <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{t('tasks.error')} <code>{run.error}</code></span>
                )}
                {run.log.length > 0 && <CodeBlock>{run.log.slice(-12).join('\n')}</CodeBlock>}

                {phase !== 'settled' && (
                  <div style={{ ...row, marginTop: 8 }}>
                    <button onClick={() => void stop(run.runId)} disabled={busy === run.runId || run.status === 'stopping'} style={buttonStyle}>
                      {run.status === 'stopping' ? t('tasks.stopping') : t('tasks.stop')}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </PanelGate>
  );
}
