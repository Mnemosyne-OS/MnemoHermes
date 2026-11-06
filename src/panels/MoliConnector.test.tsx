import { act, fireEvent, render, screen } from '@testing-library/react';
import { translate } from '../i18n/useI18n';
import type { MoliProbe } from '../lib/moli';

const calls: Array<{ action: string; payload: unknown }> = [];
let probeAnswer: { address: string; probe: MoliProbe } | Error = { address: '127.0.0.1:8790', probe: { verdict: 'moli', devices: 123 } };
let setAnswer: { address: string | null; backupFiles: string[] } | Error = { address: '127.0.0.1:8790', backupFiles: ['config.yaml.mnemo-x.bak'] };

vi.mock('../sdk/instance', () => ({
  sdk: {
    invoke: vi.fn((action: string, payload: unknown) => {
      calls.push({ action, payload });
      const answer = action === 'hermes.connectorMoliProbe' ? probeAnswer
        : action === 'hermes.connectorSetMoli' ? setAnswer
        : new Error(`unexpected ${action}`);
      return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
    }),
  },
}));

import { MoliConnector } from './MoliConnector';

const flush = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
const actions = () => calls.map((c) => c.action);

async function typeAndLink(onChanged = vi.fn(), address = '127.0.0.1:8790') {
  render(<MoliConnector status={{ present: false, address: null }} onChanged={onChanged} />);
  fireEvent.change(screen.getByPlaceholderText('192.168.1.20:8790'), { target: { value: address } });
  fireEvent.click(screen.getByText(translate('moli.link')));
  await act(flush);
  return onChanged;
}

describe('MoliConnector', () => {
  beforeEach(() => {
    calls.length = 0;
    probeAnswer = { address: '127.0.0.1:8790', probe: { verdict: 'moli', devices: 123 } };
    setAnswer = { address: '127.0.0.1:8790', backupFiles: ['config.yaml.mnemo-x.bak'] };
  });

  it('probes first, then writes the address the host parsed, and says both facts', async () => {
    probeAnswer = { address: '192.168.1.20:8790', probe: { verdict: 'moli', devices: 123 } };
    const onChanged = await typeAndLink(vi.fn(), 'http://192.168.1.20:8790/');
    expect(actions()).toEqual(['hermes.connectorMoliProbe', 'hermes.connectorSetMoli']);
    expect(calls[0]?.payload).toEqual({ address: 'http://192.168.1.20:8790/' });
    expect(calls[1]?.payload).toEqual({ address: '192.168.1.20:8790' });
    screen.getByText(new RegExp(translate('moli.found', { address: '192.168.1.20:8790' }).replace(/[.]/g, '\\.')));
    screen.getByText(translate('moli.saved'));
    screen.getByText(translate('common.restartGateway'));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('links a Moli that is off right now, and says nothing listens', async () => {
    probeAnswer = { address: '127.0.0.1:8790', probe: { verdict: 'refused' } };
    await typeAndLink();
    expect(actions()).toEqual(['hermes.connectorMoliProbe', 'hermes.connectorSetMoli']);
    screen.getByText(translate('moli.refused', { address: '127.0.0.1:8790' }));
    screen.getByText(translate('moli.saved'));
  });

  it('never writes when something else answers there', async () => {
    probeAnswer = { address: '127.0.0.1:8123', probe: { verdict: 'notMoli', status: 200 } };
    const onChanged = await typeAndLink(vi.fn(), '127.0.0.1:8123');
    expect(actions()).toEqual(['hermes.connectorMoliProbe']);
    screen.getByText(translate('moli.notMoli', { address: '127.0.0.1:8123' }));
    screen.getByText(translate('moli.notSaved'));
    expect(screen.queryByText(translate('common.restartGateway'))).toBeNull();
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('names a dashboard only where a probe found Moli', async () => {
    probeAnswer = { address: '127.0.0.1:7439', probe: { verdict: 'notMoli', status: 401 } };
    await typeAndLink(vi.fn(), '127.0.0.1:7439');
    screen.getByText(translate('moli.approvals'));
    expect(screen.queryByText(translate('moli.approvalsAt', { dashboard: 'http://127.0.0.1:7439' }))).toBeNull();
  });

  it('names the dashboard of a Moli the probe just found, before the status reloads', async () => {
    probeAnswer = { address: '192.168.1.20:8790', probe: { verdict: 'moli' } };
    await typeAndLink(vi.fn(), '192.168.1.20:8790');
    screen.getByText(translate('moli.approvalsAt', { dashboard: 'http://192.168.1.20:8790' }));
  });

  it('says why an address is refused, and writes nothing', async () => {
    probeAnswer = new Error('MOLI_ADDRESS_NAME');
    await typeAndLink(vi.fn(), 'moli.local');
    expect(actions()).toEqual(['hermes.connectorMoliProbe']);
    screen.getByText(translate('moli.errName'));
  });

  it('keeps what answered on screen when the write itself fails', async () => {
    setAnswer = new Error('CONFIG_NOT_FOUND');
    await typeAndLink();
    screen.getByText(new RegExp(translate('moli.found', { address: '127.0.0.1:8790' }).replace(/[.]/g, '\\.')));
    screen.getByText(translate('common.error'));
    expect(screen.queryByText(translate('moli.saved'))).toBeNull();
  });

  it('says "nothing changed" and offers no restart when the address was already there', async () => {
    setAnswer = { address: '127.0.0.1:8790', backupFiles: [] };
    await typeAndLink();
    screen.getByText(translate('moli.unchanged'));
    expect(screen.queryByText(translate('common.restartGateway'))).toBeNull();
  });

  it('when linked: names the address and its dashboard, re-checks without writing, unlinks', async () => {
    const onChanged = vi.fn();
    render(<MoliConnector status={{ present: true, address: '192.168.1.20:8790' }} onChanged={onChanged} />);
    screen.getByText(translate('moli.linkedTo', { address: '192.168.1.20:8790' }));
    screen.getByText(translate('moli.approvalsAt', { dashboard: 'http://192.168.1.20:8790' }));

    fireEvent.click(screen.getByText(translate('moli.test')));
    await act(flush);
    expect(actions()).toEqual(['hermes.connectorMoliProbe']);
    expect(calls[0]?.payload).toEqual({ address: '192.168.1.20:8790' });

    fireEvent.click(screen.getByText(translate('moli.unlink')));
    await act(flush);
    expect(calls[1]).toEqual({ action: 'hermes.connectorSetMoli', payload: { address: null } });
    screen.getByText(translate('moli.unlinked'));
    expect(onChanged).toHaveBeenCalledTimes(1);
  });

  it('a hand-written entry is said, and can still be unlinked', () => {
    render(<MoliConnector status={{ present: true, address: null }} onChanged={vi.fn()} />);
    screen.getByText(translate('moli.handMade'));
    screen.getByText(translate('moli.notLinked'));
    screen.getByText(translate('moli.unlink'));
    screen.getByText(translate('moli.approvals'));
  });
});
