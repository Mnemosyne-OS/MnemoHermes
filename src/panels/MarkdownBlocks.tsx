/**
 * Paints the blocks `lib/markdown` reads: what an agent's note looks like
 * to a person, instead of the raw `## ** \`` it was typed in.
 */
import type { CSSProperties } from 'react';
import type { Block, Inline } from '../lib/markdown';

const code: CSSProperties = {
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  fontSize: '0.92em',
  background: 'var(--bg-input, #181818)',
  padding: '1px 5px',
  borderRadius: 4,
};

function Inlines({ inlines }: { inlines: Inline[] }) {
  return (
    <>
      {inlines.map((x, i) => {
        if (x.kind === 'bold') return <strong key={i}>{x.text}</strong>;
        if (x.kind === 'italic') return <em key={i}>{x.text}</em>;
        if (x.kind === 'code') return <code key={i} style={code}>{x.text}</code>;
        return <span key={i}>{x.text}</span>;
      })}
    </>
  );
}

const HEADING_SIZE: Record<number, number> = { 1: 16, 2: 15, 3: 14, 4: 13, 5: 13, 6: 13 };

export function MarkdownBlocks({ blocks }: { blocks: Block[] }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.55, display: 'grid', gap: 8 }}>
      {blocks.map((b, i) => {
        if (b.kind === 'heading') {
          return <div key={i} style={{ fontWeight: 600, fontSize: HEADING_SIZE[b.level] ?? 13, marginTop: i === 0 ? 0 : 4 }}><Inlines inlines={b.inlines} /></div>;
        }
        if (b.kind === 'paragraph') return <p key={i} style={{ margin: 0 }}><Inlines inlines={b.inlines} /></p>;
        if (b.kind === 'code') {
          return <pre key={i} style={{ ...code, margin: 0, padding: '8px 10px', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{b.text}</pre>;
        }
        const Tag = b.ordered ? 'ol' : 'ul';
        return (
          <Tag key={i} style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 3 }}>
            {b.items.map((item, j) => <li key={j}><Inlines inlines={item} /></li>)}
          </Tag>
        );
      })}
    </div>
  );
}
