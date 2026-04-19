import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AmexAdapter } from './amex.adapter';
import { parseCsv } from '../../pipeline/parser';
import { assertDefined } from '@/lib/assert';

const adapter = new AmexAdapter();
const FIXTURE = path.join(__dirname, '../../../../testing/csv', 'amex.csv');

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

    const r0 = results[0]; assertDefined(r0, 'Expected results[0]');
    const r1 = results[1]; assertDefined(r1, 'Expected results[1]');
    const r3 = results[3]; assertDefined(r3, 'Expected results[3]');
    const r4 = results[4]; assertDefined(r4, 'Expected results[4]');
    const r8 = results[8]; assertDefined(r8, 'Expected results[8]');
    const r11 = results[11]; assertDefined(r11, 'Expected results[11]');

    // Regular charge: positive CSV amount → negated → negative
    expect(Number(r0.amount)).toBe(-9.99);
    expect(Number(r1.amount)).toBe(-31.59);

    // Payment: negative CSV amount → negated → positive
    expect(Number(r3.amount)).toBe(130.37);

    // Refund/credit: negative CSV amount → negated → positive
    expect(Number(r4.amount)).toBe(5.00);

    // Date parsing: DD Mon YYYY → YYYY-MM-DD
    expect(r0.date).toBe('2026-02-15');
    expect(r11.date).toBe('2026-01-31');

    // Description normalisation (lowercase, whitespace collapsed)
    expect(r0.description).toBe('annual membership fee');
    expect(r8.description).toBe('restaurant hero bistro vancouver');
  });

  it('compositeKey includes accountId prefix', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'acc-123');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.compositeKey).toMatch(/^acc-123-/);
  });
});
