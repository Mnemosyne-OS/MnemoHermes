/** An iframe served an older SDK build (no onAgentActions) warns and serves nothing: never a crash. */
import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('../sdk/instance', () => ({ sdk: {} }));
const { HermesAgentActions } = await import('./HermesAgentActions');

describe('HermesAgentActions', () => {
  it('an SDK build without onAgentActions is warned about, never a crash', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(() => render(<HermesAgentActions onboardingDone tab="status" setTab={() => {}} refresh={() => {}} />)).not.toThrow();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('no onAgentActions'));
    warn.mockRestore();
  });
});
