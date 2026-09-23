/**
 * Skills tab — the pure half: category census, search, the disabled list
 * arithmetic, the identifier shape, and the mapping of a refusal to the
 * phrase the card shows.
 */

export type SkillOrigin = 'bundled' | 'hub' | 'custom';

export interface SkillEntry {
  id: string;
  category: string | null;
  name: string | null;
  description: string | null;
  origin: SkillOrigin;
  enabled: boolean;
  essential: boolean;
}

/** Distinct categories, sorted. */
export function skillCategories(skills: readonly SkillEntry[]): string[] {
  const set = new Set<string>();
  for (const s of skills) if (s.category) set.add(s.category);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** Case-insensitive substring match on id, name and description; a
 *  category narrows first. An empty query matches everything. */
export function filterSkills(skills: readonly SkillEntry[], query: string, category: string | null): SkillEntry[] {
  const q = query.trim().toLowerCase();
  return skills.filter((s) => {
    if (category !== null && s.category !== category) return false;
    if (!q) return true;
    return [s.id, s.name ?? '', s.description ?? ''].some((f) => f.toLowerCase().includes(q));
  });
}

/**
 * The next `skills.disabled` list after one row is toggled. Built from the
 * list the host READ (never from the rows' flags, which are a projection),
 * so two quick toggles do not race on stale flags. An essential skill is
 * never added: Hermes drops it anyway, and the row shows no switch.
 */
export function toggleDisabled(disabled: readonly string[], id: string, essential: boolean): string[] {
  if (essential) return [...disabled];
  return disabled.includes(id) ? disabled.filter((x) => x !== id) : [...disabled, id];
}

/** Mirrors main's shape check so the field can refuse before a round trip. */
export function isValidSkillIdentifier(id: string): boolean {
  const s = id.trim();
  if (!s || s.length > 300) return false;
  if (/^https:\/\/[^\s]+\/SKILL\.md$/i.test(s)) return true;
  const parts = s.split('/');
  return parts.length >= 3 && parts.every((p) => /^[\w.-]{1,100}$/.test(p) && p !== '..' && p !== '.');
}

/** Whether a row offers "Uninstall": only what did not come with Hermes. */
export function canUninstall(skill: Pick<SkillEntry, 'origin' | 'essential'>): boolean {
  return !skill.essential && skill.origin !== 'bundled';
}

/** The refusals main can give, each with its own phrase in the locales. */
export const INSTALL_ERROR_CODES = [
  'ALREADY_INSTALLED', 'ALREADY_RUNNING', 'CLI_NOT_FOUND', 'NOT_ON_SHELF', 'INSTALL_FAILED', 'NOT_INSTALLED',
  'INVALID_IDENTIFIER', 'INVALID_NAME', 'BUNDLED', 'REMOVE_FAILED', 'STILL_ON_SHELF',
  'NO_SKILL_MD', 'ALREADY_EXISTS', 'COPY_FAILED', 'OPEN_FAILED', 'SKILLS_DISABLED_UNREADABLE', 'INVALID_DISABLED',
  'CONFIG_NOT_FOUND', 'INVALID_SKILL_NAME',
] as const;
export type InstallErrorCode = typeof INSTALL_ERROR_CODES[number];

/** The code inside an error message, or the generic failure when none is. */
export function installErrorCode(message: string): InstallErrorCode {
  return INSTALL_ERROR_CODES.find((c) => message.includes(c)) ?? 'INSTALL_FAILED';
}
