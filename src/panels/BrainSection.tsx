/**
 * The brain proxy controls (doc 81): Hermes thinks with the OS's brain.
 * Toggle + daily call cap + the two apply-to-Hermes buttons (model block,
 * auxiliary routing) + the paste block. Lives in Settings AND as the
 * wizard's brain step.
 */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { usePanelData } from '../hooks/usePanelData';
import { useConfirm } from '../hooks/useConfirm';
import { panel, inputStyle, buttonStyle, primaryButton, hint, StatusDot, PanelGate, CodeBlock, FeedbackNote, sectionTitle, row } from '../ui';
import { fmtUsd } from '../lib/format';
import { hermesModelYaml } from '../lib/hermesConfig';

interface ProxyStatus {
  enabled: boolean;
  port: number;
  dailyCallCap: number;
  running: boolean;
  callsToday: number;
  /** Whether the configured Mnemosyne route can execute agent tools natively. */
  nativeTools: boolean;
  /** Real credits-route spend today, micro-USD (gate debits) — a FLOOR when
   *  pricedCalls < sponsoredCalls (some calls had no known cost, omitted not zeroed). */
  spentTodayUsdMicro: number;
  pricedCalls: number;
  sponsoredCalls: number;
  key: string | null;
}

/** The two writes into Hermes' own config, and the action behind each. */
const APPLIES = [
  { id: 'model', action: 'hermes.proxyApplyConfig', label: 'brain.apply', primary: true },
  { id: 'aux', action: 'hermes.proxyApplyAux', label: 'brain.auxApply', primary: false },
] as const;

type ApplyVerdict = 'done' | 'error';

export function BrainSection() {
  const { t } = useI18n();
  const { state, setState, reload } = usePanelData<ProxyStatus>(
    () => sdk.invoke<ProxyStatus>('hermes.proxyStatus', {}),
  );
  const [busy, setBusy] = useState(false);
  const [verdicts, setVerdicts] = useState<Record<string, ApplyVerdict>>({});
  const confirm = useConfirm<string>();

  const update = async (patch: { enabled?: boolean; dailyCallCap?: number }) => {
    setBusy(true);
    try {
      const status = await sdk.invoke<ProxyStatus>('hermes.proxySetConfig', patch);
      setState({ kind: 'data', data: status });
    } catch {
      // Whatever the host actually holds is the truth to show.
      await reload();
    } finally {
      setBusy(false);
    }
  };

  /** Both buttons write Hermes' config.yaml, so both arm before they act. */
  const runApply = async (id: string, action: string) => {
    if (!confirm.press(id)) return;
    setBusy(true);
    try {
      await sdk.invoke(action, {});
      setVerdicts((v) => ({ ...v, [id]: 'done' }));
    } catch {
      setVerdicts((v) => ({ ...v, [id]: 'error' }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <PanelGate state={state} onRetry={() => void reload()}>
      {(status) => (
        <div style={panel}>
          <h2 style={{ ...sectionTitle, margin: '0 0 6px' }}>{t('brain.heading')}</h2>
          <p style={{ ...hint, margin: '0 0 14px' }}>{t('brain.intro')}</p>

          <div style={{ display: 'grid', gap: 14, fontSize: 13, maxWidth: 520 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={status.enabled}
                disabled={busy}
                onChange={(e) => void update({ enabled: e.target.checked })}
              />
              {t('brain.enable')}
              {status.enabled && (
                <span style={{ fontSize: 12, color: status.running ? 'var(--accent, #35c9a6)' : 'var(--text-muted, #666)' }}>
                  <StatusDot on={status.running} />
                  {status.running ? t('brain.running') : t('brain.stopped')}
                </span>
              )}
            </label>

            <label style={{ display: 'grid', gap: 6 }}>
              {t('brain.capLabel')}
              <input
                type="number"
                min={0}
                max={5000}
                defaultValue={status.dailyCallCap}
                disabled={busy}
                onBlur={(e) => {
                  const v = Number(e.target.value);
                  if (Number.isFinite(v) && v !== status.dailyCallCap) void update({ dailyCallCap: v });
                }}
                style={{ ...inputStyle, maxWidth: 140 }}
              />
              <span style={hint}>
                {t('brain.callsToday', { n: status.callsToday, cap: status.dailyCallCap })}
              </span>
            </label>

            {/* Live credits spend today — real gate debits (Pheme discipline: a FLOOR
                when some calls had no known cost, never a 0 dressed as free). */}
            {status.sponsoredCalls > 0 && (
              <span style={hint}>
                {t(
                  status.pricedCalls < status.sponsoredCalls ? 'brain.spentTodayFloor' : 'brain.spentToday',
                  {
                    usd: fmtUsd(status.spentTodayUsdMicro),
                    priced: status.pricedCalls,
                    total: status.sponsoredCalls,
                  },
                )}
              </span>
            )}

            {/* Honest capability line: "why doesn't my agent act?" answers here,
                not in a support thread. Follows the configured route live. */}
            <span style={hint}>
              <StatusDot on={status.nativeTools} />
              {status.nativeTools ? t('brain.toolsNative') : t('brain.toolsNone')}
            </span>

            {status.enabled && status.key && (
              <div style={{ display: 'grid', gap: 8 }}>
                {APPLIES.map((a) => (
                  <div key={a.id} style={row}>
                    <button
                      onClick={() => void runApply(a.id, a.action)}
                      disabled={busy}
                      style={a.primary ? primaryButton : buttonStyle}
                    >
                      {confirm.armed === a.id ? t('brain.applyConfirm') : t(a.label)}
                    </button>
                    {verdicts[a.id] === 'done' && <FeedbackNote tone="ok">{t('brain.applied')}</FeedbackNote>}
                    {verdicts[a.id] === 'error' && <FeedbackNote tone="note">{t('common.error')}</FeedbackNote>}
                  </div>
                ))}
                <span style={hint}>{t('brain.auxHint')}</span>
                <span>{t('brain.pasteHint')}</span>
                <CodeBlock variant="snippet">{hermesModelYaml(status.port, status.key)}</CodeBlock>
              </div>
            )}
          </div>
        </div>
      )}
    </PanelGate>
  );
}
