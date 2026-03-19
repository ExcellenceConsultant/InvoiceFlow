import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from "@shared/schema";

const connectionString = process.env.INVOICEFLOW_DB_URL || process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

try {
  const url = new URL(connectionString);
  console.log(`[db] Connecting to: ${url.hostname} / database: ${url.pathname.slice(1)}`);
  console.log(`[db] Source: ${process.env.INVOICEFLOW_DB_URL ? "INVOICEFLOW_DB_URL" : process.env.NEON_DATABASE_URL ? "NEON_DATABASE_URL" : "DATABASE_URL"}`);
} catch {}

const sql = neon(connectionString);
export const db = drizzle({ client: sql, schema });

// Keep pool export as compatibility shim for session store
export const pool = { query: sql } as any;
