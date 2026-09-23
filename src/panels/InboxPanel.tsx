/**
 * The provenance inbox (M4) — every chronicle the agent wrote through the
 * MCP, under human veto: keep (durable state, cartridge-side), move
 * (re-ingest then forget, host-side), reject (forget). Verdicts filter the
 * list locally — no refetch, the host already executed them.
 *
 * 2026-09-23: tiles instead of a column of raw text. Each tile reads its
 * note as markdown (headings, lists, bold), takes its title from the first
 * heading, folds past a few lines with "Read more", and ends with the
 * origin line as a footer: who wrote it, when, for what task. The host
 * now only lists chronicles SIGNED by that line (not documents quoting it).
 */
import { useMemo, useState } from 'react';
import { sdk } from '../sdk/instance';
import { dateLocale, useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { panel, inputStyle, buttonStyle, primaryButton, hint, Pill, PanelGate, stack, row } from '../ui';
import { itemKey, type InboxItem, type InboxReport } from '../types';
import { markdownTitle, parseMarkdown } from '../lib/markdown';
import { MarkdownBlocks } from './MarkdownBlocks';

/** Folded height of a tile's body, before "Read more". */
const FOLD_PX = 160;

export function InboxPanel({ reviewedIds, onKeep }: { reviewedIds: string[]; onKeep: (key: string) => void }) {
  const { t } = useI18n();
  const { state, setState, reload } = usePanelData<InboxReport>(
    () => sdk.invoke<InboxReport>('hermes.inbox', {}),
  );
  const [moving, setMoving] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm<string>();

  // A membership test per item per render: a Set, so a long ledger does not
  // turn the list into a quadratic scan.
  const reviewed = useMemo(() => new Set(reviewedIds), [reviewedIds]);

  const dropItem = (key: string) => {
    setState((cur) => cur.kind === 'data'
      ? { kind: 'data', data: { ...cur.data, items: cur.data.items.filter((i) => itemKey(i) !== key) } }
      : cur);
  };

  const reject = async (item: InboxItem) => {
    const key = itemKey(item);
    setBusy(key);
    setActionError(null);
    try {
      await sdk.invoke('hermes.inboxReject', { vaultId: item.vaultId, chronicleId: item.chronicleId });
      dropItem(key);
    } catch {
      setActionError(t('common.error'));
    } finally {
      setBusy(null);
      confirm.cancel();
    }
  };

  const move = async (item: InboxItem, targetVaultId: string) => {
    const key = itemKey(item);
    setBusy(key);
    setActionError(null);
    try {
      await sdk.invoke('hermes.inboxMove', { vaultId: item.vaultId, chronicleId: item.chronicleId, targetVaultId });
      dropItem(key);
    } catch {
      setActionError(t('common.error'));
    } finally {
      setBusy(null);
      setMoving(null);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(report) => {
        const items = report.items.filter((i) => !reviewed.has(itemKey(i)));
        return (
          <div style={stack}>
            <p style={{ ...hint, margin: 0 }}>{t('inbox.intro')}</p>
            {actionError && <p style={{ margin: 0, fontSize: 12, color: 'var(--danger, #d9534f)' }}>{actionError}</p>}
            {items.length === 0 && (
              <div style={panel}>
                <p style={{ margin: 0, fontSize: 13 }}>{t('inbox.empty')}</p>
                <p style={{ ...hint, margin: '6px 0 0' }}>{t('inbox.emptyHint')}</p>
              </div>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14, alignItems: 'start' }}>
              {items.map((item) => {
                const key = itemKey(item);
                return (
                  <Tile
                    key={key}
                    item={item}
                    targets={report.targets}
                    disabled={busy !== null}
                    armed={confirm.armed === key}
                    moving={moving === key}
                    onKeep={() => onKeep(key)}
                    onMoveOpen={() => { setMoving(key); confirm.cancel(); }}
                    onMoveTo={(v) => void move(item, v)}
                    onReject={() => { setMoving(null); if (confirm.press(key)) void reject(item); }}
                  />
                );
              })}
            </div>
          </div>
        );
      }}
    </PanelGate>
  );
}

function Tile({ item, targets, disabled, armed, moving, onKeep, onMoveOpen, onMoveTo, onReject }: {
  item: InboxItem;
  targets: InboxReport['targets'];
  disabled: boolean;
  armed: boolean;
  moving: boolean;
  onKeep: () => void;
  onMoveOpen: () => void;
  onMoveTo: (vaultId: string) => void;
  onReject: () => void;
}) {
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const blocks = useMemo(() => parseMarkdown(item.body || item.excerpt), [item.body, item.excerpt]);
  const title = useMemo(() => markdownTitle(blocks), [blocks]);
  // The block the title came from is not painted a second time under it.
  const body = useMemo(() => (title && blocks[0] && blocks[0].kind === 'heading' ? blocks.slice(1) : blocks), [blocks, title]);
  // Fold only what is worth folding: a short note shows whole.
  const foldable = (item.body || item.excerpt).length > 420 || blocks.length > 4;

  return (
    <div style={{ ...panel, display: 'grid', gap: 10 }}>
      <div style={{ ...row, gap: 8 }}>
        <Pill>{item.vaultName}</Pill>
        <Pill>{item.spineType}</Pill>
        <span style={{ ...hint, fontSize: 11, marginLeft: 'auto' }}>{new Date(item.createdAt).toLocaleString(dateLocale(lang))}</span>
      </div>
      {title && <div style={{ fontWeight: 600, fontSize: 14, lineHeight: 1.3 }}>{title}</div>}
      <div style={{ position: 'relative', maxHeight: open || !foldable ? undefined : FOLD_PX, overflow: 'hidden' }}>
        <MarkdownBlocks blocks={body} />
        {foldable && !open && (
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 48, background: 'linear-gradient(transparent, var(--bg-panel, #101010))' }} />
        )}
      </div>
      {(foldable || item.bodyTruncated) && (
        <button onClick={() => setOpen((v) => !v)} style={{ ...buttonStyle, padding: '2px 8px', fontSize: 12, justifySelf: 'start' }}>
          {open ? t('inbox.readLess') : t('inbox.readMore')}
        </button>
      )}
      {item.bodyTruncated && open && <p style={{ ...hint, margin: 0 }}>{t('inbox.bodyTruncated')}</p>}
      <div style={{ ...hint, fontSize: 11, borderTop: '1px solid var(--border-subtle, #2a2a2a)', paddingTop: 8 }}>
        {t('inbox.writtenBy')}
        {item.provenance.date && ` · ${item.provenance.date}`}
        {item.provenance.task && ` · ${t('inbox.task', { task: item.provenance.task })}`}
      </div>
      {item.multiPart ? (
        <p style={{ ...hint, margin: 0 }}>{t('inbox.multiPart')}</p>
      ) : (
        <div style={{ ...row, gap: 8 }}>
          <button onClick={onKeep} disabled={disabled} style={primaryButton}>{t('inbox.keep')}</button>
          {moving ? (
            <select autoFocus defaultValue="" disabled={disabled} onChange={(e) => { if (e.target.value) onMoveTo(e.target.value); }} style={inputStyle}>
              <option value="" disabled>{t('inbox.moveTo')}</option>
              {targets.filter((v) => v.vaultId !== item.vaultId).map((v) => <option key={v.vaultId} value={v.vaultId}>{v.displayName}</option>)}
            </select>
          ) : (
            <button onClick={onMoveOpen} disabled={disabled} style={buttonStyle}>{t('inbox.move')}</button>
          )}
          <button
            onClick={onReject}
            disabled={disabled}
            style={{
              ...buttonStyle,
              marginLeft: 'auto',
              color: armed ? 'var(--bg-void, #050505)' : 'var(--danger, #d9534f)',
              background: armed ? 'var(--danger, #d9534f)' : 'var(--bg-input, #181818)',
              borderColor: 'var(--danger, #d9534f)',
            }}
          >
            {armed ? t('inbox.confirm') : t('inbox.reject')}
          </button>
        </div>
      )}
    </div>
  );
}
