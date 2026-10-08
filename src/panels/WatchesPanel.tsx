/**
 * The Veilles tab (2026-10-02): "search this topic every night, give me the
 * report when I ask". A watch is a Hermes cron job the host narrows to web
 * search; this tab is the form, the list, and the report reader, so nobody
 * has to know the sentence to type in the chat.
 *
 * Four facts sit on top, because a watch that silently cannot run reads as a
 * broken watch: which search engine the agent has (none = it searches
 * nothing), whether the gateway runs (it holds the scheduler), whether the
 * machine is kept awake, and what a night cost.
 */
import { useCallback, useState } from 'react';
import { sdk } from '../sdk/instance';
import { dateLocale, useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { useGatewayRestart } from '../hooks/useGatewayRestart';
import { RestartGatewayRow } from './RestartGatewayRow';
import { MarkdownBlocks } from './MarkdownBlocks';
import { parseMarkdown } from '../lib/markdown';
import { errorMessage } from '../lib/errorCodes';
import { panel, inputStyle, buttonStyle, primaryButton, dangerButton, hint, PanelGate, sectionTitle, row, StatusDot, FeedbackNote } from '../ui';
import {
  actErrorKey,
  DEFAULT_HOUR,
  engineLabelKey,
  fmtTokens,
  HOURS,
  offerFreeEngine,
  runningNow,
  scheduleHour,
  watchCost,
  type WatchesData,
  type WatchView,
} from '../lib/watches';

interface Report { id: string; file: string; at: string; text: string; truncated: boolean }

export function WatchesPanel() {
  const { t, lang } = useI18n();
  const locale = dateLocale(lang);
  const { state, reload } = usePanelData<WatchesData>(() => sdk.invoke<WatchesData>('hermes.watches', {}));
  const [topic, setTopic] = useState('');
  const [hour, setHour] = useState(DEFAULT_HOUR);
  const [deliver, setDeliver] = useState<'local' | 'telegram'>('local');
  const [braveKey, setBraveKey] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<{ tone: 'ok' | 'note'; key: string } | null>(null);
  const [needsRestart, setNeedsRestart] = useState(false);
  const [report, setReport] = useState<Report | null>(null);
  const confirm = useConfirm<string>();
  const { restart, run: runRestart } = useGatewayRestart();

  const act = useCallback(async (key: string, payload: Record<string, unknown>, okKey: string | null) => {
    setBusy(key);
    setNote(null);
    try {
      await sdk.invoke('hermes.watchAct', payload);
      if (okKey) setNote({ tone: 'ok', key: okKey });
      await reload(true);
      return true;
    } catch (err) {
      setNote({ tone: 'note', key: actErrorKey(errorMessage(err)) });
      return false;
    } finally {
      setBusy(null);
    }
  }, [reload]);

  const create = useCallback(async () => {
    const text = topic.trim();
    if (!text) return;
    if (await act('create', { op: 'create', topic: text, hour, deliver }, 'watches.created')) setTopic('');
  }, [act, topic, hour, deliver]);

  const searchCall = useCallback(async (key: string, action: string, payload: Record<string, unknown>, okKey: string) => {
    setBusy(key);
    setNote(null);
    try {
      await sdk.invoke(action, payload);
      setNote({ tone: 'ok', key: okKey });
      setNeedsRestart(true);
      setBraveKey('');
      await reload(true);
    } catch (err) {
      setNote({ tone: 'note', key: actErrorKey(errorMessage(err)) });
    } finally {
      setBusy(null);
    }
  }, [reload]);

  const openReport = useCallback(async (id: string, file?: string) => {
    setBusy(`report:${id}`);
    setNote(null);
    try {
      const r = await sdk.invoke<Omit<Report, 'id'>>('hermes.watchReport', { id, ...(file ? { file } : {}) });
      setReport({ id, ...r });
    } catch (err) {
      setNote({ tone: 'note', key: actErrorKey(errorMessage(err)) });
    } finally {
      setBusy(null);
    }
  }, []);

  const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' }) : '—');

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(data) => (
        <div style={{ display: 'grid', gap: 12 }}>
          {/* What a watch needs to run at all. */}
          <div style={panel}>
            <h2 style={{ ...sectionTitle, margin: '0 0 6px' }}>{t('watches.heading')}</h2>
            <p style={{ ...hint, margin: '0 0 12px' }}>{t('watches.intro')}</p>
            <div style={{ display: 'grid', gap: 8, fontSize: 13 }}>
              <span>
                <StatusDot on={data.search.engine !== null} />
                {t('watches.engineLine', { engine: t(engineLabelKey(data.search.engine), { name: data.search.engine ?? '' }) })}
              </span>
              <span>
                <StatusDot on={data.gatewayRunning} />
                {data.gatewayRunning ? t('watches.gatewayOn') : t('watches.gatewayOff')}
              </span>
              <label style={{ ...row, gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={data.keepAwake.enabled}
                  disabled={busy === 'keepAwake'}
                  onChange={(e) => void act('keepAwake', { op: 'keepAwake', on: e.target.checked }, null)}
                />
                {t('watches.keepAwake')}
              </label>
              <span style={{ ...hint, marginLeft: 24 }}>
                {data.keepAwake.holding ? t('watches.keepAwakeHolding') : t('watches.keepAwakeIdle')}
                {' '}{t('watches.keepAwakeLimit')}
              </span>
            </div>
          </div>

          {/* The search engine: free in one click, or the person's own Brave key. */}
          <div style={panel}>
            <h3 style={{ ...sectionTitle, fontSize: 14 }}>{t('watches.engineHeading')}</h3>
            <div style={{ display: 'grid', gap: 10, maxWidth: 560 }}>
              {offerFreeEngine(data.search) ? (
                <div style={row}>
                  <button
                    onClick={() => void searchCall('free', 'hermes.searchFreeInstall', {}, 'watches.freeInstalled')}
                    disabled={busy !== null}
                    style={data.search.engine === null ? primaryButton : buttonStyle}
                  >
                    {busy === 'free' ? t('watches.freeInstalling') : t('watches.freeInstall')}
                  </button>
                  <span style={hint}>{t('watches.freeHint')}</span>
                </div>
              ) : (
                <span style={hint}>{t('watches.freeReady')}</span>
              )}
              <span style={hint}>{data.search.braveKey ? t('watches.braveSet') : t('watches.braveIntro')}</span>
              <div style={{ ...row, gap: 8 }}>
                <input
                  type="password"
                  value={braveKey}
                  onChange={(e) => setBraveKey(e.target.value)}
                  placeholder={t('watches.braveLabel')}
                  aria-label={t('watches.braveLabel')}
                  autoComplete="off"
                  style={{ ...inputStyle, flex: 1, minWidth: 220 }}
                />
                <button
                  onClick={() => void searchCall('brave', 'hermes.searchSetBrave', { key: braveKey.trim() }, 'watches.braveSaved')}
                  disabled={busy !== null || !braveKey.trim()}
                  style={buttonStyle}
                >
                  {t('watches.braveSave')}
                </button>
                {data.search.braveKey && (
                  <button
                    onClick={() => { if (confirm.press('brave-remove')) void searchCall('brave', 'hermes.searchSetBrave', { key: null }, 'watches.braveRemoved'); }}
                    disabled={busy !== null}
                    style={dangerButton}
                  >
                    {confirm.armed === 'brave-remove' ? t('watches.confirmAgain') : t('watches.braveRemove')}
                  </button>
                )}
              </div>
              {needsRestart && <RestartGatewayRow restart={restart} onRestart={() => void runRestart()} />}
            </div>
          </div>

          {/* A new watch. */}
          <div style={panel}>
            <h3 style={{ ...sectionTitle, fontSize: 14 }}>{t('watches.newHeading')}</h3>
            <div style={{ display: 'grid', gap: 10 }}>
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void create(); }}
                placeholder={t('watches.topicPlaceholder')}
                aria-label={t('watches.topicLabel')}
                maxLength={200}
                style={inputStyle}
              />
              <div style={{ ...row, gap: 16 }}>
                <label style={{ ...row, gap: 6, fontSize: 13 }}>
                  {t('watches.hourLabel')}
                  <select value={hour} onChange={(e) => setHour(Number(e.target.value))} style={{ ...inputStyle, width: 'auto' }}>
                    {HOURS.map((h) => <option key={h} value={h}>{`${String(h).padStart(2, '0')}:00`}</option>)}
                  </select>
                </label>
                <label style={{ ...row, gap: 6, fontSize: 13 }}>
                  <input type="radio" checked={deliver === 'local'} onChange={() => setDeliver('local')} />
                  {t('watches.deliverLocal')}
                </label>
                <label style={{ ...row, gap: 6, fontSize: 13, opacity: data.telegram ? 1 : 0.5 }}>
                  <input type="radio" checked={deliver === 'telegram'} disabled={!data.telegram} onChange={() => setDeliver('telegram')} />
                  {t('watches.deliverTelegram')}
                </label>
              </div>
              {!data.telegram && <span style={hint}>{t('watches.telegramHint')}</span>}
              <div style={row}>
                <button onClick={() => void create()} disabled={busy !== null || !topic.trim()} style={primaryButton}>
                  {busy === 'create' ? t('watches.creating') : t('watches.create')}
                </button>
                {data.search.engine === null && <span style={hint}>{t('watches.noEngineWarn')}</span>}
              </div>
            </div>
          </div>

          {note && <FeedbackNote tone={note.tone}>{t(note.key)}</FeedbackNote>}

          {/* The watches. */}
          {data.watches.length === 0 && <span style={hint}>{t('watches.empty')}</span>}
          {data.watches.map((w) => (
            <WatchCard
              key={w.id}
              watch={w}
              busy={busy}
              armed={confirm.armed}
              fmtDate={fmtDate}
              locale={locale}
              onReport={(file) => void openReport(w.id, file)}
              onRun={() => void act(`run:${w.id}`, { op: 'run', id: w.id }, 'watches.runQueued')}
              onToggle={() => void act(`toggle:${w.id}`, { op: w.state === 'paused' ? 'resume' : 'pause', id: w.id }, null)}
              onRemove={() => { if (confirm.press(`remove:${w.id}`)) void act(`remove:${w.id}`, { op: 'remove', id: w.id }, 'watches.removed'); }}
              report={report && report.id === w.id ? report : null}
              onCloseReport={() => setReport(null)}
            />
          ))}
        </div>
      )}
    </PanelGate>
  );
}

