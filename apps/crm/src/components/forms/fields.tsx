'use client';

// The 13 field components for the public runtime, themed to Studio Sal tokens
// (canvas/paper/ink/wood/leaf/clay, Gowun serif via text-h3, zero radius except
// rounded-full for dots/check). Rewritten from ba-hub's field set — same
// interactions (A/B/C + number keys on select, S/N on yes-no, auto-advance on
// single-choice), our look. No framer-motion.

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { formatPhone } from './validation';
import type { FieldProps } from './types';

// Shared bits ---------------------------------------------------------------

function Prompt({ field }: { field: FieldProps['field'] }) {
  return (
    <>
      <h2 className="text-h3 text-ink">
        {field.titulo}
        {field.obrigatorio && <span className="ml-1 text-wood">*</span>}
      </h2>
      {field.subtitulo && <p className="mt-2 text-body text-ink-muted">{field.subtitulo}</p>}
    </>
  );
}

const lineInput =
  'mt-6 w-full border-b border-line bg-transparent pb-2 text-2xl text-ink placeholder:text-ink-muted/60 focus:border-ink focus:outline-none';

const optionBtn =
  'flex w-full cursor-pointer items-center gap-3 border px-5 py-4 text-left text-lg transition-colors';

function optionBadge(active: boolean) {
  return `flex h-7 w-7 shrink-0 items-center justify-center text-xs font-bold transition-colors ${
    active ? 'bg-ink text-paper' : 'bg-paper text-ink-muted'
  }`;
}

// Text-like -----------------------------------------------------------------

function TextShortField({ field, value, onChange, onSubmit, autoFocus }: FieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  const isPhone = field.tipo === 'telefone';
  const isNum = field.tipo === 'numero';
  return (
    <div className="w-full">
      <Prompt field={field} />
      <input
        ref={ref}
        type={field.tipo === 'email' ? 'email' : 'text'}
        inputMode={isPhone || isNum ? 'numeric' : undefined}
        value={value == null ? '' : String(value)}
        placeholder={field.placeholder ?? ''}
        onChange={(e) => onChange(isPhone ? formatPhone(e.target.value) : e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={lineInput}
      />
    </div>
  );
}

function TextLongField({ field, value, onChange, onSubmit, autoFocus }: FieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [autoFocus]);
  return (
    <div className="w-full">
      <Prompt field={field} />
      <textarea
        ref={ref}
        value={value == null ? '' : String(value)}
        placeholder={field.placeholder ?? ''}
        rows={3}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            onSubmit();
          }
        }}
        className={`${lineInput} resize-none`}
      />
    </div>
  );
}

function DateField({ field, value, onChange, onSubmit, autoFocus }: FieldProps) {
  return (
    <div className="w-full">
      <Prompt field={field} />
      <input
        type="date"
        value={(value as string) ?? ''}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onSubmit();
        }}
        className={lineInput}
      />
    </div>
  );
}

// Choice --------------------------------------------------------------------

