import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'block w-full border border-line bg-paper px-4 py-3 text-body text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Input.displayName = 'Input';
