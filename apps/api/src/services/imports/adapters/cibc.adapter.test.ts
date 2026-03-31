import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import { CibcAdapter } from './cibc.adapter';
import { parseCsv } from '../parser';

const adapter = new CibcAdapter();
const FIXTURE = path.join(__dirname, '__fixtures__', 'cibc.csv');

describe('CibcAdapter', () => {
  it('detect() returns true for CIBC data row', () => {
    expect(
      adapter.detect([
        '2026-02-24',
        'STARBUCKS WHISTLER',
        '10.29',
        '',
        '5268****2066',
      ])
    ).toBe(true);
  });

  it('detect() returns false for Amex header row', () => {
    expect(
      adapter.detect(['Date', 'Date Processed', 'Description', 'Amount'])
    ).toBe(false);
  });

  it('parses fixture file correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(4);

    expect(Number(results[0].amount)).toBe(-10.29);
    expect(Number(results[1].amount)).toBe(-46.99);
    expect(Number(results[2].amount)).toBe(-198.45);

    const payment = results.find((r) => Number(r.amount) > 0);
    expect(payment).toBeDefined();
    expect(Number(payment!.amount)).toBe(503.87);
  });

  it('stores card number in metadata', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');
    expect(results[0].metadata?.cardNumber).toContain('5268');
  });

  it('compositeKey includes accountId prefix', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'acc-456');
    expect(results[0].compositeKey).toMatch(/^acc-456-/);
  });
});
