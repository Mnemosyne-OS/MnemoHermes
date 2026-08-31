/**
 * The provenance inbox (M4) — every chronicle the agent wrote through the
 * MCP, under human veto: keep (durable state, cartridge-side), move
 * (re-ingest then forget, host-side), reject (forget). Verdicts filter the
 * list locally — no refetch, the host already executed them.
 */
import { useMemo, useState } from 'react';
import { sdk } from '../sdk/instance';
import { dateLocale, useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { panel, inputStyle, buttonStyle, primaryButton, hint, Pill, PanelGate, stack } from '../ui';
import { itemKey, type InboxItem, type InboxReport } from '../types';

export function InboxPanel({ reviewedIds, onKeep }: { reviewedIds: string[]; onKeep: (key: string) => void }) {
  const { t, lang } = useI18n();
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
      await sdk.invoke('hermes.inboxMove', {
        vaultId: item.vaultId,
        chronicleId: item.chronicleId,
        targetVaultId
      });
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
            {actionError && (
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary, #aaa)' }}>{actionError}</p>
            )}
            {items.length === 0 && <div style={panel}>{t('inbox.empty')}</div>}
            {items.map((item) => {
              const key = itemKey(item);
              const disabled = busy !== null;
              const armed = confirm.armed === key;
              return (
                <div key={key} style={panel}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                    <Pill>{item.vaultName}</Pill>
                    <Pill>{item.spineType}</Pill>
                    <span style={{ ...hint, fontSize: 11 }}>
                      {new Date(item.createdAt).toLocaleString(dateLocale(lang))}
                    </span>
                  </div>
                  <p style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {item.excerpt}
                  </p>
                  {item.multiPart ? (
                    <p style={{ ...hint, margin: 0 }}>{t('inbox.multiPart')}</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <button onClick={() => onKeep(key)} disabled={disabled} style={primaryButton}>
                        {t('inbox.keep')}
                      </button>
                      {moving === key ? (
                        <select
                          autoFocus
                          defaultValue=""
                          disabled={disabled}
                          onChange={(e) => { if (e.target.value) void move(item, e.target.value); }}
                          style={inputStyle}
                        >
                          <option value="" disabled>{t('inbox.moveTo')}</option>
                          {report.targets
                            .filter((v) => v.vaultId !== item.vaultId)
                            .map((v) => (
                              <option key={v.vaultId} value={v.vaultId}>{v.displayName}</option>
                            ))}
                        </select>
                      ) : (
                        <button
                          onClick={() => { setMoving(key); confirm.cancel(); }}
                          disabled={disabled}
                          style={buttonStyle}
                        >
                          {t('inbox.move')}
                        </button>
                      )}
                      <button
                        onClick={() => { setMoving(null); if (confirm.press(key)) void reject(item); }}
                        disabled={disabled}
                        style={{
                          ...buttonStyle,
                          color: armed ? 'var(--bg-void, #050505)' : 'var(--text-secondary, #aaa)',
                          background: armed ? 'var(--text-secondary, #aaa)' : 'var(--bg-input, #181818)'
                        }}
                      >
                        {armed ? t('inbox.confirm') : t('inbox.reject')}
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      }}
    </PanelGate>
  );
}
