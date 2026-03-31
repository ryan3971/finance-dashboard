import { describe, expect, it } from 'vitest';
import { createQuestradeFixtureBuffer } from './__fixtures__/questrade-fixture';
import { parseXlsx } from '../parser';
import { QuestradeAdapter } from './questrade.adapter';

const adapter = new QuestradeAdapter();

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

  it('parses fixture XLSX correctly', () => {
    const buffer = createQuestradeFixtureBuffer();
    const rows = parseXlsx(buffer);
    const results = adapter.parse(rows, 'test-account-id');

    expect(results).toHaveLength(3);

    const div = results.find((r) => r.rawAction === 'DIV');
    expect(div).toBeDefined();
    expect(div!.action).toBe('dividend');
    expect(Number(div!.netAmount)).toBeGreaterThan(0);
  });

  it('maps account types correctly', () => {
    const buffer = createQuestradeFixtureBuffer();
    const rows = parseXlsx(buffer);
    const results = adapter.parse(rows, 'test-account-id');

    const tfsa = results.find((r) => r.accountType === 'tfsa');
    expect(tfsa).toBeDefined();

    const rrsp = results.find((r) => r.accountType === 'rrsp');
    expect(rrsp).toBeDefined();
  });

  it('maps TF6 action to transfer', () => {
    const buffer = createQuestradeFixtureBuffer();
    const rows = parseXlsx(buffer);
    const results = adapter.parse(rows, 'test-account-id');

    const transfer = results.find((r) => r.rawAction === 'TF6');
    expect(transfer!.action).toBe('transfer');
  });
});
