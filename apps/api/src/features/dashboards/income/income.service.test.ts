import { describe, expect, it } from 'vitest';
import { buildIncomeResponse } from './income.service';

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
    expect(result.months.every((m) => m.total === '0.00')).toBe(true);
  });

  it('fills present months with correct total and leaves others at 0.00', () => {
    const rows = [{ month: 3, total: '4500.00' }];
    const result = buildIncomeResponse(2025, rows, noPercentages);
    expect(result.months[2].total).toBe('4500.00');
    expect(result.months[0].total).toBe('0.00');
    expect(result.months[11].total).toBe('0.00');
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
    expect(jan.allocation).toEqual({
      needs: '500.00',
      wants: '300.00',
      investments: '200.00',
    });
  });

  it('returns zero allocations (not null) for empty months when percentages configured', () => {
    const result = buildIncomeResponse(2025, [], percentages50_30_20);
    expect(result.months[0].allocation).toEqual({
      needs: '0.00',
      wants: '0.00',
      investments: '0.00',
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
    expect(jun.allocation).not.toBeNull();
    expect(jun.allocation!.needs).toBe('33.00');
    expect(jun.allocation!.wants).toBe('33.00');
    expect(jun.allocation!.investments).toBe('34.00');
  });

  it('includes all 12 months in order', () => {
    const result = buildIncomeResponse(2025, [], noPercentages);
    result.months.forEach((m, i) => {
      expect(m.month).toBe(i + 1);
    });
  });
});
