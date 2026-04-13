import { describe, expect, it } from 'vitest';
import { buildIncomeResponse } from './income.service';
import { assertDefined } from '@/lib/assert';

const noPercentages = {
  needsPercentage: null,
  wantsPercentage: null,
  investmentsPercentage: null,
};

const percentages50_30_20 = {
  needsPercentage: 50,
  wantsPercentage: 30,
  investmentsPercentage: 20,
};

describe('buildIncomeResponse', () => {
  it('returns 12 months when rows is empty', () => {
    const result = buildIncomeResponse(2025, [], noPercentages);
    expect(result.year).toBe(2025);
    expect(result.months).toHaveLength(12);
    expect(result.months.every((m) => m.total === 0)).toBe(true);
  });

  it('fills present months with correct total and leaves others at 0', () => {
    const rows = [{ month: 3, total: '4500.00' }];
    const result = buildIncomeResponse(2025, rows, noPercentages);
    const march = result.months[2];
    assertDefined(march, 'Expected month at index 2 (March)');
    const jan = result.months[0];
    assertDefined(jan, 'Expected month at index 0 (January)');
    const dec = result.months[11];
    assertDefined(dec, 'Expected month at index 11 (December)');
    expect(march.total).toBe(4500);
    expect(jan.total).toBe(0);
    expect(dec.total).toBe(0);
  });

  it('sets allocation null for all months when no percentages configured', () => {
    const rows = [{ month: 3, total: '4500.00' }];
    const result = buildIncomeResponse(2025, rows, noPercentages);
    expect(result.months.every((m) => m.allocation === null)).toBe(true);
  });

  it('computes correct allocation splits (50/30/20 on 1000.00)', () => {
    const rows = [{ month: 1, total: '1000.00' }];
    const result = buildIncomeResponse(2025, rows, percentages50_30_20);
    const jan = result.months[0];
    assertDefined(jan, 'Expected month at index 0 (January)');
    expect(jan.allocation).toEqual({
      needs: 500,
      wants: 300,
      investments: 200,
    });
  });

  it('returns zero allocations (not null) for empty months when percentages configured', () => {
    const result = buildIncomeResponse(2025, [], percentages50_30_20);
    const jan = result.months[0];
    assertDefined(jan, 'Expected month at index 0 (January)');
    expect(jan.allocation).toEqual({
      needs: 0,
      wants: 0,
      investments: 0,
    });
  });

  it('handles 33/33/34 split without throwing', () => {
    const rows = [{ month: 6, total: '100.00' }];
    const result = buildIncomeResponse(
      2025,
      rows,
      { needsPercentage: 33, wantsPercentage: 33, investmentsPercentage: 34 }
    );
    const jun = result.months[5];
    assertDefined(jun, 'Expected month at index 5 (June)');
    expect(jun.allocation).not.toBeNull();
    expect(jun.allocation!.needs).toBe(33);
    expect(jun.allocation!.wants).toBe(33);
    expect(jun.allocation!.investments).toBe(34);
  });

  it('includes all 12 months in order', () => {
    const result = buildIncomeResponse(2025, [], noPercentages);
    result.months.forEach((m, i) => {
      expect(m.month).toBe(i + 1);
    });
  });
});
