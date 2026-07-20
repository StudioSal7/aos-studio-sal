// Testes de render de ponta a ponta: template .docx canônico (versionado em
// apps/crm/contract-templates/) + contract-data-builder → docxtemplater →
// texto extraído. Garante que o documento FINAL está correto — é o que o
// cliente recebe. Cada FIX que toca o template ganha asserção aqui.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { buildContractData, type ContractCollectedData } from '../contract-data-builder';
import { renderContractDocx } from './index';

const TEMPLATES_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '../../../../contract-templates');

function loadTemplate(tipo: string): Buffer {
  return readFileSync(resolve(TEMPLATES_DIR, `${tipo}.docx`));
}

/** Texto plano do .docx renderizado (tags XML removidas). */
function renderToText(tipo: string, coletado: ContractCollectedData, leadOverrides = {}): string {
  const template = loadTemplate(tipo);
  const placeholders = buildContractData({
    lead: {
      name: 'Fulana',
      nickname: null,
      email: 'f@example.com',
      whatsappE164: '+5511999990000',
      valorProposto: '1997.00',
      formaPagamentoNegociada: 'pix',
      ...leadOverrides,
    },
    product: { displayName: 'Mentoria Salto' },
    coletado,
    dataGeracao: new Date('2026-07-19T12:00:00Z'),
  });
  const out = renderContractDocx(template, placeholders);
  const xml = new PizZip(out).file('word/document.xml')!.asText();
  return xml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}

const TIPOS = ['mentoria', 'assessoria', 'branding_pessoal'] as const;

describe('render do contrato — prazo (FIX 1)', () => {
  for (const tipo of TIPOS) {
    it(`${tipo}: sem prazo informado, documento sai com "6 (seis) meses" e zero [REVISAR]`, () => {
      const text = renderToText(tipo, {});
      expect(text).not.toMatch(/\[REVISAR/);
      expect(text).toContain('6 (seis) meses');
    });

    it(`${tipo}: prazo informado sobrepõe`, () => {
      const text = renderToText(tipo, { prazo: '12 (doze) meses' });
      expect(text).toContain('12 (doze) meses');
      expect(text).not.toContain('6 (seis) meses');
    });
  }
});
