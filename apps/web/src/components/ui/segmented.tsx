import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  /** Tooltip / accessible name when the label is an icon. */
  title?: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
  ariaLabel: string;
  size?: 'sm' | 'xs';
  disabled?: boolean;
  className?: string;
}

/** Compact segmented control (radio group of buttons). */
export function Segmented<T extends string>({ value, options, onChange, ariaLabel, size = 'sm', disabled, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn('inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5', className)}>
      {options.map((o) => {
        const active = o.value === value;
        const button = (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.title}
            disabled={disabled || o.disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1 rounded-md font-medium whitespace-nowrap text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-40 [&_svg:not([class*='size-'])]:size-4",
              size === 'sm' ? 'h-7 px-2 text-xs' : 'h-6 px-1.5 text-[11px]',
              active && 'bg-background text-foreground shadow-sm',
            )}
          >
            {o.label}
          </button>
        );
        if (!o.title) return button;
        return (
          <Tooltip key={o.value}>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent>{o.title}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
