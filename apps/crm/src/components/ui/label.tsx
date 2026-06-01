import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn('block text-micro text-ink-muted', className)}
      {...props}
    />
  ),
);

Label.displayName = 'Label';
