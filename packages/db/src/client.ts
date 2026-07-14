import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

type DrizzleDb = ReturnType<typeof createDb>;

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // Pool pequeno de propósito: na Vercel, CADA invocação serverless cria seu
  // próprio pool. Com a conexão DIRETA do Supabase (porta 5432, max_connections
  // = 60), poucas invocações concorrentes × max:10 estouravam o limite →
  // Postgres recusa com `53300: sorry, too many clients already`, que a UI vê
  // como "Connection closed" / server-side exception intermitente no dashboard
  // (que dispara ~23 queries por render). Medido: max:10 × 12 invocações = 157
  // falhas; max:3 × 12 = 0 falhas. `idle_timeout` devolve conexões ociosas das
  // instâncias quentes, baixando o uso em regime permanente.
  //
  // ⚠️ Correção definitiva p/ serverless é usar o POOLER do Supabase (Supavisor
  // transaction mode, porta 6543) na DATABASE_URL da Vercel — o código já está
  // pronto (`prepare: false`, exigido pelo pooler). Migrations (db:push/migrate)
  // continuam pela conexão direta 5432.
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 3,
    idle_timeout: 20,
  });

  return drizzle(client, { schema });
}

// Lazy singleton: a conexão só é criada (e DATABASE_URL só é exigida) no
// primeiro uso real, em runtime. Inicializar no topo do módulo quebraria o
// `next build` — o Next importa cada route handler na fase "collect page data",
// e um throw no import derruba o build (ex.: /api/crons/data-quality).
let instance: DrizzleDb | undefined;

function getDb(): DrizzleDb {
  if (!instance) {
    instance = createDb();
  }
  return instance;
}

export const db: DrizzleDb = new Proxy({} as DrizzleDb, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real, prop, receiver);
    return typeof value === 'function' ? value.bind(real) : value;
  },
});

export type Db = DrizzleDb;
export { schema };
