import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'block w-full border border-line bg-paper px-4 py-3 text-body text-ink placeholder:text-ink-muted focus:border-ink focus:outline-none disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);

Textarea.displayName = 'Textarea';
