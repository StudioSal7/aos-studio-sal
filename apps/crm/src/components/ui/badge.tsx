import type { HTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type Variant = 'neutral' | 'hot' | 'review' | 'archive' | 'fake' | 'won' | 'lost';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: Variant;
};

const variants: Record<Variant, string> = {
  neutral: 'border-line bg-canvas text-ink-muted',
  hot: 'border-wood bg-canvas text-wood',
  review: 'border-ink bg-canvas text-ink',
  archive: 'border-line bg-canvas text-ink-muted',
  fake: 'border-clay bg-canvas text-clay',
  won: 'border-leaf bg-canvas text-leaf',
  lost: 'border-line bg-canvas text-ink-muted',
};

export function Badge({
  variant = 'neutral',
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center border px-2 py-0.5 text-micro',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
