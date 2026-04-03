import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { parseCsv } from '../../pipeline/parser';
import { TdAdapter } from './td.adapter';

const adapter = new TdAdapter();
const FIXTURE = path.join(__dirname, './../__fixtures__', 'td.csv');

describe('TdAdapter', () => {
  it('detect() returns true for TD data row', () => {
    expect(
      adapter.detect(['2026-02-02', 'SOME MERCHANT', '28.8', '', '14878.00'])
    ).toBe(true);
  });

  it('detect() returns false when col[4] has masked card (CIBC format)', () => {
    expect(
      adapter.detect(['2026-02-17', 'WAREHOUSE GROCERY CO', '198.45', '', '4321****5678'])
    ).toBe(false);
  });

  it('parses fixture file correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(15);

    // Income: credit col populated → positive amount
    const income = results.find((r) =>
      r.rawDescription.includes('EMPLOYMENT INS DEP')
    );
    expect(income).toBeDefined();
    expect(Number(income!.amount)).toBe(2616);

    // Expense: debit col populated → negative amount
    const expense = results.find((r) =>
      r.rawDescription.includes('CREDIT CARD PYMT')
    );
    expect(expense).toBeDefined();
    expect(Number(expense!.amount)).toBeLessThan(0);
  });

  it('collapses extra spaces in descriptions', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');
    const income = results.find((r) => r.description.includes('employment ins dep'));
    expect(income!.description).not.toContain('  ');
  });
});
