import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface ValueChipProps {
  label: string;
  text: string;
  ai?: boolean;
  className?: string;
}

/** Small "criterion: value" chip; AI estimates are dashed with a sparkle. */
export function ValueChip({ label, text, ai = false, className }: ValueChipProps) {
  const chip = (
    <span
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] leading-4',
        ai ? 'border-dashed border-ai/80 bg-ai/10' : 'border-border bg-muted/60',
        className,
      )}
    >
      {ai && <Sparkles className="size-3 shrink-0 text-ai" aria-hidden />}
      <span className="truncate text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{text}</span>
    </span>
  );
  if (!ai) return chip;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{chip}</TooltipTrigger>
      <TooltipContent>Estimation de l’assistant</TooltipContent>
    </Tooltip>
  );
}
