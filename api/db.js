import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

let sqlClient = null;

export function getSql() {
  const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!databaseUrl) {
    return null;
  }
  if (!sqlClient) {
    sqlClient = neon(databaseUrl);
  }
  return sqlClient;
}
