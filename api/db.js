import { neon } from '@neondatabase/serverless';
import 'dotenv/config';

let sqlClient = null;

export function getSql() {
  const rawUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!rawUrl) {
    return null;
  }
  // Remove any accidental spaces or line-breaks from copy-pasting
  const databaseUrl = rawUrl.trim().replace(/\s+/g, '');
  if (!sqlClient) {
    try {
      sqlClient = neon(databaseUrl);
    } catch (err) {
      console.warn('Invalid DATABASE_URL provided to neon():', err.message);
      return null;
    }
  }
  return sqlClient;
}
