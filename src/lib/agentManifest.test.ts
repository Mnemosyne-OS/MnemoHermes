/**
 * MnemoHermes' agent actions (doc 149): the manifest's declaration passes the
 * HOST's own check, every declared action has its handler (a declared action
 * without one would be offered to agents and fail), the one action that calls
 * a model is declared `spend`, and no action answers an approval or changes
 * Hermes' config (docs 123 and 80: those stay the person's).
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentActionsFromManifest } from '../../../infinity-edition/src/main/plugins/cartridgeAgentActions';
import { TABS, TASK_MAX_CHARS, TASKS_LIMITS } from './hermesAgent';

const root = join(__dirname, '..', '..');
const manifest = JSON.parse(readFileSync(join(root, 'mnemo-plugin.json'), 'utf8')) as unknown;
const source = readFileSync(join(root, 'src', 'lib', 'hermesAgent.ts'), 'utf8');
const block = source.slice(source.indexOf('// agent-actions:begin'), source.indexOf('// agent-actions:end'));
const handlers = [...block.matchAll(/^ {4}(\w+): (?:async )?\(/gm)].map((m) => m[1]);

function declared() {
  const r = agentActionsFromManifest(manifest);
  if (!r.ok) throw new Error(r.error);
  return r.value;
}

describe("MnemoHermes' agent actions", () => {
  it("pass the host's check of the manifest", () => {
    const r = agentActionsFromManifest(manifest);
    expect(r.ok ? 'ok' : r.error).toBe('ok');
  });

  it('every declared action has its handler, and no handler is undeclared', () => {
    expect(handlers.length).toBeGreaterThan(5);
    expect([...handlers].sort()).toEqual(declared().map((a) => a.id).sort());
  });

  it('the task, a model call, is the one action that spends', () => {
    expect(declared().filter((a) => a.effect === 'spend').map((a) => a.id)).toEqual(['startTask']);
  });

  it('no handler answers an approval, chats, or writes config', () => {
    // The host actions the handlers reach themselves: two reads. The rest goes through the buttons' own calls.
    const asked = [...source.matchAll(/'(hermes\.\w+)'/g)].map((m) => m[1]);
    expect([...new Set(asked)].sort()).toEqual(['hermes.runList', 'hermes.status']);
    expect(source).not.toMatch(/runApprove|approve\(/);
  });

  it("the tabs and the limits it declares are the code's own", () => {
    const byId = new Map(declared().map((a) => [a.id, a]));
    expect(byId.get('showTab')!.params.tab).toMatchObject({ enum: [...TABS] });
    expect(byId.get('tasks')!.params.limit).toMatchObject({ minimum: TASKS_LIMITS.min, maximum: TASKS_LIMITS.max });
    expect(byId.get('startTask')!.params.task).toMatchObject({ maxLength: TASK_MAX_CHARS });
  });
});
