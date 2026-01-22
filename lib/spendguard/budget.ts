// Budget Tracking - SpendGuard Control Plane
// Redis-backed storage for Vercel deployment

import { redis, REDIS_KEYS } from "../redis";

export interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

export interface BudgetCheckResult {
  allowed: boolean;
  reason: string;
  remaining: number;
}

interface BudgetState {
  daily_limit: number;
  remaining: number;
}

// Default budget values
const DEFAULT_BUDGET: BudgetState = {
  daily_limit: 1.0,
  remaining: 1.0,
};

async function getBudgetState(): Promise<BudgetState> {
  const state = await redis.get<BudgetState>(REDIS_KEYS.BUDGET);
  return state || { ...DEFAULT_BUDGET };
}

async function setBudgetState(state: BudgetState): Promise<void> {
  await redis.set(REDIS_KEYS.BUDGET, state);
}

export async function getBudgetStatus(): Promise<BudgetStatus> {
  const budgetState = await getBudgetState();
  const spent = budgetState.daily_limit - budgetState.remaining;
  return {
    daily_limit: budgetState.daily_limit,
    remaining: budgetState.remaining,
    spent,
    percentage_used: (spent / budgetState.daily_limit) * 100,
  };
}

/**
 * Clear persisted budget state (reverts to DEFAULT_BUDGET on next read)
 */
export async function clearBudget(): Promise<void> {
  await redis.del(REDIS_KEYS.BUDGET);
}

export async function checkBudget(amount: number): Promise<BudgetCheckResult> {
  const budgetState = await getBudgetState();
  
  if (amount > budgetState.remaining) {
    return {
      allowed: false,
      reason: `budget_exceeded: $${amount.toFixed(4)} exceeds remaining $${budgetState.remaining.toFixed(4)}`,
      remaining: budgetState.remaining,
    };
  }

  return {
    allowed: true,
    reason: "budget_check_passed",
    remaining: budgetState.remaining,
  };
}

export async function deductBudget(amount: number): Promise<BudgetStatus> {
  const budgetState = await getBudgetState();
  budgetState.remaining = Math.max(0, budgetState.remaining - amount);
  await setBudgetState(budgetState);
  return getBudgetStatus();
}

export async function resetBudget(): Promise<BudgetStatus> {
  const budgetState = await getBudgetState();
  budgetState.remaining = budgetState.daily_limit;
  await setBudgetState(budgetState);
  return getBudgetStatus();
}

export async function setDailyLimit(limit: number): Promise<BudgetStatus> {
  const budgetState: BudgetState = {
    daily_limit: limit,
    remaining: limit,
  };
  await setBudgetState(budgetState);
  return getBudgetStatus();
}
