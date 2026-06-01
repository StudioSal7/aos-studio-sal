import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@repo/ui';

type CardProps = HTMLAttributes<HTMLDivElement>;

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('border border-line bg-paper p-6', className)}
      {...props}
    />
  ),
);

Card.displayName = 'Card';
