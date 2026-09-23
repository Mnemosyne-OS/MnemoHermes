/**
 * speech — the pure half of the cockpit's voice loop (doc 123, 2026-09-23):
 * which replies get spoken, what is spoken out of a reply, and how the host's
 * PCM becomes samples. No host call here; the hook owns those.
 * @module speech
 */

/** Mirrors Hermes' own `/voice off|on|all`: `voice` = speak the reply to a spoken question. */
export type VoiceReplyMode = 'off' | 'voice' | 'all';
export const VOICE_REPLY_MODES: readonly VoiceReplyMode[] = ['off', 'voice', 'all'];
export const VOICE_REPLY_KEY = 'mnemo-hermes:voice-reply';
export const DEFAULT_VOICE_REPLY: VoiceReplyMode = 'voice';

export function isVoiceReplyMode(v: unknown): v is VoiceReplyMode {
  return typeof v === 'string' && (VOICE_REPLY_MODES as readonly string[]).includes(v);
}

export function nextVoiceReplyMode(m: VoiceReplyMode): VoiceReplyMode {
  return VOICE_REPLY_MODES[(VOICE_REPLY_MODES.indexOf(m) + 1) % VOICE_REPLY_MODES.length] ?? 'off';
}

/** Whether this reply is spoken, given the mode and how the question came in. */
export function shouldSpeak(mode: VoiceReplyMode, askedByVoice: boolean): boolean {
  if (mode === 'all') return true;
  if (mode === 'voice') return askedByVoice;
  return false;
}

/** The host's per-request ceiling (reader.ttsSpeak caps at 4 000). */
export const SPEECH_UNIT_MAX = 400;
/** Past this a spoken reply is a podcast; the rest stays readable in the bubble. */
export const SPOKEN_MAX_CHARS = 2_400;

/**
 * What a voice says out of a reply: no code, no tables, no markdown marks, no
 * URLs, no MEDIA tags. A reply that is all code speaks nothing.
 */
export function speakableText(reply: string): string {
  let t = reply;
  t = t.replace(/```[\s\S]*?```/g, ' ');
  t = t.replace(/MEDIA:\s*(?:"[^"\n]*"|'[^'\n]*'|\S+)/g, ' ');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ');
  t = t.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
  t = t.replace(/https?:\/\/\S+/g, ' ');
  t = t.replace(/^\s*\|.*\|\s*$/gm, ' ');
  t = t.replace(/^#{1,6}\s+/gm, '');
  t = t.replace(/^\s*[-*+]\s+/gm, '');
  t = t.replace(/^\s*\d+\.\s+/gm, '');
  t = t.replace(/[*_`~>#]+/g, '');
  t = t.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
  return t;
}

/**
 * Cut a spoken text into units the host synthesizes one at a time: at
 * sentence ends first, then at clauses, never past SPEECH_UNIT_MAX. The
 * whole is capped at SPOKEN_MAX_CHARS and `truncated` says when it was.
 */
export function splitForSpeech(text: string): { units: string[]; truncated: boolean } {
  const truncated = text.length > SPOKEN_MAX_CHARS;
  let body = truncated ? text.slice(0, SPOKEN_MAX_CHARS) : text;
  if (truncated) {
    const cut = Math.max(body.lastIndexOf('. '), body.lastIndexOf('\n'));
    if (cut > SPOKEN_MAX_CHARS / 2) body = body.slice(0, cut + 1);
  }
  const units: string[] = [];
  let current = '';
  const push = () => { const u = current.trim(); if (u) units.push(u); current = ''; };
  for (const sentence of body.split(/(?<=[.!?…]|\n)\s+/)) {
    const s = sentence.trim();
    if (!s) continue;
    if (s.length > SPEECH_UNIT_MAX) {
      push();
      // A sentence longer than a unit: cut at clauses, then hard.
      let rest = s;
      while (rest.length > SPEECH_UNIT_MAX) {
        const window = rest.slice(0, SPEECH_UNIT_MAX);
        let at = Math.max(window.lastIndexOf(', '), window.lastIndexOf('; '), window.lastIndexOf(' '));
        if (at < SPEECH_UNIT_MAX / 3) at = SPEECH_UNIT_MAX;
        units.push(rest.slice(0, at).trim());
        rest = rest.slice(at).trim();
      }
      if (rest) units.push(rest);
      continue;
    }
    if ((current + ' ' + s).trim().length > SPEECH_UNIT_MAX) push();
    current = current ? `${current} ${s}` : s;
  }
  push();
  return { units, truncated };
}

/** The host's `pcmBase64` (16-bit little-endian mono) → Float32 samples. */
export function pcmBase64ToFloat32(b64: string): Float32Array {
  const bin = atob(b64);
  const samples = Math.floor(bin.length / 2);
  const out = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const lo = bin.charCodeAt(i * 2);
    const hi = bin.charCodeAt(i * 2 + 1);
    let v = (hi << 8) | lo;
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}

/** The error code a host speech/dictation refusal starts with (`NO_SPEECH: …` → `NO_SPEECH`). */
export function speechErrorCode(message: string): string {
  const m = /^([A-Z][A-Z_]+)(?::|$)/.exec(message.trim());
  return m?.[1] ?? 'UNKNOWN';
}
