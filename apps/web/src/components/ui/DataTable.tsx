import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface DataTableProps {
  children: ReactNode;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function DataTable({ children, toolbar, footer, className }: DataTableProps) {
  return (
    <div className={cn('bg-surface rounded-lg border border-border-base overflow-hidden', className)}>
      {toolbar != null && (
        <div className="flex items-center justify-end px-3 py-2 border-b border-border-subtle">
          {toolbar}
        </div>
      )}
      <div className="overflow-x-auto">
        {children}
      </div>
      {footer}
    </div>
  );
}
