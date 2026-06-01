import { cn } from '@repo/ui';

const SYMBOL_MAP: Record<string, string> = {
  cmd: '⌘',
  meta: '⌘',
  ctrl: '⌃',
  shift: '⇧',
  alt: '⌥',
  option: '⌥',
  enter: '↵',
  return: '↵',
  esc: 'esc',
  escape: 'esc',
  tab: '⇥',
  backspace: '⌫',
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

export function KbdHint({
  keys,
  className,
}: {
  keys: string[];
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex items-center gap-0.5 text-micro normal-case tracking-normal text-ink-muted',
        className,
      )}
    >
      {keys.map((k, i) => (
        <kbd
          key={i}
          className="inline-block min-w-[1.25rem] border border-line bg-canvas px-1 py-0.5 text-center text-[10px] leading-none"
        >
          {SYMBOL_MAP[k.toLowerCase()] ?? k.toUpperCase()}
        </kbd>
      ))}
    </span>
  );
}
