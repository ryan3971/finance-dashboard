import { useNavigate } from '@tanstack/react-router';

function offsetMonth(year: number, month: number, delta: 1 | -1) {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

export function useMonthNavigation(year: number, month: number) {
  const navigate = useNavigate();
  const now = new Date();
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const label = new Date(year, month - 1, 1).toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
  });

  function prev() {
    void navigate({
      to: '/dashboard/snapshot',
      search: offsetMonth(year, month, -1),
    });
  }

  function next() {
    if (isCurrentMonth) return;
    void navigate({
      to: '/dashboard/snapshot',
      search: offsetMonth(year, month, 1),
    });
  }

  function goToToday() {
    void navigate({ to: '/dashboard/snapshot', search: {} });
  }

  return { isCurrentMonth, label, prev, next, goToToday };
}
