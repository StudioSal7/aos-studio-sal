import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

type DrizzleDb = ReturnType<typeof createDb>;

function createDb() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  const client = postgres(databaseUrl, {
    prepare: false,
    max: 10,
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
