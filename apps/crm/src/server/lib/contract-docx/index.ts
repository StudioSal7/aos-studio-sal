// Adaptador fino sobre PizZip + Docxtemplater — faz o mail-merge de um .docx
// template com o record de placeholders já pronto (ver contract-data-builder).
// Placeholder ausente do record → string vazia (nullGetter), nunca lança.

import Docxtemplater from 'docxtemplater';
import PizZip from 'pizzip';

export function renderContractDocx(templateBuffer: Buffer, data: Record<string, string>): Buffer {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    nullGetter: () => '',
  });
  doc.render(data);
  return doc.toBuffer();
}
