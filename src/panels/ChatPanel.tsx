/**
 * The Chat tab — one stateless conversation with the agent through its
 * api_server (M2). Error CODES become localized user messages here; the
 * host only ever ships the taxonomy.
 *
 * 2026-09-23 (doc 123): the tab also LISTENS and SPEAKS, like the Telegram
 * bot — the host's microphone and the voice of Settings › Voice, through
 * `speech.*` and `reader.tts*`; a spoken question goes through the same
 * `hermes.chatStream` as a typed one. And what a reply POINTS AT (an image the
 * agent made, a document it wrote) becomes a card on the stage beside the
 * conversation, read through `hermes.readMedia` / `hermes.readDocument`.
 * Both are gated on the gateway answering: a person without Hermes running
 * sees the same text tab as before, no mic, no cards.
 */
import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { sdk } from '../sdk/instance';
import { useI18n } from '../i18n/useI18n';
import { panel, inputStyle, buttonStyle, primaryButton, hint } from '../ui';
import { chatErrorKey, errorMessage } from '../lib/errorCodes';
import { extractMedia, type MediaRef } from '../lib/chatMedia';
import { shouldSpeak } from '../lib/speech';
import { useCockpitVoice } from '../hooks/useCockpitVoice';
import { ChatStage } from './ChatStage';
import type { ChatMessage, HermesStatus, StageItem } from '../types';

/** The cheat-sheet content. Command literals are Hermes' own vocabulary
 *  (universal, never translated); only the descriptions go through t(). */
const COMMANDS = [
  'help', 'new', 'status', 'model', 'context',
  'goal', 'skills', 'background', 'title', 'voice',
] as const;

const VOICE_MODE_ICON = { off: '🔇', voice: '🔈', all: '🔊' } as const;

let stageSeq = 0;
function stageId(): string {
  stageSeq += 1;
  return `stage-${Date.now().toString(36)}-${stageSeq}`;
}

/** A reply's pointers → cards, all `loading` until the host reads them. */
export function stageItemsFor(refs: MediaRef[]): StageItem[] {
  return refs.map((ref) => ({
    id: stageId(),
    kind: ref.kind,
    name: ref.name,
    path: ref.path,
    dataUrl: ref.dataUrl,
    text: null,
    truncated: false,
    state: ref.dataUrl ? 'ready' : 'loading',
    error: null,
  }));
}