function WatchCard(props: {
  watch: WatchView;
  busy: string | null;
  armed: string | null;
  fmtDate: (iso: string | null) => string;
  locale: string;
  onReport: (file?: string) => void;
  onRun: () => void;
  onToggle: () => void;
  onRemove: () => void;
  report: Report | null;
  onCloseReport: () => void;
}) {
  const { t } = useI18n();
  const { watch: w, busy, armed, fmtDate, locale, report } = props;
  const hourOf = scheduleHour(w.schedule);
  const cost = watchCost(w.runs);
  const paused = w.state === 'paused';
  const live = runningNow(w.runs);

  return (
    <div style={panel}>
      <div style={{ ...row, justifyContent: 'space-between' }}>
        <strong style={{ fontSize: 13 }}>{w.name}</strong>
        <span style={{ fontSize: 12 }}>
          <StatusDot on={!paused && w.enabled} />
          {live ? t('watches.stateRunning') : paused ? t('watches.statePaused') : t('watches.stateScheduled')}
        </span>
      </div>
      <div style={{ display: 'grid', gap: 4, marginTop: 6, fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>
        <span>
          {hourOf !== null ? t('watches.everyNight', { hour: `${String(hourOf).padStart(2, '0')}:00` }) : t('watches.schedule', { s: w.schedule })}
          {' · '}{w.deliver === 'telegram' ? t('watches.deliverTelegram') : t('watches.deliverLocal')}
        </span>
        {!paused && <span>{t('watches.next', { at: fmtDate(w.nextRunAt) })}</span>}
        <span>
          {w.lastRunAt ? t('watches.last', { at: fmtDate(w.lastRunAt) }) : t('watches.neverRan')}
          {w.lastStatus === 'error' && w.lastError && ` · ${t('watches.lastFailed')} ${w.lastError.slice(0, 160)}`}
        </span>
        <span>
          {t('watches.cost', { last: fmtTokens(cost.last, locale), mean: fmtTokens(cost.mean, locale) })}
          {cost.unmeasured > 0 && ` · ${t('watches.costUnmeasured', { n: cost.unmeasured })}`}
        </span>
        {cost.measured > 0 && <span style={{ ...hint, fontSize: 11 }}>{t('watches.costHow')}</span>}
        {!w.narrowed && <span style={{ ...hint, fontSize: 11 }}>{t('watches.notNarrowed')}</span>}
      </div>

      <div style={{ ...row, gap: 8, marginTop: 10 }}>
        <button onClick={() => props.onReport()} disabled={busy !== null || w.reports.length === 0} style={primaryButton}>
          {w.reports.length === 0 ? t('watches.noReportYet') : t('watches.readLatest')}
        </button>
        <button onClick={props.onRun} disabled={busy !== null || live} style={buttonStyle}>{t('watches.runNow')}</button>
        <button onClick={props.onToggle} disabled={busy !== null} style={buttonStyle}>{paused ? t('watches.resume') : t('watches.pause')}</button>
        <button onClick={props.onRemove} disabled={busy !== null} style={dangerButton}>
          {armed === `remove:${w.id}` ? t('watches.confirmAgain') : t('watches.remove')}
        </button>
      </div>

      {report && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--border-subtle, #2a2a2a)', paddingTop: 10 }}>
          <div style={{ ...row, justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12 }}>{t('watches.reportOf', { at: fmtDate(report.at) })}</span>
            <div style={{ ...row, gap: 8 }}>
              {w.reports.length > 1 && (
                <select
                  value={report.file}
                  onChange={(e) => props.onReport(e.target.value)}
                  aria-label={t('watches.olderReports')}
                  style={{ ...inputStyle, width: 'auto', fontSize: 12 }}
                >
                  {w.reports.map((r) => <option key={r.file} value={r.file}>{fmtDate(r.at)}</option>)}
                </select>
              )}
              <button onClick={props.onCloseReport} style={buttonStyle}>{t('watches.closeReport')}</button>
            </div>
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 8 }}>
            <MarkdownBlocks blocks={parseMarkdown(report.text)} />
          </div>
          {report.truncated && <span style={hint}>{t('watches.truncated')}</span>}
        </div>
      )}
    </div>
  );
}
