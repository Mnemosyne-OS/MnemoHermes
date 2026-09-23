import { describe, it, expect } from 'vitest';
import { extractMedia } from './chatMedia';

const PNG = 'C:\\Users\\tony\\AppData\\Local\\Mnemosyne OS\\images\\cat 01.png';

describe('extractMedia', () => {
  it('a quoted MEDIA tag becomes an image card and leaves the bubble', () => {
    const r = extractMedia(`Voilà ton chat.\nMEDIA:"${PNG}"\nIl te plaît ?`);
    expect(r.refs).toEqual([{ kind: 'image', path: PNG, dataUrl: null, name: 'cat 01.png' }]);
    expect(r.text).toBe('Voilà ton chat.\n\nIl te plaît ?');
  });

  it('a bare MEDIA tag stops at whitespace and sheds the sentence\'s punctuation', () => {
    const r = extractMedia('Done: MEDIA:/home/t/out/pic.jpg. Next?');
    expect(r.refs[0]).toMatchObject({ kind: 'image', path: '/home/t/out/pic.jpg', name: 'pic.jpg' });
    expect(r.text).toBe('Done: . Next?');
  });

  it('an inline data-URL image (the buffered route) carries its bytes and no path', () => {
    const data = 'data:image/png;base64,iVBORw0KGgo=';
    const r = extractMedia(`Here.\n![image](${data})`);
    expect(r.refs).toEqual([{ kind: 'image', path: null, dataUrl: data, name: 'image' }]);
    expect(r.text).toBe('Here.');
  });

  it('a document path in prose becomes a card and the sentence STAYS', () => {
    const r = extractMedia("J'ai écrit le rapport dans C:\\Users\\tony\\Documents\\rapport-Q3.md, dis-moi.");
    expect(r.refs).toEqual([{ kind: 'document', path: 'C:\\Users\\tony\\Documents\\rapport-Q3.md', dataUrl: null, name: 'rapport-Q3.md' }]);
    expect(r.text).toBe("J'ai écrit le rapport dans C:\\Users\\tony\\Documents\\rapport-Q3.md, dis-moi.");
  });

  it('a path with spaces is found only when the agent quoted it (backticks or quotes)', () => {
    const r = extractMedia('Fait : `C:\\Users\\tony\\Documents\\rapport Q3.md` et "C:\\a b\\c.txt" mais pas C:\\a b\\d.txt');
    expect(r.refs.map((x) => x.path)).toEqual(['C:\\Users\\tony\\Documents\\rapport Q3.md', 'C:\\a b\\c.txt']);
  });

  it('a POSIX document path and a pdf are cards too; an unknown extension is not', () => {
    const r = extractMedia('See /home/t/notes/plan.pdf and /home/t/a.xyz and `/tmp/x/y.txt`');
    expect(r.refs.map((x) => x.path).sort()).toEqual(['/home/t/notes/plan.pdf', '/tmp/x/y.txt']);
  });

  it('the same file named twice is ONE card (case-insensitive on Windows)', () => {
    const r = extractMedia(`MEDIA:"${PNG}" and again ${PNG.toUpperCase()}`);
    expect(r.refs).toHaveLength(1);
  });

  it('a bare drive letter, a lone slash, a URL and a version number are not paths', () => {
    const r = extractMedia('C: is the drive, / is the root, https://x.io/a.md is a link, v1.2.3 is a version');
    expect(r.refs).toEqual([]);
  });

  it('no media → the text is returned intact and no cards', () => {
    const r = extractMedia('Just words.\n\nTwo paragraphs.');
    expect(r).toEqual({ text: 'Just words.\n\nTwo paragraphs.', refs: [] });
  });

  it('a MEDIA tag whose file is not an image or a document makes no card and is still removed', () => {
    const r = extractMedia('MEDIA:"C:\\x\\file.exe" ok');
    expect(r.refs).toEqual([]);
    expect(r.text).toBe('ok');
  });
});
