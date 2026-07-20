import PizZip from 'pizzip';
import { describe, expect, it } from 'vitest';
import { renderContractDocx } from './index';

// Fixture .docx mínimo, montado em memória (sem depender de binário versionado
// no repo) — só as partes que o OOXML exige pra um documento válido de um
// parágrafo, com os placeholders do mail-merge no corpo do texto.
function buildFixtureDocx(bodyText: string): Buffer {
  const zip = new PizZip();

  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`,
  );

  zip.file(
    '_rels/.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`,
  );

  zip.file(
    'word/_rels/document.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`,
  );

  zip.file(
    'word/document.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
<w:p><w:r><w:t>${bodyText}</w:t></w:r></w:p>
</w:body>
</w:document>`,
  );

  return zip.generate({ type: 'nodebuffer' });
}

function extractBodyText(docxBuffer: Buffer): string {
  const zip = new PizZip(docxBuffer);
  const xml = zip.file('word/document.xml')?.asText() ?? '';
  const match = xml.match(/<w:t[^>]*>([^<]*)<\/w:t>/);
  return match?.[1] ?? '';
}

describe('renderContractDocx', () => {
  it('substitui placeholders conhecidos pelos valores do record', () => {
    const template = buildFixtureDocx(
      'Contrato de {produto} — {nome}, valor {valor} ({valor_extenso}).',
    );
    const out = renderContractDocx(template, {
      produto: 'Mentoria Salto',
      nome: 'Bia',
      valor: 'R$ 1.997,00',
      valor_extenso: 'mil novecentos e noventa e sete reais',
    });

    expect(extractBodyText(out)).toBe(
      'Contrato de Mentoria Salto — Bia, valor R$ 1.997,00 (mil novecentos e noventa e sete reais).',
    );
  });

  it('placeholder ausente do record sai vazio, não lança', () => {
    const template = buildFixtureDocx('Nome: {nome}. CPF: {cpf_cnpj_nao_fornecido}.');
    const out = renderContractDocx(template, { nome: 'Bia' });

    expect(extractBodyText(out)).toBe('Nome: Bia. CPF: .');
  });

  it('record com todos os campos vazios gera .docx válido sem lançar', () => {
    const template = buildFixtureDocx('Nome: {nome}. Produto: {produto}.');
    expect(() => renderContractDocx(template, { nome: '', produto: '' })).not.toThrow();
  });
});
