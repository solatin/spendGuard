// Budget Engine - SpendGuard Demo
// SQLite-backed budget tracking with daily limits

import { getDb } from "./db";

export interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason: string;
}

interface BudgetRow {
  daily_limit: number;
  remaining: number;
}

export function getBudgetStatus(): BudgetStatus {
  const db = getDb();
  const row = db.prepare("SELECT daily_limit, remaining FROM budget WHERE id = 1").get() as BudgetRow;

  const spent = row.daily_limit - row.remaining;
  return {
    daily_limit: row.daily_limit,
    remaining: Math.max(0, row.remaining),
    spent: Math.max(0, spent),
    percentage_used: (spent / row.daily_limit) * 100,
  };
}

export function checkBudget(cost: number): BudgetCheckResult {
  const db = getDb();
  const row = db.prepare("SELECT remaining FROM budget WHERE id = 1").get() as { remaining: number };

  if (cost > row.remaining) {
    return {
      allowed: false,
      reason: `budget_exceeded: $${cost.toFixed(4)} exceeds remaining $${row.remaining.toFixed(4)}`,
    };
  }

  return {
    allowed: true,
    reason: "budget_ok",
  };
}

export function deductBudget(cost: number): void {
  const db = getDb();
  db.prepare("UPDATE budget SET remaining = MAX(0, remaining - ?) WHERE id = 1").run(cost);
}

export function resetBudget(): void {
  const db = getDb();
  db.prepare("UPDATE budget SET remaining = daily_limit WHERE id = 1").run();
}

export function setDailyLimit(limit: number): void {
  const db = getDb();
  db.prepare(`
    UPDATE budget 
    SET daily_limit = ?, 
        remaining = CASE WHEN remaining > ? THEN ? ELSE remaining END 
    WHERE id = 1
  `).run(limit, limit, limit);
}
