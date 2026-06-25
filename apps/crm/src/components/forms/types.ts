// Client-side form types for the runtime + builder. Aligned to the Drizzle row
// shapes in @repo/db (forms / form_fields), but kept self-contained so client
// components don't import server-only modules.

import type {
  FormConfig,
  FormFieldConfig,
  LeadMappingTarget,
} from '@repo/db/schema';

export type {
  FormConfig,
  FormFieldConfig,
  LeadMappingTarget,
} from '@repo/db/schema';

// The 13 field types (matches formFieldTypeEnum).
export type FieldType =
  | 'boas_vindas'
  | 'texto_curto'
  | 'texto_longo'
  | 'email'
  | 'telefone'
  | 'url'
  | 'numero'
  | 'data'
  | 'select'
  | 'multi_select'
  | 'escala'
  | 'sim_nao'
  | 'encerramento';

export type FormStatus = 'rascunho' | 'ativo' | 'pausado' | 'encerrado';

export const FIELD_TYPE_LABELS: Record<FieldType, string> = {
  boas_vindas: 'Boas-vindas',
  texto_curto: 'Texto curto',
  texto_longo: 'Texto longo',
  email: 'Email',
  telefone: 'Telefone',
  url: 'URL',
  numero: 'Número',
  data: 'Data',
  select: 'Seleção única',
  multi_select: 'Seleção múltipla',
  escala: 'Escala (1-10)',
  sim_nao: 'Sim / Não',
  encerramento: 'Encerramento',
};

// Plain (serializable) field shape passed from the Server Component to the
// runtime. Mirrors the DB row but without Date objects.
export interface FormFieldView {
  id: string;
  ordem: number;
  tipo: FieldType;
  titulo: string;
  subtitulo: string | null;
  placeholder: string | null;
  obrigatorio: boolean;
  config: FormFieldConfig | null;
  leadMapping: LeadMappingTarget | null;
  leadEnumMap: Record<string, string> | null;
}

export interface FormView {
  id: string;
  titulo: string;
  descricao: string | null;
  slug: string;
  status: FormStatus;
  config: FormConfig | null;
  fields: FormFieldView[];
}

// Props every field component receives in the runtime.
export interface FieldProps {
  field: FormFieldView;
  value: unknown;
  onChange: (value: unknown) => void;
  onSubmit: () => void;
  autoFocus: boolean;
}
