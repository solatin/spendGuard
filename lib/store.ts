// Client-side Zustand store for SpendGuard UI
"use client";

import { create } from "zustand";

// Types
export interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

export interface Policy {
  max_price_per_call: number;
  allowed_providers: string[];
  allowed_actions: string[];
  allowed_tasks: string[];
}

export interface AuditLogEntry {
  id: string;
  provider: string;
  action: string;
  task: string;
  cost: number;
  decision: "APPROVED" | "DENIED" | "PAYMENT_REQUIRED";
  reason: string;
  timestamp: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  payment_nonce?: string;
  payment_payer?: string;
  payment_verified?: boolean;
}

export interface LogStats {
  total: number;
  approved: number;
  denied: number;
  paymentRequired: number;
}

// Store interface
interface SpendGuardStore {
  // Budget
  budget: BudgetStatus | null;
  setBudget: (budget: BudgetStatus) => void;
  fetchBudget: () => Promise<void>;
  resetBudget: () => Promise<void>;
  clearNonces: () => Promise<void>;

  // Policy
  policy: Policy | null;
  setPolicy: (policy: Policy) => void;
  fetchPolicy: () => Promise<void>;

  // Logs
  logs: AuditLogEntry[];
  stats: LogStats | null;
  setLogs: (logs: AuditLogEntry[], stats: LogStats) => void;
  fetchLogs: () => Promise<void>;
  clearLogs: () => Promise<void>;

  // Loading states
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
}

export const useSpendGuardStore = create<SpendGuardStore>((set) => ({
  // Initial state
  budget: null,
  policy: null,
  logs: [],
  stats: null,
  isLoading: false,

  // Setters
  setBudget: (budget) => set({ budget }),
  setPolicy: (policy) => set({ policy }),
  setLogs: (logs, stats) => set({ logs, stats }),
  setLoading: (isLoading) => set({ isLoading }),

  // Async actions
  fetchBudget: async () => {
    try {
      const res = await fetch("/api/budget");
      const data = await res.json();
      set({ budget: data });
    } catch (error) {
      console.error("Failed to fetch budget:", error);
    }
  },

  resetBudget: async () => {
    try {
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      const data = await res.json();
      if (data.status) {
        set({ budget: data.status });
      }
    } catch (error) {
      console.error("Failed to reset budget:", error);
    }
  },

  clearNonces: async () => {
    try {
      await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_nonces" }),
      });
    } catch (error) {
      console.error("Failed to clear nonces:", error);
    }
  },

  fetchPolicy: async () => {
    try {
      const res = await fetch("/api/policy");
      const data = await res.json();
      set({ policy: data });
    } catch (error) {
      console.error("Failed to fetch policy:", error);
    }
  },

  fetchLogs: async () => {
    try {
      const res = await fetch("/api/logs");
      const data = await res.json();
      set({ logs: data.logs || [], stats: data.stats || null });
    } catch (error) {
      console.error("Failed to fetch logs:", error);
    }
  },

  clearLogs: async () => {
    try {
      await fetch("/api/logs", { method: "DELETE" });
      set({ logs: [], stats: { total: 0, approved: 0, denied: 0, paymentRequired: 0 } });
    } catch (error) {
      console.error("Failed to clear logs:", error);
    }
  },
}));

// Hook for auto-fetching data with polling
export function useSpendGuardData(pollInterval: number = 2000) {
  const { fetchBudget, fetchPolicy, fetchLogs } = useSpendGuardStore();

  const fetchAll = async () => {
    await Promise.all([fetchBudget(), fetchPolicy(), fetchLogs()]);
  };

  return { fetchAll, fetchBudget, fetchPolicy, fetchLogs };
}

