import { fmtUsd, fmtCount, UNKNOWN } from './format';

describe('fmtUsd', () => {
  it('renders an ordinary amount at four decimals', () => {
    expect(fmtUsd(1_234_567)).toBe('1.2346');
    expect(fmtUsd(10_000)).toBe('0.0100');
  });

  it('never prints 0.0000 for a spend that actually happened', () => {
    // A fraction-of-a-cent day is not a free day. Rounding it away would tell
    // someone their agent cost nothing when it billed them.
    const out = fmtUsd(12);
    expect(out).not.toBe('0.0000');
    expect(Number(out)).toBeGreaterThan(0);
    expect(out).toBe('0.000012');
  });

  it('prints a real zero as a zero', () => {
    // Nothing was spent AND we measured it: that is a fact, not an unknown.
    expect(fmtUsd(0)).toBe('0.0000');
  });

  it('renders the unknown mark rather than NaN when nothing was measured', () => {
    expect(fmtUsd(Number.NaN)).toBe(UNKNOWN);
    expect(fmtUsd(Number.POSITIVE_INFINITY)).toBe(UNKNOWN);
  });

  it('crosses into six decimals exactly at the rounding boundary', () => {
    expect(fmtUsd(50)).toBe('0.0001');   // 0.00005 rounds up, still visible
    expect(fmtUsd(49)).toBe('0.000049'); // would have rounded to 0.0000
  });
});

describe('fmtCount', () => {
  it('keeps a measured zero distinct from an unmeasured one', () => {
    expect(fmtCount(0)).toBe('0');
    expect(fmtCount(null)).toBe(UNKNOWN);
    expect(fmtCount(undefined)).toBe(UNKNOWN);
  });

  it('renders a count', () => {
    expect(fmtCount(7)).toBe('7');
  });

  it('refuses NaN rather than printing it', () => {
    expect(fmtCount(Number.NaN)).toBe(UNKNOWN);
  });
});
