/**
 * Gateway phase — the Status tab's three-way answer about the agent process.
 *
 * 🚨 "not up" is TWO different facts and merging them is the bug this exists
 * to prevent: a managed child that has not bound its api_server yet is
 * STARTING (the gateway takes 10-20 s to boot), while an unmanaged absence is
 * DOWN. Rendering the first as "stopped" makes a healthy boot look like a
 * failure, and puts a "Start" button next to a process that is already
 * starting.
 */
import type { HermesStatus } from '../types';

export type GatewayPhase = 'up' | 'starting' | 'down';

/** `busy` = a start/stop click is in flight from this window. */
export function gatewayPhase(status: HermesStatus, busy = false): GatewayPhase {
  if (status.gatewayRunning === true) return 'up';
  if (status.gatewayProcess.managed || busy) return 'starting';
  return 'down';
}

/** The Start button appears only where starting is the missing gesture. */
export function canStartGateway(status: HermesStatus, busy = false): boolean {
  return gatewayPhase(status, busy) === 'down';
}

/**
 * Whether the panel must keep re-reading the truth. A managed child mid-boot
 * changes underneath us with nothing to notify the window.
 */
export function isBooting(status: HermesStatus): boolean {
  return status.gatewayProcess.managed && status.gatewayRunning === false;
}

/** Locale key for each phase, so the label cannot drift from the decision. */
export const GATEWAY_PHASE_KEYS: Record<GatewayPhase, string> = {
  up: 'status.gatewayUp',
  starting: 'status.gatewayStarting',
  down: 'status.gatewayDown',
};
