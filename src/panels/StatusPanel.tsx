/**
 * The Status tab — install/api_server/gateway facts plus the aggregated
 * dashboard (brain, channels, skills+covenant, inbox pending).
 *
 * Each tile fails to "—" alone (lib/dashboard), and the gateway's three-way
 * phase lives in lib/gateway: a managed child mid-boot is STARTING, never
 * "stopped with a Start button next to it".
 */
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n, getLang } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { panel, buttonStyle, primaryButton, hint, StatusDot, PanelGate, CodeBlock, sectionTitle, row } from '../ui';
import { type HermesStatus } from '../types';
import { canStartGateway, gatewayPhase, GATEWAY_PHASE_KEYS, isBooting } from '../lib/gateway';
import { showsUpdateButton } from '../lib/managedInstall';
import { ManagedInstallCard } from './ManagedInstallCard';
import {
  summarizeDashboard,
  pendingCount,
  type DashboardExtras,
} from '../lib/dashboard';
import { fmtCount, UNKNOWN } from '../lib/format';

/** How often a booting gateway (or an open journal) is re-read. */
const WATCH_MS = 2000;

interface UpdateRun {
  running: boolean;
  exitCode: number | null;
  output: string[];
}

/** One dashboard square: a label, and whatever could be measured under it. */
function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={panel}>
      <div style={{ ...hint, marginBottom: 6 }}>{label}</div>
      <span style={{ fontSize: 13 }}>{children}</span>
    </div>
  );
}

