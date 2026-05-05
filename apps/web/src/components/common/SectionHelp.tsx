import { useState } from 'react';
import { CircleHelp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { helpContent } from '@/lib/helpContent';

interface Props {
  readonly contentKey: string;
}

export function SectionHelp({ contentKey }: Props) {
  const [open, setOpen] = useState(false);
  const entry = helpContent[contentKey];

  if (!entry) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-5 w-5 flex items-center justify-center rounded text-content-secondary hover:text-content-primary hover:bg-surface-subtle transition-colors"
        aria-label={`Help: ${entry.title}`}
      >
        <CircleHelp className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md overflow-y-auto max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{entry.title}</DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-4">
              {entry.body && <p>{entry.body}</p>}
              {entry.sections && entry.sections.length > 0 && (
                <div className="space-y-3">
                  {entry.sections.map((section) => (
                    <div key={section.heading}>
                      <p className="font-semibold text-content-primary mb-1">
                        {section.heading}
                      </p>
                      <p>{section.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogDescription>
        </DialogContent>
      </Dialog>
    </>
  );
}
