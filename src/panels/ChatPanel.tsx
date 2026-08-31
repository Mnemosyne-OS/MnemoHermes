/**
 * The Chat tab — one stateless conversation with the agent through its
 * api_server (M2). Error CODES become localized user messages here; the
 * host only ever ships the taxonomy.
 */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { panel, inputStyle, buttonStyle, primaryButton, hint } from '../ui';
import { chatErrorKey, errorMessage } from '../lib/errorCodes';
import type { ChatMessage } from '../types';

/** The cheat-sheet content. Command literals are Hermes' own vocabulary
 *  (universal, never translated); only the descriptions go through t(). */
const COMMANDS = [
  'help', 'new', 'status', 'model', 'context',
  'goal', 'skills', 'background', 'title', 'voice',
] as const;

export function ChatPanel({ apiPort, messages, setMessages }: {
  apiPort: number | null;
  /** Owned by App so the conversation survives tab switches (panels unmount). */
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
}) {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cheatOpen, setCheatOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // The in-flight stream's canceller (Stop button, and abort-on-unmount).
  const abortRef = useRef<AbortController | null>(null);
  // Guards setState after unmount: the conversation lives in App state (survives
  // tab switches), but this panel does not — a switch mid-stream aborts here.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; abortRef.current?.abort(); };
  }, []);
  // Honest waiting: an agent turn runs tools and can legitimately take
  // minutes — show elapsed seconds so silence never reads as "stuck".
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const id = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, [pending]);
  const elapsedSec = pending && startedAt !== null ? Math.floor((Date.now() - startedAt) / 1000) : 0;
  // The "thinking" line covers only the wait BEFORE the first token; once the
  // bubble starts filling, the live text is the progress indicator.
  const lastMsg = messages[messages.length - 1];
  const awaitingFirstToken = pending && (!lastMsg || lastMsg.role !== 'assistant' || lastMsg.content.length === 0);

  const insertCommand = (cmd: string) => {
    setInput(`/${cmd} `);
    setCheatOpen(false);
    inputRef.current?.focus();
  };

  const send = async () => {
    const text = input.trim();
    if (!text || pending) return;
    const next = [...messages, { role: 'user' as const, content: text }];
    setMessages(next);
    setInput('');
    setError(null);
    setPending(true);
    setStartedAt(Date.now());

    // Open the assistant bubble now, at a fixed index, and fill it as chunks
    // arrive. It renders nothing while empty (see the map below), so there is no
    // blank box before the first token — the "thinking" line covers that gap.
    const assistantIndex = next.length;
    setMessages((cur) => [...cur, { role: 'assistant', content: '' }]);

    const controller = new AbortController();
    abortRef.current = controller;
    let received = 0;
    try {
      await sdk.stream('hermes.chatStream', {
        messages: next,
        ...(apiPort !== null ? { port: apiPort } : {})
      }, {
        signal: controller.signal,
        onChunk: (chunk) => {
          received += chunk.length;
          setMessages((cur) => {
            const copy = cur.slice();
            const bubble = copy[assistantIndex];
            if (bubble && bubble.role === 'assistant') {
              copy[assistantIndex] = { role: 'assistant', content: bubble.content + chunk };
            }
            return copy;
          });
        },
      });
    } catch (err) {
      if (controller.signal.aborted) {
        // Clean stop: keep whatever streamed, label it stopped.
        if (mountedRef.current) setError(t('chat.stopped'));
      } else if (received > 0) {
        // Partial reply then the stream broke — keep the partial bubble, flag it.
        // Never let a truncation read as a complete short answer.
        if (mountedRef.current) setError(t('chat.errInterrupted'));
      } else {
        // Nothing arrived — drop the empty bubble and surface the classified error.
        setMessages((cur) => cur.filter((_, i) => i !== assistantIndex));
        if (mountedRef.current) setError(t(chatErrorKey(errorMessage(err))));
      }
    } finally {
      abortRef.current = null;
      if (mountedRef.current) setPending(false);
    }
  };

  return (
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden' }}>
      {/* The sliding cheat-sheet: tiles of Hermes' slash commands, click to insert. */}
      <div
        aria-hidden={!cheatOpen}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          width: 280,
          boxSizing: 'border-box',
          padding: '16px 16px 12px',
          background: 'var(--bg-panel, #101010)',
          borderLeft: '1px solid var(--border-subtle, #2a2a2a)',
          boxShadow: '-8px 0 24px rgba(0,0,0,0.35)',
          transform: cheatOpen ? 'translateX(0)' : 'translateX(105%)',
          transition: 'transform 0.25s ease',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          zIndex: 2
        }}
      >
        <strong style={{ fontSize: 13 }}>{t('chat.commandsTitle')}</strong>
        {COMMANDS.map((cmd) => (
          <button
            key={cmd}
            onClick={() => insertCommand(cmd)}
            aria-label={`/${cmd} — ${t(`chat.cmd.${cmd}`)}`}
            style={{
              ...buttonStyle,
              textAlign: 'left',
              display: 'grid',
              gap: 2,
              padding: '8px 10px'
            }}
          >
            <span style={{ fontFamily: 'monospace', fontSize: 12 }}>/{cmd}</span>
            <span style={{ ...hint, fontSize: 11 }}>{t(`chat.cmd.${cmd}`)}</span>
          </button>
        ))}
        <span style={{ ...hint, fontSize: 11, marginTop: 4 }}>{t('chat.commandsHint')}</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
        {messages.length === 0 && !pending && (
          <p style={{ ...hint, fontSize: 13, margin: 0 }}>{t('chat.empty')}</p>
        )}
        {messages.map((m, i) => {
          // The in-flight assistant bubble renders nothing until its first token.
          if (m.role === 'assistant' && m.content.length === 0) return null;
          return (
            <div
              key={i}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                padding: '8px 12px',
                borderRadius: 8,
                fontSize: 13,
                whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? 'var(--bg-input, #181818)' : 'var(--bg-void, #050505)',
                border: '1px solid var(--border-subtle, #2a2a2a)'
              }}
            >
              {m.content}
            </div>
          );
        })}
        {awaitingFirstToken && (
          <p style={{ ...hint, fontSize: 13, margin: 0 }}>
            {t('chat.thinking')} ({elapsedSec}s)
            {elapsedSec >= 8 && (
              <span style={{ display: 'block', fontSize: 12, marginTop: 4 }}>{t('chat.longTurnHint')}</span>
            )}
          </p>
        )}
        {error && (
          <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: 13, margin: 0 }}>{error}</p>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // isComposing: Enter inside an IME (zh input) confirms the
            // composition — it must never send the message mid-typing.
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send();
          }}
          placeholder={t('chat.placeholder')}
          disabled={pending}
          style={{ ...inputStyle, flex: 1 }}
        />
        <button
          onClick={() => setCheatOpen((o) => !o)}
          aria-label={t('chat.commands')}
          title={t('chat.commands')}
          style={{ ...(cheatOpen ? primaryButton : buttonStyle), fontFamily: 'monospace' }}
        >
          /
        </button>
        {pending ? (
          <button onClick={() => abortRef.current?.abort()} style={buttonStyle}>
            {t('chat.stop')}
          </button>
        ) : (
          <button onClick={() => void send()} disabled={!input.trim()} style={buttonStyle}>
            {t('chat.send')}
          </button>
        )}
      </div>
    </div>
  );
}
