/**
 * A small markdown reader for the inbox tiles: what an agent's memory note
 * uses (headings, paragraphs, bullet and numbered lists, fenced code,
 * bold / italic / inline code) and nothing else. No HTML, no images, and
 * a link is its text — a tile is read, never navigated from.
 *
 * Pure: blocks in, blocks out. The component that paints them is
 * `panels/MarkdownBlocks.tsx`.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'italic'; text: string }
  | { kind: 'code'; text: string };

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; inlines: Inline[] }
  | { kind: 'paragraph'; inlines: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'code'; text: string };

/** Inline marks, left to right; an unclosed mark is plain text. */
export function parseInlines(text: string): Inline[] {
  const out: Inline[] = [];
  // Links first: keep the text, drop the target (never navigated from a tile).
  const src = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  // Underscore marks only at word boundaries: `platform_toolsets` and
  // `__init__` are identifiers an agent's note is full of (sweep 2026-09-23).
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*]+\*)|((?<!\w)__[^_]+__(?!\w))|((?<!\w)_[^_]+_(?!\w))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) {
    if (m.index > last) out.push({ kind: 'text', text: src.slice(last, m.index) });
    const tok = m[0];
    if (tok.startsWith('`')) out.push({ kind: 'code', text: tok.slice(1, -1) });
    else if (tok.startsWith('**') || tok.startsWith('__')) out.push({ kind: 'bold', text: tok.slice(2, -2) });
    else out.push({ kind: 'italic', text: tok.slice(1, -1) });
    last = m.index + tok.length;
  }
  if (last < src.length) out.push({ kind: 'text', text: src.slice(last) });
  return out;
}

const HEADING = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
const BULLET = /^\s*[-*+]\s+(.+)$/;
const NUMBERED = /^\s*\d+[.)]\s+(.+)$/;

export function parseMarkdown(text: string): Block[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const blocks: Block[] = [];
  let para: string[] = [];
  const flushPara = () => {
    if (!para.length) return;
    blocks.push({ kind: 'paragraph', inlines: parseInlines(para.join(' ')) });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    if (/^\s*```/.test(line)) {
      flushPara();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i] ?? '')) { buf.push(lines[i] ?? ''); i++; }
      blocks.push({ kind: 'code', text: buf.join('\n') });
      continue;
    }
    const h = HEADING.exec(line);
    if (h) {
      flushPara();
      blocks.push({ kind: 'heading', level: Math.min(6, (h[1] ?? '#').length) as 1 | 2 | 3 | 4 | 5 | 6, inlines: parseInlines(h[2] ?? '') });
      continue;
    }
    const b = BULLET.exec(line);
    const n = b ? null : NUMBERED.exec(line);
    if (b || n) {
      flushPara();
      const ordered = !!n;
      const last = blocks[blocks.length - 1];
      const item = parseInlines((b ?? n)?.[1] ?? '');
      if (last && last.kind === 'list' && last.ordered === ordered) last.items.push(item);
      else blocks.push({ kind: 'list', ordered, items: [item] });
      continue;
    }
    if (line.trim() === '') { flushPara(); continue; }
    para.push(line.trim());
  }
  flushPara();
  return blocks;
}

/** The first heading's text, or the first paragraph's first words: a tile title. */
export function markdownTitle(blocks: readonly Block[], maxChars = 80): string | null {
  const plain = (inl: Inline[]) => inl.map((x) => x.text).join('').trim();
  const h = blocks.find((b): b is Extract<Block, { kind: 'heading' }> => b.kind === 'heading');
  if (h) return plain(h.inlines).slice(0, maxChars) || null;
  const p = blocks.find((b): b is Extract<Block, { kind: 'paragraph' }> => b.kind === 'paragraph');
  if (!p) return null;
  const text = plain(p.inlines);
  if (!text) return null;
  return text.length > maxChars ? text.slice(0, maxChars).replace(/\s+\S*$/, '') + '…' : text;
}
