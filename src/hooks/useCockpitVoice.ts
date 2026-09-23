/**
 * useCockpitVoice — the Chat tab's voice loop (doc 123, 2026-09-23, "le chat
 * vocal ça fonctionne comme le bot telegram ?").
 *
 * The host does the two hard halves. It LISTENS on its own microphone
 * (`speech.listenStart/Stop`: the frame never touches the device, it gets
 * words) and it SPEAKS with the voice chosen in Settings › Voice
 * (`reader.voiceConfig` + `reader.ttsSpeak`: PCM comes back, this hook only
 * plays it). What lives here is the loop: a mode that mirrors Hermes' own
 * `/voice off|on|all`, one recording at a time, one voice at a time, and every
 * exit (a new turn, a tab switch, an unmount) stops both.
 *
 * Nothing here reaches the app's own assistant (the orb): a spoken question
 * goes to Hermes through the same `hermes.chatStream` as a typed one.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { sdk } from '../sdk/instance';
import { getLang } from '../i18n/useI18n';
import {
  DEFAULT_VOICE_REPLY, VOICE_REPLY_KEY, isVoiceReplyMode, nextVoiceReplyMode, pcmBase64ToFloat32,
  speakableText, speechErrorCode, splitForSpeech, type VoiceReplyMode,
} from '../lib/speech';

/** A local engine can take a minute to warm; the reader's own budget. */
const TTS_SPEAK_TIMEOUT_MS = 180_000;
/** Transcribing a two-minute clip on CPU Whisper small. */
const LISTEN_STOP_TIMEOUT_MS = 120_000;

interface VoiceConfig {
  engine: string;
  voice: string;
  speed: number;
}

interface SpeakResult { success: boolean; pcmBase64?: string; sampleRate?: number; error?: string }

export interface CockpitVoice {
  /** null = still asking the host; false = no STT engine set up (the button says why). */
  available: boolean | null;
  listening: boolean;
  transcribing: boolean;
  /** Seconds since the mic opened, for the counter that proves it is recording. */
  listenSeconds: number;
  /** The last voice error's CODE (NO_SPEECH, MIC_BUSY, …), cleared on the next gesture. */
  error: string | null;
  start: () => Promise<void>;
  /** Stop and transcribe; null when nothing usable came back (the error says why). */
  stopAndTranscribe: () => Promise<string | null>;
  cancel: () => void;
  mode: VoiceReplyMode;
  cycleMode: () => void;
  speaking: boolean;
  /** The reply was longer than what a voice reads; the bubble has the rest. */
  spokenTruncated: boolean;
  speak: (reply: string) => Promise<void>;
  stopSpeaking: () => void;
}

function readMode(): VoiceReplyMode {
  try {
    const v = localStorage.getItem(VOICE_REPLY_KEY);
    return isVoiceReplyMode(v) ? v : DEFAULT_VOICE_REPLY;
  } catch {
    return DEFAULT_VOICE_REPLY;
  }
}

