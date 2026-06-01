'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import type { CloserRecommendation } from '@repo/commercial/types';

export function RecommendationCard({ rec, index }: { rec: CloserRecommendation; index: number }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(rec.script);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard indisponível — ignora */
    }
  }

  return (
    <div className="border border-line p-3">
      <p className="text-micro text-ink normal-case tracking-normal">
        <span className="text-ink-muted">{index + 1}.</span> {rec.texto}
      </p>
      {rec.script && (
        <div className="mt-2 flex items-start gap-2 bg-canvas p-2.5">
          <p className="flex-1 text-micro text-ink normal-case tracking-normal italic leading-relaxed">
            “{rec.script}”
          </p>
          <button
            type="button"
            onClick={copy}
            className="shrink-0 text-ink-muted hover:text-ink"
            title="copiar script"
          >
            {copied ? <Check size={14} className="text-leaf" /> : <Copy size={14} />}
          </button>
        </div>
      )}
    </div>
  );
}
