import { describe, expect, it } from 'vitest';
import { interpolate, resolveFormVariables } from './personalization';
import type { FormFieldView, LeadMappingTarget } from './types';

function field(id: string, leadMapping: LeadMappingTarget | null): FormFieldView {
  return {
    id,
    ordem: 0,
    tipo: 'texto_curto',
    titulo: '',
    subtitulo: null,
    placeholder: null,
    obrigatorio: true,
    config: null,
    leadMapping,
    leadEnumMap: null,
  };
}

describe('resolveFormVariables', () => {
  it('usa o apelido (nickname) quando preenchido', () => {
    const fields = [field('f-name', 'name'), field('f-nick', 'nickname')];
    const vars = resolveFormVariables(fields, { 'f-name': 'Maria Silva', 'f-nick': 'Bi' });
    expect(vars.nome).toBe('Bi');
  });

  it('faz trim do apelido', () => {
    const fields = [field('f-nick', 'nickname')];
    expect(resolveFormVariables(fields, { 'f-nick': '  Bia  ' }).nome).toBe('Bia');
  });

  it('cai no primeiro nome quando o apelido está vazio', () => {
    const fields = [field('f-name', 'name'), field('f-nick', 'nickname')];
    const vars = resolveFormVariables(fields, { 'f-name': 'Maria Silva', 'f-nick': '' });
    expect(vars.nome).toBe('Maria');
  });

  it('retorna nome vazio quando nada foi respondido', () => {
    const fields = [field('f-name', 'name'), field('f-nick', 'nickname')];
    expect(resolveFormVariables(fields, {}).nome).toBe('');
  });

  it('ignora respostas não-string', () => {
    const fields = [field('f-nick', 'nickname')];
    expect(resolveFormVariables(fields, { 'f-nick': ['x'] }).nome).toBe('');
  });

  it('retorna vazio quando não há campo de nome/apelido no form', () => {
    const fields = [field('f-mail', 'email')];
    expect(resolveFormVariables(fields, { 'f-mail': 'a@b.com' }).nome).toBe('');
  });
});

describe('interpolate — valor presente', () => {
  const vars = { nome: 'bianca' };

  it('substitui o token pelo valor', () => {
    expect(interpolate('{nome}, qual a sua idade?', vars)).toBe('bianca, qual a sua idade?');
  });

  it('substitui o token no meio sem recapitalizar o resto', () => {
    expect(interpolate('recebemos sua aplicação, {nome}!', vars)).toBe(
      'recebemos sua aplicação, bianca!',
    );
  });

  it('substitui múltiplas ocorrências', () => {
    expect(interpolate('oi {nome}, tudo bem {nome}?', vars)).toBe('oi bianca, tudo bem bianca?');
  });

  it('deixa texto sem token intocado', () => {
    expect(interpolate('qual o seu melhor email?', vars)).toBe('qual o seu melhor email?');
  });

  it('preserva tokens de chave desconhecida', () => {
    expect(interpolate('olá {nome}, veja {outro}', vars)).toBe('olá bianca, veja {outro}');
  });
});

describe('interpolate — valor vazio (higieniza a frase)', () => {
  const vars = { nome: '' };

  it('remove o token que abre a frase e recapitaliza', () => {
    expect(interpolate('{nome}, qual a sua idade?', vars)).toBe('Qual a sua idade?');
  });

  it('remove o token que fecha a frase (vírgula antes)', () => {
    expect(interpolate('recebemos sua aplicação, {nome}!', vars)).toBe(
      'recebemos sua aplicação!',
    );
  });

  it('remove o token no meio sem deixar vírgula órfã', () => {
    expect(interpolate('{nome}, nos conte sobre seu trabalho', vars)).toBe(
      'Nos conte sobre seu trabalho',
    );
  });

  it('não quebra com token solto sem vírgula', () => {
    expect(interpolate('fale com {nome} agora', vars)).toBe('fale com agora');
  });
});
