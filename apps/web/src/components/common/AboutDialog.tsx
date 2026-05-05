import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';

interface Props {
  readonly triggerClassName?: string;
}

export function AboutDialog({ triggerClassName }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center px-3 text-sm transition-colors text-content-secondary hover:text-content-primary hover:bg-surface-subtle',
          triggerClassName,
        )}
      >
        About
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Finance Dashboard</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-content-secondary">
              <p>
                A personal finance dashboard for tracking income, expenses, and
                savings goals across accounts. Built to give a clear picture of
                monthly cash flow and progress against a planned budget.
              </p>
              <p>
                The sample data loaded into this demo represents a fictional
                household with typical income and spending patterns across
                several account types.
              </p>
              <div className="flex gap-4 pt-1">
                <a
                  href="https://github.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info underline hover:opacity-80 transition-opacity"
                >
                  GitHub
                </a>
                <a
                  href="https://notion.so/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-info underline hover:opacity-80 transition-opacity"
                >
                  Portfolio
                </a>
              </div>
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
