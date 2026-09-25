/**
 * Does GitHub carry a newer MnemoHermes than the one running? (2026-09-25)
 *
 * The cartridge is installed from its repository, outside the Hub's signed
 * catalog, and the host only compares versions for catalog entries: nothing
 * ever told anyone an update existed. Until the host learns to check
 * link-installed cartridges (an app release), the cartridge asks itself.
 *
 * Read through `social.fetch` (host-side GET, https only, the `vault:read`
 * the cartridge already holds), from the manifest the installer itself
 * reads. 🎭 A check that could not be made is `unknown` and shows nothing:
 * saying "up to date" without having asked is the lie this avoids, and
 * saying "update failed" about a laptop offline is noise.
 */

export const REMOTE_MANIFEST_URL = 'https://raw.githubusercontent.com/Mnemosyne-OS/MnemoHermes/main/mnemo-plugin.json';
export const REPO_URL = 'https://github.com/Mnemosyne-OS/MnemoHermes';

export type UpdateCheck =
  | { kind: 'newer'; latest: string }
  | { kind: 'current' }
  | { kind: 'unknown' };

const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)/;

/** x.y.z numerically; a pre-release suffix is ignored. null when unreadable. */
export function isNewerVersion(candidate: string, current: string): boolean | null {
  const a = VERSION_RE.exec(candidate);
  const b = VERSION_RE.exec(current);
  if (!a || !b) return null;
  for (let i = 1; i <= 3; i++) {
    const d = Number(a[i]) - Number(b[i]);
    if (d !== 0) return d > 0;
  }
  return false;
}

/** The version a fetched manifest declares, or null. */
export function remoteVersion(res: { body?: unknown; encoding?: unknown } | null | undefined): string | null {
  if (!res || typeof res.body !== 'string') return null;
  let text = res.body;
  if (res.encoding === 'base64') {
    try {
      text = new TextDecoder().decode(Uint8Array.from(atob(text), (c) => c.charCodeAt(0)));
    } catch {
      return null;
    }
  }
  try {
    const v = (JSON.parse(text) as { version?: unknown }).version;
    return typeof v === 'string' && VERSION_RE.test(v) ? v : null;
  } catch {
    return null;
  }
}

export async function checkForUpdate(
  fetchManifest: () => Promise<{ body?: unknown; encoding?: unknown }>,
  current: string,
): Promise<UpdateCheck> {
  try {
    const latest = remoteVersion(await fetchManifest());
    if (!latest) return { kind: 'unknown' };
    const newer = isNewerVersion(latest, current);
    if (newer === null) return { kind: 'unknown' };
    return newer ? { kind: 'newer', latest } : { kind: 'current' };
  } catch (err) {
    console.warn('[update-check] could not read the published manifest:', err);
    return { kind: 'unknown' };
  }
}
