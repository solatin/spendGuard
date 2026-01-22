"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface AuditLogEntry {
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

interface Policy {
  max_price_per_call: number;
  allowed_providers: string[];
  allowed_actions: string[];
  allowed_tasks: string[];
}

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

interface LogStats {
  total: number;
  approved: number;
  denied: number;
  paymentRequired: number;
}

export default function SpendGuardInspectorClient() {
  const searchParams = useSearchParams();
  const selectedLogId = searchParams.get("logId");
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [isEditingPolicy, setIsEditingPolicy] = useState(false);
  const [isSavingPolicy, setIsSavingPolicy] = useState(false);
  const [policyDraft, setPolicyDraft] = useState<{
    max_price_per_call: string;
    allowed_providers: string;
    allowed_actions: string;
    allowed_tasks: string;
  } | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isResettingBudget, setIsResettingBudget] = useState(false);
  const [budgetDailyLimitDraft, setBudgetDailyLimitDraft] = useState<string>("");

  const fetchData = useCallback(async () => {
    const [logsRes, policyRes, budgetRes] = await Promise.all([
      fetch("/api/logs"),
      fetch("/api/policy"),
      fetch("/api/budget"),
    ]);

    const logsData = await logsRes.json();
    const policyData = await policyRes.json();
    const budgetData = await budgetRes.json();

    setLogs(logsData.logs.slice(0, 20));
    setStats(logsData.stats);
    setPolicy(policyData);
    setBudget(budgetData);
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchData();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedLogId) return;
    const found = logs.find((l) => l.id === selectedLogId) || null;
    if (found) setSelectedLog(found);
  }, [selectedLogId, logs]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getDecisionColor = (decision: string) => {
    switch (decision) {
      case "APPROVED":
        return "text-emerald-400 bg-emerald-500/20";
      case "DENIED":
        return "text-red-400 bg-red-500/20";
      case "PAYMENT_REQUIRED":
        return "text-amber-400 bg-amber-500/20";
      default:
        return "text-gray-400 bg-gray-500/20";
    }
  };

  const getLogPhase = (log: AuditLogEntry): string => {
    if (log.reason.includes("policy") || log.reason.includes("not_allowed")) {
      return "Policy Check";
    }
    if (log.reason.includes("budget")) {
      return "Budget Check";
    }
    if (log.decision === "PAYMENT_REQUIRED") {
      return "402 Forwarded";
    }
    if (log.payment_verified !== undefined) {
      return log.payment_verified ? "Payment Verified" : "Payment Invalid";
    }
    return "Executed";
  };

  const handleClear = async () => {
    try {
      setIsClearing(true);
      setSelectedLog(null);

      const res = await fetch("/api/spendguard/clear", { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`clear_failed: ${res.status}`);
      }

      await fetchData();
    } catch (error) {
      console.error("Failed to clear SpendGuard DB:", error);
    } finally {
      setIsClearing(false);
    }
  };

  const beginEditPolicy = () => {
    if (!policy) return;
    setPolicyDraft({
      max_price_per_call: String(policy.max_price_per_call),
      allowed_providers: policy.allowed_providers.join(", "),
      allowed_actions: policy.allowed_actions.join(", "),
      allowed_tasks: policy.allowed_tasks.join(", "),
    });
    setIsEditingPolicy(true);
  };

  const cancelEditPolicy = () => {
    setIsEditingPolicy(false);
    setPolicyDraft(null);
  };

  const savePolicy = async () => {
    if (!policyDraft) return;
    try {
      setIsSavingPolicy(true);
      const res = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_price_per_call: Number(policyDraft.max_price_per_call),
          allowed_providers: policyDraft.allowed_providers,
          allowed_actions: policyDraft.allowed_actions,
          allowed_tasks: policyDraft.allowed_tasks,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `save_failed: ${res.status}`);
      }
      setIsEditingPolicy(false);
      setPolicyDraft(null);
      await fetchData();
    } catch (error) {
      console.error("Failed to save policy:", error);
    } finally {
      setIsSavingPolicy(false);
    }
  };

  const beginEditBudget = () => {
    if (!budget) return;
    setBudgetDailyLimitDraft(String(budget.daily_limit));
    setIsEditingBudget(true);
  };

  const cancelEditBudget = () => {
    setIsEditingBudget(false);
    setBudgetDailyLimitDraft("");
  };

  const saveBudget = async () => {
    try {
      setIsSavingBudget(true);
      const res = await fetch("/api/budget", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_limit: Number(budgetDailyLimitDraft) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `save_failed: ${res.status}`);
      }
      setIsEditingBudget(false);
      setBudgetDailyLimitDraft("");
      await fetchData();
    } catch (error) {
      console.error("Failed to save budget:", error);
    } finally {
      setIsSavingBudget(false);
    }
  };

  const resetBudgetRemaining = async () => {
    try {
      setIsResettingBudget(true);
      const res = await fetch("/api/budget", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset" }),
      });
      if (!res.ok) {
        throw new Error(`reset_failed: ${res.status}`);
      }
      await fetchData();
    } catch (error) {
      console.error("Failed to reset budget:", error);
    } finally {
      setIsResettingBudget(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            🛡️ SpendGuard Inspector
          </h1>
          <p className="text-gray-400">
            Internal view of SpendGuard&apos;s decision-making and x402 forwarding
          </p>
        </div>

        {/* Flow Diagram - Shows SpendGuard's role */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-cyan-400">🔄</span> SpendGuard x402 Flow
          </h2>
          <div className="flex items-center justify-between text-sm">
            <div className="flex-1 text-center">
              <div className="inline-block px-4 py-2 bg-cyan-900/30 border border-cyan-700 rounded-lg">
                <div className="text-cyan-400 font-semibold">Agent</div>
                <div className="text-xs text-gray-500">Request</div>
              </div>
            </div>
            <div className="text-gray-600 px-2">→</div>
            <div className="flex-1 text-center">
              <div className="inline-block px-4 py-2 bg-emerald-900/30 border border-emerald-700 rounded-lg">
                <div className="text-emerald-400 font-semibold">SpendGuard</div>
                <div className="text-xs text-gray-500">Policy + Budget</div>
              </div>
            </div>
            <div className="text-gray-600 px-2">→</div>
            <div className="flex-1 text-center">
              <div className="inline-block px-4 py-2 bg-amber-900/30 border border-amber-700 rounded-lg">
                <div className="text-amber-400 font-semibold">Provider</div>
                <div className="text-xs text-gray-500">Returns 402</div>
              </div>
            </div>
            <div className="text-gray-600 px-2">→</div>
            <div className="flex-1 text-center">
              <div className="inline-block px-4 py-2 bg-purple-900/30 border border-purple-700 rounded-lg">
                <div className="text-purple-400 font-semibold">SpendGuard</div>
                <div className="text-xs text-gray-500">Forwards 402</div>
              </div>
            </div>
            <div className="text-gray-600 px-2">→</div>
            <div className="flex-1 text-center">
              <div className="inline-block px-4 py-2 bg-cyan-900/30 border border-cyan-700 rounded-lg">
                <div className="text-cyan-400 font-semibold">Agent</div>
                <div className="text-xs text-gray-500">Receives 402</div>
              </div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-amber-900/20 border border-amber-800 rounded-lg">
            <p className="text-xs text-amber-300">
              <strong>Key Point:</strong> SpendGuard receives the 402 from Provider and{" "}
              <strong>forwards it to Agent</strong> with x402 metadata (price, nonce, asset, network). SpendGuard does NOT pay - it only enforces policy and forwards payment requirements.
            </p>
          </div>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-5 gap-4">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stats?.total || 0}</div>
            <div className="text-sm text-gray-500">Total Requests</div>
          </div>
          <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-emerald-400">{stats?.approved || 0}</div>
            <div className="text-sm text-gray-500">Approved</div>
          </div>
          <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-amber-400">{stats?.paymentRequired || 0}</div>
            <div className="text-sm text-gray-500">402 Forwarded</div>
          </div>
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats?.denied || 0}</div>
            <div className="text-sm text-gray-500">Denied</div>
          </div>
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-cyan-400">{budget?.remaining.toFixed(4) || "0.0000"} USDC</div>
            <div className="text-sm text-gray-500">Budget Left</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Policy & Budget */}
          <div className="space-y-6">
            {/* Policy Engine */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-purple-400">📋</span> Policy Engine
                </h2>
                {!isEditingPolicy && (
                  <button
                    onClick={beginEditPolicy}
                    disabled={!policy}
                    className="text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                )}
              </div>

              {policy && !isEditingPolicy && (
                <div className="space-y-4 text-sm">
                  <div>
                    <div className="text-gray-500 mb-1">Max Price Per Call</div>
                    <div className="text-white font-mono">{policy.max_price_per_call.toFixed(4)} USDC</div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Allowed Providers</div>
                    <div className="flex flex-wrap gap-2">
                      {policy.allowed_providers.map((p) => (
                        <span key={p} className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded text-xs font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Allowed Actions</div>
                    <div className="flex flex-wrap gap-2">
                      {policy.allowed_actions.map((a) => (
                        <span key={a} className="px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded text-xs font-mono">
                          {a}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-gray-500 mb-1">Allowed Tasks</div>
                    <div className="flex flex-wrap gap-2">
                      {policy.allowed_tasks.map((t) => (
                        <span key={t} className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded text-xs font-mono">
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {isEditingPolicy && policyDraft && (
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="text-gray-500 mb-1 block">Max Price Per Call (USDC)</label>
                    <input
                      value={policyDraft.max_price_per_call}
                      onChange={(e) => setPolicyDraft({ ...policyDraft, max_price_per_call: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono text-sm"
                      inputMode="decimal"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 mb-1 block">Allowed Providers (comma-separated)</label>
                    <input
                      value={policyDraft.allowed_providers}
                      onChange={(e) => setPolicyDraft({ ...policyDraft, allowed_providers: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono text-sm"
                      placeholder="email"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 mb-1 block">Allowed Actions (comma-separated)</label>
                    <input
                      value={policyDraft.allowed_actions}
                      onChange={(e) => setPolicyDraft({ ...policyDraft, allowed_actions: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono text-sm"
                      placeholder="send"
                    />
                  </div>
                  <div>
                    <label className="text-gray-500 mb-1 block">Allowed Tasks (comma-separated)</label>
                    <input
                      value={policyDraft.allowed_tasks}
                      onChange={(e) => setPolicyDraft({ ...policyDraft, allowed_tasks: e.target.value })}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono text-sm"
                      placeholder="welcome_flow"
                    />
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={savePolicy}
                      disabled={isSavingPolicy}
                      className="px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingPolicy ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditPolicy}
                      disabled={isSavingPolicy}
                      className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Budget Engine */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <span className="text-emerald-400">💰</span> Budget Engine
                </h2>
                {!isEditingBudget && (
                  <button
                    onClick={beginEditBudget}
                    disabled={!budget}
                    className="text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Edit
                  </button>
                )}
              </div>
              {budget && (
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Daily Limit</span>
                    <span className="text-white font-mono">{budget.daily_limit.toFixed(4)} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Spent</span>
                    <span className="text-red-400 font-mono">{budget.spent.toFixed(4)} USDC</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Remaining
                      <button
                        onClick={resetBudgetRemaining}
                        disabled={isResettingBudget}
                        className="ml-2 px-2 py-1 rounded-md bg-gray-800 hover:bg-gray-700 text-white text-[11px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isResettingBudget ? "Resetting..." : "Reset"}
                      </button>
                    </span>

                    <span className="flex items-center gap-2">
                      <span className="text-emerald-400 font-mono">{budget.remaining.toFixed(4)} USDC</span>
                    </span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${100 - budget.percentage_used}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-500 text-center">
                    {budget.percentage_used.toFixed(1)}% used
                  </div>

                </div>
              )}

              {isEditingBudget && budget && (
                <div className="space-y-4 text-sm">
                  <div>
                    <label className="text-gray-500 mb-1 block">Daily Limit (USDC)</label>
                    <input
                      value={budgetDailyLimitDraft}
                      onChange={(e) => setBudgetDailyLimitDraft(e.target.value)}
                      className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white font-mono text-sm"
                      inputMode="decimal"
                    />
                    <div className="text-xs text-gray-600 mt-1">
                      Saving a new daily limit also resets remaining to that value.
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={saveBudget}
                      disabled={isSavingBudget}
                      className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSavingBudget ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={cancelEditBudget}
                      disabled={isSavingBudget}
                      className="px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Middle: Request Logs */}
          <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="text-amber-400">📊</span> Decision Logs
                {logs.length > 0 && (
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full ml-2">
                    {logs.length}
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-600 font-mono">
                  {lastUpdated ? `Updated: ${lastUpdated}` : "Not loaded"}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? "Refreshing..." : logs.length > 0 ? "Refresh" : "Load"}
                </button>
                {logs.length > 0 && (
                  <button
                    onClick={handleClear}
                    disabled={isClearing}
                    className="text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isClearing ? "Clearing..." : "Clear Log"}
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {logs.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <span className="text-2xl">📭</span>
                  <p className="mt-2">No logs yet. Run the Agent Simulator!</p>
                </div>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${selectedLog?.id === log.id
                      ? "bg-gray-800 border-cyan-700"
                      : log.decision === "PAYMENT_REQUIRED"
                        ? "bg-amber-900/10 border-amber-800 hover:border-amber-700"
                        : log.decision === "APPROVED"
                          ? "bg-emerald-900/15 border-emerald-800 hover:border-emerald-700"
                          : "bg-gray-800/50 border-gray-700 hover:border-gray-600"
                      }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-mono">{formatTime(log.timestamp)}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${log.decision === "PAYMENT_REQUIRED"
                          ? "bg-amber-900/50 text-amber-400"
                          : "bg-gray-700 text-gray-400"
                          }`}>
                          {getLogPhase(log)}
                        </span>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${getDecisionColor(log.decision)}`}>
                        {log.decision}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{log.provider}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-400">{log.action}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-400">{log.task}</span>
                      <span className="text-gray-600 ml-auto">{log.cost.toFixed(4)} USDC</span>
                    </div>

                    <div className="text-xs text-gray-500 mt-2 truncate">
                      {log.reason}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}


