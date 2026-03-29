import { describe, it, expect } from 'vitest';
import { TdAdapter } from './td.adapter';
import * as fs from 'fs';
import * as path from 'path';
import { parseCsv } from '../parser';

const adapter = new TdAdapter();
const FIXTURE = path.join(__dirname, '__fixtures__', 'td.csv');

describe('TdAdapter', () => {
  it('detect() returns true for TD data row', () => {
    expect(adapter.detect(['2025-08-29', 'SOME MERCHANT', '28.8', '', '7250.34'])).toBe(true);
  });

  it('detect() returns false when col[4] has masked card (CIBC format)', () => {
    expect(adapter.detect(['2026-02-24', 'STARBUCKS', '10.29', '', '5268****2066'])).toBe(false);
  });

  it('parses fixture file correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(5);

    const income = results.find(r => r.rawDescription.includes('PRODIGY'));
    expect(Number(income!.amount)).toBe(2549.81);

    const fee = results.find(r => r.rawDescription.includes('ACCOUNT FEE'));
    expect(Number(fee!.amount)).toBe(-11.95);
  });

  it('collapses double spaces in descriptions', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');
    const prodigy = results.find(r => r.description.includes('prodigy'));
    expect(prodigy!.description).not.toContain('  ');
  });
});
