import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

const client = postgres(databaseUrl, {
  prepare: false,
  max: 10,
});

export const db = drizzle(client, { schema });
export type Db = typeof db;
export { schema };
