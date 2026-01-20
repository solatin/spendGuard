"use client";

import { useEffect, useState, useCallback } from "react";

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

interface Policy {
  max_price_per_call: number;
  allowed_providers: string[];
  allowed_actions: string[];
  allowed_tasks: string[];
}

interface LogStats {
  total: number;
  approved: number;
  denied: number;
  totalCost: number;
}

export default function DashboardPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const fetchData = useCallback(async () => {
    const [budgetRes, policyRes, logsRes] = await Promise.all([
      fetch("/api/budget"),
      fetch("/api/policy"),
      fetch("/api/logs"),
    ]);

    const budgetData = await budgetRes.json();
    const policyData = await policyRes.json();
    const logsData = await logsRes.json();

    setBudget(budgetData);
    setPolicy(policyData);
    setStats(logsData.stats);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResetBudget = async () => {
    setIsResetting(true);
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    await fetchData();
    setIsResetting(false);
  };

  const formatCurrency = (value: number) => `$${value.toFixed(4)}`;

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-mono text-3xl font-bold text-zinc-100 mb-2">
            Control Dashboard
          </h1>
          <p className="text-zinc-400">
            Real-time overview of SpendGuard policy and budget status
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Requests"
            value={stats?.total?.toString() || "—"}
            icon="◈"
          />
          <StatCard
            label="Approved"
            value={stats?.approved?.toString() || "—"}
            icon="✓"
            variant="success"
          />
          <StatCard
            label="Denied"
            value={stats?.denied?.toString() || "—"}
            icon="✕"
            variant="danger"
          />
          <StatCard
            label="Total Spent"
            value={stats ? formatCurrency(stats.totalCost) : "—"}
            icon="$"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Budget Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 card-hover">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-mono text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <span className="text-emerald-400">$</span>
                Budget Status
              </h2>
              <button
                onClick={handleResetBudget}
                disabled={isResetting}
                className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm font-mono hover:bg-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50"
              >
                {isResetting ? "Resetting..." : "Reset Budget"}
              </button>
            </div>

            {budget && (
              <>
                {/* Budget Bar */}
                <div className="mb-6">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-zinc-400">Daily Budget</span>
                    <span className="font-mono text-zinc-300">
                      {formatCurrency(budget.remaining)} / {formatCurrency(budget.daily_limit)}
                    </span>
                  </div>
                  <div className="h-4 bg-zinc-800 rounded-full overflow-hidden border border-zinc-700">
                    <div
                      className={`h-full transition-all duration-500 ${
                        budget.percentage_used > 90
                          ? "bg-red-500"
                          : budget.percentage_used > 70
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, budget.percentage_used)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-xs mt-2">
                    <span className="text-zinc-500">
                      {budget.percentage_used.toFixed(1)}% used
                    </span>
                    <span className="text-zinc-500">
                      Spent: {formatCurrency(budget.spent)}
                    </span>
                  </div>
                </div>

                {/* Budget Details */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-4">
                    <div className="text-xs text-zinc-500 mb-1">Remaining</div>
                    <div className="font-mono text-xl text-emerald-400">
                      {formatCurrency(budget.remaining)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-800/50 border border-zinc-700/50 p-4">
                    <div className="text-xs text-zinc-500 mb-1">Daily Limit</div>
                    <div className="font-mono text-xl text-zinc-300">
                      {formatCurrency(budget.daily_limit)}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Policy Card */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 card-hover">
            <h2 className="font-mono text-lg font-semibold text-zinc-100 flex items-center gap-2 mb-6">
              <span className="text-emerald-400">⚙</span>
              Active Policy
            </h2>

            {policy && (
              <div className="space-y-4">
                <PolicyRow
                  label="Max Price Per Call"
                  value={formatCurrency(policy.max_price_per_call)}
                />
                <PolicyRow
                  label="Allowed Providers"
                  value={policy.allowed_providers.join(", ")}
                  isArray
                />
                <PolicyRow
                  label="Allowed Actions"
                  value={policy.allowed_actions.join(", ")}
                  isArray
                />
                <PolicyRow
                  label="Allowed Tasks"
                  value={policy.allowed_tasks.join(", ")}
                  isArray
                />
              </div>
            )}
          </div>
        </div>

        {/* System Status */}
        <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-3 w-3 rounded-full bg-emerald-500 animate-pulse-glow" />
              <span className="text-sm text-zinc-400">SpendGuard Active</span>
            </div>
            <span className="font-mono text-xs text-zinc-500">
              Last updated: {new Date().toLocaleTimeString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  variant,
}: {
  label: string;
  value: string;
  icon: string;
  variant?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 card-hover">
      <div className="flex items-center gap-2 mb-2">
        <span
          className={`text-sm ${
            variant === "success"
              ? "text-emerald-400"
              : variant === "danger"
              ? "text-red-400"
              : "text-zinc-500"
          }`}
        >
          {icon}
        </span>
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <div
        className={`font-mono text-2xl font-semibold ${
          variant === "success"
            ? "text-emerald-400"
            : variant === "danger"
            ? "text-red-400"
            : "text-zinc-100"
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function PolicyRow({
  label,
  value,
  isArray,
}: {
  label: string;
  value: string;
  isArray?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-zinc-800 last:border-0">
      <span className="text-sm text-zinc-400">{label}</span>
      {isArray ? (
        <div className="flex flex-wrap gap-1 justify-end">
          {value.split(", ").map((item) => (
            <span
              key={item}
              className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono"
            >
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="font-mono text-sm text-zinc-200">{value}</span>
      )}
    </div>
  );
}


