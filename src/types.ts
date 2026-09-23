/**
 * Shared contracts of the cockpit — the host action payload shapes several
 * panels read, and the durable-state sanitizers (doc 73).
 */

/** Contract of the host's `hermes.status` action (see main/hermes/hermesInstall.ts). */
export interface HermesStatus {
  installed: boolean;
  home: string | null;
  /** The install the HOST put there (doc 123 §4 lot 0) — re-installable from
   *  here; a hand install only updates through its own CLI. Older hosts omit
   *  it: the panel reads a missing flag as `false`. */
  managed: boolean;
  apiServer: { enabled: boolean; keyPresent: boolean };
  /** null = not probed (no install, or api_server off). */
  gatewayRunning: boolean | null;
  /** The gateway process the cockpit manages (external ones show in gatewayRunning). */
  gatewayProcess: { managed: boolean; pid: number | null; startedAt: string | null; lastLine: string | null };
}

/** Contract of the host's `hermes.managedInstallStatus` action (doc 123
 *  §4 lot 0). One job at a time; `pct` is null on every stage nothing measures. */
export interface ManagedInstallState {
  running: boolean;
  stage: 'python' | 'download' | 'verify' | 'extract' | 'venv' | 'deps' | 'config' | 'check' | 'done' | null;
  pct: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  error: string | null;
  cancelled: boolean;
  output: string[];
  installed: { tag: string; version: string; installedAt: string; versionLine: string } | null;
  /** What config.yaml launches the memory server with (read back by the host),
   *  or null = no memory wired. Older hosts omit it: read as null. */
  memory?: { command: string; args: string[] } | null;
  /** Same for the OS actions server (images), doc 123 2026-09-23. Absent on
   *  older hosts: read as null, "not wired". */
  actions?: { command: string; args: string[] } | null;
  /** The ear for voice notes, as config.yaml declares it (doc 123, 2026-09-23);
   *  null = no `stt:` block. Absent on older hosts: read as null. */
  stt?: { provider: string | null; model: string | null; enabled: boolean } | null;
  home: string;
  pin: { tag: string; version: string; bytes?: number };
}

/** Contract of the host's `hermes.voiceRoute` (doc 123, 2026-09-23): which voice
 *  answers on a messaging channel, and whether the voice chosen in the app's
 *  Settings › Voice CAN. `route` is what config.yaml says; `other` = a block the
 *  human wrote, not ours to switch. */
export interface VoiceRouteView {
  route: 'edge' | 'app' | 'other' | null;
  ours: boolean;
  appAvailable: boolean;
  /** Why the app voice cannot answer: NO_VOICE_PREFS, UNSUPPORTED_FAMILY, LICENSE_REQUIRED,
   *  ENGINE_NOT_INSTALLED, VOICE_NOT_INSTALLED, NO_CLONE_SAMPLE. */
  reason: string | null;
  /** The choice in words (`xtts · clone`), or null. */
  chosen: string | null;
}

export type RunChoice = 'once' | 'session' | 'always' | 'deny';

/** Contract of the host's `hermes.runList` / `runStart` / `runApprove` /
 *  `runStop` actions (doc 123 lot 1): one task on the gateway's /v1/runs,
 *  followed by the host. */
export interface RunView {
  runId: string;
  input: string;
  status: 'queued' | 'running' | 'waiting_for_approval' | 'stopping' | 'completed' | 'failed' | 'cancelled' | 'unknown';
  startedAt: string;
  lastEventAt: string;
  approval: {
    requestId: string | null;
    /** Redacted by the gateway before it hit the wire. */
    command: string | null;
    description: string | null;
    choices: RunChoice[];
    smartDenied: boolean;
    receivedAt: string;
  } | null;
  /** Hermes' `approvals.timeout`, seconds — the countdown counts from receivedAt. */
  approvalTimeoutSec: number;
  output: string;
  error: string | null;
  log: string[];
  stream: 'live' | 'ended' | 'lost';
}

export interface InboxItem {
  vaultId: string;
  vaultName: string;
  chronicleId: number;
  spineType: string;
  excerpt: string;
  /** The text without its origin line, newlines kept (markdown). */
  body: string;
  bodyTruncated: boolean;
  provenance: { agent: string; date: string | null; task: string | null };
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

/**
 * A card on the stage beside the chat (doc 123, 2026-09-23): something a
 * reply POINTED AT, read through the host. `loading` until the host reads
 * it, `error` with the host's reason when it could not — never a broken
 * picture pretending to be the picture.
 */
export interface StageItem {
  id: string;
  kind: 'image' | 'document';
  name: string;
  /** Absolute path on this machine; null for an image the reply carried inline. */
  path: string | null;
  dataUrl: string | null;
  /** A text document's head; null for a binary one (pdf, docx) or an image. */
  text: string | null;
  truncated: boolean;
  state: 'loading' | 'ready' | 'error';
  error: string | null;
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
