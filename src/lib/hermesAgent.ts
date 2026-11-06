/**
 * What an agent may do in MnemoHermes (doc 149), as plain functions over the
 * cockpit's own host calls and its tab bar. Declared in `mnemo-plugin.json` ›
 * agentActions, served by `HermesAgentActions` while the window is open.
 *
 * Every move is the person's own control: the gateway's Start and Stop through
 * the calls the Status tab makes (`gatewayStartCall` / `gatewayStopCall`), a
 * task through the Tasks tab's (`runStartCall` / `runStopCall`). After each,
 * the tab it belongs to is shown and re-read, so the person sees it land.
 *
 * ⛔ Not exposed, on purpose: answering an approval (doc 123: Hermes acts, the
 * human decides — never a « yes » given by another agent), the chat, and every
 * change to Hermes' config, posture, skills, channels or install (doc 80: a
 * config mutation stays human). Keeping or rejecting what Hermes wrote in
 * memory (the inbox) is the person's to govern.
 *
 * Refusals throw `CODE: reason`. « working » is never claimed: a run says when
 * it last gave a sign of life.
 */
import type { HermesStatus, RunView } from '../types';
import { gatewayPhase, gatewayStartCall, gatewayStopCall, type Invoke } from './gateway';
import { approvalSecondsLeft, runPhase, runStartCall, runStopCall, silentSeconds, sortRuns } from './runs';

export type Tab = 'status' | 'chat' | 'tasks' | 'watches' | 'agents' | 'channels' | 'tools' | 'skills' | 'inbox' | 'settings';
export const TABS: readonly Tab[] = ['status', 'chat', 'tasks', 'watches', 'agents', 'channels', 'tools', 'skills', 'inbox', 'settings'];
/** The longest task text an agent may hand over: what the manifest declares. */
export const TASK_MAX_CHARS = 4000;
/** How many runs `tasks` may return: what the manifest declares as `limit`'s limits. */
export const TASKS_LIMITS = { min: 1, max: 50, fallback: 10 } as const;
const OUTPUT_CHARS = 2000;

/** The cockpit's state and its own moves, read fresh at every call. */
export interface HermesAgentContext {
  /** null while the saved state is read; false while the guided first steps are on screen. */
  onboardingDone: boolean | null;
  tab: Tab;
  setTab: (tab: Tab) => void;
  /** Re-reads the tab on screen, as opening it does. */
  refresh: () => void;
  invoke: Invoke;
  locale: () => string;
}

/** The shape `sdk.onAgentActions` takes. */
export type AgentHandlers = Record<string, (args: Record<string, unknown>) => unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const message = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

/** A whole number inside the bounds, the fallback when absent or unreadable. Never negative. */
export function clampLimit(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return TASKS_LIMITS.fallback;
  return Math.min(TASKS_LIMITS.max, Math.max(TASKS_LIMITS.min, Math.floor(v)));
}

/** One run as an agent reads it: what it was asked, where it is, what it said. */
export function runLine(run: RunView, nowMs: number) {
  const waiting = runPhase(run) === 'waiting';
  return {
    runId: run.runId,
    task: run.input.slice(0, 300),
    status: run.status,
    startedAt: run.startedAt,
    // A fact, never « working »: an idle run and a dead one fall silent the same way.
    silentSeconds: silentSeconds(run, nowMs),
    ...(waiting && run.approval
      ? { waitsForThePerson: { description: run.approval.description, command: run.approval.command, secondsLeft: approvalSecondsLeft(run, nowMs) } }
      : {}),
    ...(run.output ? { output: run.output.slice(-OUTPUT_CHARS), ...(run.output.length > OUTPUT_CHARS ? { outputCut: run.output.length } : {}) } : {}),
    ...(run.error ? { error: run.error } : {}),
  };
}

