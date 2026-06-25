'use server';

// Server actions for the form builder (admin). Owner-only. Mirrors the treino
// action structure: requireAuth + requireRole, ActionResult, revalidatePath.
// Autosave model: the editor calls update*Action per change (no big batch save).

import { and, asc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { db } from '@repo/db/client';
import * as schema from '@repo/db/schema';
import { requireAuth, requireRole } from '@/server/auth';
import { slugify } from '@/components/forms/slug';
import type { ActionResult } from './leads';

const ADMIN_PATH = '/admin/formularios';

async function requireOwner() {
  const auth = await requireAuth();
  requireRole(auth, 'owner');
  return auth;
}

// ── Form CRUD ──────────────────────────────────────────────────────────────

export async function createFormAction(input: {
  titulo: string;
}): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireOwner();
  const titulo = input.titulo.trim();
  if (!titulo) return { ok: false, error: 'Título obrigatório.' };

  const slug = await uniqueSlug(slugify(titulo) || 'formulario');

  const [form] = await db
    .insert(schema.forms)
    .values({ titulo, slug, status: 'rascunho' })
    .returning({ id: schema.forms.id, slug: schema.forms.slug });

  if (!form) return { ok: false, error: 'Falha ao criar formulário.' };

  // Seed a welcome + closing screen so a new form is immediately previewable.
  await db.insert(schema.formFields).values([
    {
      formId: form.id,
      ordem: 0,
      tipo: 'boas_vindas',
      titulo: 'Que bom te ver por aqui.',
      obrigatorio: false,
    },
    {
      formId: form.id,
      ordem: 1,
      tipo: 'encerramento',
      titulo: 'Tudo certo!',
      obrigatorio: false,
    },
  ]);

  revalidatePath(ADMIN_PATH);
  return { ok: true, data: form };
}

export async function updateFormAction(input: {
  formId: string;
  titulo?: string;
  descricao?: string | null;
  status?: schema.Form['status'];
  config?: schema.FormConfig;
}): Promise<ActionResult> {
  await requireOwner();

  const patch: Partial<schema.NewForm> = { updatedAt: new Date() };
  if (input.titulo !== undefined) {
    const t = input.titulo.trim();
    if (!t) return { ok: false, error: 'Título não pode ficar vazio.' };
    patch.titulo = t;
  }
  if (input.descricao !== undefined) patch.descricao = input.descricao;
  if (input.status !== undefined) patch.status = input.status;
  if (input.config !== undefined) patch.config = input.config;

  await db.update(schema.forms).set(patch).where(eq(schema.forms.id, input.formId));

  revalidatePath(ADMIN_PATH);
  revalidatePath(`${ADMIN_PATH}/${input.formId}`);
  return { ok: true };
}

export async function deleteFormAction(input: { formId: string }): Promise<ActionResult> {
  await requireOwner();
  // Hard delete: form_fields cascade; form_responses are kept (leadId set null)
  // — but responses FK to forms is cascade, so they go too. The lead stays.
  await db.delete(schema.forms).where(eq(schema.forms.id, input.formId));
  revalidatePath(ADMIN_PATH);
  return { ok: true };
}

export async function duplicateFormAction(input: {
  formId: string;
}): Promise<ActionResult<{ id: string; slug: string }>> {
  await requireOwner();

  const [src] = await db
    .select()
    .from(schema.forms)
    .where(eq(schema.forms.id, input.formId))
    .limit(1);
  if (!src) return { ok: false, error: 'Formulário não encontrado.' };

  const slug = await uniqueSlug(`${src.slug}-copia`);
  const [copy] = await db
    .insert(schema.forms)
    .values({
      titulo: `${src.titulo} (cópia)`,
      descricao: src.descricao,
      slug,
      status: 'rascunho',
      config: src.config,
    })
    .returning({ id: schema.forms.id, slug: schema.forms.slug });
  if (!copy) return { ok: false, error: 'Falha ao duplicar.' };

  const fields = await db
    .select()
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, src.id))
    .orderBy(asc(schema.formFields.ordem));

  if (fields.length > 0) {
    await db.insert(schema.formFields).values(
      fields.map((f) => ({
        formId: copy.id,
        ordem: f.ordem,
        tipo: f.tipo,
        titulo: f.titulo,
        subtitulo: f.subtitulo,
        placeholder: f.placeholder,
        obrigatorio: f.obrigatorio,
        config: f.config,
        leadMapping: f.leadMapping,
        leadEnumMap: f.leadEnumMap,
      })),
    );
  }

  revalidatePath(ADMIN_PATH);
  return { ok: true, data: copy };
}

