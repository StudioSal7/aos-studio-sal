import { describe, it, expect } from 'vitest';
import { buildSdrThread, threadHasPerMessageTimestamps } from './index';
import type { EvolutionMessage } from '../evolution-client';

function msg(partial: Partial<EvolutionMessage> & { fromMe: boolean; ts: number; text?: string }): EvolutionMessage {
  return {
    key: { id: `id-${partial.ts}`, fromMe: partial.fromMe, remoteJid: 'x@s.whatsapp.net' },
    pushName: partial.pushName,
    messageType: partial.messageType ?? 'conversation',
    messageTimestamp: partial.ts,
    message: partial.text !== undefined ? { conversation: partial.text } : null,
  };
}

describe('buildSdrThread', () => {
  it('ordena ascendente por timestamp mesmo recebendo decrescente', () => {
    const messages = [
      msg({ fromMe: false, ts: 300, text: 'terceira' }),
      msg({ fromMe: true, ts: 100, text: 'primeira' }),
      msg({ fromMe: false, ts: 200, text: 'segunda' }),
    ];
    const thread = buildSdrThread(messages, { leadName: 'Juliana' });
    const lines = thread.split('\n');
    expect(lines[0]).toContain('primeira');
    expect(lines[1]).toContain('segunda');
    expect(lines[2]).toContain('terceira');
  });

  it('rotula fromMe=true como SDR e fromMe=false com leadName', () => {
    const thread = buildSdrThread([
      msg({ fromMe: true, ts: 100, text: 'oi' }),
      msg({ fromMe: false, ts: 200, text: 'olá' }),
    ], { leadName: 'Bruna' });
    expect(thread).toContain('SDR: oi');
    expect(thread).toContain('Bruna: olá');
  });

  it('usa pushName quando leadName ausente', () => {
    const thread = buildSdrThread([
      msg({ fromMe: false, ts: 100, text: 'oi', pushName: 'Gabriela Escrich' }),
    ]);
    expect(thread).toContain('Gabriela Escrich: oi');
  });

  it('cai para "lead" sem leadName nem pushName', () => {
    const thread = buildSdrThread([msg({ fromMe: false, ts: 100, text: 'oi' })]);
    expect(thread).toContain('lead: oi');
  });

  it('extrai texto de extendedTextMessage', () => {
    const m: EvolutionMessage = {
      key: { id: 'a', fromMe: false, remoteJid: 'x@s.whatsapp.net' },
      messageType: 'extendedTextMessage',
      messageTimestamp: 100,
      message: { extendedTextMessage: { text: 'mensagem longa' } },
    };
    expect(buildSdrThread([m])).toContain('mensagem longa');
  });

  it('marca mídia sem texto com rótulo legível', () => {
    const m: EvolutionMessage = {
      key: { id: 'a', fromMe: true, remoteJid: 'x@s.whatsapp.net' },
      messageType: 'imageMessage',
      messageTimestamp: 100,
      message: null,
    };
    expect(buildSdrThread([m])).toContain('[image]');
  });

  it('lança erro com lista vazia', () => {
    expect(() => buildSdrThread([])).toThrow(/Nenhuma mensagem/);
  });

  it('formata timestamp em horário de São Paulo', () => {
    // 2026-01-15 12:00:00 UTC = 09:00 em São Paulo (UTC-3)
    const epoch = Math.floor(Date.UTC(2026, 0, 15, 12, 0, 0) / 1000);
    const thread = buildSdrThread([msg({ fromMe: true, ts: epoch, text: 'oi' })]);
    expect(thread).toContain('09:00');
    expect(thread).toContain('15/01/2026');
  });
});

describe('threadHasPerMessageTimestamps', () => {
  it('true quando há timestamps válidos', () => {
    expect(threadHasPerMessageTimestamps([msg({ fromMe: true, ts: 100, text: 'x' })])).toBe(true);
  });
  it('false quando timestamps ausentes/zerados', () => {
    expect(threadHasPerMessageTimestamps([msg({ fromMe: true, ts: 0, text: 'x' })])).toBe(false);
  });
});
