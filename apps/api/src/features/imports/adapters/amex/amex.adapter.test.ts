import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { AmexAdapter } from './amex.adapter';
import { parseCsv } from '../../pipeline/parser';
import { assertDefined } from '@/lib/assert';

const adapter = new AmexAdapter();
const FIXTURE = path.join(__dirname, '../../../../testing/csv', 'amex.csv');

// amex.csv: 6 data rows (5 charges + 1 payment), dates 2026-03-14 to 2026-03-26
const fixtureRows = parseCsv(fs.readFileSync(FIXTURE, 'utf-8'));

describe('AmexAdapter detect()', () => {
  it('returns true for a canonical Amex header row', () => {
    expect(
      adapter.detect(['Date', 'Date Processed', 'Description', 'Amount'])
    ).toBe(true);
  });

  it('returns true regardless of header capitalization', () => {
    expect(
      adapter.detect(['DATE', 'DATE PROCESSED', 'DESCRIPTION', 'AMOUNT'])
    ).toBe(true);
  });

  it('returns true when extra trailing columns are present', () => {
    expect(
      adapter.detect([
        'Date',
        'Date Processed',
        'Description',
        'Amount',
        'Extended Details',
      ])
    ).toBe(true);
  });

  it('returns false for a non-Amex header', () => {
    expect(
      adapter.detect([
        '2026-02-17',
        'WAREHOUSE GROCERY CO',
        '198.45',
        '',
        '4321****',
      ])
    ).toBe(false);
  });

  it('returns false when the row has fewer than four columns', () => {
    expect(adapter.detect(['Date', 'Date Processed', 'Description'])).toBe(
      false
    );
  });
});

describe('AmexAdapter validate()', () => {
  it('passes a fully populated row', () => {
    const result = adapter.validate([
      '14 Mar 2026',
      '14 Mar 2026',
      'Groceries',
      '12.00',
    ]);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('fails when date is missing', () => {
    const result = adapter.validate(['', '14 Mar 2026', 'Groceries', '12.00']);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing date');
  });

  it('fails when description is missing', () => {
    const result = adapter.validate([
      '14 Mar 2026',
      '14 Mar 2026',
      '',
      '12.00',
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing description');
  });

  it('fails when amount is missing', () => {
    const result = adapter.validate([
      '14 Mar 2026',
      '14 Mar 2026',
      'Groceries',
      '',
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing amount');
  });

  it('fails when amount is not numeric', () => {
    const result = adapter.validate([
      '14 Mar 2026',
      '14 Mar 2026',
      'Groceries',
      'N/A',
    ]);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid amount: "N/A"');
  });
});

describe('AmexAdapter parse()', () => {
  it('returns one result per valid data row and excludes the header', () => {
    expect(adapter.parse(fixtureRows, 'acc')).toHaveLength(6);
  });

  it('returns an empty array for empty input', () => {
    expect(adapter.parse([], 'acc')).toHaveLength(0);
  });

  it('silently skips invalid rows', () => {
    const rows = [
      ['Date', 'Date Processed', 'Description', 'Amount'],
      ['14 Mar 2026', '', 'Valid Row', '12.00'],
      ['', '', 'Bad Row', 'not-a-number'],
    ];
    expect(adapter.parse(rows, 'acc')).toHaveLength(1);
  });

  describe('amount handling', () => {
    it('negates positive CSV amounts (charges)', () => {
      // TIM HORTONS #412: CSV 12.00 → stored -12
      const results = adapter.parse(fixtureRows, 'acc');
      const row = results.find((r) => r.description === 'tim hortons #412');
      assertDefined(row, 'Expected TIM HORTONS row');
      expect(row.amount).toBe(-12);
    });

    it('makes negative CSV amounts positive (payments)', () => {
      // PAYMENT RECEIVED: CSV -245.00 → stored 245
      const results = adapter.parse(fixtureRows, 'acc');
      const row = results.find(
        (r) => r.description === 'payment received - thank you'
      );
      assertDefined(row, 'Expected PAYMENT RECEIVED row');
      expect(row.amount).toBe(245);
    });
  });

  describe('date parsing', () => {
    it('converts "DD Mon YYYY" to ISO 8601', () => {
      const results = adapter.parse(fixtureRows, 'acc');
      const row = results.find((r) => r.description === 'tim hortons #412');
      assertDefined(row, 'Expected TIM HORTONS row');
      expect(row.date).toBe('2026-03-14');
    });

    it('converts legacy "DD-Mon-YY" to ISO 8601', () => {
      const rows = [
        ['Date', 'Date Processed', 'Description', 'Amount'],
        ['15-Feb-26', '', 'GROCERY STORE', '50.00'],
      ];
      const results = adapter.parse(rows, 'acc');
      expect(results[0]?.date).toBe('2026-02-15');
    });
  });

  describe('description normalization', () => {
    it('lowercases and collapses whitespace', () => {
      const rows = [
        ['Date', 'Date Processed', 'Description', 'Amount'],
        ['14 Mar 2026', '', 'MULTI  SPACE  DESC', '10.00'],
      ];
      const results = adapter.parse(rows, 'acc');
      expect(results[0]?.description).toBe('multi space desc');
    });

    it('preserves rawDescription before normalization', () => {
      const results = adapter.parse(fixtureRows, 'acc');
      const row = results.find((r) => r.rawDescription === 'TIM HORTONS #412');
      assertDefined(row, 'Expected row with rawDescription TIM HORTONS #412');
      expect(row.description).toBe('tim hortons #412');
    });
  });

  describe('compositeKey', () => {
    it('encodes accountId, date, hyphenated description, and amount', () => {
      // '#' is stripped; negative amount produces double dash before the value
      const results = adapter.parse(fixtureRows, 'acc-123');
      const row = results.find((r) => r.rawDescription === 'TIM HORTONS #412');
      assertDefined(row, 'Expected TIM HORTONS row');
      expect(row.compositeKey).toBe(
        'acc-123-2026-03-14-tim-hortons-412--12.00'
      );
    });
  });
});
