import { canStartGateway, gatewayPhase, GATEWAY_PHASE_KEYS, isBooting } from './gateway';
import type { HermesStatus } from '../types';

type StatusOverride = Omit<Partial<HermesStatus>, 'gatewayProcess'> & {
  gatewayProcess?: Partial<HermesStatus['gatewayProcess']>;
};

function status(over: StatusOverride = {}): HermesStatus {
  return {
    installed: true,
    home: 'C:/Users/x/Documents/hermes',
    managed: false,
    apiServer: { enabled: true, keyPresent: true },
    gatewayRunning: false,
    ...over,
    gatewayProcess: {
      managed: false,
      pid: null,
      startedAt: null,
      lastLine: null,
      ...over.gatewayProcess,
    },
  };
}

describe('gatewayPhase', () => {
  it('is up when the gateway answers', () => {
    expect(gatewayPhase(status({ gatewayRunning: true }))).toBe('up');
  });

  it('is down for an absence nobody is working on', () => {
    expect(gatewayPhase(status())).toBe('down');
  });

  it('calls a managed child that has not bound yet STARTING, not stopped', () => {
    // The gateway takes 10-20 s to bind its api_server. Reading that window as
    // "stopped" makes a healthy boot look like a failure.
    expect(gatewayPhase(status({ gatewayProcess: { managed: true } }))).toBe('starting');
  });

  it('is starting while this window has a click in flight', () => {
    expect(gatewayPhase(status(), true)).toBe('starting');
  });

  it('prefers the running fact over a local busy flag', () => {
    // A stale busy flag must never hide a gateway that is demonstrably up.
    expect(gatewayPhase(status({ gatewayRunning: true }), true)).toBe('up');
  });

  it('treats an unprobed gateway as not up rather than guessing', () => {
    // gatewayRunning null = nobody asked (no install, or api_server off).
    expect(gatewayPhase(status({ gatewayRunning: null }))).toBe('down');
  });

  it('names every phase', () => {
    for (const phase of ['up', 'starting', 'down'] as const) {
      expect(GATEWAY_PHASE_KEYS[phase]).toBeTruthy();
    }
  });
});

describe('canStartGateway', () => {
  it('offers Start only where starting is the missing gesture', () => {
    expect(canStartGateway(status())).toBe(true);
  });

  it('never offers Start next to a process that is already booting', () => {
    // This is the pairing that made the panel contradict itself: the label said
    // "starting" while the button beside it invited another start.
    const booting = status({ gatewayProcess: { managed: true } });
    expect(gatewayPhase(booting)).toBe('starting');
    expect(canStartGateway(booting)).toBe(false);
  });

  it('never offers Start for a running gateway', () => {
    expect(canStartGateway(status({ gatewayRunning: true }))).toBe(false);
  });

  it('never offers Start twice while the first click is in flight', () => {
    expect(canStartGateway(status(), true)).toBe(false);
  });
});

describe('isBooting', () => {
  it('is true only for a managed child that is not answering yet', () => {
    expect(isBooting(status({ gatewayProcess: { managed: true } }))).toBe(true);
  });

  it('is false once it answers, so the watch loop stops', () => {
    expect(isBooting(status({ gatewayRunning: true, gatewayProcess: { managed: true } }))).toBe(false);
  });

  it('is false for a gateway we do not manage', () => {
    // An external gateway that is down is somebody else's business: polling it
    // every two seconds forever would burn a timer on a state we cannot change.
    expect(isBooting(status())).toBe(false);
  });

  it('is false when nobody probed, so an unknown never starts a poll loop', () => {
    expect(isBooting(status({ gatewayRunning: null, gatewayProcess: { managed: true } }))).toBe(false);
  });
});
