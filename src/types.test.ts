import {
  itemKey,
  sanitizeReviewed,
  sanitizeSettings,
  DEFAULT_SETTINGS,
  MAX_REVIEWED_IDS,
} from './types';

describe('itemKey', () => {
  it('scopes a chronicle by its vault', () => {
    expect(itemKey({ vaultId: 'v1', chronicleId: 42 })).toBe('v1:42');
  });

  it('does not collide across vaults', () => {
    // Chronicle ids restart per vault, so an unscoped key would silently
    // mark someone else's memory as reviewed.
    expect(itemKey({ vaultId: 'v1', chronicleId: 1 }))
      .not.toBe(itemKey({ vaultId: 'v2', chronicleId: 1 }));
  });
});

describe('sanitizeReviewed', () => {
  it('reads a plain list back', () => {
    expect(sanitizeReviewed(['v1:1', 'v1:2'])).toEqual(['v1:1', 'v1:2']);
  });

  it('returns an empty ledger for anything that is not a list', () => {
    // Durable state is a free-form document (doc 73): a host that predates this
    // cartridge, or a half-written save, must not crash the panel.
    for (const bad of [null, undefined, 'v1:1', 42, {}]) {
      expect(sanitizeReviewed(bad)).toEqual([]);
    }
  });

  it('drops non-string entries rather than carrying them into a Set', () => {
    expect(sanitizeReviewed(['v1:1', 7, null, { id: 'x' }, 'v1:2'])).toEqual(['v1:1', 'v1:2']);
  });

  it('keeps the MOST RECENT ids when the ledger overflows', () => {
    // slice(-MAX): the tail is what a fresh verdict appends to, so trimming the
    // head forgets the oldest reviews rather than the newest.
    const many = Array.from({ length: MAX_REVIEWED_IDS + 10 }, (_, i) => `v1:${i}`);
    const out = sanitizeReviewed(many);
    expect(out).toHaveLength(MAX_REVIEWED_IDS);
    expect(out[out.length - 1]).toBe(`v1:${MAX_REVIEWED_IDS + 9}`);
    expect(out).not.toContain('v1:0');
  });
});

describe('sanitizeSettings', () => {
  it('reads a valid document back', () => {
    expect(sanitizeSettings({ statusRefreshSec: 60, apiPort: 8642 }))
      .toEqual({ statusRefreshSec: 60, apiPort: 8642 });
  });

  it('falls back to the defaults for a missing or malformed document', () => {
    for (const bad of [null, undefined, 'settings', 42]) {
      expect(sanitizeSettings(bad)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('accepts only the cadences the Settings tab offers', () => {
    // A value outside the select would leave the control showing something the
    // user cannot reproduce, and a 1-second cadence would hammer four probes.
    expect(sanitizeSettings({ statusRefreshSec: 1 }).statusRefreshSec).toBe(0);
    expect(sanitizeSettings({ statusRefreshSec: 300 }).statusRefreshSec).toBe(300);
    expect(sanitizeSettings({ statusRefreshSec: '60' }).statusRefreshSec).toBe(0);
  });

  it('refuses a port outside the range instead of dialling it', () => {
    expect(sanitizeSettings({ apiPort: 0 }).apiPort).toBeNull();
    expect(sanitizeSettings({ apiPort: 65536 }).apiPort).toBeNull();
    expect(sanitizeSettings({ apiPort: -1 }).apiPort).toBeNull();
    expect(sanitizeSettings({ apiPort: 1.5 }).apiPort).toBeNull();
    expect(sanitizeSettings({ apiPort: '8642' }).apiPort).toBeNull();
  });

  it('keeps the two fields independent', () => {
    // One bad field must not reset the other: they are saved as one document.
    expect(sanitizeSettings({ statusRefreshSec: 60, apiPort: 'nope' }))
      .toEqual({ statusRefreshSec: 60, apiPort: null });
  });

  it('reads null as auto-detect, which is what an absent port means', () => {
    expect(sanitizeSettings({ statusRefreshSec: 30, apiPort: null }).apiPort).toBeNull();
  });
});
