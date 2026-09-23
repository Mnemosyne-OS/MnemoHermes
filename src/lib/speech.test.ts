import { describe, it, expect } from 'vitest';
import {
  nextVoiceReplyMode, shouldSpeak, speakableText, splitForSpeech, pcmBase64ToFloat32, speechErrorCode,
  isVoiceReplyMode, SPEECH_UNIT_MAX, SPOKEN_MAX_CHARS,
} from './speech';

describe('voice reply mode', () => {
  it('cycles off → voice → all → off, like /voice', () => {
    expect(nextVoiceReplyMode('off')).toBe('voice');
    expect(nextVoiceReplyMode('voice')).toBe('all');
    expect(nextVoiceReplyMode('all')).toBe('off');
  });

  it('speaks to a spoken question in voice mode, everything in all, nothing in off', () => {
    expect(shouldSpeak('voice', true)).toBe(true);
    expect(shouldSpeak('voice', false)).toBe(false);
    expect(shouldSpeak('all', false)).toBe(true);
    expect(shouldSpeak('off', true)).toBe(false);
  });

  it('only the three modes are modes', () => {
    expect(isVoiceReplyMode('all')).toBe(true);
    expect(isVoiceReplyMode('loud')).toBe(false);
    expect(isVoiceReplyMode(null)).toBe(false);
  });
});

describe('speakableText', () => {
  it('drops code, tables, links\' targets, URLs, MEDIA tags and markdown marks', () => {
    const t = speakableText([
      '# Titre', 'Voici **le** résultat, voir [le doc](https://x.io/a).', '```js', 'const a = 1;', '```',
      '| a | b |', '|---|---|', 'MEDIA:"C:\\x\\y.png"', '- un point', '1. deux', 'https://example.org/z',
    ].join('\n'));
    expect(t).toBe('Titre\nVoici le résultat, voir le doc.\nun point\ndeux');
  });

  it('a reply that is only code speaks nothing', () => {
    expect(speakableText('```\nx\n```')).toBe('');
  });
});

describe('splitForSpeech', () => {
  it('groups sentences into units under the ceiling, in order', () => {
    const { units, truncated } = splitForSpeech('Une. Deux! Trois?\nQuatre.');
    expect(units).toEqual(['Une. Deux! Trois? Quatre.']);
    expect(truncated).toBe(false);
  });

  it('never emits a unit longer than the ceiling, cutting a long sentence at a clause', () => {
    const long = Array.from({ length: 60 }, (_, i) => `mot${i}`).join(', ') + '.';
    expect(long.length).toBeGreaterThan(SPEECH_UNIT_MAX);
    const { units } = splitForSpeech(long);
    expect(units.length).toBeGreaterThan(1);
    for (const u of units) expect(u.length).toBeLessThanOrEqual(SPEECH_UNIT_MAX);
    expect(units.join(' ').replace(/\s+/g, ' ')).toBe(long);
  });

  it('caps a podcast-length reply and says so', () => {
    const text = Array.from({ length: 200 }, (_, i) => `Phrase numéro ${i} assez longue.`).join(' ');
    const { units, truncated } = splitForSpeech(text);
    expect(truncated).toBe(true);
    expect(units.join(' ').length).toBeLessThanOrEqual(SPOKEN_MAX_CHARS);
    expect(units.join(' ').endsWith('.')).toBe(true);
  });

  it('empty in, no units out', () => {
    expect(splitForSpeech('')).toEqual({ units: [], truncated: false });
  });
});

describe('pcmBase64ToFloat32', () => {
  it('reads 16-bit little-endian samples, signed', () => {
    const bytes = new Uint8Array([0x00, 0x00, 0xff, 0x7f, 0x00, 0x80]);
    const b64 = btoa(String.fromCharCode(...bytes));
    const f = pcmBase64ToFloat32(b64);
    expect(Array.from(f)).toEqual([0, 32767 / 32768, -1]);
  });
});

describe('speechErrorCode', () => {
  it('is the leading code, or UNKNOWN', () => {
    expect(speechErrorCode('NO_SPEECH: transcript empty')).toBe('NO_SPEECH');
    expect(speechErrorCode('MIC_BUSY')).toBe('MIC_BUSY');
    expect(speechErrorCode('Host did not reply')).toBe('UNKNOWN');
  });
});
