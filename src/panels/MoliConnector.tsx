/**
 * Moli OS — the house, for the assistant (2026-10-15).
 *
 * The person types the address of their Moli OS (an IP and a port). The host
 * probes it first and says what answered, then writes `mcp_servers.moli` in
 * the Hermes config. The two facts stay two lines: "what answered" and "what
 * was written". A Moli that is off right now is still linked (the entry
 * carries a 5 s connect timeout); something that is not Moli is not.
 *
 * 🚨 Two approval surfaces: an order sent to a device in a protected room is
 * held by MOLI and approved on Moli's own dashboard, not on the Mnemosyne
 * plateau. The panel says so in plain words, always, with the address.
 */
import { useState } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { useGatewayRestart } from '../hooks/useGatewayRestart';
import { panel, inputStyle, primaryButton, buttonStyle, hint, StatusDot, FeedbackNote, sectionTitle, row } from '../ui';
import { RestartGatewayRow } from './RestartGatewayRow';
import { errorMessage, moliFault, MOLI_FAULT_TEXT, type MoliFault } from '../lib/errorCodes';
import {
  guardLines,
  MOLI_WRITTEN_TEXT,
  offersRestart,
  verdictLines,
  writesAfter,
  type MoliLine,
  type MoliProbeAnswer,
  type MoliStatus,
  type MoliWritten,
} from '../lib/moli';

type Busy = 'link' | 'test' | 'unlink' | null;

export function MoliConnector({ status, onChanged }: { status: MoliStatus; onChanged: () => void }) {
  const { t } = useI18n();
  const [addr, setAddr] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const [seen, setSeen] = useState<MoliProbeAnswer | null>(null);
  const [written, setWritten] = useState<MoliWritten>('idle');
  const [fault, setFault] = useState<MoliFault | null>(null);
  const { restart, run: restartGateway, reset: resetRestart } = useGatewayRestart();

  const linked = status.present && status.address !== null;
  const handMade = status.present && status.address === null;
  const say = (lines: MoliLine[]) => lines.map((l) => t(l.key, l.vars)).join(' ');

  const begin = (what: Exclude<Busy, null>) => {
    setBusy(what);
    setFault(null);
    setWritten('idle');
    setSeen(null);
    resetRestart();
  };

  const probe = (address: string) => sdk.invoke<MoliProbeAnswer>('hermes.connectorMoliProbe', { address });

  // Probe first, then write: the person sees what answered before anything
  // is saved, and a door that is not Moli is never written.
  const link = async () => {
    begin('link');
    try {
      const found = await probe(addr.trim());
      setSeen(found);
      if (!writesAfter(found.probe)) {
        setWritten('notSaved');
        return;
      }
      const res = await sdk.invoke<{ address: string | null; backupFiles: string[] }>(
        'hermes.connectorSetMoli',
        { address: found.address },
      );
      setWritten(res.backupFiles.length > 0 ? 'saved' : 'unchanged');
      setAddr('');
      onChanged();
    } catch (err) {
      setFault(moliFault(errorMessage(err)));
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    if (status.address === null) return;
    begin('test');
    try {
      setSeen(await probe(status.address));
    } catch (err) {
      setFault(moliFault(errorMessage(err)));
    } finally {
      setBusy(null);
    }
  };

  const unlink = async () => {
    begin('unlink');
    try {
      await sdk.invoke('hermes.connectorSetMoli', { address: null });
      setWritten('unlinked');
      onChanged();
    } catch (err) {
      setFault(moliFault(errorMessage(err)));
    } finally {
      setBusy(null);
    }
  };

  // The dashboard named with an address where Moli IS: the linked one, else
  // one a probe just found Moli at. Never a door that answered as something else.
  const dashboardAddress = status.address ?? (seen?.probe.verdict === 'moli' ? seen.address : null);

  return (
    <div style={panel}>
      <div style={{ ...row, gap: 10, marginBottom: 6 }}>
        <h2 style={{ ...sectionTitle, margin: 0 }}>{t('moli.heading')}</h2>
        <span style={{ fontSize: 13 }}>
          <StatusDot on={linked} />
          {linked ? t('moli.linkedTo', { address: status.address ?? '' }) : t('moli.notLinked')}
        </span>
      </div>
      <p style={{ ...hint, margin: '0 0 8px' }}>{t('moli.intro')}</p>
      <p style={{ ...hint, margin: '0 0 14px' }}>
        {dashboardAddress
          ? t('moli.approvalsAt', { dashboard: `http://${dashboardAddress}` })
          : t('moli.approvals')}
      </p>

      {handMade && <p style={{ ...hint, margin: '0 0 14px' }}>{t('moli.handMade')}</p>}

      <div style={{ display: 'grid', gap: 14, fontSize: 13, maxWidth: 480 }}>
        <label style={{ display: 'grid', gap: 6 }}>
          {linked ? t('moli.changeLabel') : t('moli.addressLabel')}
          <input
            type="text"
            value={addr}
            onChange={(e) => setAddr(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && addr.trim() && busy === null) void link(); }}
            placeholder="192.168.1.20:8790"
            autoComplete="off"
            spellCheck={false}
            style={inputStyle}
          />
        </label>
        <span style={hint}>{t('moli.addressHint')}</span>

        <div style={row}>
          <button onClick={() => void link()} disabled={busy !== null || !addr.trim()} style={primaryButton}>
            {busy === 'link' ? t('moli.checking') : linked ? t('moli.change') : t('moli.link')}
          </button>
          {linked && (
            <button onClick={() => void test()} disabled={busy !== null} style={buttonStyle}>
              {busy === 'test' ? t('moli.checking') : t('moli.test')}
            </button>
          )}
          {status.present && (
            <button onClick={() => void unlink()} disabled={busy !== null} style={buttonStyle}>
              {t('moli.unlink')}
            </button>
          )}
        </div>

        {seen && (
          <div style={{ display: 'grid', gap: 6 }}>
            <FeedbackNote tone={seen.probe.verdict === 'moli' ? 'ok' : 'note'}>
              {say(verdictLines(seen.address, seen.probe))}
            </FeedbackNote>
            {guardLines(seen.probe).map((l) => (
              <span key={l.key} style={hint}>{t(l.key, l.vars)}</span>
            ))}
          </div>
        )}
        {written !== 'idle' && (
          <FeedbackNote tone={written === 'notSaved' ? 'note' : 'ok'}>{t(MOLI_WRITTEN_TEXT[written])}</FeedbackNote>
        )}
        {fault && <FeedbackNote tone="note">{t(MOLI_FAULT_TEXT[fault])}</FeedbackNote>}

        {offersRestart(written) && (
          <RestartGatewayRow restart={restart} onRestart={() => void restartGateway()} />
        )}

        <span style={hint}>{t('moli.tools')}</span>
      </div>
    </div>
  );
}
