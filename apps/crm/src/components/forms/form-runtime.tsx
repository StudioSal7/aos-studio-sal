'use client';

// Public-facing form runtime (Studio Sal themed). One question at a time, CSS
// slide transition (no framer-motion), keyboard-friendly. Submits to
// /api/forms/submit. All 13 field types via FieldComponent (./fields).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTypeform } from './use-typeform';
import { FieldComponent, fieldUsesOkButton } from './fields';
import type { FormView } from './types';

interface FormRuntimeProps {
  form: FormView;
  /** UTM captured from the page query string (when form.config.coletarUtm). */
  utm?: Record<string, string | null>;
}

export function FormRuntime({ form, utm }: FormRuntimeProps) {
  const fields = form.fields;

  const onSubmit = useCallback(
    async (answers: Record<string, unknown>, startedAt: string) => {
      const res = await fetch('/api/forms/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          formId: form.id,
          answers,
          startedAt,
          metadata: {
            utmSource: utm?.utm_source ?? null,
            utmMedium: utm?.utm_medium ?? null,
            utmCampaign: utm?.utm_campaign ?? null,
            utmTerm: utm?.utm_term ?? null,
            utmContent: utm?.utm_content ?? null,
            referrer: typeof document !== 'undefined' ? document.referrer || null : null,
          },
        }),
      });
      if (!res.ok) throw new Error('submit_failed');
      const data = (await res.json()) as { redirecionarUrl?: string | null };
      if (data.redirecionarUrl) {
        window.location.href = data.redirecionarUrl;
      }
    },
    [form.id, utm],
  );

  const { currentIndex, answers, state, direction, error, progress, setAnswer, next, prev, submit } =
    useTypeform(fields, onSubmit);

  const bgImage = form.config?.backgroundImage ?? null;

  const currentField = fields[currentIndex];
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === fields.length - 1;
  const isClosing = currentField?.tipo === 'encerramento';
  const isWelcome = currentField?.tipo === 'boas_vindas';
  const lastFieldIsClosing = fields[fields.length - 1]?.tipo === 'encerramento';

  // Envio na tela de encerramento. A tela "recebemos sua aplicação" promete que
  // o envio aconteceu — então disparamos automaticamente ao chegar nela, em vez
  // de exigir um Enter invisível (causa raiz do bug: leads não eram criados).
  const [closeError, setCloseError] = useState(false);
  const closeSubmittedRef = useRef(false);

  const runCloseSubmit = useCallback(async () => {
    setCloseError(false);
    const ok = await submit();
    if (!ok) setCloseError(true);
  }, [submit]);

  useEffect(() => {
    if (!isClosing) return;
    if (closeSubmittedRef.current) return; // só tenta uma vez automaticamente
    if (state !== 'active') return; // aguarda a transição terminar
    closeSubmittedRef.current = true;
    void runCloseSubmit();
  }, [isClosing, state, runCloseSubmit]);

  // Enter advances for text-like fields (single-choice auto-advances on click/
  // key; textarea needs Cmd/Ctrl+Enter, handled in the field itself).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (state !== 'active' && state !== 'idle') return;
      const target = e.target as HTMLElement | null;
      if (target?.tagName === 'TEXTAREA') return;
      if (e.key === 'Enter') {
        // Let the focused input's own onKeyDown handle Enter; only handle the
        // welcome screen here (closing auto-submits via the effect above).
        if (isWelcome) {
          e.preventDefault();
          next();
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state, isWelcome, next]);

  // Tela genérica de conclusão só para forms SEM campo de encerramento próprio.
  if (state === 'completed' && !lastFieldIsClosing) {
    return (
      <CompletedScreen
        mensagem={form.config?.mensagemFinal ?? null}
        bgImage={bgImage ?? null}
      />
    );
  }

  if (!currentField) return null;

  const currentValue = answers[currentField.id];
  const hasValue =
    currentValue !== undefined &&
    currentValue !== null &&
    currentValue !== '' &&
    !(Array.isArray(currentValue) && currentValue.length === 0);

  const showOk = fieldUsesOkButton(currentField.tipo);

  const transitionClass =
    state === 'transitioning'
      ? direction === 'next'
        ? '-translate-y-6 opacity-0'
        : 'translate-y-6 opacity-0'
      : 'translate-y-0 opacity-100';

  return (
    <div
      className={`relative flex min-h-screen flex-col justify-center overflow-hidden text-ink${bgImage ? ' form-on-photo' : ' bg-canvas'}`}
      style={
        bgImage
          ? {
              backgroundImage: `url(${bgImage})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : undefined
      }
    >
      {/* Overlay escuro sobre a imagem de fundo */}
      {bgImage && <div className="pointer-events-none fixed inset-0 z-0 bg-black/45" />}

      {/* Progress bar */}
      <div className="fixed left-0 top-0 z-50 h-0.5 w-full bg-line/40">
        <div
          className="h-full bg-wood transition-[width] duration-300 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="relative z-10 w-full px-[8vw] sm:px-[10vw]">
        <div
          key={currentField.id}
          className={`flex min-h-[60vh] max-w-xl items-center transition-all duration-200 ease-out ${transitionClass}`}
        >
          {isClosing ? (
            closeError ? (
              <ClosingError onRetry={runCloseSubmit} />
            ) : state === 'completed' ? (
              <FieldComponent
                field={currentField}
                value={currentValue}
                onChange={() => {}}
                onSubmit={() => {}}
                autoFocus={false}
              />
            ) : (
              <ClosingSending />
            )
          ) : (
            <FieldComponent
              field={currentField}
              value={currentValue}
              onChange={(val) => setAnswer(currentField.id, val)}
              onSubmit={() => next()}
              autoFocus
            />
          )}
        </div>

        {error && <p className="mt-4 max-w-xl text-sm text-clay">{error}</p>}

        {showOk && (
          <div className="mt-7 flex max-w-xl items-center gap-3">
            <button
              type="button"
              onClick={() => hasValue && next()}
              disabled={!hasValue}
              className="text-btn bg-wood px-6 py-3 text-white transition-colors hover:bg-wood-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              ok ✓
            </button>
            <span className="text-xs text-ink-muted">
              pressione{' '}
              <kbd className="border border-line bg-paper px-1.5 py-0.5 text-[10px]">{' '}Enter{' '}</kbd> ↵
            </span>
          </div>
        )}
      </div>

      {/* Prev/next nav (hidden on welcome/closing) */}
      {!isWelcome && !isClosing && (
        <div className="fixed bottom-8 right-8 z-50 flex gap-2">
          <button
            type="button"
            onClick={prev}
            disabled={isFirst}
            aria-label="Anterior"
            className="flex h-10 w-10 items-center justify-center border border-line bg-paper text-ink transition-colors hover:bg-canvas disabled:opacity-30"
          >
            ↑
          </button>
          <button
            type="button"
            onClick={() => (isLast ? submit() : next())}
            aria-label="Próximo"
            className="flex h-10 w-10 items-center justify-center border border-line bg-paper text-ink transition-colors hover:bg-canvas"
          >
            ↓
          </button>
        </div>
      )}
    </div>
  );
}

function ClosingSending() {
  return (
    <div className="flex flex-col items-start">
      <h1 className="text-form-title text-ink">enviando…</h1>
      <p className="mt-4 max-w-lg text-body text-ink-muted">
        Estamos registrando sua aplicação. Um instante.
      </p>
    </div>
  );
}

function ClosingError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-start">
      <h1 className="text-form-title text-ink">algo deu errado.</h1>
      <p className="mt-4 max-w-lg text-body text-ink-muted">
        Não conseguimos registrar sua aplicação agora. Toque abaixo para tentar de novo.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="text-btn mt-9 bg-wood px-8 py-3.5 text-white transition-colors hover:bg-wood-hover"
      >
        tentar novamente →
      </button>
    </div>
  );
}

function CompletedScreen({ mensagem, bgImage }: { mensagem: string | null; bgImage: string | null }) {
  return (
    <div
      className={`flex min-h-screen flex-col items-center justify-center px-[10vw] text-center text-ink${bgImage ? ' form-on-photo' : ' bg-canvas'}`}
      style={
        bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
          : undefined
      }
    >
      {bgImage && <div className="pointer-events-none fixed inset-0 z-0 bg-black/45" />}
      <div className="relative z-10">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-leaf/15 mx-auto">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="text-h2 text-ink">recebido.</h2>
        <p className="mt-3 max-w-md text-body text-ink-muted">
          {mensagem ?? 'Obrigada por preencher. Em breve entraremos em contato.'}
        </p>
      </div>
    </div>
  );
}
