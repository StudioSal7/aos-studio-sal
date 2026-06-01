import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type Variant = 'outline' | 'solid' | 'ghost';
type Size = 'md' | 'sm';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

const base =
  'inline-flex items-center justify-center text-btn transition-colors duration-300 disabled:cursor-not-allowed disabled:opacity-50';

const variants: Record<Variant, string> = {
  outline:
    'border border-ink bg-transparent text-ink hover:bg-ink hover:text-paper',
  solid: 'bg-ink text-paper hover:bg-ink-hover',
  ghost: 'text-ink underline-offset-4 hover:underline',
};

const sizes: Record<Size, string> = {
  md: 'px-8 py-4',
  sm: 'px-4 py-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'outline', size = 'md', className, type, ...props }, ref) => (
    <button
      ref={ref}
      type={type ?? 'button'}
      className={cn(
        base,
        variants[variant],
        variant !== 'ghost' && sizes[size],
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = 'Button';
