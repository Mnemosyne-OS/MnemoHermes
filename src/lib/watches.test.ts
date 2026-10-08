import { describe, it, expect } from 'vitest';
import { actErrorKey, engineLabelKey, fmtTokens, offerFreeEngine, runningNow, scheduleHour, watchCost, type WatchRun } from './watches';

const run = (over: Partial<WatchRun> = {}): WatchRun => ({
  startedAt: '2026-10-02T07:00:00Z',
  endedAt: '2026-10-02T07:03:00Z',
  tokens: 10_000,
  calls: 3,
  ...over,
});

describe('engineLabelKey', () => {
  it('names "no engine" apart from every engine', () => {
    expect(engineLabelKey(null)).toBe('watches.engineNone');
    expect(engineLabelKey('ddgs')).toBe('watches.engineDdgs');
    expect(engineLabelKey('brave-free')).toBe('watches.engineBrave');
    expect(engineLabelKey('searxng')).toBe('watches.engineSearxng');
    expect(engineLabelKey('tavily')).toBe('watches.engineOther');
  });
});

describe('offerFreeEngine', () => {
  it('offers the free engine while it is not on disk, even when a key engine answers', () => {
    expect(offerFreeEngine({ engine: null, source: null, ddgsInstalled: false, braveKey: false })).toBe(true);
    expect(offerFreeEngine({ engine: 'brave-free', source: 'env', ddgsInstalled: false, braveKey: true })).toBe(true);
    expect(offerFreeEngine({ engine: 'ddgs', source: 'package', ddgsInstalled: true, braveKey: false })).toBe(false);
  });
});

describe('scheduleHour', () => {
  it('reads the daily schedule this tab writes, and nothing else', () => {
    expect(scheduleHour('0 3 * * *')).toBe(3);
    expect(scheduleHour('0 23 * * *')).toBe(23);
    expect(scheduleHour('30 3 * * *')).toBeNull();
    expect(scheduleHour('every 2h')).toBeNull();
    expect(scheduleHour('0 24 * * *')).toBeNull();
  });
});

describe('watchCost', () => {
  it('an unmeasured run is left out of the mean, never counted as zero', () => {
    const c = watchCost([run({ tokens: null }), run({ tokens: 20_000 }), run({ tokens: 10_000 })]);
    expect(c.last).toBeNull();
    expect(c.mean).toBe(15_000);
    expect(c.measured).toBe(2);
    expect(c.unmeasured).toBe(1);
  });

  it('a run still going is neither the last nor in the mean', () => {
    const c = watchCost([run({ endedAt: null, tokens: 999 }), run({ tokens: 4_000 })]);
    expect(c.last).toBe(4_000);
    expect(c.mean).toBe(4_000);
  });

  it('no measured run: both null', () => {
    expect(watchCost([])).toEqual({ last: null, mean: null, measured: 0, unmeasured: 0 });
    expect(watchCost([run({ tokens: null })]).mean).toBeNull();
  });
});

describe('runningNow', () => {
  it('only the newest run decides', () => {
    expect(runningNow([run({ endedAt: null }), run()])).toBe(true);
    expect(runningNow([run(), run({ endedAt: null })])).toBe(false);
    expect(runningNow([])).toBe(false);
  });
});

describe('fmtTokens', () => {
  it('null is a dash, never 0', () => {
    expect(fmtTokens(null, 'fr-FR')).toBe('—');
    expect(fmtTokens(0, 'en-US')).toBe('0');
    expect(fmtTokens(12_400, 'en-US')).toBe('12.4 k');
  });
});

describe('actErrorKey', () => {
  it('a code that contains a shorter one is matched first', () => {
    expect(actErrorKey('UV_NOT_FOUND')).toBe('watches.errUv');
    expect(actErrorKey('VENV_NOT_FOUND')).toBe('watches.errVenv');
    expect(actErrorKey('NOT_FOUND')).toBe('watches.errNotFound');
    expect(actErrorKey('NOT_INSTALLED_AFTER')).toBe('watches.errFreeInstall');
    expect(actErrorKey('NOT_INSTALLED')).toBe('watches.errNotInstalled');
    expect(actErrorKey('something else')).toBe('common.error');
  });
});
