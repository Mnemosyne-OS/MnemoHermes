/**
 * The two strings the cockpit hands a human to paste or type: an agent
 * profile name, and the `model:` block that points Hermes at the OS's brain.
 */

/**
 * `hermes profile create` accepts a lowercase slug. The rule is enforced here
 * rather than inline in the panel so the Create button and any future caller
 * cannot disagree about what is acceptable.
 */
export const PROFILE_NAME_RE = /^[a-z0-9][a-z0-9-]{0,30}$/;

/** What the panel sends: trimmed and lowercased, the way the CLI wants it. */
export function normalizeProfileName(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidProfileName(raw: string): boolean {
  return PROFILE_NAME_RE.test(normalizeProfileName(raw));
}

/**
 * The `model:` block for Hermes' config.yaml, pointing at the loopback brain
 * proxy (doc 81). Shown for a human to paste; the Apply button writes the same
 * thing host-side.
 *
 * 🚨 A missing key still produces a syntactically valid block with an EMPTY
 * `api_key`. Pasting that yields a clean 401 rather than a parse error, which
 * is the failure we want: the agent says it was refused instead of refusing to
 * start.
 */
export function hermesModelYaml(port: number, key: string | null): string {
  return [
    'model:',
    '  provider: "custom"',
    `  base_url: "http://127.0.0.1:${port}/v1"`,
    `  api_key: "${key ?? ''}"`,
    '  default: "mnemosyne"',
  ].join('\n');
}
