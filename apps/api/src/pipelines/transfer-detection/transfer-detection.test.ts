import { describe, expect, it } from 'vitest';
import { negateAmount } from './transfer-detection.service';

describe('negateAmount', () => {
  it('negates a positive amount', () => {
    expect(negateAmount('100.00')).toBe('-100.00');
  });

  it('removes the leading minus from a negative amount', () => {
    expect(negateAmount('-100.00')).toBe('100.00');
  });

  it('handles amounts with many decimal places', () => {
    expect(negateAmount('1234.56')).toBe('-1234.56');
    expect(negateAmount('-1234.56')).toBe('1234.56');
  });

  it('does not use floating-point arithmetic', () => {
    // Amounts that lose precision under parseFloat + toFixed
    expect(negateAmount('123456789.99')).toBe('-123456789.99');
    expect(negateAmount('-123456789.99')).toBe('123456789.99');
  });
});
