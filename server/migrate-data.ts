import type { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const currentDir = typeof import.meta.dirname === "string" 
  ? import.meta.dirname 
  : path.dirname(fileURLToPath(import.meta.url));

function findFile(filename: string): string | null {
  const searchPaths = [
    path.join(process.cwd(), "server", filename),
    path.join(process.cwd(), filename),
    path.join(currentDir, filename),
    path.join(currentDir, "..", "server", filename),
  ];
  for (const p of searchPaths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

/**
 * Idempotent backfill: recalculates stored subtotal/total for any invoice where
 * the stored subtotal does not match the sum of its line items.
 * Introduced to fix invoices 1626 and 1879 which had stale stored values.
 * Safe to run on every startup — it only updates rows that are actually wrong.
 */
export async function runInvoiceSubtotalBackfill(): Promise<void> {
  try {
    const result = await db.execute(sql`
      UPDATE invoices i
      SET
        subtotal = line_sums.actual_sum,
        total    = GREATEST(0, line_sums.actual_sum
                             + COALESCE(i.freight::numeric, 0)
                             - CASE
                                 WHEN i.discount_type = 'percent'
                                   THEN ROUND(line_sums.actual_sum * COALESCE(i.discount::numeric, 0) / 100, 2)
                                 ELSE COALESCE(i.discount::numeric, 0)
                               END),
        updated_at = NOW()
      FROM (
        SELECT invoice_id, ROUND(COALESCE(SUM(line_total::numeric), 0), 2) AS actual_sum
        FROM invoice_line_items
        GROUP BY invoice_id
      ) AS line_sums
      WHERE i.id = line_sums.invoice_id
        AND (
          ABS(i.subtotal::numeric - line_sums.actual_sum) > 0.005
          OR ABS(i.total::numeric - GREATEST(0, line_sums.actual_sum
               + COALESCE(i.freight::numeric, 0)
               - CASE
                   WHEN i.discount_type = 'percent'
                     THEN ROUND(line_sums.actual_sum * COALESCE(i.discount::numeric, 0) / 100, 2)
                   ELSE COALESCE(i.discount::numeric, 0)
                 END)) > 0.005
        )
      RETURNING i.invoice_number
    `);
    const rows = (result as unknown as { rows: { invoice_number: string }[] }).rows ?? [];
    if (rows.length > 0) {
      console.log(`[backfill] Fixed subtotal/total for ${rows.length} invoice(s): ${rows.map((r) => r.invoice_number).join(", ")}`);
    }
  } catch (err: any) {
    console.error("[backfill] Invoice subtotal backfill failed:", err?.message);
  }
}

export function registerMigrationRoutes(app: Express) {
  app.post("/api/admin/migrate-data", async (req, res) => {
    const { secret, schemaOnly } = req.body;
    if (secret !== "migrate-prod-2026") {
      return res.status(403).json({ message: "Forbidden" });
    }

    try {
      const schemaFile = findFile("migration-schema.sql");
      if (schemaFile) {
        console.log("Applying schema from:", schemaFile);
        const schemaContent = fs.readFileSync(schemaFile, "utf-8");
        const statements = schemaContent.split(";").filter(s => s.trim().length > 0);
        let schemaApplied = 0;
        let schemaErrors = 0;
        for (const stmt of statements) {
          try {
            await db.execute(sql.raw(stmt + ";"));
            schemaApplied++;
          } catch (err: any) {
            if (!err?.message?.includes("already exists")) {
              schemaErrors++;
            }
          }
        }
        console.log(`Schema: ${schemaApplied} applied, ${schemaErrors} errors`);
      } else {
        console.log("No schema file found, skipping schema setup");
      }

      if (schemaOnly) {
        return res.json({ message: "Schema applied" });
      }

      const dataFile = findFile("migration-data.sql");
      if (!dataFile) {
        return res.status(404).json({ 
          message: "Migration data file not found",
          cwd: process.cwd(),
          dir: currentDir,
          serverFiles: fs.existsSync(path.join(process.cwd(), "server")) 
            ? fs.readdirSync(path.join(process.cwd(), "server")).filter(f => f.includes("migration"))
            : "server dir not found"
        });
      }

      console.log("Reading data from:", dataFile);
      const sqlContent = fs.readFileSync(dataFile, "utf-8");
      const lines = sqlContent.split("\n").filter(line => line.trim().length > 0);

      const results: Record<string, { inserted: number; errors: number }> = {};
      let currentTable = "";

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("ALTER TABLE")) {
          const match = trimmed.match(/ALTER TABLE public\.(\w+)/);
          if (match) currentTable = match[1];
          continue;
        }

        if (trimmed.startsWith("INSERT INTO")) {
          const match = trimmed.match(/INSERT INTO public\.(\w+)/);
          if (match) currentTable = match[1];

          if (!results[currentTable]) {
            results[currentTable] = { inserted: 0, errors: 0 };
          }

          try {
            const cleanSql = trimmed.replace(/;$/, "") + " ON CONFLICT DO NOTHING;";
            await db.execute(sql.raw(cleanSql));
            results[currentTable].inserted++;
          } catch (err: any) {
            results[currentTable].errors++;
            if (results[currentTable].errors <= 3) {
              console.error(`Error inserting into ${currentTable}:`, err?.message?.substring(0, 200));
            }
          }
        }
      }

      res.json({ message: "Migration completed", results });
    } catch (error: any) {
      console.error("Migration error:", error?.message);
      res.status(500).json({ message: "Migration failed", error: error?.message });
    }
  });
}
