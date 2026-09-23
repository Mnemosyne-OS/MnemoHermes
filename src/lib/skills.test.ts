import { describe, it, expect } from 'vitest';
import {
  canUninstall, filterSkills, installErrorCode, isValidSkillIdentifier, skillCategories, toggleDisabled, type SkillEntry,
} from './skills';

const entry = (over: Partial<SkillEntry> & Pick<SkillEntry, 'id'>): SkillEntry => ({
  category: null, name: null, description: null, origin: 'bundled', enabled: true, essential: false, ...over,
});

const SHELF: SkillEntry[] = [
  entry({ id: 'apple-notes', category: 'apple', name: 'Apple Notes', description: 'Read and write notes' }),
  entry({ id: 'himalaya', category: 'email', description: 'IMAP mail client' }),
  entry({ id: 'obsidian', category: 'note-taking', name: 'Obsidian' }),
  entry({ id: 'loose', name: 'Loose', description: 'No category', origin: 'hub' }),
];

describe('skillCategories', () => {
  it('lists each category once, sorted, and skips the uncategorised', () => {
    expect(skillCategories(SHELF)).toEqual(['apple', 'email', 'note-taking']);
  });
});

describe('filterSkills', () => {
  it('an empty query with no category is the whole shelf', () => {
    expect(filterSkills(SHELF, '  ', null)).toEqual(SHELF);
  });

  it('a category narrows to its members', () => {
    expect(filterSkills(SHELF, '', 'email').map((s) => s.id)).toEqual(['himalaya']);
  });

  it('searches id, name and description, case-insensitively', () => {
    expect(filterSkills(SHELF, 'NOTES', null).map((s) => s.id)).toEqual(['apple-notes']);
    expect(filterSkills(SHELF, 'imap', null).map((s) => s.id)).toEqual(['himalaya']);
    expect(filterSkills(SHELF, 'obsid', null).map((s) => s.id)).toEqual(['obsidian']);
  });

  it('a query and a category combine', () => {
    expect(filterSkills(SHELF, 'notes', 'email')).toEqual([]);
    expect(filterSkills(SHELF, 'notes', 'apple').map((s) => s.id)).toEqual(['apple-notes']);
  });

  it('a null name or description never throws and never matches', () => {
    expect(filterSkills(SHELF, 'null', null)).toEqual([]);
  });
});

describe('toggleDisabled', () => {
  it('adds a skill that was enabled, removes one that was disabled, from the list the host read', () => {
    expect(toggleDisabled(['pdf'], 'findmy', false)).toEqual(['pdf', 'findmy']);
    expect(toggleDisabled(['pdf', 'findmy'], 'pdf', false)).toEqual(['findmy']);
  });

  it('never adds the essential skill, and never mutates its input', () => {
    const before = ['pdf'];
    expect(toggleDisabled(before, 'hermes-agent', true)).toEqual(['pdf']);
    expect(before).toEqual(['pdf']);
  });
});

describe('isValidSkillIdentifier', () => {
  it('accepts owner/repo/path and an https SKILL.md URL, trimmed', () => {
    expect(isValidSkillIdentifier(' openai/skills/skill-creator ')).toBe(true);
    expect(isValidSkillIdentifier('https://example.org/x/SKILL.md')).toBe(true);
  });

  it('refuses empty, two segments, dot segments, http', () => {
    expect(isValidSkillIdentifier('')).toBe(false);
    expect(isValidSkillIdentifier('owner/repo')).toBe(false);
    expect(isValidSkillIdentifier('a/../b')).toBe(false);
    expect(isValidSkillIdentifier('http://example.org/SKILL.md')).toBe(false);
  });
});

describe('canUninstall', () => {
  it('only what did not come with Hermes, and never the essential one', () => {
    expect(canUninstall({ origin: 'hub', essential: false })).toBe(true);
    expect(canUninstall({ origin: 'custom', essential: false })).toBe(true);
    expect(canUninstall({ origin: 'bundled', essential: false })).toBe(false);
    expect(canUninstall({ origin: 'hub', essential: true })).toBe(false);
  });
});

describe('installErrorCode', () => {
  it('finds the code inside the message main threw', () => {
    expect(installErrorCode('Error: NOT_ON_SHELF')).toBe('NOT_ON_SHELF');
    expect(installErrorCode('BUNDLED')).toBe('BUNDLED');
    expect(installErrorCode('COPY_FAILED: EACCES')).toBe('COPY_FAILED');
  });

  it('falls back to the generic failure for anything else', () => {
    expect(installErrorCode('socket hang up')).toBe('INSTALL_FAILED');
  });
});
