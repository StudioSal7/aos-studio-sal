'use client';

// One-question-at-a-time state machine. Ported from ba-hub forms, adapted to
// FormFieldView. State: idle → active → transitioning → submitting → completed.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormFieldView } from './types';
import { validateField } from './validation';

export type TypeformState = 'idle' | 'active' | 'transitioning' | 'submitting' | 'completed';
export type Direction = 'next' | 'prev';

interface UseTypeformReturn {
  currentIndex: number;
  answers: Record<string, unknown>;
  state: TypeformState;
  direction: Direction;
  error: string | null;
  progress: number;
  setAnswer: (fieldId: string, value: unknown) => void;
  next: () => boolean;
  prev: () => void;
  submit: () => void;
  startedAt: string;
}

export function useTypeform(
  fields: FormFieldView[],
  onSubmit: (answers: Record<string, unknown>, startedAt: string) => Promise<void>,
): UseTypeformReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const answersRef = useRef<Record<string, unknown>>({});
  const [state, setState] = useState<TypeformState>('idle');
  const [direction, setDirection] = useState<Direction>('next');
  const [error, setError] = useState<string | null>(null);
  const startedAtRef = useRef<string>('');
  if (startedAtRef.current === '') {
    startedAtRef.current = new Date().toISOString();
  }

  const inputFields = fields.filter(
    (f) => f.tipo !== 'boas_vindas' && f.tipo !== 'encerramento',
  );
  const totalInputs = inputFields.length;
  const answeredCount = inputFields.filter(
    (f) => answers[f.id] !== undefined && answers[f.id] !== '',
  ).length;
  const progress = totalInputs > 0 ? (answeredCount / totalInputs) * 100 : 0;

  useEffect(() => {
    setError(null);
  }, [currentIndex]);

  const setAnswer = useCallback((fieldId: string, value: unknown) => {
    setAnswers((prev) => {
      const updated = { ...prev, [fieldId]: value };
      answersRef.current = updated;
      return updated;
    });
    setError(null);
  }, []);

  const submit = useCallback(async () => {
    setState('submitting');
    try {
      await onSubmit(answersRef.current, startedAtRef.current);
      setState('completed');
    } catch {
      setState('active');
    }
  }, [onSubmit]);

  const next = useCallback((): boolean => {
    const currentField = fields[currentIndex];
    if (!currentField) return false;

    if (currentField.tipo !== 'boas_vindas' && currentField.tipo !== 'encerramento') {
      const validationError = validateField(currentField, answersRef.current[currentField.id]);
      if (validationError) {
        setError(validationError);
        return false;
      }
    }

    if (currentIndex < fields.length - 1) {
      setError(null);
      setDirection('next');
      setState('transitioning');
      setTimeout(() => {
        setCurrentIndex((i) => i + 1);
        setState('active');
      }, 180);
      return true;
    }

    // Last field with no closing screen → submit directly.
    submit();
    return true;
  }, [currentIndex, fields, submit]);

  const prev = useCallback(() => {
    if (currentIndex > 0) {
      setError(null);
      setDirection('prev');
      setState('transitioning');
      setTimeout(() => {
        setCurrentIndex((i) => i - 1);
        setState('active');
      }, 180);
    }
  }, [currentIndex]);

  return {
    currentIndex,
    answers,
    state,
    direction,
    error,
    progress,
    setAnswer,
    next,
    prev,
    submit,
    startedAt: startedAtRef.current,
  };
}
