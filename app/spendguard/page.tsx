"use client";

import { useState, useEffect, useCallback } from "react";

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

export default function SpendGuardInspectorPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [stats, setStats] = useState<LogStats | null>(null);
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [isClearing, setIsClearing] = useState(false);

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
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 0);
    
    const interval = setInterval(fetchData, 1500);
    
    return () => {
      clearTimeout(timeoutId);
      clearInterval(interval);
    };
  }, [fetchData]);

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
              <strong>Key Point:</strong> SpendGuard receives the 402 from Provider and <strong>forwards it to Agent</strong> with x402 metadata (price, nonce, asset, network). SpendGuard does NOT pay - it only enforces policy and forwards payment requirements.
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
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-purple-400">📋</span> Policy Engine
              </h2>
              {policy && (
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
            </div>

            {/* Budget Engine */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-emerald-400">💰</span> Budget Engine
              </h2>
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
                    <span className="text-gray-500">Remaining</span>
                    <span className="text-emerald-400 font-mono">{budget.remaining.toFixed(4)} USDC</span>
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
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedLog?.id === log.id
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
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          log.decision === "PAYMENT_REQUIRED" 
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

                    {/* Special highlight for 402 forwarding */}
                    {log.decision === "PAYMENT_REQUIRED" && (
                      <div className="mt-3 p-2 bg-amber-900/20 border border-amber-800/50 rounded text-xs">
                        <div className="flex items-center gap-2 text-amber-400 font-medium mb-1">
                          ⚡ x402 Response Forwarded
                        </div>
                        <div className="text-gray-400">
                          Provider returned 402 → SpendGuard forwarded to Agent with payment metadata
                        </div>
                      </div>
                    )}

                    {/* Expanded Details */}
                    {selectedLog?.id === log.id && (
                      <div className="mt-4 pt-4 border-t border-gray-700 space-y-4">
                        {/* Decision Path - Enhanced for 402 */}
                        <div>
                          <div className="text-xs text-gray-500 mb-2">SpendGuard Decision Path:</div>
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded">
                              1. Policy {log.reason.includes("not_allowed") ? "❌" : "✓"}
                            </span>
                            <span className="text-gray-600">→</span>
                            <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded">
                              2. Budget {log.reason.includes("budget") ? "❌" : "✓"}
                            </span>
                            <span className="text-gray-600">→</span>
                            {log.decision === "PAYMENT_REQUIRED" ? (
                              <>
                                <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded">
                                  3. Forward to Provider
                                </span>
                                <span className="text-gray-600">→</span>
                                <span className="px-2 py-1 bg-amber-900/30 text-amber-400 rounded">
                                  4. Provider returns 402
                                </span>
                                <span className="text-gray-600">→</span>
                                <span className="px-2 py-1 bg-purple-900/30 text-purple-400 rounded font-semibold">
                                  5. Forward 402 to Agent
                                </span>
                              </>
                            ) : log.decision === "APPROVED" ? (
                              <>
                                <span className="px-2 py-1 bg-cyan-900/30 text-cyan-400 rounded">
                                  3. Verify Payment
                                </span>
                                <span className="text-gray-600">→</span>
                                <span className="px-2 py-1 bg-emerald-900/30 text-emerald-400 rounded">
                                  4. Execute
                                </span>
                              </>
                            ) : (
                              <span className="px-2 py-1 bg-red-900/30 text-red-400 rounded">
                                DENIED
                              </span>
                            )}
                          </div>
                        </div>

                        {/* x402 Forwarding Details */}
                        {log.decision === "PAYMENT_REQUIRED" && log.payment_nonce && (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">x402 Data Forwarded to Agent:</div>
                            <div className="bg-amber-950/50 border border-amber-800 rounded p-3">
                              <pre className="text-xs text-amber-300 font-mono overflow-x-auto">
{JSON.stringify({
  status: 402,
  message: "Payment Required",
  x402: {
    price: log.cost,
    asset: "USDC",
    network: "base-sepolia",
    nonce: log.payment_nonce,
    payTo: "mock_wallet_address"
  }
}, null, 2)}
                              </pre>
                            </div>
                            <p className="text-xs text-gray-500 mt-2 italic">
                              ↑ This is what SpendGuard forwarded to the Agent (originally from Provider)
                            </p>
                          </div>
                        )}

                        {/* Payment Verification Info */}
                        {log.payment_nonce && log.decision !== "PAYMENT_REQUIRED" && (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Payment Verification:</div>
                            <div className="bg-gray-950 rounded p-3 text-xs font-mono">
                              <div className="text-gray-400">
                                Nonce: <span className="text-cyan-400">{log.payment_nonce}</span>
                              </div>
                              {log.payment_payer && (
                                <div className="text-gray-400">
                                  Payer: <span className="text-cyan-400">{log.payment_payer}</span>
                                </div>
                              )}
                              <div className="text-gray-400">
                                Verified: <span className={log.payment_verified ? "text-emerald-400" : "text-red-400"}>
                                  {log.payment_verified ? "✓ YES" : "✕ NO"}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Raw Payload */}
                        {log.payload && (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Original Request Payload:</div>
                            <pre className="bg-gray-950 rounded p-3 text-xs text-gray-300 font-mono overflow-x-auto">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}

                        {/* Raw Response */}
                        {log.response && (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Provider Response:</div>
                            <pre className="bg-gray-950 rounded p-3 text-xs text-emerald-300 font-mono overflow-x-auto">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
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
