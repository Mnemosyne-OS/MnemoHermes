import {
  carriesTerminal,
  explicitToolsets,
  presetToolsets,
  toggleToolset,
  toolsetsPayload,
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

describe('toggleToolset', () => {
  it('adds a box that was not ticked', () => {
    expect(toggleToolset(['web'], AVAILABLE, 'file')).toEqual(['web', 'file']);
  });

  it('removes a box that was ticked', () => {
    expect(toggleToolset(['web', 'file'], AVAILABLE, 'web')).toEqual(['file']);
  });

  it('drops the preset the moment a box is touched', () => {
    // The grid cannot draw `all`, so keeping it would leave the checkboxes
    // showing something other than what the config means.
    expect(toggleToolset(['all'], AVAILABLE, 'web')).toEqual(['web']);
  });

  it('keeps the explicit entries that sat beside a preset', () => {
    expect(toggleToolset(['hermes-cli', 'web'], AVAILABLE, 'file')).toEqual(['web', 'file']);
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

  it('omits an emptied platform rather than writing an empty list', () => {
    // An empty key would claim the human chose "no tools at all" for a platform
    // they may not even have been editing.
    expect(toolsetsPayload({ cli: ['web'], telegram: ['todo'] }, { cli: [] }))
      .toEqual({ telegram: ['todo'] });
  });

  it('ignores an edit for a platform the config does not have', () => {
    expect(toolsetsPayload({ cli: ['web'] }, { ghost: ['terminal'] })).toEqual({ cli: ['web'] });
  });

  it('returns an empty object when everything was emptied', () => {
    expect(toolsetsPayload({ cli: ['web'] }, { cli: [] })).toEqual({});
  });
});
