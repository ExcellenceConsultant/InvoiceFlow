import type { Express } from "express";
import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

function findFile(filename: string): string | null {
  const paths = [
    path.join(process.cwd(), "server", filename),
    path.join(process.cwd(), filename),
    path.join(__dirname, filename),
    path.join(__dirname, "..", "server", filename),
  ];
  for (const p of paths) {
    if (fs.existsSync(p)) return p;
  }
  return null;
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
          dirname: __dirname,
          files: fs.readdirSync(process.cwd()).filter(f => f.includes("migration")).slice(0, 10)
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
