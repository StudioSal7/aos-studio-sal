// Per-field validation for the runtime. Ported from ba-hub forms; pure.
// boas_vindas/encerramento are screens (no input) → never invalid.

import type { FormFieldView } from './types';

export function validateField(field: FormFieldView, value: unknown): string | null {
  if (field.tipo === 'boas_vindas' || field.tipo === 'encerramento') {
    return null;
  }

  if (field.obrigatorio) {
    if (value === undefined || value === null || value === '') {
      return 'Este campo é obrigatório';
    }
    if (Array.isArray(value) && value.length === 0) {
      return 'Selecione pelo menos uma opção';
    }
  }

  if (!value && !field.obrigatorio) return null;

  const strValue = String(value);

  switch (field.tipo) {
    case 'email': {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(strValue)) return 'Email inválido';
      break;
    }
    case 'telefone': {
      const digits = strValue.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) return 'Telefone inválido';
      break;
    }
    case 'url': {
      try {
        new URL(strValue);
      } catch {
        return 'URL inválida';
      }
      break;
    }
    case 'numero': {
      if (Number.isNaN(Number(strValue))) return 'Número inválido';
      break;
    }
  }

  return null;
}

export function formatPhone(value: string): string {
  const digits = value.replace(/\D/g, '');
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}
