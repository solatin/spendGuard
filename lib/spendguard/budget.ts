// Budget Tracking - SpendGuard Control Plane
// Manages daily spending limits and budget enforcement

import { getDb } from "../db";

/**
 * Budget status
 */
export interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

/**
 * Budget check result
 */
export interface BudgetCheckResult {
  allowed: boolean;
  reason: string;
  remaining: number;
}

interface BudgetRow {
  daily_limit: number;
  remaining: number;
}

/**
 * Get current budget status
 */
export function getBudgetStatus(): BudgetStatus {
  const db = getDb();
  const row = db.prepare("SELECT * FROM budget WHERE id = 1").get() as BudgetRow;

  const spent = row.daily_limit - row.remaining;
  const percentage_used = (spent / row.daily_limit) * 100;

  return {
    daily_limit: row.daily_limit,
    remaining: row.remaining,
    spent,
    percentage_used,
  };
}

/**
 * Check if budget allows the requested amount
 */
export function checkBudget(amount: number): BudgetCheckResult {
  const status = getBudgetStatus();

  if (amount > status.remaining) {
    return {
      allowed: false,
      reason: `budget_exceeded: $${amount.toFixed(4)} exceeds remaining $${status.remaining.toFixed(4)}`,
      remaining: status.remaining,
    };
  }

  return {
    allowed: true,
    reason: "budget_check_passed",
    remaining: status.remaining,
  };
}

/**
 * Deduct amount from budget
 * Should only be called after successful payment verification
 */
export function deductBudget(amount: number): BudgetStatus {
  const db = getDb();

  db.prepare("UPDATE budget SET remaining = remaining - ? WHERE id = 1").run(amount);

  return getBudgetStatus();
}

/**
 * Reset budget to daily limit
 */
export function resetBudget(): BudgetStatus {
  const db = getDb();
  const status = getBudgetStatus();

  db.prepare("UPDATE budget SET remaining = daily_limit WHERE id = 1").run();

  return {
    ...status,
    remaining: status.daily_limit,
    spent: 0,
    percentage_used: 0,
  };
}

/**
 * Set daily budget limit
 */
export function setDailyLimit(limit: number): BudgetStatus {
  const db = getDb();

  db.prepare("UPDATE budget SET daily_limit = ?, remaining = ? WHERE id = 1").run(
    limit,
    limit
  );

  return getBudgetStatus();
}

