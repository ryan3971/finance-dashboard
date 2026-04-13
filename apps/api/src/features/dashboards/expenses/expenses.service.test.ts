import { describe, expect, it } from 'vitest';
import { buildExpensesResponse } from './expenses.service';
import { assertDefined } from '@/lib/assert';

describe('buildExpensesResponse', () => {
  it('returns 12 months when rows is empty', () => {
    const result = buildExpensesResponse(2025, []);
    expect(result.year).toBe(2025);
    expect(result.months).toHaveLength(12);
    expect(result.months.every((m) => m.need === 0)).toBe(true);
    expect(result.months.every((m) => m.want === 0)).toBe(true);
    expect(result.months.every((m) => m.other === 0)).toBe(true);
    expect(result.months.every((m) => m.total === 0)).toBe(true);
    expect(result.annualTotal).toBe(0);
  });

  it('returns months in order 1–12', () => {
    const result = buildExpensesResponse(2025, []);
    expect(result.months.every((m, i) => m.month === i + 1)).toBe(true);
  });

  it('buckets Need correctly', () => {
    const result = buildExpensesResponse(2025, [
      { month: 3, needWant: 'Need', total: '500.00' },
    ]);
    const march = result.months[2];
    assertDefined(march, 'Expected month at index 2 (March)');
    expect(march.need).toBe(500);
    expect(march.want).toBe(0);
    expect(march.other).toBe(0);
    expect(march.total).toBe(500);
  });

  it('buckets Want correctly', () => {
    const result = buildExpensesResponse(2025, [
      { month: 5, needWant: 'Want', total: '200.00' },
    ]);
    const may = result.months[4];
    assertDefined(may, 'Expected month at index 4 (May)');
    expect(may.need).toBe(0);
    expect(may.want).toBe(200);
    expect(may.other).toBe(0);
    expect(may.total).toBe(200);
  });

  it('buckets NA into other', () => {
    const result = buildExpensesResponse(2025, [
      { month: 7, needWant: 'NA', total: '100.00' },
    ]);
    const july = result.months[6];
    assertDefined(july, 'Expected month at index 6 (July)');
    expect(july.need).toBe(0);
    expect(july.want).toBe(0);
    expect(july.other).toBe(100);
    expect(july.total).toBe(100);
  });

  it('buckets null needWant into other', () => {
    const result = buildExpensesResponse(2025, [
      { month: 1, needWant: null, total: '75.00' },
    ]);
    const jan = result.months[0];
    assertDefined(jan, 'Expected month at index 0 (January)');
    expect(jan.other).toBe(75);
    expect(jan.total).toBe(75);
  });

  it('buckets any unrecognised needWant value into other', () => {
    const result = buildExpensesResponse(2025, [
      { month: 2, needWant: 'SomeOtherValue', total: '60.00' },
    ]);
    const feb = result.months[1];
    assertDefined(feb, 'Expected month at index 1 (February)');
    expect(feb.other).toBe(60);
    expect(feb.total).toBe(60);
  });

  it('sums multiple buckets in the same month and total equals need + want + other', () => {
    const result = buildExpensesResponse(2025, [
      { month: 6, needWant: 'Need', total: '300.00' },
      { month: 6, needWant: 'Want', total: '150.00' },
      { month: 6, needWant: 'NA', total: '50.00' },
    ]);
    const june = result.months[5];
    assertDefined(june, 'Expected month at index 5 (June)');
    expect(june.need).toBe(300);
    expect(june.want).toBe(150);
    expect(june.other).toBe(50);
    expect(june.total).toBe(500);
    expect(june.total).toBe(june.need + june.want + june.other);
    expect(result.annualTotal).toBe(500);
  });

  it('annualTotal sums across multiple months', () => {
    const result = buildExpensesResponse(2025, [
      { month: 1, needWant: 'Need', total: '100.00' },
      { month: 6, needWant: 'Want', total: '200.00' },
      { month: 12, needWant: null, total: '50.00' },
    ]);
    expect(result.annualTotal).toBe(350);
  });

  it('leaves months without rows at zero', () => {
    const result = buildExpensesResponse(2025, [
      { month: 1, needWant: 'Need', total: '100.00' },
    ]);
    const dec = result.months[11];
    assertDefined(dec, 'Expected month at index 11 (December)');
    expect(dec.need).toBe(0);
    expect(dec.want).toBe(0);
    expect(dec.other).toBe(0);
    expect(dec.total).toBe(0);
  });
});