/** The handlers `sdk.onAgentActions` serves. `get` returns the cockpit as it is at the call. */
export function hermesAgentHandlers(get: () => HermesAgentContext, now: () => number = Date.now): AgentHandlers {
  /** A gateway Start or Stop from an agent still in flight: a second one waits its turn. */
  let gatewayCall = false;

  /** The tabs exist only once the guided first steps are done: a move behind the wizard is a move nobody sees. */
  const cockpit = () => {
    const ctx = get();
    if (ctx.onboardingDone === null) throw new Error('NOT_READY: the cockpit is still reading its state; try again in a moment');
    if (!ctx.onboardingDone) throw new Error('ONBOARDING: the guided first steps are on the person\'s screen; they finish them first');
    return ctx;
  };

  /** Shows a tab and re-reads it, so the person sees what just happened there. */
  const show = (ctx: HermesAgentContext, tab: Tab) => {
    if (ctx.tab === tab) ctx.refresh();
    else ctx.setTab(tab);
  };

  /** The facts the Status tab reads. */
  const status = (ctx: HermesAgentContext) => ctx.invoke<HermesStatus>('hermes.status', {});

  // agent-actions:begin
  return {
    status: async () => {
      const ctx = get();
      const s = await status(ctx);
      return {
        installed: s.installed,
        managedInstall: s.managed,
        apiServer: s.apiServer.enabled,
        // null = not probed (no install, or the api server is off).
        gateway: s.gatewayRunning === null ? null : gatewayPhase(s, gatewayCall),
        ...(s.gatewayProcess.startedAt ? { gatewayStartedAt: s.gatewayProcess.startedAt } : {}),
        ...(s.gatewayRunning === false && s.gatewayProcess.lastLine ? { gatewayLastLine: s.gatewayProcess.lastLine } : {}),
        tab: ctx.onboardingDone === null ? 'loading' : ctx.onboardingDone ? ctx.tab : 'onboarding',
      };
    },

    tasks: async (args) => {
      const ctx = get();
      const { runs } = await ctx.invoke<{ runs: RunView[] }>('hermes.runList', {});
      const t = now();
      return sortRuns(runs).slice(0, clampLimit(args.limit)).map((r) => runLine(r, t));
    },

    showTab: (args) => {
      const ctx = cockpit();
      const tab = str(args.tab) as Tab;
      if (!(TABS as readonly string[]).includes(tab)) throw new Error(`BAD_ARG: tab is one of ${TABS.join(', ')}`);
      ctx.setTab(tab);
      return { tab };
    },

    startGateway: async () => {
      const ctx = cockpit();
      if (gatewayCall) throw new Error('BUSY: a gateway start or stop is already on its way; call status');
      const s = await status(ctx);
      const phase = gatewayPhase(s);
      if (phase === 'up') return { gateway: 'up', already: true };
      if (phase === 'starting') throw new Error('BUSY: the gateway is already starting; call status until it is up');
      gatewayCall = true;
      try {
        await gatewayStartCall(ctx.invoke, ctx.locale());
      } catch (err) {
        throw new Error(`START_REFUSED: ${message(err)}`);
      } finally {
        gatewayCall = false;
        show(get(), 'status');
      }
      // Accepted is not up: the gateway takes 10-20 s to bind its api server.
      return { gateway: 'starting', then: 'call status until gateway is up' };
    },

    stopGateway: async () => {
      const ctx = cockpit();
      if (gatewayCall) throw new Error('BUSY: a gateway start or stop is already on its way; call status');
      const s = await status(ctx);
      if (!s.gatewayProcess.managed) {
        throw new Error(s.gatewayRunning
          ? 'NOT_MANAGED: this gateway was not started by the cockpit; it is stopped where it was started'
          : 'NOT_RUNNING: no gateway runs');
      }
      gatewayCall = true;
      try {
        await gatewayStopCall(ctx.invoke);
      } finally {
        gatewayCall = false;
        show(get(), 'status');
      }
      return { stopped: true };
    },

    startTask: async (args) => {
      const ctx = cockpit();
      const text = str(args.task);
      if (!text) throw new Error('BAD_ARG: task is empty');
      const s = await status(ctx);
      if (s.gatewayRunning !== true) throw new Error('GATEWAY_DOWN: the gateway is not up; call startGateway, then status until it is up');
      const run = await runStartCall(ctx.invoke, text);
      show(get(), 'tasks');
      return { runId: run.runId, status: run.status, then: 'call tasks; an approval waits for the person, on their screen' };
    },

    stopTask: async (args) => {
      const ctx = cockpit();
      const runId = str(args.runId);
      const { runs } = await ctx.invoke<{ runs: RunView[] }>('hermes.runList', {});
      const run = runs.find((r) => r.runId === runId);
      if (!run) throw new Error(`NOT_FOUND: no task "${runId}"; the tasks are ${runs.map((r) => r.runId).slice(0, 10).join(', ') || 'none'}`);
      if (runPhase(run) === 'settled') return { runId, status: run.status, already: true };
      await runStopCall(ctx.invoke, runId);
      show(get(), 'tasks');
      return { runId, stopping: true };
    },
  };
  // agent-actions:end
}
