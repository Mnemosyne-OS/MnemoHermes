/**
 * The Status tab's aggregated dashboard — four independent probes reduced to
 * four tiles.
 *
 * 🚨 Each tile fails ALONE. `Promise.allSettled` already gives that for a
 * rejected probe, but a probe that RESOLVES with a payload of the wrong shape
 * used to throw while being read, inside the async loader, which left `extras`
 * null and took all four tiles off the screen. One malformed answer must cost
 * one tile.
 *
 * 🎭 A tile that could not be measured renders `—` (see `format.ts`), never a
 * zero. "The agent configured no channel" and "nobody could ask" are different
 * sentences and the interface must not merge them.
 */
import { itemKey } from '../types';

export interface ProxySummary {
  running: boolean;
  callsToday: number;
  dailyCallCap: number;
}

export interface SkillsSummary {
  count: number;
  covenant: boolean;
}

/** Just enough of an inbox item to count what is still unreviewed. */
export interface PendingRef {
  vaultId: string;
  chronicleId: number;
}

export interface DashboardExtras {
  proxy: ProxySummary | null;
  channelsConfigured: number | null;
  skills: SkillsSummary | null;
  /**
   * The raw items, NOT a count. The pending number depends on the reviewed
   * ledger, which changes on every keep — deriving it at render keeps a click
   * from re-firing all four probes.
   */
  inboxItems: PendingRef[] | null;
}

export const EMPTY_EXTRAS: DashboardExtras = {
  proxy: null,
  channelsConfigured: null,
  skills: null,
  inboxItems: null,
};

/** The value of a settled probe, or undefined if it rejected. */
function valueOf(result: PromiseSettledResult<unknown>): unknown {
  return result.status === 'fulfilled' ? result.value : undefined;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function readProxy(value: unknown): ProxySummary | null {
  const r = asRecord(value);
  if (!r) return null;
  const callsToday = asNumber(r.callsToday);
  const dailyCallCap = asNumber(r.dailyCallCap);
  if (typeof r.running !== 'boolean' || callsToday === null || dailyCallCap === null) return null;
  return { running: r.running, callsToday, dailyCallCap };
}

export function readChannelsConfigured(value: unknown): number | null {
  const r = asRecord(value);
  if (!r || !Array.isArray(r.channels)) return null;
  return r.channels.filter((c) => asRecord(c)?.configured === true).length;
}

export function readSkills(value: unknown): SkillsSummary | null {
  const r = asRecord(value);
  if (!r || !Array.isArray(r.skills)) return null;
  // The covenant flag is a claim about an install. Anything other than an
  // explicit `true` means we did not see it, which is what `false` renders.
  return { count: r.skills.length, covenant: r.mnemosyneMemoryInstalled === true };
}

export function readInboxItems(value: unknown): PendingRef[] | null {
  const r = asRecord(value);
  if (!r || !Array.isArray(r.items)) return null;
  const refs: PendingRef[] = [];
  for (const raw of r.items) {
    const item = asRecord(raw);
    const chronicleId = asNumber(item?.chronicleId);
    if (!item || typeof item.vaultId !== 'string' || chronicleId === null) continue;
    refs.push({ vaultId: item.vaultId, chronicleId });
  }
  return refs;
}

/** Reduce the four probes, in the order they are fired, to the tile data. */
export function summarizeDashboard(
  results: [
    proxy: PromiseSettledResult<unknown>,
    channels: PromiseSettledResult<unknown>,
    skills: PromiseSettledResult<unknown>,
    inbox: PromiseSettledResult<unknown>,
  ],
): DashboardExtras {
  const [proxy, channels, skills, inbox] = results;
  return {
    proxy: readProxy(valueOf(proxy)),
    channelsConfigured: readChannelsConfigured(valueOf(channels)),
    skills: readSkills(valueOf(skills)),
    inboxItems: readInboxItems(valueOf(inbox)),
  };
}

/**
 * How many inbox items still await a verdict. `null` in, `null` out: nobody
 * read the inbox, so the tile has nothing to report.
 */
export function pendingCount(items: PendingRef[] | null, reviewedIds: readonly string[]): number | null {
  if (items === null) return null;
  const reviewed = new Set(reviewedIds);
  return items.filter((i) => !reviewed.has(itemKey(i))).length;
}
