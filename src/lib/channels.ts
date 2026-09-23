/**
 * Channels tab — the pure half. A saved Telegram allow-list is a comma
 * separated string in the .env; the page needs to know whether it is
 * EMPTY, because an empty list means the bot answers whoever finds it and
 * spends the owner's credits doing so.
 */

/** How many ids a saved allow-list carries. Empty = the bot answers anyone. */
export function allowedIdCount(allowedUsers: string | undefined | null): number {
  if (!allowedUsers) return 0;
  return allowedUsers.split(',').map((s) => s.trim()).filter(Boolean).length;
}