export function useCockpitVoice(): CockpitVoice {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [listenSeconds, setListenSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<VoiceReplyMode>(readMode);
  const [speaking, setSpeaking] = useState(false);
  const [spokenTruncated, setSpokenTruncated] = useState(false);

  const mountedRef = useRef(true);
  const listeningRef = useRef(false);
  const startingRef = useRef(false);
  // One voice at a time: a new speak() retires the previous run by bumping this.
  const speakRunRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;
    const runRef = speakRunRef;
    const sourceRef = currentSourceRef;
    const ctxRef = audioCtxRef;
    sdk.invoke<{ available: boolean; busy: boolean }>('speech.status', {})
      .then((s) => { if (!cancelled && mountedRef.current) setAvailable(!!s?.available); })
      .catch((err) => {
        console.warn('[cockpit-voice] speech.status failed:', err);
        if (!cancelled && mountedRef.current) setAvailable(false);
      });
    return () => {
      cancelled = true;
      mountedRef.current = false;
      // Leaving the tab mid-sentence: release the host's mic, silence the voice.
      if (listeningRef.current) {
        listeningRef.current = false;
        sdk.invoke('speech.listenCancel', {}).catch((err) => console.warn('[cockpit-voice] listenCancel on unmount failed:', err));
      }
      runRef.current++;
      try { sourceRef.current?.stop(); } catch { /* already ended */ }
      try { window.speechSynthesis?.cancel(); } catch { /* no synthesis in this frame */ }
      ctxRef.current?.close().catch(() => { /* closing twice is fine */ });
      ctxRef.current = null;
    };
  }, []);

  // The counter under the mic: it is what says "this is recording" when the
  // frame cannot show a level meter (the device is the host's).
  useEffect(() => {
    if (!listening) { setListenSeconds(0); return; }
    const startedAt = Date.now();
    const id = setInterval(() => setListenSeconds(Math.floor((Date.now() - startedAt) / 1000)), 500);
    return () => clearInterval(id);
  }, [listening]);

  const start = useCallback(async () => {
    if (listeningRef.current || startingRef.current) return;
    startingRef.current = true;
    setError(null);
    try {
      await sdk.invoke('speech.listenStart', {});
      if (!mountedRef.current) {
        await sdk.invoke('speech.listenCancel', {}).catch(() => { /* best effort after unmount */ });
        return;
      }
      listeningRef.current = true;
      setListening(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[cockpit-voice] listenStart refused:', msg);
      if (mountedRef.current) setError(speechErrorCode(msg));
    } finally {
      startingRef.current = false;
    }
  }, []);

  const stopAndTranscribe = useCallback(async (): Promise<string | null> => {
    if (!listeningRef.current) return null;
    listeningRef.current = false;
    setListening(false);
    setTranscribing(true);
    try {
      const r = await sdk.invoke<{ text: string; seconds: number; ceilingHit: boolean }>(
        'speech.listenStop', { lang: getLang() }, LISTEN_STOP_TIMEOUT_MS,
      );
      return r?.text?.trim() ? r.text.trim() : null;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[cockpit-voice] listenStop failed:', msg);
      if (mountedRef.current) setError(speechErrorCode(msg));
      return null;
    } finally {
      if (mountedRef.current) setTranscribing(false);
    }
  }, []);

  const cancel = useCallback(() => {
    if (!listeningRef.current) return;
    listeningRef.current = false;
    setListening(false);
    sdk.invoke('speech.listenCancel', {}).catch((err) => console.warn('[cockpit-voice] listenCancel failed:', err));
  }, []);

  const cycleMode = useCallback(() => {
    setMode((m) => {
      const next = nextVoiceReplyMode(m);
      try { localStorage.setItem(VOICE_REPLY_KEY, next); } catch (err) { console.warn('[cockpit-voice] mode not persisted:', err); }
      return next;
    });
  }, []);

  const stopSpeaking = useCallback(() => {
    speakRunRef.current++;
    try { currentSourceRef.current?.stop(); } catch { /* already ended */ }
    currentSourceRef.current = null;
    try { window.speechSynthesis?.cancel(); } catch { /* no synthesis in this frame */ }
    setSpeaking(false);
  }, []);

  const speak = useCallback(async (reply: string) => {
    const ensureCtx = (): AudioContext => {
      if (!audioCtxRef.current) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioCtxRef.current = new Ctor();
      }
      return audioCtxRef.current;
    };

    const playPcm = (samples: Float32Array, sampleRate: number, run: number): Promise<void> => new Promise((resolve) => {
      if (speakRunRef.current !== run) { resolve(); return; }
      const ctx = ensureCtx();
      const buf = ctx.createBuffer(1, Math.max(1, samples.length), sampleRate || 24000);
      buf.getChannelData(0).set(samples, 0);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.onended = () => { if (currentSourceRef.current === src) currentSourceRef.current = null; resolve(); };
      currentSourceRef.current = src;
      if (ctx.state === 'suspended') ctx.resume().catch(() => { /* the gesture that started this already resumed it */ });
      src.start();
    });

    const speakBrowser = (text: string, voiceName: string, run: number): Promise<void> => new Promise((resolve) => {
      const synth = window.speechSynthesis;
      if (!synth) { resolve(); return; }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = getLang();
      if (voiceName) {
        const v = synth.getVoices().find((x) => x.name === voiceName);
        if (v) u.voice = v;
      }
      u.onend = () => resolve();
      u.onerror = () => resolve();
      if (speakRunRef.current !== run) { resolve(); return; }
      synth.speak(u);
    });

    stopSpeaking();
    const run = ++speakRunRef.current;
    const { units, truncated } = splitForSpeech(speakableText(reply));
    setSpokenTruncated(truncated);
    if (!units.length) return;
    setSpeaking(true);
    setError(null);
    try {
      const cfg = await sdk.invoke<VoiceConfig>('reader.voiceConfig', {});
      if (speakRunRef.current !== run) return;
      if (cfg.engine === 'browser') {
        for (const unit of units) {
          if (speakRunRef.current !== run) return;
          await speakBrowser(unit, cfg.voice, run);
        }
        return;
      }
      // Prefetch the next unit while this one plays: the gap between two
      // sentences is a synthesis, not a silence.
      const fetch = (i: number): Promise<SpeakResult> => sdk.invoke<SpeakResult>(
        'reader.ttsSpeak',
        { text: units[i], next: units[i + 1], voice: cfg.voice, speed: cfg.speed, engine: cfg.engine },
        TTS_SPEAK_TIMEOUT_MS,
      );
      let pending = fetch(0);
      for (let i = 0; i < units.length; i++) {
        const res = await pending;
        if (speakRunRef.current !== run) return;
        if (i + 1 < units.length) pending = fetch(i + 1);
        if (!res?.success || !res.pcmBase64) throw new Error(res?.error || 'TTS_FAILED');
        await playPcm(pcmBase64ToFloat32(res.pcmBase64), res.sampleRate ?? 24000, run);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn('[cockpit-voice] speak failed:', msg);
      if (mountedRef.current && speakRunRef.current === run) setError(speechErrorCode(msg) === 'UNKNOWN' ? 'TTS_FAILED' : speechErrorCode(msg));
    } finally {
      if (mountedRef.current && speakRunRef.current === run) setSpeaking(false);
    }
  }, [stopSpeaking]);

  return {
    available, listening, transcribing, listenSeconds, error,
    start, stopAndTranscribe, cancel,
    mode, cycleMode,
    speaking, spokenTruncated, speak, stopSpeaking,
  };
}
