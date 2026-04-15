import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { CibcAdapter } from './cibc/cibc.adapter';
import { TdAdapter } from './td/td.adapter';
import { parseCsv } from '../pipeline/parser';
import { assertDefined } from '@/lib/assert';

const FIXTURES = path.join(__dirname, '__fixtures__');

const tdRows = parseCsv(fs.readFileSync(path.join(FIXTURES, 'td_manual.csv'), 'utf-8'));
const cibcRows = parseCsv(fs.readFileSync(path.join(FIXTURES, 'cibc_manual.csv'), 'utf-8'));

// ---------------------------------------------------------------------------
// Shared DebitCreditAdapter behaviour — tested once via the TD concrete class
// ---------------------------------------------------------------------------
describe('DebitCreditAdapter shared parsing', () => {
  const adapter = new TdAdapter();

  it('parses all data rows from fixture', () => {
    expect(adapter.parse(tdRows, 'test-account-id')).toHaveLength(9);
  });

  it('credit col populated → positive amount', () => {
    const results = adapter.parse(tdRows, 'test-account-id');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(Number(r0.amount)).toBe(4000);
  });

  it('debit col populated → negative amount', () => {
    const results = adapter.parse(tdRows, 'test-account-id');
    const expense = results.find((r) => r.rawDescription === 'WALMART GROCERY STORE 321');
    assertDefined(expense, 'Expected WALMART GROCERY STORE 321 row');
    expect(Number(expense.amount)).toBe(-150);
  });

  it('compositeKey includes accountId prefix', () => {
    const results = adapter.parse(tdRows, 'acc-456');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.compositeKey).toMatch(/^acc-456-/);
  });
});

// ---------------------------------------------------------------------------
// CibcAdapter — detection and CIBC-specific metadata extraction
// ---------------------------------------------------------------------------
describe('CibcAdapter', () => {
  const adapter = new CibcAdapter();

  it('detect() returns true for CIBC data row with masked card', () => {
    expect(
      adapter.detect([
        '2026-02-17',
        'WAREHOUSE GROCERY CO',
        '198.45',
        '',
        '4321****5678',
      ])
    ).toBe(true);
  });

  it('detect() returns false for Amex header row', () => {
    expect(
      adapter.detect(['Date', 'Date Processed', 'Description', 'Amount'])
    ).toBe(false);
  });

  it('detect() returns false when col[4] has no masked card (TD format)', () => {
    expect(
      adapter.detect(['2026-02-02', 'SOME MERCHANT', '28.8', '', '14878.00'])
    ).toBe(false);
  });

  it('parses quoted description containing a comma correctly', () => {
    const results = adapter.parse(cibcRows, 'test-account-id');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.rawDescription).toBe('WALMART SUPERCENTRE 552 VANCOUVER, BC');
    expect(Number(r0.amount)).toBe(-80);
  });

  it('stores card number in metadata', () => {
    const results = adapter.parse(cibcRows, 'test-account-id');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.metadata?.cardNumber).toContain('4321');
  });
});

// ---------------------------------------------------------------------------
// TdAdapter — detection only (parsing covered by shared section above)
// ---------------------------------------------------------------------------
describe('TdAdapter', () => {
  const adapter = new TdAdapter();

  it('detect() returns true for TD data row', () => {
    expect(
      adapter.detect(['2026-02-02', 'SOME MERCHANT', '28.8', '', '14878.00'])
    ).toBe(true);
  });

  it('detect() returns false when col[4] has masked card (CIBC format)', () => {
    expect(
      adapter.detect([
        '2026-02-17',
        'WAREHOUSE GROCERY CO',
        '198.45',
        '',
        '4321****5678',
      ])
    ).toBe(false);
  });
});