function SelectField({ field, value, onChange, onSubmit }: FieldProps) {
  const options = field.config?.opcoes ?? [];
  const selected = value as string | undefined;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= options.length) {
        const opt = options[n - 1]!;
        onChange(opt);
        setTimeout(onSubmit, 180);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [options, onChange, onSubmit]);

  return (
    <div className="w-full">
      <Prompt field={field} />
      <div className="mt-6 flex flex-col gap-3">
        {options.map((opt, i) => {
          const active = selected === opt;
          return (
            <button
              key={opt}
              type="button"
              onClick={() => {
                onChange(opt);
                setTimeout(onSubmit, 180);
              }}
              className={`${optionBtn} ${active ? 'border-ink bg-paper' : 'border-line hover:bg-paper'}`}
            >
              <span className={optionBadge(active)}>{String.fromCharCode(65 + i)}</span>
              <span className="text-ink">{opt}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-muted">Pressione uma letra ou clique para selecionar</p>
    </div>
  );
}

function MultiSelectField({ field, value, onChange }: FieldProps) {
  const options = field.config?.opcoes ?? [];
  const selected = (value as string[]) ?? [];
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div className="w-full">
      <Prompt field={field} />
      <div className="mt-6 flex flex-col gap-3">
        {options.map((opt, i) => {
          const active = selected.includes(opt);
          return (
            <button
              key={opt}
              type="button"
              onClick={() => toggle(opt)}
              className={`${optionBtn} ${active ? 'border-ink bg-paper' : 'border-line hover:bg-paper'}`}
            >
              <span className={optionBadge(active)}>
                {active ? '✓' : String.fromCharCode(65 + i)}
              </span>
              <span className="text-ink">{opt}</span>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-ink-muted">Selecione uma ou mais opções</p>
    </div>
  );
}

function ScaleField({ field, value, onChange, onSubmit }: FieldProps) {
  const min = field.config?.min ?? 1;
  const max = field.config?.max ?? 10;
  const labelMin = field.config?.labelMin ?? '';
  const labelMax = field.config?.labelMax ?? '';
  const selected = value as number | undefined;
  const numbers = Array.from({ length: Math.max(0, max - min + 1) }, (_, i) => min + i);

  return (
    <div className="w-full">
      <Prompt field={field} />
      <div className="mt-8 flex flex-wrap gap-2">
        {numbers.map((n) => {
          const active = selected === n;
          return (
            <button
              key={n}
              type="button"
              onClick={() => {
                onChange(n);
                setTimeout(onSubmit, 220);
              }}
              className={`flex h-11 w-11 shrink-0 items-center justify-center border text-sm font-semibold transition-colors ${
                active ? 'border-ink bg-ink text-paper' : 'border-line text-ink-muted hover:bg-paper'
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      {(labelMin || labelMax) && (
        <div className="mt-3 flex justify-between text-xs text-ink-muted">
          <span>{labelMin}</span>
          <span>{labelMax}</span>
        </div>
      )}
    </div>
  );
}

function YesNoField({ field, value, onChange, onSubmit }: FieldProps) {
  const selected = value as boolean | undefined;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const k = e.key.toLowerCase();
      if (k === 's' || k === 'y') {
        onChange(true);
        setTimeout(onSubmit, 180);
      } else if (k === 'n') {
        onChange(false);
        setTimeout(onSubmit, 180);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onChange, onSubmit]);

  return (
    <div className="w-full">
      <Prompt field={field} />
      <div className="mt-8 flex gap-4">
        {[
          { label: 'Sim', val: true, key: 'S' },
          { label: 'Não', val: false, key: 'N' },
        ].map(({ label, val, key }) => {
          const active = selected === val;
          return (
            <button
              key={label}
              type="button"
              onClick={() => {
                onChange(val);
                setTimeout(onSubmit, 180);
              }}
              className={`flex flex-1 cursor-pointer flex-col items-center gap-2 border px-8 py-6 text-xl transition-colors ${
                active ? 'border-ink bg-paper text-ink' : 'border-line text-ink hover:bg-paper'
              }`}
            >
              {label}
              <span className="text-xs text-ink-muted">pressione {key}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Screens -------------------------------------------------------------------

function WelcomeField({ field, onSubmit }: FieldProps) {
  const buttonText = field.config?.botaoTexto ?? 'começar';
  return (
    <div className="flex flex-col items-start text-left">
      <h1 className="text-display text-ink">{field.titulo}</h1>
      {field.subtitulo && <p className="mt-4 max-w-lg text-body text-ink-muted whitespace-pre-line">{field.subtitulo}</p>}
      <button
        type="button"
        onClick={onSubmit}
        className="text-btn mt-9 bg-wood px-8 py-3.5 text-white transition-colors hover:bg-wood-hover"
      >
        {buttonText} →
      </button>
    </div>
  );
}

function ClosingField({ field }: FieldProps) {
  return (
    <div className="flex flex-col items-start">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-leaf/15">
        <Check className="h-7 w-7 text-leaf" />
      </div>
      <h1 className="text-display text-ink">{field.titulo}</h1>
      {field.subtitulo && <p className="mt-4 max-w-lg text-body text-ink-muted">{field.subtitulo}</p>}
    </div>
  );
}

// Dispatcher ----------------------------------------------------------------

const FIELD_COMPONENTS: Record<string, React.ComponentType<FieldProps>> = {
  boas_vindas: WelcomeField,
  texto_curto: TextShortField,
  texto_longo: TextLongField,
  email: TextShortField,
  telefone: TextShortField,
  url: TextShortField,
  numero: TextShortField,
  data: DateField,
  select: SelectField,
  multi_select: MultiSelectField,
  escala: ScaleField,
  sim_nao: YesNoField,
  encerramento: ClosingField,
};

export function FieldComponent(props: FieldProps) {
  const Comp = FIELD_COMPONENTS[props.field.tipo];
  if (!Comp) return null;
  return <Comp {...props} />;
}

// Which field types show the standalone "ok" button (text-like; the others
// auto-advance on selection or are screens).
export function fieldUsesOkButton(tipo: FieldProps['field']['tipo']): boolean {
  return (
    tipo === 'texto_curto' ||
    tipo === 'texto_longo' ||
    tipo === 'email' ||
    tipo === 'telefone' ||
    tipo === 'url' ||
    tipo === 'numero' ||
    tipo === 'data' ||
    tipo === 'multi_select'
  );
}
