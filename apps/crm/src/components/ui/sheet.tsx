'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type ReactNode,
} from 'react';
import { cn } from '@repo/ui';

const Sheet = DialogPrimitive.Root;
const SheetTrigger = DialogPrimitive.Trigger;
const SheetClose = DialogPrimitive.Close;
const SheetPortal = DialogPrimitive.Portal;

const SheetOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-40 bg-ink/10 backdrop-blur-[1px]',
      'transition-opacity duration-200',
      'data-[state=closed]:opacity-0 data-[state=open]:opacity-100',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = 'SheetOverlay';

type SheetContentProps = ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  side?: 'right' | 'left';
  width?: 'sm' | 'md' | 'lg';
  showClose?: boolean;
};

const widthClasses: Record<NonNullable<SheetContentProps['width']>, string> = {
  sm: 'w-full sm:max-w-md',
  md: 'w-full sm:max-w-lg',
  lg: 'w-full sm:max-w-xl',
};

const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(({ className, children, side = 'right', width = 'md', showClose = true, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed top-0 z-50 flex h-full flex-col border-line bg-paper shadow-xl outline-none',
        widthClasses[width],
        'transition-transform duration-200 ease-out',
        side === 'right' && [
          'right-0 border-l',
          'data-[state=closed]:translate-x-full data-[state=open]:translate-x-0',
        ],
        side === 'left' && [
          'left-0 border-r',
          'data-[state=closed]:-translate-x-full data-[state=open]:translate-x-0',
        ],
        className,
      )}
      {...props}
    >
      {children}
      {showClose && (
        <DialogPrimitive.Close
          className="absolute right-4 top-4 inline-flex h-7 w-7 items-center justify-center text-ink-muted transition-colors hover:bg-canvas hover:text-ink focus-visible:outline-none"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" aria-hidden />
        </DialogPrimitive.Close>
      )}
    </DialogPrimitive.Content>
  </SheetPortal>
));
SheetContent.displayName = 'SheetContent';

function SheetHeader({ className, ...props }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-1 border-b border-line bg-paper px-6 py-5',
        className,
      )}
      {...props}
    />
  );
}

function SheetBody({ className, ...props }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex-1 overflow-y-auto px-6 py-5', className)} {...props} />;
}

function SheetFooter({ className, ...props }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={cn(
        'flex items-center justify-end gap-3 border-t border-line bg-paper px-6 py-4',
        className,
      )}
      {...props}
    />
  );
}

const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-h3 text-ink', className)}
    {...props}
  />
));
SheetTitle.displayName = 'SheetTitle';

const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-body text-ink-muted', className)}
    {...props}
  />
));
SheetDescription.displayName = 'SheetDescription';

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
};
