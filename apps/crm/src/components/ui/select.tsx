import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        'block w-full border border-line bg-paper px-4 py-3 text-body text-ink focus:border-ink focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Select.displayName = 'Select';
