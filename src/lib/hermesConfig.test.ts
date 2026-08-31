import { hermesModelYaml, isValidProfileName, normalizeProfileName } from './hermesConfig';

describe('normalizeProfileName', () => {
  it('trims and lowercases, the way the CLI wants it', () => {
    expect(normalizeProfileName('  Content-Creator  ')).toBe('content-creator');
  });
});

describe('isValidProfileName', () => {
  it.each(['a', 'content-creator', 'agent2', 'x'.repeat(31)])('accepts %s', (name) => {
    expect(isValidProfileName(name)).toBe(true);
  });

  it.each([
    ['', 'empty'],
    ['-lead', 'leading hyphen'],
    ['my agent', 'a space'],
    ['agent_1', 'an underscore'],
    ['agent/../etc', 'a path'],
    ['x'.repeat(32), 'too long'],
  ])('rejects %s (%s)', (name) => {
    expect(isValidProfileName(name)).toBe(false);
  });

  it('validates what will actually be SENT, not what was typed', () => {
    // The panel normalises before invoking, so the button must judge the
    // normalised form or it greys out a name that would have worked.
    expect(isValidProfileName('  Content-Creator ')).toBe(true);
  });

  it('rejects a name whose only problem survives normalisation', () => {
    expect(isValidProfileName('  my agent ')).toBe(false);
  });
});

describe('hermesModelYaml', () => {
  it('points at the loopback proxy on the given port', () => {
    const yaml = hermesModelYaml(7439, 'sk-abc');
    expect(yaml).toContain('base_url: "http://127.0.0.1:7439/v1"');
    expect(yaml).toContain('api_key: "sk-abc"');
    expect(yaml).toContain('provider: "custom"');
    expect(yaml).toContain('default: "mnemosyne"');
  });

  it('stays parseable with no key, so the agent reports a 401 instead of refusing to start', () => {
    const yaml = hermesModelYaml(7439, null);
    expect(yaml).toContain('api_key: ""');
    expect(yaml.split('\n')).toHaveLength(5);
  });

  it('indents every field under model:', () => {
    const [head, ...rest] = hermesModelYaml(7439, 'k').split('\n');
    expect(head).toBe('model:');
    for (const line of rest) expect(line.startsWith('  ')).toBe(true);
  });
});