export function StatusPanel({ refreshSec, reviewedIds }: { refreshSec: number; reviewedIds: string[] }) {
  const { t } = useI18n();
  const { state, reload } = usePanelData<HermesStatus>(
    () => sdk.invoke<HermesStatus>('hermes.status', {}),
  );
  const [gatewayBusy, setGatewayBusy] = useState(false);
  const [extras, setExtras] = useState<DashboardExtras | null>(null);
  const [logsOpen, setLogsOpen] = useState(false);
  const [logLines, setLogLines] = useState<string[] | null>(null);
  // `hermes update` is one-shot: fire, then poll its state. null = never run
  // this session; the panel shows running → done(0)/failed, with live output.
  const [update, setUpdate] = useState<UpdateRun | null>(null);

  // While an update runs, poll its state so the output fills live and the
  // running→settled transition (which drives the button) stays fresh.
  useEffect(() => {
    if (!update?.running) return;
    const id = setInterval(() => {
      void (async () => {
        try {
          setUpdate(await sdk.invoke<UpdateRun>('hermes.updateStatus', {}));
        } catch {
          // Host without the action, or a transient miss — stop claiming it runs.
          setUpdate((u) => (u ? { ...u, running: false } : u));
        }
      })();
    }, WATCH_MS);
    return () => clearInterval(id);
  }, [update?.running]);

  const startUpdate = useCallback(async () => {
    setUpdate({ running: true, exitCode: null, output: [] });
    try {
      setUpdate(await sdk.invoke<UpdateRun>('hermes.update', {}));
    } catch (err) {
      setUpdate({ running: false, exitCode: -1, output: [err instanceof Error ? err.message : String(err)] });
    }
  }, []);

  // Managed install (doc 123 §4 lot 0) lives in ManagedInstallCard — shared
  // with the wizard's welcome step. When its job settles, the install facts
  // changed under us: re-read them.
  const onInstallSettled = useCallback(() => { void reload(true); }, [reload]);

  const loadLogs = useCallback(async () => {
    try {
      const data = await sdk.invoke<{ lines: string[] }>('hermes.gatewayLogs', {});
      setLogLines(data.lines);
    } catch {
      // Older host without the action — the lastLine fallback still shows.
      setLogLines(null);
    }
  }, []);

  const booting = state.kind === 'data' && isBooting(state.data);

  // While booting (or with the journal open), keep the truth fresh.
  useEffect(() => {
    if (!logsOpen && !booting) return;
    const id = setInterval(() => {
      if (booting) void reload(true);
      void loadLogs();
    }, WATCH_MS);
    return () => clearInterval(id);
  }, [logsOpen, booting, reload, loadLogs]);

  // The four dashboard probes. Deliberately independent of `reviewedIds`: the
  // pending count is derived at render, so keeping an item costs no refetch.
  const loadExtras = useCallback(async () => {
    setExtras(summarizeDashboard(await Promise.allSettled([
      sdk.invoke('hermes.proxyStatus', {}),
      sdk.invoke('hermes.channels', {}),
      sdk.invoke('hermes.skills', {}),
      sdk.invoke('hermes.inbox', {}),
    ])));
  }, []);

  useEffect(() => {
    void loadExtras();
  }, [loadExtras]);

  // Auto-refresh honors the Settings tab; silent so the panel never flickers.
  useEffect(() => {
    if (refreshSec <= 0) return;
    const id = setInterval(() => {
      void reload(true);
      void loadExtras();
    }, refreshSec * 1000);
    return () => clearInterval(id);
  }, [refreshSec, reload, loadExtras]);

  const startGateway = async () => {
    setGatewayBusy(true);
    setLogsOpen(true); // the honest status: show the process's own words
    try {
      await sdk.invoke('hermes.gatewayStart', { locale: getLang() });
    } catch {
      // The reload below shows the honest state either way.
    } finally {
      setGatewayBusy(false);
      void reload(true);
      void loadLogs();
    }
  };

  const stopGateway = async () => {
    setGatewayBusy(true);
    try {
      await sdk.invoke('hermes.gatewayStop', {});
    } catch {
      // Reload shows the honest state.
    } finally {
      setGatewayBusy(false);
      void reload(true);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()} loadingLabel="status.checking">
      {(status) => (
        <div style={panel}>
          <h2 style={{ ...sectionTitle, marginBottom: 16 }}>{t('status.heading')}</h2>
          <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
            <div>
              <StatusDot on={status.installed} />
              {status.installed ? t('status.installed') : t('status.notInstalled')}
              {status.home && <span style={{ ...hint, marginLeft: 8 }}>{status.home}</span>}
            </div>
            <div>
              <StatusDot on={status.apiServer.enabled} />
              {t('status.apiServer')}{' '}
              {status.apiServer.enabled ? t('status.enabled') : t('status.disabled')}
            </div>

            {status.gatewayRunning !== null && (
              <div style={{ ...row, gap: 10 }}>
                <span>
                  <StatusDot on={status.gatewayRunning} />
                  {t('status.gateway')}{' '}
                  {t(GATEWAY_PHASE_KEYS[gatewayPhase(status, gatewayBusy)])}
                </span>
                {canStartGateway(status, gatewayBusy) && (
                  <button onClick={() => void startGateway()} style={primaryButton}>
                    {t('status.gatewayStart')}
                  </button>
                )}
                {status.gatewayProcess.managed && (
                  <button onClick={() => void stopGateway()} style={buttonStyle}>
                    {t('status.gatewayStop')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setLogsOpen((o) => !o);
                    if (!logsOpen) void loadLogs();
                  }}
                  style={logsOpen ? primaryButton : buttonStyle}
                >
                  {t('status.logs')}
                </button>
                {!logsOpen && !status.gatewayRunning && status.gatewayProcess.lastLine && (
                  <span style={{ ...hint, fontSize: 11 }}>{status.gatewayProcess.lastLine}</span>
                )}
              </div>
            )}
            {logsOpen && (
              <CodeBlock>
                {logLines && logLines.length
                  ? logLines.join('\n')
                  : (status.gatewayProcess.lastLine ?? t('status.logsEmpty'))}
              </CodeBlock>
            )}

            {/* Managed install (doc 123 §4 lot 0) — the button every user gets
                instead of the official `irm | iex`. Shown while nothing is
                installed; on the install the host owns, a Reinstall instead. */}
            <ManagedInstallCard status={status} onSettled={onInstallSettled} />

            {/* Update Hermes — the "terminals give me acne" thesis: no shell to
                run `hermes update`, one button, live output. Shown on a HAND
                install: the managed one has no git checkout to pull and
                re-installs instead (lib/managedInstall). */}
            {showsUpdateButton(status) && (
              <div style={{ ...row, gap: 10 }}>
                <button onClick={() => void startUpdate()} disabled={update?.running === true} style={buttonStyle}>
                  {update?.running ? t('status.updating') : t('status.update')}
                </button>
                {update && !update.running && update.exitCode !== null && (
                  <span style={{ fontSize: 12, color: update.exitCode === 0 ? 'var(--accent, #35c9a6)' : 'var(--text-secondary, #aaa)' }}>
                    {update.exitCode === 0 ? t('status.updateDone') : t('status.updateFailed')}
                  </span>
                )}
                <span style={{ ...hint, fontSize: 11 }}>{t('status.updateHint')}</span>
              </div>
            )}
            {update && update.output.length > 0 && <CodeBlock>{update.output.join('\n')}</CodeBlock>}
          </div>

          {extras && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10, marginTop: 16 }}>
              <Tile label={t('brain.heading')}>
                {extras.proxy ? (
                  <>
                    <StatusDot on={extras.proxy.running} />
                    {extras.proxy.running ? t('brain.running') : t('brain.stopped')}
                    <span style={{ ...hint, marginLeft: 8 }}>
                      {extras.proxy.callsToday}/{extras.proxy.dailyCallCap}
                    </span>
                  </>
                ) : UNKNOWN}
              </Tile>
              <Tile label={t('tabs.channels')}>
                {extras.channelsConfigured === null
                  ? UNKNOWN
                  : t('dashboard.channelsCount', { n: extras.channelsConfigured })}
              </Tile>
              <Tile label={t('tabs.skills')}>
                {extras.skills ? (
                  <>
                    {fmtCount(extras.skills.count)}
                    <span style={{ marginLeft: 8, color: extras.skills.covenant ? 'var(--accent, #35c9a6)' : 'var(--text-muted, #666)' }}>
                      {extras.skills.covenant ? t('dashboard.covenantOk') : t('dashboard.covenantMissing')}
                    </span>
                  </>
                ) : UNKNOWN}
              </Tile>
              <Tile label={t('tabs.inbox')}>
                {(() => {
                  const pending = pendingCount(extras.inboxItems, reviewedIds);
                  return pending === null ? UNKNOWN : t('dashboard.inboxPending', { n: pending });
                })()}
              </Tile>
            </div>
          )}
        </div>
      )}
    </PanelGate>
  );
}
