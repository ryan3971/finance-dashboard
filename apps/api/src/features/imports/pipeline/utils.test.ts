import { describe, expect, it } from 'vitest';
import { buildCompositeKey, normaliseDescription, parseAmount, parseDate } from './utils';

// ---------------------------------------------------------------------------
// parseDate
// ---------------------------------------------------------------------------
describe('parseDate', () => {
  it('passes through ISO YYYY-MM-DD unchanged', () => {
    expect(parseDate('2026-04-15')).toBe('2026-04-15');
  });

  it('strips timestamp from ISO datetime (Questrade format)', () => {
    expect(parseDate('2026-04-15 12:00:00 AM')).toBe('2026-04-15');
  });

  it('parses DD Mon YYYY (Amex space format)', () => {
    expect(parseDate('15 Feb 2026')).toBe('2026-02-15');
  });

  it('pads single-digit day in DD Mon YYYY', () => {
    expect(parseDate('5 Jan 2026')).toBe('2026-01-05');
  });

  it('parses DD-Mon-YY with year < 50 as 20xx (Amex legacy format)', () => {
    expect(parseDate('15-Jun-25')).toBe('2025-06-15');
  });

  it('parses DD-Mon-YY with year >= 50 as 19xx', () => {
    expect(parseDate('10-Mar-52')).toBe('1952-03-10');
  });

  it('handles leading/trailing whitespace', () => {
    expect(parseDate('  2026-04-15  ')).toBe('2026-04-15');
  });

  it('throws for an unrecognised format', () => {
    expect(() => parseDate('April 15 2026')).toThrow('Unrecognised date format');
  });

  it('throws for an empty string', () => {
    expect(() => parseDate('')).toThrow('Unrecognised date format');
  });

  it('throws for a recognised-shape date with an invalid month abbreviation', () => {
    expect(() => parseDate('15 Xyz 2026')).toThrow('Unrecognised month abbreviation');
  });
});

// ---------------------------------------------------------------------------
// parseAmount
// ---------------------------------------------------------------------------
describe('parseAmount', () => {
  it('returns 0 for an empty string', () => {
    expect(parseAmount('')).toBe(0);
  });

  it('returns 0 for a whitespace-only string', () => {
    expect(parseAmount('   ')).toBe(0);
  });

  it('returns 0 for undefined', () => {
    expect(parseAmount(undefined)).toBe(0);
  });

  it('strips commas from a comma-formatted value', () => {
    expect(parseAmount('1,234.56')).toBe(1234.56);
  });

  it('parses a plain positive number', () => {
    expect(parseAmount('99.99')).toBe(99.99);
  });

  it('parses a negative value', () => {
    expect(parseAmount('-150.00')).toBe(-150);
  });

  it('throws for a non-numeric string', () => {
    expect(() => parseAmount('abc')).toThrow('Unrecognised amount value');
  });
});

// ---------------------------------------------------------------------------
// normaliseDescription
// ---------------------------------------------------------------------------
describe('normaliseDescription', () => {
  it('lowercases the input', () => {
    expect(normaliseDescription('WALMART')).toBe('walmart');
  });

  it('collapses interior whitespace runs to a single space', () => {
    expect(normaliseDescription('hello   world')).toBe('hello world');
  });

  it('trims leading and trailing whitespace', () => {
    expect(normaliseDescription('  hello  ')).toBe('hello');
  });

  it('trims and collapses in combination', () => {
    expect(normaliseDescription('  HELLO   WORLD  ')).toBe('hello world');
  });

  it('leaves an already-normalised string unchanged', () => {
    expect(normaliseDescription('hello world')).toBe('hello world');
  });
});

// ---------------------------------------------------------------------------
// buildCompositeKey
// ---------------------------------------------------------------------------
describe('buildCompositeKey', () => {
  it('produces identical keys for identical inputs (deduplication contract)', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    const key2 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    expect(key1).toBe(key2);
  });

  it('different accountId → different key', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    const key2 = buildCompositeKey('acc-2', '2026-04-15', 'WALMART', -50);
    expect(key1).not.toBe(key2);
  });

  it('different date → different key', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    const key2 = buildCompositeKey('acc-1', '2026-04-16', 'WALMART', -50);
    expect(key1).not.toBe(key2);
  });

  it('different description → different key', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    const key2 = buildCompositeKey('acc-1', '2026-04-15', 'COSTCO', -50);
    expect(key1).not.toBe(key2);
  });

  it('different amount → different key', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    const key2 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -51);
    expect(key1).not.toBe(key2);
  });

  it('normalises description casing before building key (case-insensitive dedup)', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'WALMART', -50);
    const key2 = buildCompositeKey('acc-1', '2026-04-15', 'walmart', -50);
    expect(key1).toBe(key2);
  });

  it('formats amount to 2 decimal places', () => {
    const key = buildCompositeKey('acc-1', '2026-04-15', 'coffee', -5);
    expect(key).toMatch(/-5\.00$/);
  });

  it('strips special characters from description', () => {
    const key1 = buildCompositeKey('acc-1', '2026-04-15', 'Tim Hortons #42!', -3);
    const key2 = buildCompositeKey('acc-1', '2026-04-15', 'tim hortons 42', -3);
    expect(key1).toBe(key2);
  });
});
