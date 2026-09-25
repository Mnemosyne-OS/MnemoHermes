import { checkForUpdate, isNewerVersion, remoteVersion } from './updateCheck';

const b64 = (s: string) => btoa(s);

describe('isNewerVersion', () => {
  it('compares numerically, part by part', () => {
    expect(isNewerVersion('0.9.10', '0.9.2')).toBe(true);
    expect(isNewerVersion('0.10.0', '0.9.9')).toBe(true);
    expect(isNewerVersion('1.0.0', '0.99.99')).toBe(true);
    expect(isNewerVersion('0.9.2', '0.9.2')).toBe(false);
    expect(isNewerVersion('0.9.1', '0.9.2')).toBe(false);
  });
  it('refuses to answer about an unreadable version', () => {
    expect(isNewerVersion('latest', '0.9.2')).toBeNull();
    expect(isNewerVersion('0.9.3', '')).toBeNull();
  });
});

describe('remoteVersion', () => {
  it('reads the version of a manifest, utf8 or base64', () => {
    expect(remoteVersion({ body: '{"version":"0.9.3"}', encoding: 'utf8' })).toBe('0.9.3');
    expect(remoteVersion({ body: b64('{"version":"0.9.3"}'), encoding: 'base64' })).toBe('0.9.3');
  });
  it('gives null for anything that is not a manifest with a version', () => {
    expect(remoteVersion({ body: '404: Not Found' })).toBeNull();
    expect(remoteVersion({ body: '{"name":"x"}' })).toBeNull();
    expect(remoteVersion({ body: '{"version":"soon"}' })).toBeNull();
    expect(remoteVersion(null)).toBeNull();
  });
});

describe('checkForUpdate', () => {
  it('says newer when GitHub carries a higher version', async () => {
    expect(await checkForUpdate(() => Promise.resolve({ body: '{"version":"0.9.3"}' }), '0.9.2'))
      .toEqual({ kind: 'newer', latest: '0.9.3' });
  });
  it('says current when versions match', async () => {
    expect(await checkForUpdate(() => Promise.resolve({ body: '{"version":"0.9.2"}' }), '0.9.2'))
      .toEqual({ kind: 'current' });
  });
  it('never says current when it could not ask', async () => {
    expect(await checkForUpdate(() => Promise.reject(new Error('offline')), '0.9.2')).toEqual({ kind: 'unknown' });
    expect(await checkForUpdate(() => Promise.resolve({ body: 'garbage' }), '0.9.2')).toEqual({ kind: 'unknown' });
  });
});
