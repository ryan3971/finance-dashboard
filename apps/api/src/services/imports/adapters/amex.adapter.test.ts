import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AmexAdapter } from './amex.adapter';
import { parseCsv } from '../parser';

const adapter = new AmexAdapter();
const FIXTURE = path.join(__dirname, '__fixtures__', 'amex.csv');

describe('AmexAdapter', () => {
  it('detect() returns true for Amex header row', () => {
    expect(
      adapter.detect(['Date', 'Date Processed', 'Description', 'Amount'])
    ).toBe(true);
  });

  it('detect() returns false for non-Amex header', () => {
    expect(
      adapter.detect(['2026-02-24', 'STARBUCKS', '10.29', '', '5268****'])
    ).toBe(false);
  });

  it('parses fixture file correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(3);

    expect(Number(results[0].amount)).toBe(-9.99);
    expect(Number(results[1].amount)).toBe(-59);
    expect(Number(results[2].amount)).toBe(-8.75);

    expect(results[0].date).toBe('2025-06-15');
    expect(results[1].date).toBe('2025-06-14');
    expect(results[2].date).toBe('2025-06-13');

    expect(results[0].description).toBe('membership fee installment');
  });

  it('compositeKey includes accountId prefix', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'acc-123');
    expect(results[0].compositeKey).toMatch(/^acc-123-/);
  });
});
