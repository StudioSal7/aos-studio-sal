'use client';

// Form builder (owner). Autosave model: each edit fires the matching server
// action immediately (no batch "save all"). Field reorder via @dnd-kit persists
// on drag end. Mirrors ba-hub's field-editor-card structure, themed to Studio
// Sal, with our leadMapping + per-option leadEnumMap selectors.

import { useState, useTransition } from 'react';
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ExternalLink, GripVertical, Plus, Trash2 } from 'lucide-react';
import {
  addFieldAction,
  deleteFieldAction,
  reorderFieldsAction,
  updateFieldAction,
  updateFormAction,
} from '@/server/actions/forms';
import {
  FIELD_TYPE_LABELS,
  type FieldType,
  type FormFieldView,
  type FormView,
} from '@/components/forms/types';
import {
  LEAD_ENUM_VALUES,
  LEAD_MAPPING_OPTIONS,
  isEnumTarget,
} from '@/components/forms/lead-mapping-options';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const TYPES_WITH_PLACEHOLDER: FieldType[] = [
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'numero',
  'url',
];

const ADD_TYPES: FieldType[] = [
  'texto_curto',
  'texto_longo',
  'email',
  'telefone',
  'url',
  'numero',
  'data',
  'select',
  'multi_select',
  'escala',
  'sim_nao',
];

