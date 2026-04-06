import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/DropdownMenu';
import { ACTIONS_COLUMN_ID } from '@/features/transactions/hooks/useTransactionColumns';
import { Button } from '@/components/ui/Button';
import { Columns3 } from 'lucide-react';
import type { Table } from '@tanstack/react-table';
import type { Transaction } from '@/features/transactions/hooks/useTransactions';

interface ColumnVisibilityToggleProps {
  table: Table<Transaction>;
}

export function ColumnVisibilityToggle({ table }: ColumnVisibilityToggleProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="flex items-center gap-1 text-content-secondary"
        >
          <Columns3 className="h-3.5 w-3.5" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {table
          .getAllColumns()
          .filter((col) => col.id !== ACTIONS_COLUMN_ID)
          .map((col) => {
            const label = col.columnDef.meta?.label ?? col.id;
            return (
              <DropdownMenuCheckboxItem
                key={col.id}
                checked={col.getIsVisible()}
                onCheckedChange={(value) => col.toggleVisibility(value)}
              >
                {label}
              </DropdownMenuCheckboxItem>
            );
          })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
