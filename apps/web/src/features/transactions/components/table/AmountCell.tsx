import { DEFAULT_CURRENCY } from '@finance/shared';

function formatAmount(amount: number): string {
  const formatted = new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: DEFAULT_CURRENCY,
  }).format(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : `+${formatted}`;
}

interface AmountCellProps {
  amount: string;
  isTransfer: boolean;
}

export function AmountCell({ amount, isTransfer }: AmountCellProps) {
  const num = parseFloat(amount);
  return (
    <span
      className={`font-mono text-sm font-medium ${
        isTransfer
          ? 'text-content-muted'
          : num > 0
            ? 'text-positive'
            : 'text-danger'
      }`}
    >
      {formatAmount(num)}
    </span>
  );
}
