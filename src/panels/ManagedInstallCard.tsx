/**
 * Managed install — the one button every user gets instead of the official
 * `irm | iex` (doc 123 §4 lot 0). Two homes, one component: the wizard's
 * welcome step (what a fresh install sees first) and the Status tab.
 *
 * Fire-and-poll against the host: `hermes.managedInstall` starts the job,
 * `hermes.managedInstallStatus` is read every WATCH_MS while it runs, and
 * `onSettled` fires once when it stops so the owner re-reads the install
 * facts. The clock is MEASURED from the host's `startedAt` — the proof of
 * life a spinner cannot give — and a bar is drawn only when `pct` is a
 * number (lib/managedInstall).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { buttonStyle, primaryButton, hint, CodeBlock, row } from '../ui';
import type { HermesStatus, ManagedInstallState } from '../types';
import {
  canInstall,
  canReinstall,
  downloadMb,
  elapsedSeconds,
  formatClock,
  installErrorKey,
  installPhase,
  STAGE_KEYS,
} from '../lib/managedInstall';

/** How often a running job is re-read. */
const WATCH_MS = 2000;

export function ManagedInstallCard({ status, onSettled }: { status: HermesStatus; onSettled: () => void }) {
  const { t } = useI18n();
  // null = the host has not answered yet (older host, or first paint): no
  // button, no hint — nothing claimed about an install we cannot drive.
  const [install, setInstall] = useState<ManagedInstallState | null>(null);
  const [refusal, setRefusal] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  // The installer's raw lines are for the curious and for a bug report: one
  // click away, never the screen itself (onboarding rework 2026-09-25). A
  // failure opens them, since then they are the explanation.
  const [showOutput, setShowOutput] = useState<boolean | null>(null);
  const phase = installPhase(install);
  const running = phase === 'running';

  const load = useCallback(async () => {
    try {
      setInstall(await sdk.invoke<ManagedInstallState>('hermes.managedInstallStatus', {}));
    } catch (err) {
      // One failed poll must not erase a running install from the screen
      // (sweep 2026-09-23): the last state stands until the next answer.
      console.warn('[cockpit] install status poll failed:', err);
      setInstall((cur) => cur);
    }
  }, []);

  // Once per mount, so a job left running in another window shows up here too.
  useEffect(() => { void load(); }, [load]);

  // While a job runs: poll the host and tick the clock; both stop when it settles.
  useEffect(() => {
    if (!running) return;
    const poll = setInterval(() => { void load(); }, WATCH_MS);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [running, load]);

  // running → settled: the install facts changed under the owner.
  const wasRunning = useRef(false);
  useEffect(() => {
    if (wasRunning.current && !running) onSettled();
    wasRunning.current = running;
  }, [running, onSettled]);

  const start = useCallback(async (force: boolean) => {
    setRefusal(null);
    try {
      setInstall(await sdk.invoke<ManagedInstallState>('hermes.managedInstall', { force, locale: getLang() }));
    } catch (err) {
      setRefusal(err instanceof Error ? err.message : String(err));
    }
  }, []);

  const cancel = useCallback(async () => {
    try {
      await sdk.invoke('hermes.managedInstallCancel', {});
    } catch (err) {
      // The poll still shows the job running; the refusal itself is said.
      setRefusal(err instanceof Error ? err.message : String(err));
    }
    void load();
  }, [load]);

  if (!install) return null;
  if (!(canInstall(status, install) || running || canReinstall(status, install))) return null;

  const elapsed = elapsedSeconds(install, nowMs);
  // Untouched by the person: closed, except on a failure.
  const outputOpen = showOutput ?? phase === 'failed';
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      {status.installed && status.managed && (
        <span style={hint}>
          {t('status.installManaged', { version: install.installed?.version ?? install.pin.version })}
          {' · '}
          {install.memory ? t('status.memoryWired') : t('status.memoryMissing')}
          {' · '}
          {install.actions ? t('status.actionsWired') : t('status.actionsMissing')}
          {' · '}
          {install.stt && install.stt.enabled ? t('status.voiceWired') : t('status.voiceMissing')}
        </span>
      )}
      <div style={{ ...row, gap: 10 }}>
        {!running && canInstall(status, install) && (
          <button onClick={() => void start(false)} style={primaryButton}>{t('status.install')}</button>
        )}
        {!running && canReinstall(status, install) && (
          <button onClick={() => void start(true)} style={buttonStyle}>{t('status.reinstall')}</button>
        )}
        {running && (
          <>
            <button disabled style={buttonStyle}>{t('status.installing')}</button>
            <button onClick={() => void cancel()} style={buttonStyle}>{t('status.installCancel')}</button>
          </>
        )}
      </div>
      {!status.installed && !running && (
        <span style={{ ...hint, fontSize: 11 }}>
          {t('status.installHint', { version: install.pin.version, mb: downloadMb(install.pin.bytes) ?? '—' })}
        </span>
      )}
      {running && install.stage && (
        <div style={{ display: 'grid', gap: 4 }}>
          <span style={{ fontSize: 12 }}>
            {t(STAGE_KEYS[install.stage])}
            {install.pct !== null && ` · ${install.pct} %`}
            {elapsed !== null && ` · ${formatClock(elapsed)}`}
          </span>
          {install.pct !== null && (
            <div style={{ height: 4, background: 'var(--border, #333)', borderRadius: 2 }}>
              <div style={{ height: 4, width: `${install.pct}%`, background: 'var(--accent, #35c9a6)', borderRadius: 2 }} />
            </div>
          )}
        </div>
      )}
      {refusal && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
          {t(installErrorKey(refusal))} <code>{refusal}</code>
        </span>
      )}
      {!running && phase === 'done' && (
        <span style={{ fontSize: 12, color: 'var(--accent, #35c9a6)' }}>{t('status.installDone')}</span>
      )}
      {!running && phase === 'failed' && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
          {t('status.installFailed')} <code>{install.error}</code>
        </span>
      )}
      {!running && phase === 'cancelled' && (
        <span style={{ fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{t('status.installCancelled')}</span>
      )}
      {install.output.length > 0 && (running || phase !== 'idle') && (
        <>
          <button onClick={() => setShowOutput(!outputOpen)} style={{ ...buttonStyle, justifySelf: 'start', fontSize: 11 }}>
            {outputOpen ? t('status.installHideOutput') : t('status.installShowOutput')}
          </button>
          {outputOpen && <CodeBlock>{install.output.slice(-40).join('\n')}</CodeBlock>}
        </>
      )}
    </div>
  );
}
