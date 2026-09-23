import { describe, it, expect } from 'vitest';
import { markdownTitle, parseInlines, parseMarkdown } from './markdown';

describe('parseInlines', () => {
  it('reads bold, italic and code, leaving the rest as text', () => {
    expect(parseInlines('a **b** c *d* e `f` g')).toEqual([
      { kind: 'text', text: 'a ' }, { kind: 'bold', text: 'b' }, { kind: 'text', text: ' c ' },
      { kind: 'italic', text: 'd' }, { kind: 'text', text: ' e ' }, { kind: 'code', text: 'f' }, { kind: 'text', text: ' g' },
    ]);
  });

  it('keeps a link\'s text and drops its target', () => {
    expect(parseInlines('see [the doc](https://x.y/z) now')).toEqual([{ kind: 'text', text: 'see the doc now' }]);
  });

  it('an underscore inside an identifier is a character, not emphasis (sweep 2026-09-23)', () => {
    expect(parseInlines('platform_toolsets and skills_hub')).toEqual([{ kind: 'text', text: 'platform_toolsets and skills_hub' }]);
    // `__init__` between spaces IS strong emphasis in Markdown; only the in-word case is protected.
    expect(parseInlines('see _this_ now')).toEqual([{ kind: 'text', text: 'see ' }, { kind: 'italic', text: 'this' }, { kind: 'text', text: ' now' }]);
  });

  it('an unclosed mark is plain text', () => {
    expect(parseInlines('2 * 3 = 6')).toEqual([{ kind: 'text', text: '2 * 3 = 6' }]);
  });
});

describe('parseMarkdown', () => {
  it('splits headings, paragraphs, lists and fenced code', () => {
    const md = ['## Persisting', '', 'Before your first ingest, confirm.', 'Then follow it.', '', '- **Self-contained.** A future reader', '- Provenance', '', '1. one', '2. two', '', '```', 'x = 1', '```'].join('\n');
    const blocks = parseMarkdown(md);
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'list', 'list', 'code']);
    expect(blocks[0]).toMatchObject({ kind: 'heading', level: 2 });
    expect(blocks[1]).toMatchObject({ kind: 'paragraph', inlines: [{ kind: 'text', text: 'Before your first ingest, confirm. Then follow it.' }] });
    expect(blocks[2]).toMatchObject({ kind: 'list', ordered: false });
    expect((blocks[2] as { items: unknown[] }).items).toHaveLength(2);
    expect(blocks[3]).toMatchObject({ kind: 'list', ordered: true });
    expect(blocks[4]).toEqual({ kind: 'code', text: 'x = 1' });
  });

  it('six hashes is the deepest heading, seven is a paragraph (as in Markdown), and CRLF is fine', () => {
    expect(parseMarkdown('###### deep\r\ntext')).toEqual([
      { kind: 'heading', level: 6, inlines: [{ kind: 'text', text: 'deep' }] },
      { kind: 'paragraph', inlines: [{ kind: 'text', text: 'text' }] },
    ]);
    expect(parseMarkdown('####### not a heading')).toEqual([
      { kind: 'paragraph', inlines: [{ kind: 'text', text: '####### not a heading' }] },
    ]);
  });

  it('empty input is no block', () => {
    expect(parseMarkdown('')).toEqual([]);
    expect(parseMarkdown('\n\n')).toEqual([]);
  });
});

describe('markdownTitle', () => {
  it('prefers the first heading, else the first words of the first paragraph', () => {
    expect(markdownTitle(parseMarkdown('para\n\n# Title'))).toBe('Title');
    expect(markdownTitle(parseMarkdown('Decided to pin uv 0.4 because the installer broke on the newer one and nobody noticed'), 30)).toBe('Decided to pin uv 0.4 because…');
  });

  it('is null without any text', () => {
    expect(markdownTitle(parseMarkdown('```\ncode only\n```'))).toBeNull();
  });
});
