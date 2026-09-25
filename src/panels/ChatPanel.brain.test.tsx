/**
 * Field report 2026-09-25: on a managed install Hermes' model points at the
 * brain proxy, and the proxy was off, so every turn hung. The chat says it
 * and carries the switch. A hand install may think with its own model: no
 * banner there.
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { translate } from '../i18n/useI18n';
import type { ChatMessage, StageItem } from '../types';

let managed = true;
let proxyEnabled = false;
const setCalls: unknown[] = [];

vi.mock('../sdk/instance', () => ({
  sdk: {
    invoke: vi.fn((action: string, payload?: unknown) => {
      switch (action) {
        case 'hermes.status': return Promise.resolve({ installed: true, managed, gatewayRunning: true, gatewayProcess: { managed: true } });
        case 'hermes.proxyStatus': return Promise.resolve({ enabled: proxyEnabled });
        case 'hermes.proxySetConfig': setCalls.push(payload); proxyEnabled = true; return Promise.resolve({ enabled: true });
        default: return Promise.reject(new Error(`not in this test: ${action}`));
      }
    }),
    stream: vi.fn(),
  },
}));

import { ChatPanel } from './ChatPanel';

function Host() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [stage, setStage] = useState<StageItem[]>([]);
  return <ChatPanel apiPort={null} messages={messages} setMessages={setMessages} stageItems={stage} setStageItems={setStage} />;
}

const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

describe('ChatPanel and a switched-off brain', () => {
  beforeEach(() => { managed = true; proxyEnabled = false; setCalls.length = 0; });

  it('says the brain is off on a managed install and switches it on', async () => {
    render(<Host />);
    await act(flush);
    screen.getByText(translate('chat.brainOff'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: translate('chat.brainOn') }));
      await flush();
    });
    expect(setCalls).toEqual([{ enabled: true }]);
    expect(screen.queryByText(translate('chat.brainOff'))).toBeNull();
  });

  it('stays quiet when the brain is on', async () => {
    proxyEnabled = true;
    render(<Host />);
    await act(flush);
    expect(screen.queryByText(translate('chat.brainOff'))).toBeNull();
  });

  it('stays quiet on a hand install', async () => {
    managed = false;
    render(<Host />);
    await act(flush);
    expect(screen.queryByText(translate('chat.brainOff'))).toBeNull();
  });
});
