import { describe, it, expect } from 'vitest';
import {
  carriesTerminal,
  effectiveToolsets,
  expandPreset,
  explicitToolsets,
  gridToolsets,
  PINNED_TOOLSETS,
  presetToolsets,
  toggleToolset,
  toolsetsPayload,
  unreadPresets,
  unsetLinkedChannels,
} from './toolsets';

const AVAILABLE = ['web', 'file', 'todo', 'skills', 'tts', 'terminal'];

describe('carriesTerminal', () => {
  it('sees the raw toolset', () => {
    expect(carriesTerminal(['web', 'terminal'])).toBe(true);
  });

  it('sees the presets that bundle one', () => {
    expect(carriesTerminal(['all'])).toBe(true);
    expect(carriesTerminal(['debugging'])).toBe(true);
    expect(carriesTerminal(['hermes-cli'])).toBe(true);
  });

  it('does not flag a harmless list', () => {
    expect(carriesTerminal(['web', 'todo', 'tts'])).toBe(false);
    expect(carriesTerminal([])).toBe(false);
  });

  it('does not flag a name that merely contains the word', () => {
    expect(carriesTerminal(['terminal-free'])).toBe(false);
  });
});

describe('gridToolsets', () => {
  it('draws the pinned catalogue first, then what the host adds, once each', () => {
    const grid = gridToolsets(['web', 'zzz_custom', 'file']);
    expect(grid.slice(0, PINNED_TOOLSETS.length)).toEqual([...PINNED_TOOLSETS]);
    expect(grid.filter((x) => x === 'web')).toHaveLength(1);
    expect(grid.at(-1)).toBe('zzz_custom');
  });

  it('drops an id the pinned Hermes no longer defines, even when the host offers it', () => {
    expect(gridToolsets(['skills_hub', 'web'])).not.toContain('skills_hub');
  });
});

describe('explicit / preset split', () => {
  it('separates what the grid can draw from what it cannot', () => {
    const list = ['web', 'hermes-cli', 'file'];
    expect(explicitToolsets(list, AVAILABLE)).toEqual(['web', 'file']);
    expect(presetToolsets(list, AVAILABLE)).toEqual(['hermes-cli']);
  });

  it('accounts for every entry between the two halves', () => {
    const list = ['web', 'all', 'file', 'mystery'];
    expect([...explicitToolsets(list, AVAILABLE), ...presetToolsets(list, AVAILABLE)].sort())
      .toEqual([...list].sort());
  });
});

describe('expandPreset / effectiveToolsets', () => {
  it('reads `all` and every hermes-* bundle as the whole grid', () => {
    expect(expandPreset('all', AVAILABLE)).toEqual(AVAILABLE);
    expect(expandPreset('hermes-cli', AVAILABLE)).toEqual(AVAILABLE);
    expect(expandPreset('hermes-telegram', AVAILABLE)).toEqual(AVAILABLE);
  });

  it('reads `safe` and `debugging` as toolsets.py spells them', () => {
    expect(expandPreset('safe', ['web', 'terminal', 'vision', 'image_gen'])).toEqual(['web', 'vision', 'image_gen']);
    expect(expandPreset('debugging', AVAILABLE)).toEqual(['web', 'file', 'terminal']);
  });

  it('does not invent an expansion for a preset it cannot read', () => {
    expect(expandPreset('coding', AVAILABLE)).toBeNull();
    expect(expandPreset('mystery', AVAILABLE)).toBeNull();
  });

  it('ticks everything for a platform that carries hermes-cli — the screen no longer says "nothing"', () => {
    expect(effectiveToolsets(['hermes-cli'], AVAILABLE)).toEqual(AVAILABLE);
  });

  it('merges explicit entries with an expanded preset, in grid order, once each', () => {
    expect(effectiveToolsets(['terminal', 'safe'], ['web', 'terminal', 'vision'])).toEqual(['web', 'terminal', 'vision']);
  });

  it('ticks nothing for an unreadable preset and reports it as unread', () => {
    expect(effectiveToolsets(['coding'], AVAILABLE)).toEqual([]);
    expect(unreadPresets(['coding', 'hermes-cli', 'web'], AVAILABLE)).toEqual(['coding']);
  });
});

describe('toggleToolset', () => {
  it('adds a box that was not ticked', () => {
    expect(toggleToolset(['web'], AVAILABLE, 'file')).toEqual(['web', 'file']);
  });

  it('removes a box that was ticked', () => {
    expect(toggleToolset(['web', 'file'], AVAILABLE, 'web')).toEqual(['file']);
  });

  it('turns a preset into the explicit list the person saw, minus the box they unticked', () => {
    // `hermes-cli` showed every box ticked; unticking terminal must keep the
    // rest, not collapse the platform to nothing.
    expect(toggleToolset(['hermes-cli'], AVAILABLE, 'terminal'))
      .toEqual(['web', 'file', 'todo', 'skills', 'tts']);
    expect(toggleToolset(['all'], AVAILABLE, 'web')).not.toContain('all');
  });

  it('keeps the explicit entries that sat beside an unreadable preset', () => {
    expect(toggleToolset(['coding', 'web'], AVAILABLE, 'file')).toEqual(['web', 'file']);
  });

  it('can empty a platform completely', () => {
    expect(toggleToolset(['web'], AVAILABLE, 'web')).toEqual([]);
  });

  it('never mutates the list it was given', () => {
    const before = ['web', 'file'];
    toggleToolset(before, AVAILABLE, 'todo');
    expect(before).toEqual(['web', 'file']);
  });
});

describe('toolsetsPayload', () => {
  it('lets an edit win over the loaded config', () => {
    expect(toolsetsPayload({ cli: ['web'] }, { cli: ['file'] })).toEqual({ cli: ['file'] });
  });

  it('carries untouched platforms through unchanged', () => {
    expect(toolsetsPayload({ cli: ['web'], telegram: ['todo'] }, { cli: ['file'] }))
      .toEqual({ cli: ['file'], telegram: ['todo'] });
  });

  it('🚨 writes an EDITED platform as [] — omitting it would hand it every tool (sweep 2026-09-23)', () => {
    expect(toolsetsPayload({ cli: ['web'], telegram: ['todo'] }, { telegram: [] }))
      .toEqual({ cli: ['web'], telegram: [] });
  });

  it('leaves out an untouched platform that is empty on disk', () => {
    expect(toolsetsPayload({ cli: ['web'], telegram: [] }, { cli: ['file'] }))
      .toEqual({ cli: ['file'] });
  });

  it('writes a platform that exists only in the edits — a linked channel that had no block', () => {
    expect(toolsetsPayload({ cli: ['web'] }, { telegram: ['web', 'todo'] }))
      .toEqual({ cli: ['web'], telegram: ['web', 'todo'] });
  });

  it('an emptied only platform is written empty, not dropped to nothing', () => {
    expect(toolsetsPayload({ cli: ['web'] }, { cli: [] })).toEqual({ cli: [] });
  });
});

describe('unsetLinkedChannels', () => {
  it('names the linked channels the config says nothing about', () => {
    expect(unsetLinkedChannels({ cli: ['web'], api_server: ['web'] }, ['telegram', 'discord'])).toEqual(['telegram', 'discord']);
  });

  it('leaves out a channel that already has a block, even an empty-looking one', () => {
    expect(unsetLinkedChannels({ telegram: ['web'] }, ['telegram'])).toEqual([]);
  });

  it('is empty when nothing is linked', () => {
    expect(unsetLinkedChannels({ cli: ['web'] }, [])).toEqual([]);
  });
});
