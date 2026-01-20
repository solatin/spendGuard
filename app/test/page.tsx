"use client";

import { useState, useEffect, useCallback } from "react";

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

interface ExecuteResult {
  id: string;
  decision: "APPROVED" | "DENIED";
  reason: string;
  timestamp: string;
  cost: number;
}

export default function TestPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [results, setResults] = useState<ExecuteResult[]>([]);
  const [isLoading, setIsLoading] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    const res = await fetch("/api/budget");
    const data = await res.json();
    setBudget(data);
  }, []);

  useEffect(() => {
    fetchBudget();
    const interval = setInterval(fetchBudget, 1000);
    return () => clearInterval(interval);
  }, [fetchBudget]);

  const executeRequest = async (
    costEstimated: number,
    label: string
  ): Promise<ExecuteResult> => {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: "email",
        action: "send",
        task: "welcome_flow",
        cost_estimated: costEstimated,
        payload: {
          to: "demo@example.com",
          subject: `Test: ${label}`,
        },
      }),
    });

    const data = await res.json();

    return {
      id: data.log_id || `req_${Date.now()}`,
      decision: data.decision,
      reason: data.reason,
      timestamp: new Date().toISOString(),
      cost: costEstimated,
    };
  };

  const handleSingleEmail = async () => {
    setIsLoading("single");
    const result = await executeRequest(0.10, "Single Email");
    setResults((prev) => [result, ...prev]);
    await fetchBudget();
    setIsLoading(null);
  };

  const handleExpensiveEmail = async () => {
    setIsLoading("expensive");
    const result = await executeRequest(1.0, "Expensive Email");
    setResults((prev) => [result, ...prev]);
    await fetchBudget();
    setIsLoading(null);
  };

  const handleAgentLoop = async () => {
    setIsLoading("loop");
    const batchResults: ExecuteResult[] = [];

    for (let i = 0; i < 20; i++) {
      const result = await executeRequest(0.10, `Agent Loop #${i + 1}`);
      batchResults.push(result);
      setResults((prev) => [result, ...prev]);
      // Small delay to show progress
      await new Promise((r) => setTimeout(r, 50));
    }

    await fetchBudget();
    setIsLoading(null);
  };

  const clearResults = () => setResults([]);

  const handleResetBudget = async () => {
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    await fetchBudget();
  };

  const formatCurrency = (value: number) => `$${value.toFixed(4)}`;

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="font-mono text-3xl font-bold text-zinc-100 mb-2">
            Test Console
          </h1>
          <p className="text-zinc-400">
            Simulate API requests to see SpendGuard in action
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Controls */}
          <div className="lg:col-span-1 space-y-6">
            {/* Budget Status */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="font-mono text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                <span className="text-emerald-400">$</span>
                Live Budget
              </h2>
              {budget && (
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span className="text-zinc-500">Remaining</span>
                      <span className="font-mono text-emerald-400">
                        {formatCurrency(budget.remaining)}
                      </span>
                    </div>
                    <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          budget.percentage_used > 90
                            ? "bg-red-500"
                            : budget.percentage_used > 70
                            ? "bg-amber-500"
                            : "bg-emerald-500"
                        }`}
                        style={{
                          width: `${100 - Math.min(100, budget.percentage_used)}%`,
                        }}
                      />
                    </div>
                    <div className="text-right text-xs text-zinc-500 mt-1">
                      of {formatCurrency(budget.daily_limit)}
                    </div>
                  </div>
                  <button
                    onClick={handleResetBudget}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm font-mono hover:bg-zinc-700 transition-all"
                  >
                    Reset Budget
                  </button>
                </div>
              )}
            </div>

            {/* Test Scenarios */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="font-mono text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                <span className="text-emerald-400">▶</span>
                Test Scenarios
              </h2>

              <div className="space-y-3">
                {/* Scenario 1: Normal */}
                <TestButton
                  label="Send 1 Email"
                  description="Normal request ($0.10)"
                  onClick={handleSingleEmail}
                  isLoading={isLoading === "single"}
                  variant="success"
                />

                {/* Scenario 2: Cost Violation */}
                <TestButton
                  label="Send Expensive Email"
                  description="Cost violation ($1.00 > max $0.50)"
                  onClick={handleExpensiveEmail}
                  isLoading={isLoading === "expensive"}
                  variant="warning"
                />

                {/* Scenario 3: Agent Loop */}
                <TestButton
                  label="Agent Loop (20 requests)"
                  description="20 × $0.10 = $2.00 (exceeds $1.00 budget)"
                  onClick={handleAgentLoop}
                  isLoading={isLoading === "loop"}
                  variant="danger"
                />
              </div>
            </div>

            {/* Policy Reference */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <h2 className="font-mono text-sm font-medium text-zinc-400 mb-4 flex items-center gap-2">
                <span className="text-emerald-400">⚙</span>
                Active Policy
              </h2>
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Max Price:</span>
                  <span className="text-zinc-300">$0.50</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Provider:</span>
                  <span className="text-emerald-400">email</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Action:</span>
                  <span className="text-emerald-400">send</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Task:</span>
                  <span className="text-emerald-400">welcome_flow</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div className="lg:col-span-2">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-sm font-medium text-zinc-400 flex items-center gap-2">
                  <span className="text-emerald-400">☰</span>
                  Request Results
                  {results.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 text-xs">
                      {results.length}
                    </span>
                  )}
                </h2>
                {results.length > 0 && (
                  <button
                    onClick={clearResults}
                    className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>

              {results.length === 0 ? (
                <div className="h-64 flex items-center justify-center text-zinc-600">
                  <div className="text-center">
                    <div className="text-3xl mb-2">▶</div>
                    <div>Run a test scenario to see results</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                  {results.map((result, idx) => (
                    <div
                      key={`${result.id}-${idx}`}
                      className={`
                        p-3 rounded-lg border font-mono text-sm transition-all
                        ${
                          result.decision === "APPROVED"
                            ? "border-emerald-500/30 bg-emerald-500/5"
                            : "border-red-500/30 bg-red-500/5"
                        }
                      `}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span
                          className={`
                            px-2 py-0.5 rounded text-xs font-medium
                            ${
                              result.decision === "APPROVED"
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-red-500/20 text-red-400"
                            }
                          `}
                        >
                          {result.decision}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-zinc-400 truncate max-w-xs">
                          {result.reason}
                        </span>
                        <span className="text-zinc-500">
                          ${result.cost.toFixed(4)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TestButton({
  label,
  description,
  onClick,
  isLoading,
  variant,
}: {
  label: string;
  description: string;
  onClick: () => void;
  isLoading: boolean;
  variant: "success" | "warning" | "danger";
}) {
  const variantStyles = {
    success: "border-emerald-500/30 hover:border-emerald-500/50 hover:bg-emerald-500/10",
    warning: "border-amber-500/30 hover:border-amber-500/50 hover:bg-amber-500/10",
    danger: "border-red-500/30 hover:border-red-500/50 hover:bg-red-500/10",
  };

  const iconColors = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className={`
        w-full p-4 rounded-lg border bg-zinc-800/50 text-left transition-all
        ${variantStyles[variant]}
        disabled:opacity-50 disabled:cursor-not-allowed
      `}
    >
      <div className="flex items-center gap-3">
        <span className={`text-lg ${iconColors[variant]}`}>
          {isLoading ? "◌" : "▶"}
        </span>
        <div>
          <div className="font-mono text-sm text-zinc-200">{label}</div>
          <div className="text-xs text-zinc-500">{description}</div>
        </div>
      </div>
    </button>
  );
}


