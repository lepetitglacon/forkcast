import { useEffect, useMemo, useRef, useState } from 'react';
import rough from 'roughjs';
import { cn } from '@/lib/utils';

interface SketchFrameProps {
  seed: number;
  className?: string;
  strokeWidth?: number;
}

function roughRectPath(width: number, height: number, seed: number, strokeWidth: number): string {
  const generator = rough.generator({ options: { seed, roughness: 1.3, bowing: 1.1, strokeWidth } });
  const inset = 1.5;
  const drawable = generator.rectangle(inset, inset, Math.max(1, width - inset * 2), Math.max(1, height - inset * 2));
  return generator
    .toPaths(drawable)
    .map((p) => p.d)
    .join(' ');
}

/** Hand-drawn (rough.js) border that follows the size of its parent element. */
export function SketchFrame({ seed, className, strokeWidth = 1.6 }: SketchFrameProps) {
  const ref = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const update = () => {
      const w = parent.offsetWidth;
      const h = parent.offsetHeight;
      setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(parent);
    return () => observer.disconnect();
  }, []);

  const d = useMemo(() => (size ? roughRectPath(size.w, size.h, seed, strokeWidth) : null), [size, seed, strokeWidth]);

  return (
    <svg
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-visible', className)}
      width={size?.w ?? 0}
      height={size?.h ?? 0}
    >
      {d && <path d={d} fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" />}
    </svg>
  );
}
