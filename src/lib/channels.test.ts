import { describe, it, expect } from 'vitest';
import { allowedIdCount } from './channels';

describe('allowedIdCount', () => {
  it('an absent or blank list is zero — the bot is open to anyone', () => {
    expect(allowedIdCount(undefined)).toBe(0);
    expect(allowedIdCount(null)).toBe(0);
    expect(allowedIdCount('')).toBe(0);
    expect(allowedIdCount(' , ,')).toBe(0);
  });

  it('counts ids, ignoring spaces and stray commas', () => {
    expect(allowedIdCount('123')).toBe(1);
    expect(allowedIdCount('123, 456,789')).toBe(3);
    expect(allowedIdCount('123,,456,')).toBe(2);
  });
});