// ── Field CRUD ───────────────────────────────────────────────────────────────

export async function addFieldAction(input: {
  formId: string;
  tipo: schema.FormField['tipo'];
}): Promise<ActionResult<{ id: string }>> {
  await requireOwner();

  // New field goes just before the closing screen (or at the end).
  const fields = await db
    .select({ id: schema.formFields.id, ordem: schema.formFields.ordem, tipo: schema.formFields.tipo })
    .from(schema.formFields)
    .where(eq(schema.formFields.formId, input.formId))
    .orderBy(asc(schema.formFields.ordem));

  const closing = fields.find((f) => f.tipo === 'encerramento');
  const insertOrdem = closing ? closing.ordem : fields.length;

  // Shift the closing (and anything after) down by 1.
  if (closing) {
    await db
      .update(schema.formFields)
      .set({ ordem: sql`${schema.formFields.ordem} + 1` })
      .where(
        and(
          eq(schema.formFields.formId, input.formId),
          sql`${schema.formFields.ordem} >= ${insertOrdem}`,
        ),
      );
  }

  const [field] = await db
    .insert(schema.formFields)
    .values({
      formId: input.formId,
      ordem: insertOrdem,
      tipo: input.tipo,
      titulo: defaultTitleFor(input.tipo),
      obrigatorio: input.tipo !== 'boas_vindas' && input.tipo !== 'encerramento',
      config: input.tipo === 'select' || input.tipo === 'multi_select' ? { opcoes: ['Opção 1', 'Opção 2'] } : null,
    })
    .returning({ id: schema.formFields.id });

  if (!field) return { ok: false, error: 'Falha ao adicionar campo.' };

  revalidatePath(`${ADMIN_PATH}/${input.formId}`);
  return { ok: true, data: field };
}

export async function updateFieldAction(input: {
  fieldId: string;
  formId: string;
  patch: {
    tipo?: schema.FormField['tipo'];
    titulo?: string;
    subtitulo?: string | null;
    placeholder?: string | null;
    obrigatorio?: boolean;
    config?: schema.FormFieldConfig | null;
    leadMapping?: schema.LeadMappingTarget | null;
    leadEnumMap?: Record<string, string> | null;
  };
}): Promise<ActionResult> {
  await requireOwner();

  await db
    .update(schema.formFields)
    .set({ ...input.patch, updatedAt: new Date() })
    .where(eq(schema.formFields.id, input.fieldId));

  revalidatePath(`${ADMIN_PATH}/${input.formId}`);
  return { ok: true };
}

export async function deleteFieldAction(input: {
  fieldId: string;
  formId: string;
}): Promise<ActionResult> {
  await requireOwner();
  await db.delete(schema.formFields).where(eq(schema.formFields.id, input.fieldId));
  revalidatePath(`${ADMIN_PATH}/${input.formId}`);
  return { ok: true };
}

export async function reorderFieldsAction(input: {
  formId: string;
  orderedIds: string[];
}): Promise<ActionResult> {
  await requireOwner();

  // Persist new order by array index. Done sequentially in a small loop.
  for (let i = 0; i < input.orderedIds.length; i++) {
    await db
      .update(schema.formFields)
      .set({ ordem: i })
      .where(
        and(
          eq(schema.formFields.id, input.orderedIds[i]!),
          eq(schema.formFields.formId, input.formId),
        ),
      );
  }

  revalidatePath(`${ADMIN_PATH}/${input.formId}`);
  return { ok: true };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function uniqueSlug(base: string): Promise<string> {
  let candidate = base || 'formulario';
  let n = 1;
  // Loop until a free slug is found (bounded; slugs are few).
  while (true) {
    const [hit] = await db
      .select({ id: schema.forms.id })
      .from(schema.forms)
      .where(eq(schema.forms.slug, candidate))
      .limit(1);
    if (!hit) return candidate;
    n += 1;
    candidate = `${base}-${n}`;
  }
}

function defaultTitleFor(tipo: schema.FormField['tipo']): string {
  switch (tipo) {
    case 'boas_vindas':
      return 'Que bom te ver por aqui.';
    case 'encerramento':
      return 'Tudo certo!';
    default:
      return 'Nova pergunta';
  }
}
