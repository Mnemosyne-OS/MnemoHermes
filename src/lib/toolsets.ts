/**
 * Per-platform toolsets (the Tools tab) — the rules of the checkbox grid.
 *
 * Hermes' `platform_toolsets` mixes two vocabularies in one list: explicit
 * toolsets (`web`, `file`, `terminal`…) and bundling PRESETS (`all`,
 * `hermes-cli`…) that stand for a set the config never spells out. The grid
 * can only draw the explicit ones, so editing a platform that carries a preset
 * REPLACES the preset with what the boxes show. The panel says so; this module
 * is where the rule is actually implemented, and tested.
 *
 * 2026-09-23: a preset is now EXPANDED for display. Tony's managed config
 * carries `hermes-cli` on both platforms and the grid drew twelve empty boxes
 * next to a pill — the screen said "nothing" where the truth was "everything,
 * terminal included". The expansions below are read from `toolsets.py` of the
 * pinned Hermes (v2026.9.21); a preset this module does not know stays a pill
 * with no boxes ticked, which is the old behaviour and an honest "unknown".
 */

/**
 * Mirrors main-side `carriesTerminal`. A messaging platform that can reach a
 * shell is doc 80's original isolation worry, surfaced as data rather than
 * left in a config file nobody opens.
 */
export function carriesTerminal(list: readonly string[]): boolean {
  return list.some((x) => x === 'terminal' || x === 'all' || x === 'debugging' || x.startsWith('hermes-'));
}

/**
 * The individual toolsets of the pinned Hermes that a person would choose
 * between, in the order the grid draws them. The host's `available` list is
 * older (it predates `memory`, `computer_use`, `delegation`…); the grid draws
 * the union, minus the ids this version no longer defines.
 */
export const PINNED_TOOLSETS = [
  'web', 'search', 'browser', 'file', 'terminal', 'code_execution',
  'vision', 'image_gen', 'tts',
  'memory', 'session_search', 'todo', 'skills', 'cronjob',
  'computer_use', 'delegation', 'clarify', 'homeassistant',
] as const;

/** Ids the host may still offer that the pinned Hermes does not define. */
const RETIRED_TOOLSETS = new Set(['skills_hub']);

/** What the grid offers: the host's list and the pinned catalogue, merged. */
export function gridToolsets(available: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of [...PINNED_TOOLSETS, ...available]) {
    if (RETIRED_TOOLSETS.has(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** The entries the checkbox grid can represent. */
export function explicitToolsets(list: readonly string[], available: readonly string[]): string[] {
  return list.filter((x) => available.includes(x));
}

/** The entries it cannot: presets, rendered as pills next to the platform. */
export function presetToolsets(list: readonly string[], available: readonly string[]): string[] {
  return list.filter((x) => !available.includes(x));
}

/**
 * What a preset stands for, in grid ids. `all` and every `hermes-*` bundle
 * are "every tool" in `toolsets.py`; `safe` and `debugging` are spelled out
 * there. Null = a preset this module cannot read (nothing is ticked for it).
 */
export function expandPreset(preset: string, grid: readonly string[]): string[] | null {
  if (preset === 'all' || preset.startsWith('hermes-')) return [...grid];
  if (preset === 'safe') return grid.filter((x) => x === 'web' || x === 'vision' || x === 'image_gen');
  if (preset === 'debugging') return grid.filter((x) => x === 'terminal' || x === 'web' || x === 'file');
  return null;
}

/**
 * The boxes to draw ticked for a platform: its explicit entries plus what its
 * readable presets expand to. The config is not changed by looking at it.
 */
export function effectiveToolsets(list: readonly string[], grid: readonly string[]): string[] {
  const set = new Set(explicitToolsets(list, grid));
  for (const p of presetToolsets(list, grid)) {
    for (const id of expandPreset(p, grid) ?? []) set.add(id);
  }
  return grid.filter((id) => set.has(id));
}

/** The presets on a platform that the grid could NOT read (still pills). */
export function unreadPresets(list: readonly string[], grid: readonly string[]): string[] {
  return presetToolsets(list, grid).filter((p) => expandPreset(p, grid) === null);
}

/**
 * Tick or untick one box. The result is always an explicit list: touching a
 * platform that carried a preset drops the preset, because keeping both would
 * leave the grid showing something other than what the config means. The
 * starting point is what the person SEES ticked (the expanded preset), so
 * unticking `terminal` on a `hermes-cli` platform keeps every other tool.
 */
export function toggleToolset(
  current: readonly string[],
  grid: readonly string[],
  toolset: string,
): string[] {
  const shown = effectiveToolsets(current, grid);
  return shown.includes(toolset)
    ? shown.filter((x) => x !== toolset)
    : [...shown, toolset];
}

/**
 * The payload for `hermes.toolsetsSet`: edits win over the loaded config. A
 * platform the person EDITED is written as they left it, `[]` included (an
 * omitted platform gets Hermes' full bundle, so "no tools" must be spelled);
 * an untouched platform is carried, or left out when empty on disk. A platform
 * that exists only in `edits` (a linked channel that had no block) is written too.
 */
export function toolsetsPayload(
  platforms: Readonly<Record<string, string[]>>,
  edits: Readonly<Record<string, string[]>>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const id of [...Object.keys(platforms), ...Object.keys(edits)]) {
    if (id in next) continue;
    // Sweep 2026-09-23: an EDITED platform left empty was omitted, and an
    // omitted platform gets Hermes' bundle for it — every tool, terminal
    // included. Unticking everything to lock a bot down handed it the shell.
    // What the person edited is written as they left it, [] included; only a
    // platform nobody touched is carried or, if empty, left out.
    if (id in edits) { next[id] = edits[id]!; continue; }
    const list = platforms[id] ?? [];
    if (list.length) next[id] = list;
  }
  return next;
}

/**
 * The platforms Hermes serves that this cockpit names: what the person sees
 * as a heading. Anything else (a channel we do not know) shows its raw id.
 */
export const PLATFORM_LABEL_KEYS: Readonly<Record<string, string>> = {
  api_server: 'tools.platform.api_server',
  cli: 'tools.platform.cli',
  telegram: 'tools.platform.telegram',
  discord: 'tools.platform.discord',
  slack: 'tools.platform.slack',
  whatsapp: 'tools.platform.whatsapp',
  signal: 'tools.platform.signal',
  matrix: 'tools.platform.matrix',
};

/**
 * Linked channels the config says nothing about. Hermes then hands each its
 * `hermes-<channel>` bundle — every tool, terminal included — which is
 * exactly what the Tools tab exists to show, and it showed nothing.
 */
export function unsetLinkedChannels(
  platforms: Readonly<Record<string, string[]>>,
  linkedChannels: readonly string[],
): string[] {
  return linkedChannels.filter((id) => !(id in platforms));
}
