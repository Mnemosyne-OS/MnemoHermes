/**
 * Shared contracts of the cockpit — the host action payload shapes several
 * panels read, and the durable-state sanitizers (doc 73).
 */

/** Contract of the host's `hermes.status` action (see main/hermes/hermesInstall.ts). */
export interface HermesStatus {
  installed: boolean;
  home: string | null;
  apiServer: { enabled: boolean; keyPresent: boolean };
  /** null = not probed (no install, or api_server off). */
  gatewayRunning: boolean | null;
  /** The gateway process the cockpit manages (external ones show in gatewayRunning). */
  gatewayProcess: { managed: boolean; pid: number | null; startedAt: string | null; lastLine: string | null };
}

export interface InboxItem {
  vaultId: string;
  vaultName: string;
  chronicleId: number;
  spineType: string;
  excerpt: string;
  createdAt: string;
  /** Part of a chunked document — reject/move refuse it (orphan chunks). */
  multiPart: boolean;
}

export interface InboxReport {
  items: InboxItem[];
  targets: Array<{ vaultId: string; displayName: string }>;
}

/** The reviewed-ids ledger key for one inbox item. */
export const itemKey = (i: Pick<InboxItem, 'vaultId' | 'chronicleId'>): string =>
  `${i.vaultId}:${i.chronicleId}`;

/** One turn of the Discussion tab. The conversation lives in App state —
 *  it survives tab switches and dies with the window, ON PURPOSE: chat is
 *  stateless host-side, and writing conversations to durable state would
 *  be a privacy decision, not a default. */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/** Persisted in the host-side durable state (doc 73) under `state.settings`. */
export interface CockpitSettings {
  /** 0 = no auto-refresh. */
  statusRefreshSec: number;
  /** null = auto-detect; read by the Chat tab (M2). */
  apiPort: number | null;
}

export const DEFAULT_SETTINGS: CockpitSettings = { statusRefreshSec: 0, apiPort: null };
export const MAX_REVIEWED_IDS = 500;

export function sanitizeReviewed(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === 'string').slice(-MAX_REVIEWED_IDS);
}

export function sanitizeSettings(raw: unknown): CockpitSettings {
  const s = (raw ?? {}) as Record<string, unknown>;
  const refresh = typeof s.statusRefreshSec === 'number' && [0, 30, 60, 300].includes(s.statusRefreshSec)
    ? s.statusRefreshSec
    : 0;
  const port = typeof s.apiPort === 'number' && Number.isInteger(s.apiPort) && s.apiPort > 0 && s.apiPort < 65536
    ? s.apiPort
    : null;
  return { statusRefreshSec: refresh, apiPort: port };
}
