import {
  pendingCount,
  readChannelsConfigured,
  readInboxItems,
  readProxy,
  readSkills,
  summarizeDashboard,
} from './dashboard';

const ok = (value: unknown): PromiseSettledResult<unknown> => ({ status: 'fulfilled', value });
const ko = (): PromiseSettledResult<unknown> => ({ status: 'rejected', reason: new Error('nope') });

const PROXY = { running: true, callsToday: 3, dailyCallCap: 200 };
const CHANNELS = { channels: [{ configured: true }, { configured: false }, { configured: true }] };
const SKILLS = { skills: [{ id: 'a' }, { id: 'b' }], mnemosyneMemoryInstalled: true };
const INBOX = { items: [{ vaultId: 'v1', chronicleId: 1 }, { vaultId: 'v1', chronicleId: 2 }] };

describe('readProxy', () => {
  it('reads a well-formed payload', () => {
    expect(readProxy(PROXY)).toEqual({ running: true, callsToday: 3, dailyCallCap: 200 });
  });

  it('refuses a payload missing a field rather than defaulting it to zero', () => {
    // A tile that invents `callsToday: 0` says the agent made no calls today.
    expect(readProxy({ running: true, dailyCallCap: 200 })).toBeNull();
  });

  it('refuses a non-object', () => {
    expect(readProxy(null)).toBeNull();
    expect(readProxy('running')).toBeNull();
    expect(readProxy(undefined)).toBeNull();
  });

  it('keeps a measured zero', () => {
    expect(readProxy({ running: false, callsToday: 0, dailyCallCap: 50 }))
      .toEqual({ running: false, callsToday: 0, dailyCallCap: 50 });
  });
});

describe('readChannelsConfigured', () => {
  it('counts only the configured ones', () => {
    expect(readChannelsConfigured(CHANNELS)).toBe(2);
  });

  it('returns a measured zero when nothing is configured', () => {
    expect(readChannelsConfigured({ channels: [{ configured: false }] })).toBe(0);
  });

  it('returns unknown, not zero, when the list is missing', () => {
    expect(readChannelsConfigured({})).toBeNull();
    expect(readChannelsConfigured({ channels: 'telegram' })).toBeNull();
  });

  it('does not count an entry whose flag is merely truthy', () => {
    expect(readChannelsConfigured({ channels: [{ configured: 'yes' }, { configured: 1 }] })).toBe(0);
  });
});

describe('readSkills', () => {
  it('reads the shelf and the covenant flag', () => {
    expect(readSkills(SKILLS)).toEqual({ count: 2, covenant: true });
  });

  it('treats anything but an explicit true as "not seen"', () => {
    // The covenant flag is a claim about an install. Only `true` is evidence.
    expect(readSkills({ skills: [], mnemosyneMemoryInstalled: 'yes' })?.covenant).toBe(false);
    expect(readSkills({ skills: [] })?.covenant).toBe(false);
  });

  it('returns unknown when the shelf could not be read', () => {
    expect(readSkills({ mnemosyneMemoryInstalled: true })).toBeNull();
  });
});

describe('readInboxItems', () => {
  it('reads the refs it needs to count', () => {
    expect(readInboxItems(INBOX)).toEqual([
      { vaultId: 'v1', chronicleId: 1 },
      { vaultId: 'v1', chronicleId: 2 },
    ]);
  });

  it('skips a malformed item instead of failing the whole list', () => {
    const out = readInboxItems({ items: [{ vaultId: 'v1', chronicleId: 1 }, { vaultId: 'v2' }, null] });
    expect(out).toEqual([{ vaultId: 'v1', chronicleId: 1 }]);
  });

  it('returns unknown when there is no list at all', () => {
    expect(readInboxItems({})).toBeNull();
  });

  it('returns an empty list, not unknown, for an empty inbox', () => {
    expect(readInboxItems({ items: [] })).toEqual([]);
  });
});

describe('summarizeDashboard', () => {
  it('fills all four tiles when every probe answers', () => {
    const out = summarizeDashboard([ok(PROXY), ok(CHANNELS), ok(SKILLS), ok(INBOX)]);
    expect(out.proxy).not.toBeNull();
    expect(out.channelsConfigured).toBe(2);
    expect(out.skills).toEqual({ count: 2, covenant: true });
    expect(out.inboxItems).toHaveLength(2);
  });

  it('costs one tile per rejected probe, never the panel', () => {
    const out = summarizeDashboard([ko(), ok(CHANNELS), ok(SKILLS), ok(INBOX)]);
    expect(out.proxy).toBeNull();
    expect(out.channelsConfigured).toBe(2);
    expect(out.skills).not.toBeNull();
  });

  it('costs one tile when a probe RESOLVES with the wrong shape', () => {
    // The regression this exists for: reading a malformed-but-fulfilled payload
    // used to throw inside the loader, which left every tile unrendered. One
    // bad answer must cost one tile.
    const out = summarizeDashboard([ok(PROXY), ok({ channels: null }), ok(SKILLS), ok(INBOX)]);
    expect(out.channelsConfigured).toBeNull();
    expect(out.proxy).not.toBeNull();
    expect(out.skills).not.toBeNull();
    expect(out.inboxItems).toHaveLength(2);
  });

  it('survives every probe answering with rubbish', () => {
    const out = summarizeDashboard([ok(1), ok('x'), ok(null), ok(undefined)]);
    expect(out).toEqual({ proxy: null, channelsConfigured: null, skills: null, inboxItems: null });
  });

  it('keeps the four probes in the order they are fired', () => {
    // Swapping two of them would put the channel count in the skills tile, and
    // both are plain numbers, so nothing would look wrong on screen.
    const out = summarizeDashboard([ok(PROXY), ok(CHANNELS), ok(SKILLS), ok(INBOX)]);
    expect(out.channelsConfigured).toBe(2);
    expect(out.skills?.count).toBe(2);
    expect(out.proxy?.callsToday).toBe(3);
  });
});

describe('pendingCount', () => {
  it('counts what has no verdict yet', () => {
    expect(pendingCount([{ vaultId: 'v1', chronicleId: 1 }, { vaultId: 'v1', chronicleId: 2 }], ['v1:1'])).toBe(1);
  });

  it('stays unknown when the inbox itself could not be read', () => {
    // "nobody could ask" and "nothing is pending" are different sentences.
    expect(pendingCount(null, [])).toBeNull();
    expect(pendingCount(null, ['v1:1'])).toBeNull();
  });

  it('reports a measured zero once everything is reviewed', () => {
    expect(pendingCount([{ vaultId: 'v1', chronicleId: 1 }], ['v1:1'])).toBe(0);
  });

  it('scopes the key by vault, so the same chronicle id elsewhere still counts', () => {
    expect(pendingCount([{ vaultId: 'v2', chronicleId: 1 }], ['v1:1'])).toBe(1);
  });

  it('ignores reviewed ids for items no longer in the inbox', () => {
    expect(pendingCount([{ vaultId: 'v1', chronicleId: 9 }], ['v1:1', 'v1:2', 'v1:3'])).toBe(1);
  });
});
