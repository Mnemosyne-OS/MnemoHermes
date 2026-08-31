/**
 * Error-code classification — the one place a host taxonomy becomes a
 * locale key.
 *
 * The host ships CODES and never a sentence (doc 80: GATEWAY_NOT_RUNNING is
 * not AUTH_FAILED is not TIMEOUT). Four panels used to each carry their own
 * `if (msg.includes(...))` ladder, which is how a code silently stops being
 * recognised in one panel while it still works in another.
 *
 * 🚨 Order matters and is part of the contract: the FIRST entry whose code
 * appears in the message wins. A shorter code that is a substring of a longer
 * one must therefore come after it, and the tests pin that.
 */

/** The message of an unknown failure, whatever shape it arrived in. */
export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** First table entry whose code appears in `message`, else `fallback`. */
export function matchCode<T>(
  table: ReadonlyArray<readonly [code: string, verdict: T]>,
  message: string,
  fallback: T,
): T {
  for (const [code, verdict] of table) {
    if (message.includes(code)) return verdict;
  }
  return fallback;
}

/** Chat tab (M2). `common.error` covers anything the taxonomy does not name. */
export const CHAT_ERROR_KEYS = [
  ['GATEWAY_NOT_RUNNING', 'chat.errNotRunning'],
  ['API_SERVER_DISABLED', 'chat.errDisabled'],
  ['NOT_INSTALLED', 'chat.errNotInstalled'],
  ['AUTH_FAILED', 'chat.errAuth'],
  ['TIMEOUT', 'chat.errTimeout'],
] as const satisfies ReadonlyArray<readonly [string, string]>;

export function chatErrorKey(message: string): string {
  return matchCode(CHAT_ERROR_KEYS, message, 'common.error');
}

/**
 * Web-search routing. The engine lives in Docker, so each obstacle gets its
 * own sentence: "launch Docker" is a different instruction from "install
 * Docker", from "set it up in Mnemosyne first", from "wait, it is booting".
 */
export type SearchFeedback =
  | 'idle' | 'confirm' | 'done'
  | 'dockerInstall' | 'dockerStart' | 'notSetUp' | 'starting' | 'notAnswering' | 'error';

export const SEARCH_FEEDBACK_KEYS = [
  ['DOCKER_NOT_INSTALLED', 'dockerInstall'],
  ['DOCKER_NOT_RUNNING', 'dockerStart'],
  ['SEARXNG_NOT_SET_UP', 'notSetUp'],
  ['ENGINE_STARTING', 'starting'],
  ['ENGINE_NOT_ANSWERING', 'notAnswering'],
] as const satisfies ReadonlyArray<readonly [string, SearchFeedback]>;

export function searchFeedback(message: string): SearchFeedback {
  return matchCode(SEARCH_FEEDBACK_KEYS, message, 'error');
}

/** Locale key for each settled search verdict. `idle`/`confirm` render nothing. */
export const SEARCH_FEEDBACK_TEXT: Record<Exclude<SearchFeedback, 'idle' | 'confirm'>, string> = {
  done: 'search.routed',
  dockerInstall: 'search.dockerInstall',
  dockerStart: 'search.dockerStart',
  notSetUp: 'search.notSetUp',
  starting: 'search.starting',
  notAnswering: 'search.notAnswering',
  error: 'common.error',
};

/** Telegram credentials form (Channels tab). */
export type TelegramFeedback = 'idle' | 'saved' | 'invalidToken' | 'invalidIds' | 'error';

export const TELEGRAM_FEEDBACK_KEYS = [
  ['INVALID_TOKEN', 'invalidToken'],
  ['INVALID_USER_IDS', 'invalidIds'],
] as const satisfies ReadonlyArray<readonly [string, TelegramFeedback]>;

export function telegramFeedback(message: string): TelegramFeedback {
  return matchCode(TELEGRAM_FEEDBACK_KEYS, message, 'error');
}

export const TELEGRAM_FEEDBACK_TEXT: Record<Exclude<TelegramFeedback, 'idle'>, string> = {
  saved: 'channels.saved',
  invalidToken: 'channels.invalidToken',
  invalidIds: 'channels.invalidIds',
  error: 'common.error',
};