export function ChatPanel({ apiPort, messages, setMessages, stageItems, setStageItems }: {
  apiPort: number | null;
  /** Owned by App so the conversation survives tab switches (panels unmount). */
  messages: ChatMessage[];
  setMessages: Dispatch<SetStateAction<ChatMessage[]>>;
  /** Owned by App for the same reason: a card is not the turn that made it. */
  stageItems: StageItem[];
  setStageItems: Dispatch<SetStateAction<StageItem[]>>;
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

  // ── Voice ────────────────────────────────────────────────────────────────
  const voice = useCockpitVoice();
  // The mic exists only when Hermes can answer: without the gateway this tab
  // is the text tab it always was, and nothing here is confused with the
  // app's own assistant.
  const [gatewayUp, setGatewayUp] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    sdk.invoke<HermesStatus>('hermes.status', {})
      .then((s) => { if (!cancelled) setGatewayUp(s?.gatewayRunning === true); })
      .catch((err) => { console.warn('[chat] hermes.status failed:', err); if (!cancelled) setGatewayUp(false); });
    return () => { cancelled = true; };
  }, []);
  const micReady = gatewayUp === true && voice.available === true;
  const micDisabledReason = gatewayUp === null || voice.available === null
    ? t('chat.micProbing')
    : gatewayUp === false ? t('chat.micNoGateway') : t('chat.micNoEngine');

  // ── Stage: read what a reply points at ───────────────────────────────────
  const patchStage = useCallback((id: string, patch: Partial<StageItem>) => {
    setStageItems((cur) => cur.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }, [setStageItems]);

  const resolveStageItem = useCallback(async (item: StageItem) => {
    if (item.state !== 'loading' || !item.path) return;
    try {
      if (item.kind === 'image') {
        const r = await sdk.invoke<{ dataUrl: string; name: string }>('hermes.readMedia', { path: item.path });
        patchStage(item.id, { state: 'ready', dataUrl: r.dataUrl, name: r.name || item.name });
      } else {
        const r = await sdk.invoke<{ text: string | null; truncated: boolean; name: string }>('hermes.readDocument', { path: item.path });
        patchStage(item.id, { state: 'ready', text: r.text, truncated: !!r.truncated, name: r.name || item.name });
      }
    } catch (err) {
      const msg = errorMessage(err);
      console.warn('[chat] stage item unreadable:', item.path, msg);
      patchStage(item.id, { state: 'error', error: msg.slice(0, 160) });
    }
  }, [patchStage]);

  // A card left `loading` by a tab switch mid-read is read again on return.
  const resolvingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const item of stageItems) {
      if (item.state === 'loading' && !resolvingRef.current.has(item.id)) {
        resolvingRef.current.add(item.id);
        void resolveStageItem(item);
      }
    }
  }, [stageItems, resolveStageItem]);

  const openPath = useCallback(async (path: string) => {
    try {
      await sdk.invoke('hermes.openPath', { path });
    } catch (err) {
      console.warn('[chat] openPath refused:', err);
      if (mountedRef.current) setError(`${t('stage.openFailed')} ${errorMessage(err).slice(0, 120)}`);
    }
  }, [t]);

  const insertCommand = (cmd: string) => {
    setInput(`/${cmd} `);
    setCheatOpen(false);
    inputRef.current?.focus();
  };

  const send = async (given?: string, askedByVoice = false) => {
    const text = (given ?? input).trim();
    if (!text || pending) return;
    voice.stopSpeaking();
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
    let full = '';
    try {
      await sdk.stream('hermes.chatStream', {
        messages: next,
        ...(apiPort !== null ? { port: apiPort } : {})
      }, {
        signal: controller.signal,
        onChunk: (chunk) => {
          received += chunk.length;
          full += chunk;
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
      // The turn is whole: pull out what it points at, keep the words.
      const { text: clean, refs } = extractMedia(full);
      if (refs.length > 0 || clean !== full) {
        setMessages((cur) => {
          const copy = cur.slice();
          const bubble = copy[assistantIndex];
          if (bubble && bubble.role === 'assistant') copy[assistantIndex] = { role: 'assistant', content: clean };
          return copy;
        });
      }
      if (refs.length > 0) setStageItems((cur) => [...stageItemsFor(refs), ...cur]);
      if (mountedRef.current && shouldSpeak(voice.mode, askedByVoice)) void voice.speak(clean);
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

  const micStop = async () => {
    const text = await voice.stopAndTranscribe();
    if (!mountedRef.current || !text) return;
    await send(text, true);
  };

  const voiceErrorLine = voice.error ? t(`chat.voiceErr.${voice.error}`, undefined) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'row', gap: 12, height: '100%', minHeight: 0 }}>
    <div style={{ ...panel, display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box', position: 'relative', overflow: 'hidden', flex: 1, minWidth: 0 }}>
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
        {voice.speaking && (
          <p style={{ ...hint, fontSize: 13, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>🔊 {t('chat.speaking')}{voice.spokenTruncated ? ` ${t('chat.spokenTruncated')}` : ''}</span>
            <button onClick={voice.stopSpeaking} style={{ ...buttonStyle, padding: '2px 8px', fontSize: 12 }}>
              {t('chat.stopSpeaking')}
            </button>
          </p>
        )}
        {error && (
          <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: 13, margin: 0 }}>{error}</p>
        )}
        {voiceErrorLine && (
          <p style={{ color: 'var(--text-secondary, #aaa)', fontSize: 13, margin: 0 }}>{voiceErrorLine}</p>
        )}
      </div>

      {(voice.listening || voice.transcribing) && (
        <p style={{ ...hint, fontSize: 12, margin: '0 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
          {voice.listening
            ? <><span aria-hidden style={{ color: '#e5484d' }}>●</span> {t('chat.listening')} {voice.listenSeconds}s</>
            : <>{t('chat.transcribing')}</>}
        </p>
      )}

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
          placeholder={voice.listening ? t('chat.listeningPlaceholder') : t('chat.placeholder')}
          disabled={pending || voice.listening || voice.transcribing}
          style={{ ...inputStyle, flex: 1 }}
        />
        {/* The microphone: the host's device, lent for one question. */}
        {voice.listening ? (
          <>
            <button onClick={() => void micStop()} style={primaryButton} aria-label={t('chat.micSend')} title={t('chat.micSend')}>
              {t('chat.micSend')}
            </button>
            <button onClick={voice.cancel} style={buttonStyle} aria-label={t('chat.micCancel')} title={t('chat.micCancel')}>
              ×
            </button>
          </>
        ) : (
          <button
            onClick={() => void voice.start()}
            disabled={!micReady || pending || voice.transcribing}
            aria-label={t('chat.mic')}
            title={micReady ? t('chat.mic') : micDisabledReason}
            style={buttonStyle}
          >
            🎤
          </button>
        )}
        <button
          onClick={voice.cycleMode}
          aria-label={`${t('chat.voiceModeLabel')}: ${t(`chat.voiceMode.${voice.mode}`)}`}
          title={`${t('chat.voiceModeLabel')}: ${t(`chat.voiceMode.${voice.mode}`)}`}
          disabled={!micReady}
          style={buttonStyle}
        >
          {VOICE_MODE_ICON[voice.mode]}
        </button>
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
          <button onClick={() => void send()} disabled={!input.trim() || voice.listening} style={buttonStyle}>
            {t('chat.send')}
          </button>
        )}
      </div>
    </div>
    <ChatStage
      items={stageItems}
      onClose={(id) => setStageItems((cur) => cur.filter((it) => it.id !== id))}
      onOpen={(path) => void openPath(path)}
    />
    </div>
  );
}
