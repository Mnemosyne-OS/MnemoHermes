/**
 * The Skills tab — the shelf of know-how sheets Hermes reads when a task
 * fits, and what a person can do about it.
 *
 * 2026-09-23, two passes. First: the card handed the person a terminal
 * command; it is a button now. Second ("c'est une liste, c'est tout ?"):
 * every row has a switch (`skills.disabled` in config.yaml, written whole),
 * says where it came from, and offers Uninstall when it did not come with
 * Hermes; a "My skills" card opens the folder and imports one; an
 * "Advanced" fold installs any identifier through Hermes' installer with
 * its scan — folded on purpose, a skill is a script a stranger ships.
 *
 * Every install/uninstall job is polled while it runs: a clock and the
 * installer's lines, never a percentage nobody measured.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useGatewayRestart } from '../hooks/useGatewayRestart';
import { panel, inputStyle, primaryButton, buttonStyle, dangerButton, hint, Pill, StatusDot, PanelGate, CodeBlock, FeedbackNote, cardTitle, stack, row } from '../ui';
import {
  canUninstall, filterSkills, installErrorCode, isValidSkillIdentifier, skillCategories, toggleDisabled, type SkillEntry,
} from '../lib/skills';
import { formatClock } from '../lib/managedInstall';
import { RestartGatewayRow } from './RestartGatewayRow';

interface SkillsReport {
  skills: SkillEntry[];
  taps: string[];
  mnemosyneMemoryInstalled: boolean;
  disabled: string[] | null;
}

interface JobState {
  running: boolean;
  job: { kind: 'install' | 'uninstall'; target: string } | null;
  startedAt: string | null;
  finishedAt: string | null;
  lines: string[];
  error: string | null;
  ok: boolean | null;
}

/** How many installer lines a card shows (the rest is in the host log). */
const OUTPUT_TAIL = 8;
/** Poll cadence for a job in flight. */
const WATCH_MS = 1000;
const DANGER = 'var(--danger, #d9534f)';

export function SkillsPanel() {
  const { state, reload } = usePanelData<SkillsReport>(
    () => sdk.invoke<SkillsReport>('hermes.skills', {}),
    /unknown action|not supported|NOT_INSTALLED/i,
  );
  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {/* Silent: a loading flash would unmount the shelf, throw the scroll
          back to the top and forget the search and the category. */}
      {(report) => <Shelf report={report} reload={() => void reload(true)} />}
    </PanelGate>
  );
}

/** The one job the host runs at a time, as the panel follows it. */
type Job = { phase: 'idle' } | { phase: 'running'; kind: 'install' | 'uninstall'; target: string } | { phase: 'ok'; kind: 'install' | 'uninstall'; target: string; lines: string[] } | { phase: 'error'; kind: 'install' | 'uninstall'; target: string; error: string; lines: string[] };

