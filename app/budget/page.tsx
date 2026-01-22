"use client";

import { useCallback, useEffect, useState } from "react";

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

export default function BudgetPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [dailyLimit, setDailyLimit] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    const res = await fetch("/api/budget");
    const data = (await res.json()) as BudgetStatus;
    setBudget(data);
    setDailyLimit(String(data.daily_limit));
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
  }, []);

  useEffect(() => {
    fetchBudget();
  }, [fetchBudget]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchBudget();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const res = await fetch("/api/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_limit: Number(dailyLimit) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `save_failed: ${res.status}`);
      }
      const updated = (await res.json()) as BudgetStatus;
      setBudget(updated);
      setDailyLimit(String(updated.daily_limit));
    } catch (error) {
      console.error("Failed to save budget:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsResetting(true);
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (!res.ok) {
        throw new Error(`reset_failed: ${res.status}`);
      }
      await fetchBudget();
    } catch (error) {
      console.error("Failed to reset budget:", error);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-bold text-zinc-100 mb-2">Budget</h1>
            <p className="text-zinc-400">Edit the Redis-backed SpendGuard budget.</p>
            <div className="font-mono text-xs text-zinc-500 mt-2">
              {lastUpdated ? `Last updated: ${lastUpdated}` : "Loading..."}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm font-mono hover:bg-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4 text-center">
              <div className="text-zinc-500 text-xs mb-1">Daily Limit</div>
              <div className="font-mono text-zinc-100">{budget ? budget.daily_limit.toFixed(4) : "—"} USDC</div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4 text-center">
              <div className="text-zinc-500 text-xs mb-1">Spent</div>
              <div className="font-mono text-red-400">{budget ? budget.spent.toFixed(4) : "—"} USDC</div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4 text-center">
              <div className="text-zinc-500 text-xs mb-1">Remaining</div>
              <div className="font-mono text-emerald-400">{budget ? budget.remaining.toFixed(4) : "—"} USDC</div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="block text-sm text-zinc-400 font-mono">Set daily limit (USDC)</label>
            <input
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono"
              inputMode="decimal"
              placeholder="1.0"
            />
            <div className="flex items-center gap-3">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-zinc-950 font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 font-mono text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isResetting ? "Resetting..." : "Reset Remaining"}
              </button>
            </div>
            <div className="text-xs text-zinc-500">
              Note: setting a new daily limit also resets remaining to the same value.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


