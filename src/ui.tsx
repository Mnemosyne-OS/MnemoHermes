/**
 * Shared cockpit chrome: the style tokens every panel uses (CSS variables
 * with fallbacks — both cartridge hosts theme through them), the cartridge
 * mark, and the building blocks that keep the house rules structural rather
 * than copy-pasted:
 *
 *  • `PanelGate` renders loading / error / data, so rule 11 is not something a
 *    panel can forget. Ten panels each carried their own copy of the two
 *    guards; a panel that skips one only shows it on a bad day.
 *  • `CodeBlock` is the one console block (four hand-rolled copies before).
 *  • `FeedbackNote` is the one settled-action line. The search section alone
 *    had seven near-identical spans differing by a locale key.
 */
import type { CSSProperties, ReactNode } from 'react';
import { useI18n } from './i18n/useI18n';
import type { PanelState } from './hooks/usePanelData';

// ── Style tokens ─────────────────────────────────────────────────────────────
// Every colour is a CSS variable with a fallback: the two cartridge hosts theme
// through them, and a bare hex here would be the one thing that stays dark in a
// light shell (CLAUDE rule 12).

export const panel: CSSProperties = {
  border: '1px solid var(--border-subtle, #2a2a2a)',
  borderRadius: 8,
  padding: '16px 20px',
  background: 'var(--bg-panel, #101010)'
};

export const inputStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle, #2a2a2a)',
  background: 'var(--bg-input, #181818)',
  color: 'var(--text-primary, #e0e0e0)',
  fontSize: 13
};

export const buttonStyle: CSSProperties = {
  padding: '6px 14px',
  borderRadius: 6,
  border: '1px solid var(--border-subtle, #2a2a2a)',
  background: 'var(--bg-input, #181818)',
  color: 'var(--text-primary, #e0e0e0)',
  cursor: 'pointer',
  fontSize: 13
};

/** The button of the gesture a panel is FOR: apply, start, keep, create. */
export const primaryButton: CSSProperties = {
  ...buttonStyle,
  borderColor: 'var(--accent, #35c9a6)'
};

/** The one control that opens a shell to every channel (YOLO). */
export const dangerButton: CSSProperties = {
  ...buttonStyle,
  borderColor: 'var(--danger, #d9534f)'
};

export const badge: CSSProperties = {
  padding: '1px 8px',
  borderRadius: 999,
  border: '1px solid var(--border-subtle, #2a2a2a)',
  fontSize: 11,
  color: 'var(--text-muted, #666)'
};

/** Secondary explanation under a control. */
export const hint: CSSProperties = { fontSize: 12, color: 'var(--text-muted, #666)' };

/** A settled outcome that is not a success (an error, a refusal, a limit). */
export const note: CSSProperties = { fontSize: 12, color: 'var(--text-secondary, #aaa)' };

/** A settled outcome that IS a success. */
export const ok: CSSProperties = { fontSize: 12, color: 'var(--accent, #35c9a6)' };

export const sectionTitle: CSSProperties = { margin: '0 0 12px', fontSize: 15, fontWeight: 600 };
export const cardTitle: CSSProperties = { margin: '0 0 10px', fontSize: 14, fontWeight: 600 };

/** The vertical stack every multi-card tab uses. */
export const stack: CSSProperties = { display: 'grid', gap: 12 };

/** A row of controls that wraps rather than pushing buttons off a narrow window. */
export const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };

// ── Building blocks ──────────────────────────────────────────────────────────

/** The cartridge mark, inline so the cockpit carries its own identity —
 *  same artwork as icon.svg (wings + memory core in the flow gradient). */
