// Read queries for forms. getActiveFormBySlug is the PUBLIC fetch (renders the
// form for end-users at /f/<slug>) — only returns 'ativo' forms, so a draft/
// paused/closed form 404s. Returns a serializable FormView (no Date objects).
// The admin queries (listForms / getFormForEdit) feed the builder pages.

import { asc, count, desc, eq } from 'drizzle-orm';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import type { FormFieldView, FormStatus, FormView } from '@/components/forms/types';

export async function getActiveFormBySlug(slug: string): Promise<FormView | null> {
  const [form] = await db
    .select({
      id: schema.forms.id,
      titulo: schema.forms.titulo,
      descricao: schema.forms.descricao,
      slug: schema.forms.slug,
      status: schema.forms.status,
      config: schema.forms.config,
    })
    .from(schema.forms)
    .where(eq(schema.forms.slug, slug))
    .limit(1);

  if (!form || form.status !== 'ativo') return null;

  const fields = await db
    .select({
      id: schema.formFields.id,
      ordem: schema.formFields.ordem,
      tipo: schema.formFields.tipo,
      titulo: schema.formFields.titulo,
      subtitulo: schema.formFields.subtitulo,
      placeholder: schema.formFields.placeholder,
      obrigatorio: schema.formFields.obrigatorio,
      config: schema.formFields.config,
      leadMapping: schema.formFields.leadMapping,
      leadEnumMap: schema.formFields.leadEnumMap,
    })
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, form.id))
    .orderBy(asc(schema.formFields.ordem));

  return {
    ...form,
    fields: fields as FormFieldView[],
  };
}

// ── Admin queries ────────────────────────────────────────────────────────────

export interface FormListItem {
  id: string;
  titulo: string;
  slug: string;
  status: FormStatus;
  responsesCount: number;
  createdAt: string;
}

export async function listForms(): Promise<FormListItem[]> {
  const rows = await db
    .select({
      id: schema.forms.id,
      titulo: schema.forms.titulo,
      slug: schema.forms.slug,
      status: schema.forms.status,
      createdAt: schema.forms.createdAt,
      responsesCount: count(schema.formResponses.id),
    })
    .from(schema.forms)
    .leftJoin(schema.formResponses, eq(schema.formResponses.formId, schema.forms.id))
    .groupBy(schema.forms.id)
    .orderBy(desc(schema.forms.createdAt));

  return rows.map((r) => ({
    id: r.id,
    titulo: r.titulo,
    slug: r.slug,
    status: r.status,
    responsesCount: Number(r.responsesCount),
    createdAt: r.createdAt.toISOString(),
  }));
}

// Full form (any status) + fields, for the editor. Returns FormView.
export async function getFormForEdit(formId: string): Promise<FormView | null> {
  const [form] = await db
    .select({
      id: schema.forms.id,
      titulo: schema.forms.titulo,
      descricao: schema.forms.descricao,
      slug: schema.forms.slug,
      status: schema.forms.status,
      config: schema.forms.config,
    })
    .from(schema.forms)
    .where(eq(schema.forms.id, formId))
    .limit(1);

  if (!form) return null;

  const fields = await db
    .select({
      id: schema.formFields.id,
      ordem: schema.formFields.ordem,
      tipo: schema.formFields.tipo,
      titulo: schema.formFields.titulo,
      subtitulo: schema.formFields.subtitulo,
      placeholder: schema.formFields.placeholder,
      obrigatorio: schema.formFields.obrigatorio,
      config: schema.formFields.config,
      leadMapping: schema.formFields.leadMapping,
      leadEnumMap: schema.formFields.leadEnumMap,
    })
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, form.id))
    .orderBy(asc(schema.formFields.ordem));

  return { ...form, fields: fields as FormFieldView[] };
}

// Responses for the admin responses page. Returns the form title, the field
// list (for column headers / answer rendering), and each response with its
// linked lead (when the intake created/matched one).
export interface FormResponseRow {
  id: string;
  leadId: string | null;
  leadName: string | null;
  dados: Record<string, unknown>;
  concluidoEm: string;
  tempoPreenchimentoSeg: number | null;
}

export interface FormResponsesView {
  form: { id: string; titulo: string; slug: string };
  fields: { id: string; titulo: string; tipo: string }[];
  responses: FormResponseRow[];
}

export async function getFormResponses(
  formId: string,
  limit = 200,
): Promise<FormResponsesView | null> {
  const [form] = await db
    .select({ id: schema.forms.id, titulo: schema.forms.titulo, slug: schema.forms.slug })
    .from(schema.forms)
    .where(eq(schema.forms.id, formId))
    .limit(1);
  if (!form) return null;

  const fields = await db
    .select({
      id: schema.formFields.id,
      titulo: schema.formFields.titulo,
      tipo: schema.formFields.tipo,
    })
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, form.id))
    .orderBy(asc(schema.formFields.ordem));

  const rows = await db
    .select({
      id: schema.formResponses.id,
      leadId: schema.formResponses.leadId,
      leadName: schema.leads.name,
      dados: schema.formResponses.dados,
      concluidoEm: schema.formResponses.concluidoEm,
      tempoPreenchimentoSeg: schema.formResponses.tempoPreenchimentoSeg,
    })
    .from(schema.formResponses)
    .leftJoin(schema.leads, eq(schema.formResponses.leadId, schema.leads.id))
    .where(eq(schema.formResponses.formId, form.id))
    .orderBy(desc(schema.formResponses.concluidoEm))
    .limit(limit);

  return {
    form,
    fields: fields.filter((f) => f.tipo !== 'boas_vindas' && f.tipo !== 'encerramento'),
    responses: rows.map((r) => ({
      id: r.id,
      leadId: r.leadId,
      leadName: r.leadName,
      dados: (r.dados ?? {}) as Record<string, unknown>,
      concluidoEm: r.concluidoEm.toISOString(),
      tempoPreenchimentoSeg: r.tempoPreenchimentoSeg,
    })),
  };
}
