/**
 * chatMedia — what a reply POINTS AT, pulled out of its text (doc 123,
 * 2026-09-23, "des widgets autonomes autour du chat").
 *
 * Hermes' api_server streams the agent's words RAW: an image the agent made
 * arrives as the tag its tool wrote, `MEDIA:"C:\…\image.png"`, and a document
 * it wrote is a path in a sentence. Only the non-streaming route resolves the
 * tag into an inline `![image](data:…)`. The cockpit reads both shapes, so a
 * buffered fallback and a streamed turn produce the same cards.
 *
 * Pure: no host call. The caller fetches bytes for a path through
 * `hermes.readMedia` / `hermes.readDocument`.
 * @module chatMedia
 */

export type MediaKind = 'image' | 'document';

export interface MediaRef {
  kind: MediaKind;
  /** Absolute path on this machine; null for an inline data URL. */
  path: string | null;
  /** Present when the reply already carried the bytes (non-streaming route). */
  dataUrl: string | null;
  /** The file name, or 'image' for an inline one. */
  name: string;
}

export interface MediaExtraction {
  /** The reply with its MEDIA tags and inline images removed — what the bubble shows. */
  text: string;
  refs: MediaRef[];
}

const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp'];
const DOC_EXT = ['md', 'mdx', 'txt', 'html', 'htm', 'json', 'csv', 'rst', 'adoc', 'pdf', 'docx', 'xlsx'];

/**
 * A MEDIA tag as Hermes' MEDIA_TAG_CLEANUP_RE reads it: quoted (the path may
 * hold spaces) or bare (stops at whitespace). Trailing punctuation a sentence
 * leaves on a bare path is not part of it.
 */
const MEDIA_TAG_RE = /MEDIA:\s*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s"']+))/g;
/** An inline image the non-streaming route writes: `![alt](data:image/png;base64,…)`. */
const INLINE_IMAGE_RE = /!\[[^\]]*\]\((data:image\/[a-z+.-]+;base64,[A-Za-z0-9+/=]+)\)/g;
/**
 * An absolute path in prose: a Windows drive path or a POSIX one, ending in a
 * document or image extension. Must contain a separator after the root so a
 * bare `C:` or `/` never matches, and stops at whitespace, a quote or a
 * closing bracket.
 */
const PATH_IN_PROSE_RE = /(?<![A-Za-z0-9:/.])(?:[A-Za-z]:[\\/]|\/)[^\s"'<>()[\]`]+?\.([A-Za-z0-9]{2,5})(?=$|[\s"'<>()[\]`.,;:!?])/gm;
/**
 * The same path when the agent QUOTED it (backticks or quotes): spaces are
 * allowed inside, which prose alone can never disambiguate.
 */
const QUOTED_PATH_RE = /[`"']((?:[A-Za-z]:[\\/]|\/)[^`"'\n]+?\.[A-Za-z0-9]{2,5})[`"']/g;

function extOf(p: string): string {
  return p.split('.').pop()?.toLowerCase() ?? '';
}

function baseName(p: string): string {
  return p.split(/[\\/]/).pop() || p;
}

function kindOf(p: string): MediaKind | null {
  const ext = extOf(p);
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (DOC_EXT.includes(ext)) return 'document';
  return null;
}

function stripTrailingPunct(p: string): string {
  return p.replace(/[.,;:!?)]+$/, '');
}

/** Pull the media a reply points at, and the text left once the pointers are gone. */
export function extractMedia(reply: string): MediaExtraction {
  const refs: MediaRef[] = [];
  const seen = new Set<string>();
  const add = (ref: MediaRef) => {
    const key = ref.dataUrl ? `data:${ref.dataUrl.length}:${ref.dataUrl.slice(-32)}` : `path:${ref.path!.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    refs.push(ref);
  };

  let text = reply;

  // 1. MEDIA tags: a card each, and the tag leaves the bubble (a path in
  //    quotes is not something to read).
  text = text.replace(MEDIA_TAG_RE, (_m, quoted?: string, single?: string, bare?: string) => {
    const given = (quoted ?? single ?? bare ?? '').trim();
    const raw = stripTrailingPunct(given);
    const kind = kindOf(raw);
    if (raw && kind) add({ kind, path: raw, dataUrl: null, name: baseName(raw) });
    // A bare path swallowed the sentence's full stop: give it back.
    return bare !== undefined ? given.slice(raw.length) : '';
  });

  // 2. Inline images (buffered route): the bytes are already here.
  text = text.replace(INLINE_IMAGE_RE, (_m, dataUrl: string) => {
    add({ kind: 'image', path: null, dataUrl, name: 'image' });
    return '';
  });

  // 3. Paths in prose: the sentence stays (it says what the file is), the
  //    path becomes a card the person can open.
  for (const m of text.matchAll(QUOTED_PATH_RE)) {
    const raw = (m[1] ?? '').trim();
    const kind = kindOf(raw);
    if (kind) add({ kind, path: raw, dataUrl: null, name: baseName(raw) });
  }
  for (const m of text.matchAll(PATH_IN_PROSE_RE)) {
    const raw = stripTrailingPunct(m[0]);
    const kind = kindOf(raw);
    if (kind) add({ kind, path: raw, dataUrl: null, name: baseName(raw) });
  }

  // Collapse the blank lines the removals leave behind.
  text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return { text, refs };
}
