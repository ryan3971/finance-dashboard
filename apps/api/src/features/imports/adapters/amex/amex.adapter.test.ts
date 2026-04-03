import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AmexAdapter } from './amex.adapter';
import { parseCsv } from '../../pipeline/parser';

const adapter = new AmexAdapter();
const FIXTURE = path.join(__dirname, './../__fixtures__', 'amex.csv');

describe('AmexAdapter', () => {
  it('detect() returns true for Amex header row', () => {
    expect(
      adapter.detect(['Date', 'Date Processed', 'Description', 'Amount'])
    ).toBe(true);
  });

  it('detect() returns false for non-Amex header', () => {
    expect(
      adapter.detect(['2026-02-17', 'WAREHOUSE GROCERY CO', '198.45', '', '4321****'])
    ).toBe(false);
  });

  it('parses fixture file correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(16);

    // Regular charge: positive CSV amount → negated → negative
    expect(Number(results[0].amount)).toBe(-9.99);
    expect(Number(results[1].amount)).toBe(-31.59);

    // Payment: negative CSV amount → negated → positive
    expect(Number(results[3].amount)).toBe(130.37);

    // Refund/credit: negative CSV amount → negated → positive
    expect(Number(results[4].amount)).toBe(5.00);

    // Date parsing: DD Mon YYYY → YYYY-MM-DD
    expect(results[0].date).toBe('2026-02-15');
    expect(results[11].date).toBe('2026-01-31');

    // Description normalisation (lowercase, whitespace collapsed)
    expect(results[0].description).toBe('annual membership fee');
    expect(results[8].description).toBe('restaurant hero bistro vancouver');
  });

  it('compositeKey includes accountId prefix', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'acc-123');
    expect(results[0].compositeKey).toMatch(/^acc-123-/);
  });
});
