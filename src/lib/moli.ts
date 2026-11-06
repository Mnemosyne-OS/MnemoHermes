/**
 * Moli OS connector — what a probe verdict says, and whether the cockpit
 * writes after it. Pure: the panel renders, this decides.
 *
 * The host probes `GET /api/health` at the address the person typed and
 * returns a verdict (main/hermes/hermesMoli.ts). Two facts reach the screen
 * and are never merged: what answered, and what was written.
 */

/** Mirror of the host's MoliProbe. Every field of `moli` is ABSENT when
 *  Moli did not say it, never 0 and never an invented empty list. */
export type MoliProbe =
  | { verdict: 'moli'; version?: string; devices?: number; protectedRooms?: string[]; protectUnassigned?: boolean }
  | { verdict: 'refused' }
  | { verdict: 'noAnswer' }
  | { verdict: 'unreachable'; code: string }
  | { verdict: 'hostRefused' }
  | { verdict: 'notMoli'; status?: number };

export interface MoliStatus {
  /** `mcp_servers.moli` is in the config, whoever wrote it. */
  present: boolean;
  /** Read back from the entry's url; null when absent or written by hand. */
  address: string | null;
}

export interface MoliProbeAnswer {
  /** The address as the host parsed it (`ip:port`): what would be written. */
  address: string;
  probe: MoliProbe;
}

/**
 * Does the cockpit write the entry after this probe? A Moli that is off
 * right now (refused, no answer, unreachable) stays linkable: the entry
 * carries `connect_timeout: 5`, so the gateway starts without it after 5 s.
 * Something that answered and is not Moli, or Moli refusing this Host, is a
 * measured no: writing it would point the assistant at a door that refuses.
 */
export function writesAfter(probe: MoliProbe): boolean {
  return probe.verdict !== 'notMoli' && probe.verdict !== 'hostRefused';
}

export interface MoliLine {
  key: string;
  vars?: Record<string, string | number>;
}

/** What answered, as locale lines (one paragraph). */
export function verdictLines(address: string, probe: MoliProbe): MoliLine[] {
  switch (probe.verdict) {
    case 'moli': {
      const lines: MoliLine[] = [{ key: 'moli.found', vars: { address } }];
      if (probe.version !== undefined) lines.push({ key: 'moli.foundVersion', vars: { version: probe.version } });
      if (probe.devices !== undefined) lines.push({ key: 'moli.foundDevices', vars: { devices: probe.devices } });
      return lines;
    }
    case 'refused':
      return [{ key: 'moli.refused', vars: { address } }];
    case 'noAnswer':
      return [{ key: 'moli.noAnswer', vars: { address } }];
    case 'unreachable':
      return [{ key: 'moli.unreachable', vars: { address, code: probe.code } }];
    case 'hostRefused':
      return [{ key: 'moli.hostRefused', vars: { address } }];
    case 'notMoli':
      return [{ key: 'moli.notMoli', vars: { address } }];
  }
}

/**
 * What Moli's own guard protects, when it said so. An empty list with
 * nothing else protected is the one that matters most: every order the
 * assistant sends runs at once, with no approval anywhere.
 */
export function guardLines(probe: MoliProbe): MoliLine[] {
  if (probe.verdict !== 'moli') return [];
  const lines: MoliLine[] = [];
  const rooms = probe.protectedRooms;
  if (rooms !== undefined && rooms.length > 0) lines.push({ key: 'moli.rooms', vars: { rooms: rooms.join(', ') } });
  if (probe.protectUnassigned === true) lines.push({ key: 'moli.unassignedProtected' });
  if (rooms !== undefined && rooms.length === 0 && probe.protectUnassigned === false) lines.push({ key: 'moli.noRooms' });
  return lines;
}

/** What the last press wrote. `unchanged` = same address, nothing touched. */
export type MoliWritten = 'idle' | 'saved' | 'unchanged' | 'unlinked' | 'notSaved';

export const MOLI_WRITTEN_TEXT: Record<Exclude<MoliWritten, 'idle'>, string> = {
  saved: 'moli.saved',
  unchanged: 'moli.unchanged',
  unlinked: 'moli.unlinked',
  notSaved: 'moli.notSaved',
};

/** A write that changed the file asks for a gateway restart; nothing else does. */
export function offersRestart(written: MoliWritten): boolean {
  return written === 'saved' || written === 'unlinked';
}