export function FormBuilder({ initialForm }: { initialForm: FormView }) {
  const [form, setForm] = useState(initialForm);
  const [fields, setFields] = useState<FormFieldView[]>(initialForm.fields);
  const [, startTransition] = useTransition();
  const [addType, setAddType] = useState<FieldType>('texto_curto');

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  // ── form meta ──────────────────────────────────────────────────────────
  function saveMeta(patch: { titulo?: string; descricao?: string | null }) {
    startTransition(() => {
      void updateFormAction({ formId: form.id, ...patch });
    });
  }

  function setStatus(status: FormView['status']) {
    setForm((f) => ({ ...f, status }));
    startTransition(() => {
      void updateFormAction({ formId: form.id, status });
    });
  }

  function saveConfig(patch: Partial<NonNullable<FormView['config']>>) {
    const config = { ...(form.config ?? {}), ...patch };
    setForm((f) => ({ ...f, config }));
    startTransition(() => {
      void updateFormAction({ formId: form.id, config });
    });
  }

  // ── fields ─────────────────────────────────────────────────────────────
  function patchFieldLocal(id: string, patch: Partial<FormFieldView>) {
    setFields((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  }

  function saveField(id: string, patch: Partial<FormFieldView>) {
    patchFieldLocal(id, patch);
    startTransition(() => {
      void updateFieldAction({
        fieldId: id,
        formId: form.id,
        patch: {
          tipo: patch.tipo,
          titulo: patch.titulo,
          subtitulo: patch.subtitulo,
          placeholder: patch.placeholder,
          obrigatorio: patch.obrigatorio,
          config: patch.config,
          leadMapping: patch.leadMapping,
          leadEnumMap: patch.leadEnumMap,
        },
      });
    });
  }

  function addField() {
    startTransition(async () => {
      const res = await addFieldAction({ formId: form.id, tipo: addType });
      if (res.ok && res.data) {
        // Insert before the closing screen locally.
        const newField: FormFieldView = {
          id: res.data.id,
          ordem: fields.length,
          tipo: addType,
          titulo: 'Nova pergunta',
          subtitulo: null,
          placeholder: null,
          obrigatorio: addType !== 'boas_vindas' && addType !== 'encerramento',
          config:
            addType === 'select' || addType === 'multi_select'
              ? { opcoes: ['Opção 1', 'Opção 2'] }
              : null,
          leadMapping: null,
          leadEnumMap: null,
        };
        setFields((prev) => {
          const closingIdx = prev.findIndex((f) => f.tipo === 'encerramento');
          if (closingIdx === -1) return [...prev, newField];
          const copy = [...prev];
          copy.splice(closingIdx, 0, newField);
          return copy;
        });
      }
    });
  }

  function removeField(id: string) {
    setFields((prev) => prev.filter((f) => f.id !== id));
    startTransition(() => {
      void deleteFieldAction({ fieldId: id, formId: form.id });
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = fields.findIndex((f) => f.id === active.id);
    const newIndex = fields.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const reordered = arrayMove(fields, oldIndex, newIndex);
    setFields(reordered);
    startTransition(() => {
      void reorderFieldsAction({ formId: form.id, orderedIds: reordered.map((f) => f.id) });
    });
  }

  const isActive = form.status === 'ativo';

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-8">
      {/* Header: title + status + public link */}
      <div className="flex items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <input
            defaultValue={form.titulo}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if (v && v !== form.titulo) {
                setForm((f) => ({ ...f, titulo: v }));
                saveMeta({ titulo: v });
              }
            }}
            className="w-full border-b border-transparent bg-transparent text-h2 text-ink hover:border-line focus:border-ink focus:outline-none"
          />
          <Textarea
            defaultValue={form.descricao ?? ''}
            rows={1}
            placeholder="Descrição interna (opcional)"
            onBlur={(e) => saveMeta({ descricao: e.target.value.trim() || null })}
            className="mt-2 border-0 bg-transparent px-0 py-1 text-body"
          />
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <span className="text-micro text-ink-muted">status</span>
            <Select
              value={form.status}
              onChange={(e) => setStatus(e.target.value as FormView['status'])}
              className="w-36 py-2"
            >
              <option value="rascunho">rascunho</option>
              <option value="ativo">ativo</option>
              <option value="pausado">pausado</option>
              <option value="encerrado">encerrado</option>
            </Select>
          </div>
          {isActive && (
            <a
              href={`/f/${form.slug}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-btn text-wood hover:text-wood-hover"
            >
              abrir /f/{form.slug}
              <ExternalLink size={14} />
            </a>
          )}
        </div>
      </div>

      {/* Behaviour config */}
      <div className="grid grid-cols-1 gap-4 border border-line bg-paper p-4 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-body text-ink">
          <input
            type="checkbox"
            checked={form.config?.coletarUtm ?? false}
            onChange={(e) => saveConfig({ coletarUtm: e.target.checked })}
          />
          capturar UTM da URL
        </label>
        <div>
          <label className="mb-1 block text-micro text-ink-muted">Redirect após envio (opcional)</label>
          <Input
            defaultValue={form.config?.redirecionarUrl ?? ''}
            placeholder="https://…"
            onBlur={(e) => saveConfig({ redirecionarUrl: e.target.value.trim() || null })}
            className="py-2"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-micro text-ink-muted">Mensagem final (tela de encerramento)</label>
          <Input
            defaultValue={form.config?.mensagemFinal ?? ''}
            placeholder="Recebemos sua aplicação. Em breve entraremos em contato."
            onBlur={(e) => saveConfig({ mensagemFinal: e.target.value.trim() || null })}
            className="py-2"
          />
        </div>
      </div>

      {/* Fields */}
      <div>
        <h2 className="mb-3 text-h3 text-ink">campos.</h2>
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={fields.map((f) => f.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-2">
              {fields.map((field, i) => (
                <FieldCard
                  key={field.id}
                  field={field}
                  index={i}
                  onSave={(patch) => saveField(field.id, patch)}
                  onRemove={() => removeField(field.id)}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {/* Add field */}
        <div className="mt-4 flex items-center gap-2">
          <Select
            value={addType}
            onChange={(e) => setAddType(e.target.value as FieldType)}
            className="w-48 py-2"
          >
            {ADD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
          <Button variant="outline" size="sm" onClick={addField}>
            <Plus size={16} className="mr-1.5" />
            adicionar campo
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Field card ───────────────────────────────────────────────────────────────

function FieldCard({
  field,
  index,
  onSave,
  onRemove,
}: {
  field: FormFieldView;
  index: number;
  onSave: (patch: Partial<FormFieldView>) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: field.id,
  });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const [expanded, setExpanded] = useState(false);
  const isScreen = field.tipo === 'boas_vindas' || field.tipo === 'encerramento';
  const isChoice = field.tipo === 'select' || field.tipo === 'multi_select';
  const showEnumMap = isEnumTarget(field.leadMapping) && field.tipo === 'select';

  return (
    <div ref={setNodeRef} style={style} className="border border-line bg-paper">
      {/* Row */}
      <div className="flex items-center gap-3 p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label="Arrastar campo"
          className="shrink-0 cursor-grab text-ink-muted active:cursor-grabbing"
        >
          <GripVertical size={16} />
        </button>
        <span className="shrink-0 border border-line px-2 py-0.5 text-micro normal-case tracking-normal text-ink-muted">
          {FIELD_TYPE_LABELS[field.tipo]}
        </span>
        <input
          defaultValue={field.titulo}
          onBlur={(e) => {
            const v = e.target.value.trim();
            if (v && v !== field.titulo) onSave({ titulo: v });
          }}
          placeholder="Digite a pergunta…"
          className="min-w-0 flex-1 border-b border-transparent bg-transparent text-body text-ink hover:border-line focus:border-ink focus:outline-none"
        />
        {field.leadMapping && (
          <span className="shrink-0 border border-wood px-2 py-0.5 text-micro normal-case tracking-normal text-wood">
            → {field.leadMapping}
          </span>
        )}
        <span className="shrink-0 text-xs tabular-nums text-ink-muted">#{index + 1}</span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 text-btn text-ink-muted hover:text-ink"
        >
          {expanded ? 'fechar' : 'editar'}
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remover campo"
          className="shrink-0 text-ink-muted hover:text-clay"
        >
          <Trash2 size={15} />
        </button>
      </div>

      {/* Expanded editor */}
      {expanded && (
        <div className="space-y-4 border-t border-line px-4 py-4">
          <p className="text-xs text-ink-muted">
            Dica: escreva{' '}
            <code className="border border-line bg-canvas px-1 py-0.5 text-[11px] normal-case">
              {'{nome}'}
            </code>{' '}
            no título ou subtítulo para inserir o apelido que a pessoa deu em “como você gostaria
            de ser chamada”.
          </p>
          <div>
            <label className="mb-1 block text-micro text-ink-muted">Subtítulo (opcional)</label>
            <Textarea
              rows={2}
              defaultValue={field.subtitulo ?? ''}
              placeholder="Texto de apoio abaixo da pergunta"
              onBlur={(e) => onSave({ subtitulo: e.target.value.trim() || null })}
              className="py-2"
            />
          </div>

          {TYPES_WITH_PLACEHOLDER.includes(field.tipo) && (
            <div>
              <label className="mb-1 block text-micro text-ink-muted">Placeholder</label>
              <Input
                defaultValue={field.placeholder ?? ''}
                placeholder="Ex: Digite seu nome"
                onBlur={(e) => onSave({ placeholder: e.target.value.trim() || null })}
                className="py-2"
              />
            </div>
          )}

          {!isScreen && (
            <label className="flex items-center gap-2 text-body text-ink">
              <input
                type="checkbox"
                checked={field.obrigatorio}
                onChange={(e) => onSave({ obrigatorio: e.target.checked })}
              />
              obrigatório
            </label>
          )}

          {/* Lead mapping */}
          {!isScreen && (
            <div>
              <label className="mb-1 block text-micro text-ink-muted">
                Salvar no lead (mapeamento)
              </label>
              <Select
                value={field.leadMapping ?? '__none__'}
                onChange={(e) => {
                  const val = e.target.value === '__none__' ? null : (e.target.value as NonNullable<FormFieldView['leadMapping']>);
                  // Clear enum map when leaving an enum target.
                  onSave({ leadMapping: val, leadEnumMap: val && isEnumTarget(val) ? field.leadEnumMap : null });
                }}
                className="py-2"
              >
                <option value="__none__">Não salvar (só fica na resposta)</option>
                {LEAD_MAPPING_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              {isEnumTarget(field.leadMapping) && field.tipo !== 'select' && (
                <p className="mt-1.5 text-xs text-clay">
                  Mapeamento de enum exige um campo do tipo “Seleção única”.
                </p>
              )}
            </div>
          )}

          {/* Options editor (select / multi_select) */}
          {isChoice && (
            <OptionsEditor
              field={field}
              showEnumMap={showEnumMap}
              onSave={onSave}
            />
          )}

          {/* Scale config */}
          {field.tipo === 'escala' && (
            <div className="grid grid-cols-2 gap-3">
              <NumberConfig label="Mínimo" value={field.config?.min ?? 1} onCommit={(min) => onSave({ config: { ...field.config, min } })} />
              <NumberConfig label="Máximo" value={field.config?.max ?? 10} onCommit={(max) => onSave({ config: { ...field.config, max } })} />
              <TextConfig label="Label mínimo" value={field.config?.labelMin ?? ''} placeholder="Ex: Discordo" onCommit={(labelMin) => onSave({ config: { ...field.config, labelMin } })} />
              <TextConfig label="Label máximo" value={field.config?.labelMax ?? ''} placeholder="Ex: Concordo" onCommit={(labelMax) => onSave({ config: { ...field.config, labelMax } })} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Options editor with optional per-option enum mapping (when the field maps to a
// lead enum). Each option row shows its text and, if enum, a dropdown to pick
// the exact enum literal → builds leadEnumMap deterministically.
function OptionsEditor({
  field,
  showEnumMap,
  onSave,
}: {
  field: FormFieldView;
  showEnumMap: boolean;
  onSave: (patch: Partial<FormFieldView>) => void;
}) {
  const options = field.config?.opcoes ?? [];
  const enumMap = field.leadEnumMap ?? {};
  const enumValues = field.leadMapping ? (LEAD_ENUM_VALUES[field.leadMapping] ?? []) : [];

  function setOptions(opcoes: string[], nextEnumMap?: Record<string, string>) {
    onSave({
      config: { ...field.config, opcoes },
      ...(nextEnumMap !== undefined ? { leadEnumMap: nextEnumMap } : {}),
    });
  }

  function updateOption(i: number, value: string) {
    const prev = options[i]!;
    const next = [...options];
    next[i] = value;
    // Carry the enum mapping over to the renamed key.
    let nextMap: Record<string, string> | undefined;
    if (showEnumMap && enumMap[prev] !== undefined) {
      nextMap = { ...enumMap };
      nextMap[value] = nextMap[prev]!;
      delete nextMap[prev];
    }
    setOptions(next, nextMap);
  }

  function removeOption(i: number) {
    if (options.length <= 2) return;
    const removed = options[i]!;
    const next = options.filter((_, idx) => idx !== i);
    let nextMap: Record<string, string> | undefined;
    if (showEnumMap && enumMap[removed] !== undefined) {
      nextMap = { ...enumMap };
      delete nextMap[removed];
    }
    setOptions(next, nextMap);
  }

  function addOption() {
    setOptions([...options, `Opção ${options.length + 1}`]);
  }

  function setEnumFor(option: string, enumValue: string) {
    const nextMap = { ...enumMap };
    if (enumValue === '__none__') delete nextMap[option];
    else nextMap[option] = enumValue;
    onSave({ leadEnumMap: nextMap });
  }

  return (
    <div>
      <label className="mb-1 block text-micro text-ink-muted">Opções ({options.length})</label>
      <div className="space-y-2">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              defaultValue={opt}
              onBlur={(e) => {
                if (e.target.value !== opt) updateOption(i, e.target.value);
              }}
              className="py-2"
            />
            {showEnumMap && (
              <Select
                value={enumMap[opt] ?? '__none__'}
                onChange={(e) => setEnumFor(opt, e.target.value)}
                className="w-44 py-2"
              >
                <option value="__none__">— enum —</option>
                {enumValues.map((ev) => (
                  <option key={ev.value} value={ev.value}>
                    {ev.label}
                  </option>
                ))}
              </Select>
            )}
            <button
              type="button"
              onClick={() => removeOption(i)}
              disabled={options.length <= 2}
              aria-label="Remover opção"
              className="shrink-0 text-ink-muted hover:text-clay disabled:opacity-30"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" onClick={addOption} className="mt-2">
        <Plus size={14} className="mr-1" />
        adicionar opção
      </Button>
      {showEnumMap && (
        <p className="mt-2 text-xs text-ink-muted">
          Defina o valor de enum de cada opção. Opções sem enum não preenchem o lead.
        </p>
      )}
    </div>
  );
}

function NumberConfig({
  label,
  value,
  onCommit,
}: {
  label: string;
  value: number;
  onCommit: (v: number) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-micro text-ink-muted">{label}</label>
      <Input
        type="number"
        defaultValue={value}
        onBlur={(e) => onCommit(Number(e.target.value) || value)}
        className="py-2"
      />
    </div>
  );
}

function TextConfig({
  label,
  value,
  placeholder,
  onCommit,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onCommit: (v: string) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-micro text-ink-muted">{label}</label>
      <Input
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => onCommit(e.target.value)}
        className="py-2"
      />
    </div>
  );
}
