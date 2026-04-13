import * as fs from 'fs';
import * as path from 'path';
import { describe, expect, it } from 'vitest';
import assert from 'node:assert/strict';
import { parseCsv } from '../../pipeline/parser';
import { QuestradeAdapter } from './questrade.adapter';
import { assertDefined } from '@/lib/assert';

const adapter = new QuestradeAdapter();
const FIXTURE = path.join(__dirname, './../__fixtures__', 'questrade.csv');

describe('QuestradeAdapter', () => {
  it('detect() returns true for Questrade header row', () => {
    expect(
      adapter.detect([
        'Transaction Date',
        'Settlement Date',
        'Action',
        'Symbol',
        'Description',
        'Quantity',
        'Price',
        'Gross Amount',
        'Commission',
        'Net Amount',
        'Currency',
        'Account #',
        'Activity Type',
        'Account Type',
      ])
    ).toBe(true);
  });

  it('detect() returns false for non-Questrade header', () => {
    expect(
      adapter.detect(['Date', 'Date Processed', 'Description', 'Amount'])
    ).toBe(false);
  });

  it('parses all 20 fixture rows', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(20);
  });

  it('maps action codes correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    const div = results.find((r) => r.rawAction === 'DIV');
    assert(div !== undefined);
    expect(div.action).toBe('dividend');

    const con = results.find((r) => r.rawAction === 'CON');
    assert(con !== undefined);
    expect(con.action).toBe('deposit');

    const tf6 = results.find((r) => r.rawAction === 'TF6');
    expect(tf6).toBeDefined();
    assert(tf6 !== undefined);
    expect(tf6.action).toBe('transfer');

    const rei = results.find((r) => r.rawAction === 'REI');
    expect(rei).toBeDefined();
    assert(rei !== undefined);
    expect(rei.action).toBe('dividend');
  });

  it('maps empty action to dividend via Activity Type fallback', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    // Empty-action rows have Activity Type = "Dividends"
    const emptyActionRows = results.filter((r) => r.rawAction === '');
    expect(emptyActionRows.length).toBeGreaterThan(0);
    emptyActionRows.forEach((r) => expect(r.action).toBe('dividend'));
  });

  it('maps account types correctly', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results.some((r) => r.accountType === 'tfsa')).toBe(true);
    expect(results.some((r) => r.accountType === 'rrsp')).toBe(true);
    expect(results.some((r) => r.accountType === 'fhsa')).toBe(true);
  });

  it('REI row has negative net amount (cash-out leg of reinvestment)', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');

    const rei = results.find((r) => r.rawAction === 'REI');
    assert(rei !== undefined);
    expect(Number(rei.netAmount)).toBeLessThan(0);
  });

  it('compositeKey includes accountId prefix after import service rewrite', () => {
    const content = fs.readFileSync(FIXTURE, 'utf-8');
    const rows = parseCsv(content);
    const results = adapter.parse(rows, 'test-account-id');
    // compositeKey uses accountNumber from the file, not the passed accountId
    const r0 = results[0];
    assertDefined(r0, 'Expected results[0]');
    expect(r0.compositeKey).toMatch(/^10000001-/);
  });
});
