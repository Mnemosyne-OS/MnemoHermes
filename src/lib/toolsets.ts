/**
 * Per-platform toolsets (the Tools tab) — the rules of the checkbox grid.
 *
 * Hermes' `platform_toolsets` mixes two vocabularies in one list: explicit
 * toolsets (`web`, `file`, `terminal`…) and bundling PRESETS (`all`,
 * `hermes-cli`…) that stand for a set the config never spells out. The grid
 * can only draw the explicit ones, so editing a platform that carries a preset
 * REPLACES the preset with what the boxes show. The panel says so; this module
 * is where the rule is actually implemented, and tested.
 */

/**
 * Mirrors main-side `carriesTerminal`. A messaging platform that can reach a
 * shell is doc 80's original isolation worry, surfaced as data rather than
 * left in a config file nobody opens.
 */
export function carriesTerminal(list: readonly string[]): boolean {
  return list.some((x) => x === 'terminal' || x === 'all' || x === 'debugging' || x.startsWith('hermes-'));
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
 * Tick or untick one box. The result is always an explicit list: touching a
 * platform that carried a preset drops the preset, because keeping both would
 * leave the grid showing something other than what the config means.
 */
export function toggleToolset(
  current: readonly string[],
  available: readonly string[],
  toolset: string,
): string[] {
  const explicit = explicitToolsets(current, available);
  return explicit.includes(toolset)
    ? explicit.filter((x) => x !== toolset)
    : [...explicit, toolset];
}

/**
 * The payload for `hermes.toolsetsSet`: edits win over the loaded config, and
 * a platform left with an empty list is omitted rather than written as `[]`
 * (an empty key would claim the human chose "no tools at all" when they only
 * unticked the last box of a platform they were not editing).
 */
export function toolsetsPayload(
  platforms: Readonly<Record<string, string[]>>,
  edits: Readonly<Record<string, string[]>>,
): Record<string, string[]> {
  const next: Record<string, string[]> = {};
  for (const id of Object.keys(platforms)) {
    const list = edits[id] ?? platforms[id] ?? [];
    if (list.length) next[id] = list;
  }
  return next;
}