export function Logo({ size = 34 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} aria-hidden="true">
      <defs>
        <linearGradient id="mh-flow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7B5EA7" />
          <stop offset="45%" stopColor="#A98BFF" />
          <stop offset="100%" stopColor="#E4D6FF" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="14" fill="#0E0E13" />
      <path d="M24 30 C17 28, 12 23, 10 15 C16 18, 21 19, 25 23" fill="none" stroke="url(#mh-flow)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M40 30 C47 28, 52 23, 54 15 C48 18, 43 19, 39 23" fill="none" stroke="url(#mh-flow)" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M23 37 C18 37, 14 34, 12 29 C16 30.5, 19.5 31, 23 33" fill="none" stroke="url(#mh-flow)" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
      <path d="M41 37 C46 37, 50 34, 52 29 C48 30.5, 44.5 31, 41 33" fill="none" stroke="url(#mh-flow)" strokeWidth="2.2" strokeLinecap="round" opacity="0.6" />
      <circle cx="32" cy="33" r="8.5" fill="none" stroke="url(#mh-flow)" strokeWidth="3.6" />
      <circle cx="32" cy="33" r="2.6" fill="#E4D6FF" />
      <line x1="24" y1="51" x2="40" y2="51" stroke="#A98BFF" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    </svg>
  );
}

export function StatusDot({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        marginRight: 8,
        background: on ? 'var(--accent, #35c9a6)' : 'var(--text-muted, #666)'
      }}
    />
  );
}

/** A small labelled chip: a port, a spine type, a preset, a tap. */
export function Pill({ children }: { children: ReactNode }) {
  return <span style={badge}>{children}</span>;
}

/** The shared error state of every panel: not-wired vs failed, plus retry. */
export function ErrorPanel({ unavailable, onRetry }: { unavailable: boolean; onRetry: () => void }) {
  const { t } = useI18n();
  return (
    <div style={panel}>
      <p style={{ margin: '0 0 12px', color: 'var(--text-secondary, #aaa)' }}>
        {unavailable ? t('status.notWired') : t('common.error')}
      </p>
      <button onClick={onRetry} style={buttonStyle}>
        {t('status.retry')}
      </button>
    </div>
  );
}

/**
 * The three states of every data panel, in one place (house rule 11).
 *
 * `children` only ever runs with real data, so a panel body can read
 * `data.foo` without a guard, and cannot render a half-loaded shape.
 */
export function PanelGate<T>({
  state,
  onRetry,
  loadingLabel,
  children,
}: {
  state: PanelState<T>;
  onRetry: () => void;
  /** Locale key, when "loading" deserves a more specific sentence. */
  loadingLabel?: string;
  children: (data: T) => ReactNode;
}) {
  const { t } = useI18n();
  if (state.kind === 'loading') {
    return <div style={panel}>{t(loadingLabel ?? 'common.loading')}</div>;
  }
  if (state.kind === 'error') {
    return <ErrorPanel unavailable={state.unavailable} onRetry={onRetry} />;
  }
  return <>{children(state.data)}</>;
}

/**
 * A console block. `journal` scrolls and wraps (process output, which arrives
 * in unpredictable widths); `snippet` is a fixed sample the human copies, so it
 * scrolls sideways rather than reflowing a line that must stay one line.
 */
export function CodeBlock({
  children,
  variant = 'journal',
  style,
}: {
  children: ReactNode;
  variant?: 'journal' | 'snippet';
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    margin: 0,
    padding: '10px 12px',
    borderRadius: 6,
    background: 'var(--bg-void, #050505)',
    border: '1px solid var(--border-subtle, #2a2a2a)',
    fontSize: variant === 'journal' ? 11 : 12,
    lineHeight: 1.5,
  };
  const variantStyle: CSSProperties = variant === 'journal'
    ? { maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }
    : { overflowX: 'auto', userSelect: 'all' };
  return <pre style={{ ...base, ...variantStyle, ...style }}>{children}</pre>;
}

/**
 * The line that appears after an action settles. `tone` carries the only
 * distinction that matters to a reader: it worked, or it did not.
 */
export function FeedbackNote({ tone, children }: { tone: 'ok' | 'note'; children: ReactNode }) {
  return <span style={tone === 'ok' ? ok : note}>{children}</span>;
}
