// Blocos de exibição reutilizados na aba comercial (workflow) e no dossiê
// (informações). Server components puros — só leitura.

export function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-line bg-paper p-6">
      <h2 className="mb-4 text-micro text-ink-muted">{title}</h2>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-body">{children}</dl>
    </section>
  );
}

export function DataRow({
  label,
  value,
  href,
}: {
  label: string;
  value: string | null | undefined;
  /** Quando presente, o valor vira um link acionável (mailto:, wa.me, instagram.com/...). */
  href?: string | null;
}) {
  return (
    <>
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">
        {value == null ? (
          <span className="text-ink-muted">—</span>
        ) : href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="hover:underline">
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </>
  );
}
