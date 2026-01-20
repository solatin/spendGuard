// SQLite Database - SpendGuard Demo
// Persistent storage for budget, audit logs, and policy

import Database from "better-sqlite3";
import path from "path";

// Database file in project root
const dbPath = path.join(process.cwd(), "spendguard.db");

// Singleton database instance
let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL"); // Better performance
    initializeTables();
  }
  return db;
}

function initializeTables() {
  const database = db!;

  // Budget table
  database.exec(`
    CREATE TABLE IF NOT EXISTS budget (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      daily_limit REAL NOT NULL DEFAULT 1.0,
      remaining REAL NOT NULL DEFAULT 1.0
    )
  `);

  // Insert default budget if not exists
  const budgetExists = database.prepare("SELECT 1 FROM budget WHERE id = 1").get();
  if (!budgetExists) {
    database.prepare("INSERT INTO budget (id, daily_limit, remaining) VALUES (1, 1.0, 1.0)").run();
  }

  // Policy table
  database.exec(`
    CREATE TABLE IF NOT EXISTS policy (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      max_price_per_call REAL NOT NULL DEFAULT 0.5,
      allowed_providers TEXT NOT NULL DEFAULT '["email"]',
      allowed_actions TEXT NOT NULL DEFAULT '["send"]',
      allowed_tasks TEXT NOT NULL DEFAULT '["welcome_flow"]'
    )
  `);

  // Insert default policy if not exists
  const policyExists = database.prepare("SELECT 1 FROM policy WHERE id = 1").get();
  if (!policyExists) {
    database.prepare(`
      INSERT INTO policy (id, max_price_per_call, allowed_providers, allowed_actions, allowed_tasks) 
      VALUES (1, 0.5, '["email"]', '["send"]', '["welcome_flow"]')
    `).run();
  }

  // Audit log table
  database.exec(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      provider TEXT NOT NULL,
      action TEXT NOT NULL,
      task TEXT NOT NULL,
      cost REAL NOT NULL,
      decision TEXT NOT NULL,
      reason TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      payload TEXT,
      response TEXT
    )
  `);
}

// Close database on process exit
if (typeof process !== "undefined") {
  process.on("exit", () => {
    if (db) {
      db.close();
    }
  });
}


