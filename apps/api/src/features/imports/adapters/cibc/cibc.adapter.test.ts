import * as fs from 'fs';
import * as path from 'path';
import assert from 'node:assert/strict';
import { describe, expect, it } from 'vitest';
import { CibcAdapter } from './cibc.adapter';
import { parseCsv } from '../../pipeline/parser';
import { assertDefined } from '@/lib/assert';

const adapter = new CibcAdapter();
const FIXTURE = path.join(__dirname, './../__fixtures__', 'cibc.csv');

describe('CibcAdapter', () => {
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

  it('parses fixture file correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(15);

    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');

    // Debit: positive debit col → negative amount
    expect(Number(r0.amount)).toBe(-198.45);

    // Quoted description with comma parsed correctly
    expect(r0.rawDescription).toBe('WAREHOUSE GROCERY CO W552 VANCOUVER, BC');

    // Payment: credit col → positive amount
    const payment = results.find((r) => Number(r.amount) > 0);
    assert(payment !== undefined);
    expect(Number(payment.amount)).toBe(503.87);
  });

  it('stores card number in metadata', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.metadata?.cardNumber).toContain('4321');
  });

  it('compositeKey includes accountId prefix', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'acc-456');
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.compositeKey).toMatch(/^acc-456-/);
  });
});