/** A top-level component so its inputs keep their state across renders. */
function Shelf({ report, reload }: { report: SkillsReport; reload: () => void }) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [job, setJob] = useState<Job>({ phase: 'idle' });
  const [live, setLive] = useState<JobState | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [identifier, setIdentifier] = useState('');
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  // 'idle' | 'saved' | a refusal code from main.
  const [disabledNote, setDisabledNote] = useState<string>('idle');
  const [disabledBusy, setDisabledBusy] = useState(false);
  // 'idle' | 'imported' | 'cancelled' | a refusal code from main.
  const [folderNote, setFolderNote] = useState<string>('idle');
  const [importedName, setImportedName] = useState<string | null>(null);
  const { restart, run: restartGateway, reset: resetRestart } = useGatewayRestart();

  const running = job.phase === 'running';

  // While a job runs: poll the host for its lines and tick the clock.
  useEffect(() => {
    if (!running) return;
    const load = async () => {
      try {
        setLive(await sdk.invoke<JobState>('hermes.skillInstallStatus', {}));
      } catch {
        // The verdict comes from the job's own call; a failed poll only
        // leaves the clock without lines for a second.
      }
    };
    void load();
    const poll = setInterval(() => { void load(); }, WATCH_MS);
    const tick = setInterval(() => setNowMs(Date.now()), 1000);
    return () => { clearInterval(poll); clearInterval(tick); };
  }, [running]);

  const startedMs = live?.startedAt ? Date.parse(live.startedAt) : NaN;
  const elapsed = running && Number.isFinite(startedMs) ? Math.max(0, Math.floor((nowMs - startedMs) / 1000)) : null;
  const clock = elapsed === null ? '' : formatClock(elapsed);

  const categories = useMemo(() => skillCategories(report.skills), [report.skills]);
  const shown = useMemo(() => filterSkills(report.skills, query, category), [report.skills, query, category]);
  const jobLines = job.phase === 'ok' || job.phase === 'error' ? job.lines : running ? live?.lines ?? [] : [];
  const tail = jobLines.slice(-OUTPUT_TAIL);

  const runJob = async (kind: 'install' | 'uninstall', target: string, call: () => Promise<{ lines?: string[] } | undefined>) => {
    setJob({ phase: 'running', kind, target });
    setLive(null);
    resetRestart();
    try {
      const data = await call();
      setJob({ phase: 'ok', kind, target, lines: data?.lines ?? [] });
    } catch (err) {
      // The SDK rejection carries the code, not the installer's lines: read
      // the settled job once more so "see the lines below" has lines below.
      let lines: string[] = [];
      try { lines = (await sdk.invoke<JobState>('hermes.skillInstallStatus', {})).lines; } catch { lines = live?.lines ?? []; }
      setJob({ phase: 'error', kind, target, error: installErrorCode(err instanceof Error ? err.message : String(err)), lines });
    } finally {
      // The shelf is the verdict, on success and on a refusal alike.
      reload();
    }
  };

  const installCovenant = () => runJob('install', 'mnemosyne-memory', () => sdk.invoke('hermes.skillInstall', {}));
  const installIdentifier = () => {
    const id = identifier.trim();
    void runJob('install', id, async () => {
      const data = await sdk.invoke<{ lines: string[] }>('hermes.skillInstall', { identifier: id });
      setIdentifier('');
      return data;
    });
  };
  const uninstall = (name: string) => {
    setConfirmRemove(null);
    void runJob('uninstall', name, () => sdk.invoke('hermes.skillUninstall', { name }));
  };

  const toggle = async (s: SkillEntry) => {
    if (report.disabled === null || disabledBusy) return;
    setDisabledBusy(true);
    setDisabledNote('idle');
    resetRestart();
    try {
      await sdk.invoke('hermes.skillsSetDisabled', { disabled: toggleDisabled(report.disabled, s.id, s.essential) });
      setDisabledNote('saved');
    } catch (err) {
      setDisabledNote(installErrorCode(err instanceof Error ? err.message : String(err)));
    } finally {
      setDisabledBusy(false);
      reload();
    }
  };

  const openFolder = async () => {
    setFolderNote('idle');
    try {
      await sdk.invoke('hermes.skillsOpenFolder', {});
    } catch (err) {
      setFolderNote(installErrorCode(err instanceof Error ? err.message : String(err)));
    }
  };

  const importFolder = async () => {
    setFolderNote('idle');
    setImportedName(null);
    resetRestart();
    try {
      // A native folder picker is paced by the person: no timeout (SDK convention).
      const data = await sdk.invoke<{ cancelled: boolean; name?: string }>('hermes.skillImport', {}, 0);
      if (data.cancelled) { setFolderNote('cancelled'); return; }
      setImportedName(data.name ?? null);
      setFolderNote('imported');
      reload();
    } catch (err) {
      setFolderNote(installErrorCode(err instanceof Error ? err.message : String(err)));
    }
  };

  const jobFeedback = (kind: 'install' | 'uninstall') => {
    if (job.phase === 'idle' || job.kind !== kind) return null;
    if (job.phase === 'running') return <p style={{ ...hint, margin: '8px 0 0' }}>{t(kind === 'install' ? 'skills.installingWhat' : 'skills.uninstallingWhat')}</p>;
    if (job.phase === 'ok') return <p style={{ margin: '8px 0 0' }}><FeedbackNote tone="ok">{t(kind === 'install' ? 'skills.installed' : 'skills.uninstalled', { name: job.target })}</FeedbackNote></p>;
    return <p style={{ margin: '8px 0 0' }}><FeedbackNote tone="note">{t(`skills.installError.${job.error}`)}</FeedbackNote></p>;
  };

  return (
    <div style={stack}>
      <p style={{ ...hint, margin: 0, fontSize: 13 }}>{t('skills.intro')}</p>

      {/* ── The covenant skill ── */}
      <div style={{ ...panel, borderColor: report.mnemosyneMemoryInstalled ? 'var(--accent, #35c9a6)' : 'var(--border-subtle, #2a2a2a)' }}>
        <div style={{ ...row, gap: 10 }}>
          <span style={{ fontSize: 13 }}>
            <StatusDot on={report.mnemosyneMemoryInstalled} />
            {report.mnemosyneMemoryInstalled ? t('skills.ourInstalled') : t('skills.ourMissing')}
          </span>
          {!report.mnemosyneMemoryInstalled && (
            <button onClick={() => void installCovenant()} disabled={running} style={{ ...primaryButton, marginLeft: 'auto' }}>
              {running && job.target === 'mnemosyne-memory' ? t('skills.installingClock', { clock }) : t('skills.install')}
            </button>
          )}
        </div>
        {!report.mnemosyneMemoryInstalled && job.phase === 'idle' && <p style={{ ...hint, margin: '8px 0 0' }}>{t('skills.ourWhy')}</p>}
        {job.phase !== 'idle' && job.kind === 'install' && job.target === 'mnemosyne-memory' && jobFeedback('install')}
        {job.phase === 'ok' && job.kind === 'install' && job.target === 'mnemosyne-memory' && (
          <div style={{ marginTop: 8 }}><RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} /></div>
        )}
        {job.phase !== 'idle' && job.target === 'mnemosyne-memory' && tail.length > 0 && (
          <CodeBlock variant="snippet" style={{ margin: '10px 0 0' }}>{tail.join('\n')}</CodeBlock>
        )}
      </div>

      {/* ── The shelf ── */}
      <div style={panel}>
        <h2 style={{ ...cardTitle, marginBottom: 6 }}>{t('skills.count', { n: report.skills.length })}</h2>
        <p style={{ ...hint, margin: '0 0 12px' }}>{t('skills.shelfHint')}</p>
        {report.disabled === null && <p style={{ ...hint, margin: '0 0 12px', color: DANGER }}>{t('skills.disabledUnreadable')}</p>}
        {report.skills.length === 0 ? (
          <p style={{ ...hint, margin: 0, fontSize: 13 }}>{t('skills.empty')}</p>
        ) : (
          <>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('skills.search')} style={{ ...inputStyle, maxWidth: 360, marginBottom: 10 }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              <CategoryChip active={category === null} onClick={() => setCategory(null)}>{t('skills.allCategories')}</CategoryChip>
              {categories.map((c) => (
                <CategoryChip key={c} active={category === c} onClick={() => setCategory(category === c ? null : c)}>{c}</CategoryChip>
              ))}
            </div>
            {shown.length === 0 && <p style={{ ...hint, margin: 0, fontSize: 13 }}>{t('skills.noMatch')}</p>}
            <div style={{ display: 'grid', gap: 10 }}>
              {shown.map((s) => (
                <div key={`${s.category ?? ''}/${s.id}`} style={{ ...row, gap: 10, alignItems: 'flex-start', fontSize: 13, lineHeight: 1.5, opacity: s.enabled ? 1 : 0.55 }}>
                  <label title={s.essential ? t('skills.essential') : undefined} style={{ display: 'flex', alignItems: 'center', marginTop: 3, cursor: s.essential ? 'default' : 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={s.enabled}
                      disabled={s.essential || disabledBusy || report.disabled === null}
                      onChange={() => void toggle(s)}
                      aria-label={t('skills.enabledSwitch', { name: s.name ?? s.id })}
                    />
                  </label>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <span style={{ fontWeight: 600 }}>{s.name ?? s.id}</span>
                    {s.category && category === null && <span style={{ marginLeft: 8 }}><Pill>{s.category}</Pill></span>}
                    {s.origin !== 'bundled' && <span style={{ marginLeft: 8 }}><Pill>{t(`skills.origin.${s.origin}`)}</Pill></span>}
                    {s.essential && <span style={{ marginLeft: 8 }}><Pill>{t('skills.essential')}</Pill></span>}
                    {s.description && <div style={hint}>{s.description}</div>}
                  </div>
                  {canUninstall(s) && (
                    confirmRemove === s.id ? (
                      <span style={{ ...row, gap: 6 }}>
                        <button onClick={() => uninstall(s.id)} disabled={running} style={dangerButton}>{t('skills.uninstallConfirm')}</button>
                        <button onClick={() => setConfirmRemove(null)} style={buttonStyle}>{t('skills.uninstallCancel')}</button>
                      </span>
                    ) : (
                      <button onClick={() => setConfirmRemove(s.id)} disabled={running} style={buttonStyle}>
                        {running && job.kind === 'uninstall' && job.target === s.id ? t('skills.uninstallingClock', { clock }) : t('skills.uninstall')}
                      </button>
                    )
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ── My skills ── */}
      <div style={panel}>
        <h2 style={{ ...cardTitle, marginBottom: 6 }}>{t('skills.mineHeading')}</h2>
        <p style={{ ...hint, margin: '0 0 10px' }}>{t('skills.mineWhat')}</p>
        <ol style={{ ...hint, margin: '0 0 12px', paddingLeft: 20, display: 'grid', gap: 4 }}>
          <li>{t('skills.mineStep1')}</li>
          <li>{t('skills.mineStep2')}</li>
          <li>{t('skills.mineStep3')}</li>
        </ol>
        <div style={row}>
          <button onClick={() => void importFolder()} disabled={running} style={primaryButton}>{t('skills.importFolder')}</button>
          <button onClick={() => void openFolder()} style={buttonStyle}>{t('skills.openFolder')}</button>
          {folderNote === 'imported' && <FeedbackNote tone="ok">{t('skills.imported', { name: importedName ?? '' })}</FeedbackNote>}
          {folderNote === 'cancelled' && <FeedbackNote tone="note">{t('skills.importCancelled')}</FeedbackNote>}
          {folderNote !== 'idle' && folderNote !== 'imported' && folderNote !== 'cancelled' && (
            <FeedbackNote tone="note">{t(`skills.installError.${folderNote}`)}</FeedbackNote>
          )}
        </div>
        {folderNote === 'imported' && (
          <div style={{ marginTop: 8 }}><RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} /></div>
        )}
      </div>

      {/* ── Taps ── */}
      {report.taps.length > 0 && (
        <div style={panel}>
          <h2 style={cardTitle}>{t('skills.tapsHeading')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{report.taps.map((tap) => <Pill key={tap}>{tap}</Pill>)}</div>
        </div>
      )}

      {/* ── Advanced: any identifier ── */}
      <details style={{ ...panel, padding: 0 }}>
        <summary style={{ cursor: 'pointer', padding: '14px 18px', fontSize: 13, fontWeight: 600 }}>{t('skills.advancedHeading')}</summary>
        <div style={{ padding: '0 18px 16px' }}>
          <p style={{ ...hint, margin: '0 0 10px', color: DANGER }}>{t('skills.advancedWarning')}</p>
          <p style={{ ...hint, margin: '0 0 10px' }}>{t('skills.advancedHint')}</p>
          <div style={row}>
            <input
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              placeholder="owner/repo/path/to/skill"
              style={{ ...inputStyle, maxWidth: 420 }}
              disabled={running}
            />
            <button onClick={installIdentifier} disabled={running || !isValidSkillIdentifier(identifier)} style={buttonStyle}>
              {running && job.kind === 'install' && job.target !== 'mnemosyne-memory' ? t('skills.installingClock', { clock }) : t('skills.install')}
            </button>
          </div>
          {job.phase !== 'idle' && job.kind === 'install' && job.target !== 'mnemosyne-memory' && jobFeedback('install')}
          {job.phase === 'ok' && job.kind === 'install' && job.target !== 'mnemosyne-memory' && (
            <div style={{ marginTop: 8 }}><RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} /></div>
          )}
          {job.phase !== 'idle' && job.kind === 'install' && job.target !== 'mnemosyne-memory' && tail.length > 0 && (
            <CodeBlock variant="snippet" style={{ margin: '10px 0 0' }}>{tail.join('\n')}</CodeBlock>
          )}
        </div>
      </details>

      {/* ── What the last switch or removal did: a footer that stays in view,
            because the row that was clicked may be far down the shelf ── */}
      {(disabledNote !== 'idle' || (job.phase !== 'idle' && job.kind === 'uninstall')) && (
        <div style={{ ...panel, position: 'sticky', bottom: 8, zIndex: 2, boxShadow: 'var(--shadow-elevated, 0 -6px 20px rgba(0, 0, 0, 0.35))' }}>
          {disabledNote === 'saved' && <FeedbackNote tone="ok">{t('skills.disabledSaved')}</FeedbackNote>}
          {disabledNote !== 'idle' && disabledNote !== 'saved' && <FeedbackNote tone="note">{t(`skills.installError.${disabledNote}`)}</FeedbackNote>}
          {job.phase !== 'idle' && job.kind === 'uninstall' && jobFeedback('uninstall')}
          {job.phase !== 'idle' && job.kind === 'uninstall' && tail.length > 0 && <CodeBlock variant="snippet" style={{ margin: '10px 0 0' }}>{tail.join('\n')}</CodeBlock>}
          {(disabledNote === 'saved' || (job.phase === 'ok' && job.kind === 'uninstall')) && (
            <div style={{ marginTop: 8 }}><RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} /></div>
          )}
        </div>
      )}
    </div>
  );
}

function CategoryChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        border: '1px solid var(--border-subtle, #2a2a2a)',
        background: active ? 'var(--accent, #35c9a6)' : 'transparent',
        color: active ? 'var(--bg-primary, #111)' : 'var(--text-secondary, #aaa)',
        cursor: 'pointer',
        fontSize: 12,
      }}
    >
      {children}
    </button>
  );
}
