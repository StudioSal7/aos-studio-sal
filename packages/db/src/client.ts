import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

type DrizzleDb = ReturnType<typeof createDb>;

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  // ⚠️ NÃO baixar `max` abaixo de ~10. O Vercel usa o POOLER do Supabase
  // (Supavisor transaction mode, 6543). O `postgres.js` faz PIPELINING de
  // queries quando há mais queries concorrentes que conexões no pool; contra o
  // pooler em transaction mode, pipeline PROFUNDO (max baixo + muitas queries
  // simultâneas, como o dashboard ~18) faz algumas queries TRAVAREM pra sempre
  // → a função estoura o `maxDuration` (FUNCTION_INVOCATION_TIMEOUT, visto como
  // "Connection closed" no cliente). Reproduzido: 18 queries no pooler com
  // max:3 → 3 travam; max:5/10/20 → todas OK. `prepare: false` é OBRIGATÓRIO
  // pro transaction pooler. Migrations (db:push/migrate) usam a conexão direta
  // 5432. Detalhe completo em docs/debug-dashboard-timeout.md.
  const client = postgres(databaseUrl, {
    prepare: false,
    max: 10,
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
