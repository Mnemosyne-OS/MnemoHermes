/**
 * ChatStage — the cards that appear BESIDE the conversation when a reply
 * points at something (doc 123, 2026-09-23, "des widgets autonomes autour du
 * chat pour l'effet whaou").
 *
 * An image the agent made, a document it wrote: each is its own card, with
 * its own close, its own "open", and no tie to the bubble that produced it.
 * The cards outlive the turn (they are App state, they survive a tab switch)
 * and leave only when the person closes them. A card that could not be read
 * says so in its own words — it never vanishes, and never shows a broken
 * picture as if it were the picture.
 */
import { useEffect } from 'react';
import { useI18n } from '../i18n/useI18n';
import { buttonStyle, hint } from '../ui';
import type { StageItem } from '../types';

const STYLE_ID = 'mnemo-hermes-stage-style';
const KEYFRAMES = `
@keyframes mnemoStageIn {
  0% { opacity: 0; transform: translateX(24px) scale(0.92); }
  60% { opacity: 1; transform: translateX(-4px) scale(1.02); }
  100% { opacity: 1; transform: translateX(0) scale(1); }
}
@keyframes mnemoStageGlow {
  0% { box-shadow: 0 0 0 0 rgba(53, 201, 166, 0.55); }
  100% { box-shadow: 0 0 0 18px rgba(53, 201, 166, 0); }
}
@media (prefers-reduced-motion: reduce) {
  .mnemo-stage-card { animation: none !important; }
}
`;

function ensureStyle() {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const el = document.createElement('style');
  el.id = STYLE_ID;
  el.textContent = KEYFRAMES;
  document.head.appendChild(el);
}

export function ChatStage({ items, onClose, onOpen }: {
  items: StageItem[];
  onClose: (id: string) => void;
  onOpen: (path: string) => void;
}) {
  const { t } = useI18n();
  useEffect(() => { ensureStyle(); }, []);
  if (items.length === 0) return null;
  return (
    <aside
      aria-label={t('stage.title')}
      style={{
        width: 300, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12,
        overflowY: 'auto', paddingBottom: 12,
      }}
    >
      {items.map((item) => (
        <article
          key={item.id}
          className="mnemo-stage-card"
          style={{
            borderRadius: 12,
            border: '1px solid var(--border-subtle, #2a2a2a)',
            background: 'var(--bg-panel, #101010)',
            padding: 10,
            display: 'grid',
            gap: 8,
            animation: 'mnemoStageIn 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.2), mnemoStageGlow 1.2s ease-out',
          }}
        >
          <header style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span aria-hidden style={{ fontSize: 14 }}>{item.kind === 'image' ? '🖼️' : '📄'}</span>
            <strong style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={item.path ?? item.name}>
              {item.name}
            </strong>
            <button
              onClick={() => onClose(item.id)}
              aria-label={t('stage.close')}
              title={t('stage.close')}
              style={{ ...buttonStyle, padding: '2px 8px', fontSize: 12 }}
            >
              ×
            </button>
          </header>

          {item.state === 'loading' && <p style={{ ...hint, margin: 0 }}>{t('stage.loading')}</p>}
          {item.state === 'error' && (
            <p style={{ ...hint, margin: 0, color: 'var(--text-secondary, #aaa)' }}>
              {t('stage.unreadable')} <code style={{ fontSize: 11 }}>{item.error}</code>
            </p>
          )}
          {item.state === 'ready' && item.kind === 'image' && item.dataUrl && (
            <img
              src={item.dataUrl}
              alt={item.name}
              style={{ width: '100%', borderRadius: 8, display: 'block', cursor: item.path ? 'pointer' : 'default' }}
              onClick={() => { if (item.path) onOpen(item.path); }}
            />
          )}
          {item.state === 'ready' && item.kind === 'document' && (
            item.text !== null && item.text !== undefined ? (
              <pre style={{
                margin: 0, fontSize: 11, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                maxHeight: 220, overflowY: 'auto', color: 'var(--text-secondary, #aaa)',
                background: 'var(--bg-void, #050505)', borderRadius: 8, padding: 8,
              }}
              >
                {item.text}{item.truncated ? '\n…' : ''}
              </pre>
            ) : (
              <p style={{ ...hint, margin: 0 }}>{t('stage.binaryHint')}</p>
            )
          )}

          {item.path && item.state !== 'loading' && (
            <button onClick={() => onOpen(item.path!)} style={{ ...buttonStyle, justifySelf: 'start', fontSize: 12 }}>
              {t('stage.open')}
            </button>
          )}
        </article>
      ))}
    </aside>
  );
}
