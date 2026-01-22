"use client";

import { useState, useEffect, useCallback } from "react";

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  spent: number;
  percentage_used: number;
}

interface PaymentRequirement {
  price: number;
  asset: string;
  network: string;
  nonce: string;
  payTo: string;
}

interface ExecuteResult {
  decision: "APPROVED" | "DENIED" | "PAYMENT_REQUIRED";
  reason: string;
  log_id: string;
  x402_payment_required?: PaymentRequirement;
  provider_response?: Record<string, unknown>;
}

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

export default function DemoPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);
  const [isClearingLogs, setIsClearingLogs] = useState(false);
  const [isPreparingScenario, setIsPreparingScenario] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchBudget = useCallback(async () => {
    const res = await fetch("/api/budget");
    const data = (await res.json()) as BudgetStatus;
    setBudget(data);
  }, []);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/logs?limit=100");
    const data = await res.json();
    setLogs((data.logs || []) as AuditLogEntry[]);
  }, []);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await Promise.all([fetchBudget(), fetchLogs()]);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Fetch once on mount (no polling).
    void (async () => {
      await Promise.all([fetchBudget(), fetchLogs()]);
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
    })();
  }, [fetchBudget, fetchLogs]);

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const setBudgetLimitAndReset = async (limit: number) => {
    await fetch("/api/budget", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ daily_limit: limit }),
    });
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
  };

  const prepareScenario = async (opts?: {
    dailyLimit?: number;
    clearLogs?: boolean;
    clearNonces?: boolean;
  }) => {
    setIsPreparingScenario(true);
    setExpandedLogId(null);

    try {
      const clearLogs = opts?.clearLogs ?? true;
      const clearNonces = opts?.clearNonces ?? true;

      // Clean slate: logs + payment nonces/pending payments (unless explicitly skipped).
      if (clearLogs) {
        await fetch("/api/logs", { method: "DELETE" });
      }
      if (clearNonces) {
        await fetch("/api/budget", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "clear_nonces" }),
        });
      }

      // Set the scenario budget limit and reset remaining to match.
      const limit = opts?.dailyLimit ?? 1.0;
      await setBudgetLimitAndReset(limit);

      await Promise.all([fetchLogs(), fetchBudget()]);
    } finally {
      setIsPreparingScenario(false);
    }
  };

  // Helper to sign mock payment proof
  const signPaymentProof = (requirement: PaymentRequirement): string => {
    const proof = {
      nonce: requirement.nonce,
      payer: `mock_payer_${Date.now()}`,
      signature: `mock_signature_${requirement.nonce}_${Date.now()}`,
      amount: requirement.price,
      asset: requirement.asset,
      network: requirement.network,
      timestamp: new Date().toISOString(),
    };
    return btoa(JSON.stringify(proof));
  };

  // Normal x402 Flow
  const runNormalFlow = async () => {
    setIsRunning(true);
    setCurrentScenario("normal");
    setStatusText("Resetting logs/budget, then running normal x402 flow...");

    try {
      await prepareScenario({ dailyLimit: 1.0 });
      await delay(300);

      const response1 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "demo@example.com", subject: "Test x402 Flow" },
        }),
      });

      const result1: ExecuteResult = await response1.json();

      if (result1.decision !== "PAYMENT_REQUIRED" || !result1.x402_payment_required) {
        throw new Error(`Expected 402, got ${result1.decision}`);
      }

      setStatusText("Received 402, signing proof...");
      await delay(300);
      const paymentProof = signPaymentProof(result1.x402_payment_required);

      setStatusText("Retrying with payment proof...");
      await delay(200);

      const response2 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-PROOF": paymentProof,
        },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "demo@example.com", subject: "Test x402 Flow" },
        }),
      });

      const result2: ExecuteResult = await response2.json();

      if (result2.decision !== "APPROVED") {
        throw new Error(result2.reason);
      }

      setStatusText("Done. Check SpendGuard logs below (and other tabs).");
    } catch (error) {
      console.error("Normal flow error:", error);
      setStatusText("Normal flow failed. Check SpendGuard logs below.");
    } finally {
      // No polling: refresh logs once after the scenario completes.
      await fetchLogs();
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
      setIsRunning(false);
    }
  };

  // Policy Violation Flow
  const runPolicyViolation = async () => {
    setIsRunning(true);
    setCurrentScenario("policy_violation");
    setStatusText("Resetting logs/budget, then running policy violation scenario...");

    try {
      await prepareScenario({ dailyLimit: 1.0 });
      await delay(300);

      const response = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "sms", // Not in allowlist
          action: "send",
          task: "welcome_flow",
          payload: { to: "+1234567890", message: "Test" },
        }),
      });

      await response.json();
      setStatusText("Done. Check SpendGuard logs below.");
    } catch (error) {
      console.error("Policy violation error:", error);
      setStatusText("Policy violation run failed. Check SpendGuard logs below.");
    } finally {
      await fetchLogs();
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
      setIsRunning(false);
    }
  };

  // Budget Exhausted Flow
  const runBudgetExhausted = async () => {
    setIsRunning(true);
    setCurrentScenario("budget_exhausted");
    setStatusText("Resetting logs/budget, then running budget exhausted scenario...");

    try {
      // Start clean at the default budget before we prime and compute the correct scenario limit.
      await prepareScenario({ dailyLimit: 1.0 });

      // Prime a 402 to learn the live per-call price (so this keeps working if pricing changes)
      const primeRes = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "test@test.com", subject: "Budget Exhaust Prime" },
        }),
      });

      const prime: ExecuteResult = await primeRes.json();
      if (prime.decision !== "PAYMENT_REQUIRED" || !prime.x402_payment_required) {
        throw new Error(`Expected 402 prime, got ${prime.decision}`);
      }

      const price = prime.x402_payment_required.price;
      const scenarioLimit = Number((price * 2).toFixed(6)); // allow exactly 2 paid executions

      // Switch budget to the scenario limit and reset remaining to match.
      // IMPORTANT: do NOT clear nonces/pending payments here, or we'd delete the primed nonce.
      await setBudgetLimitAndReset(scenarioLimit);
      await fetchBudget();

      setStatusText(`Daily limit set to ${scenarioLimit.toFixed(6)} (2x price). Paying twice to drain budget...`);
      await delay(200);

      // 1) Pay the primed nonce (spends 1x price)
      const proof1 = signPaymentProof(prime.x402_payment_required);
      const paid1 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-PAYMENT-PROOF": proof1 },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "test@test.com", subject: "Budget Exhaust 1/2" },
        }),
      });
      await paid1.json();
      await fetchBudget();
      await delay(200);

      // 2) Get a second nonce, then pay it (spends 2x price total)
      const res2 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "test@test.com", subject: "Budget Exhaust 2/2" },
        }),
      });
      const r2: ExecuteResult = await res2.json();
      if (r2.decision !== "PAYMENT_REQUIRED" || !r2.x402_payment_required) {
        throw new Error(`Expected 402 second, got ${r2.decision}`);
      }

      const proof2 = signPaymentProof(r2.x402_payment_required);
      const paid2 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-PAYMENT-PROOF": proof2 },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "test@test.com", subject: "Budget Exhaust 2/2 (paid)" },
        }),
      });
      await paid2.json();
      await fetchBudget();
      await delay(200);

      // 3) One more attempt should DENY immediately on budget check
      const denyRes = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "final@test.com", subject: "Over budget" },
        }),
      });
      const deny: ExecuteResult = await denyRes.json();
      if (deny.decision !== "DENIED") {
        throw new Error(`Expected budget DENY, got ${deny.decision}`);
      }

      // Leave the budget exhausted (remaining should be ~0) so the UI reflects the scenario outcome.
      await fetchBudget();
      setStatusText("Done. Budget DENY is in logs (budget remains exhausted).");
    } catch (error) {
      console.error("Budget exhausted error:", error);
      setStatusText("Budget exhausted run failed. Check SpendGuard logs below.");
    } finally {
      await fetchLogs();
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
      setIsRunning(false);
    }
  };

  // Replay Attack Flow
  const runReplayAttack = async () => {
    setIsRunning(true);
    setCurrentScenario("replay_attack");
    setStatusText("Resetting logs/budget, then running replay attack scenario...");

    try {
      await prepareScenario({ dailyLimit: 1.0 });
      await delay(300);

      const res1 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "replay@test.com", subject: "Replay Test" },
        }),
      });

      const result1: ExecuteResult = await res1.json();

      if (!result1.x402_payment_required) {
        throw new Error("Expected 402");
      }

      setStatusText("Paying once, then attempting replay...");
      await delay(300);

      const paymentProof = signPaymentProof(result1.x402_payment_required);

      const res2 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-PROOF": paymentProof,
        },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "replay@test.com", subject: "Replay Test" },
        }),
      });

      await res2.json();
      await delay(500);

      const res3 = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-PROOF": paymentProof, // Same proof!
        },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "replay@test.com", subject: "Replay Attack!" },
        }),
      });

      await res3.json();
      setStatusText("Done. Replay result is in SpendGuard logs below.");
    } catch (error) {
      console.error("Replay attack error:", error);
      setStatusText("Replay attack run failed. Check SpendGuard logs below.");
    } finally {
      await fetchLogs();
      setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
      setIsRunning(false);
    }
  };

  const handleClearLogs = async () => {
    try {
      setIsClearingLogs(true);
      await fetch("/api/logs", { method: "DELETE" });
      await fetchLogs();
      setStatusText("Logs cleared.");
    } catch (error) {
      console.error("Failed to clear logs:", error);
      setStatusText("Failed to clear logs. See console for details.");
    } finally {
      setIsClearingLogs(false);
    }
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const decisionBadge = (decision: AuditLogEntry["decision"]) => {
    if (decision === "APPROVED") return "bg-emerald-500/20 text-emerald-400";
    if (decision === "PAYMENT_REQUIRED") return "bg-amber-500/20 text-amber-400";
    return "bg-red-500/20 text-red-400";
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            Demo Flow
          </h1>
          <p className="text-gray-400">
            Run guided scenarios. SpendGuard logs below are the source of truth.
          </p>
          {statusText && (
            <p className="text-xs text-gray-500">{statusText}</p>
          )}
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Budget & Scenarios */}
          <div className="space-y-6">
            {/* Budget Card */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-emerald-400">◈</span> Budget
              </h2>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <div className="text-sm text-gray-500">Remaining</div>
                    <div className="text-3xl font-bold text-emerald-400">
                      {budget?.remaining.toFixed(4) || "0.0000"} USDC
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">
                    of {budget?.daily_limit.toFixed(4) || "0.0000"} USDC
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${100 - (budget?.percentage_used || 0)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Test Scenarios */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-amber-400">▶</span> Scenarios
              </h2>
              {isPreparingScenario && (
                <div className="mb-3 text-xs text-gray-500">
                  Preparing scenario (clearing logs, resetting budget/nonces)…
                </div>
              )}
              <div className="space-y-3">
                <button
                  onClick={runNormalFlow}
                  disabled={isRunning || isPreparingScenario}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    isRunning && currentScenario === "normal"
                      ? "bg-emerald-900/30 border-2 border-emerald-500"
                      : "bg-gray-800/50 hover:bg-gray-800 border border-gray-700"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-emerald-400">
                      {isRunning && currentScenario === "normal" ? "◌" : "▶"}
                    </span>
                    <div>
                      <div className="font-medium text-white">Normal x402 Flow</div>
                      <div className="text-sm text-gray-500">
                        Intent → 402 → Pay → Execute
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={runPolicyViolation}
                  disabled={isRunning || isPreparingScenario}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    isRunning && currentScenario === "policy_violation"
                      ? "bg-red-900/30 border-2 border-red-500"
                      : "bg-gray-800/50 hover:bg-gray-800 border border-gray-700"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-red-400">
                      {isRunning && currentScenario === "policy_violation" ? "◌" : "▶"}
                    </span>
                    <div>
                      <div className="font-medium text-white">Policy Violation</div>
                      <div className="text-sm text-gray-500">
                        Invalid provider → DENY
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={runBudgetExhausted}
                  disabled={isRunning || isPreparingScenario}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    isRunning && currentScenario === "budget_exhausted"
                      ? "bg-amber-900/30 border-2 border-amber-500"
                      : "bg-gray-800/50 hover:bg-gray-800 border border-gray-700"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-amber-400">
                      {isRunning && currentScenario === "budget_exhausted" ? "◌" : "▶"}
                    </span>
                    <div>
                      <div className="font-medium text-white">Budget Exhausted</div>
                      <div className="text-sm text-gray-500">
                        Multiple requests → Budget DENY
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  onClick={runReplayAttack}
                  disabled={isRunning || isPreparingScenario}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    isRunning && currentScenario === "replay_attack"
                      ? "bg-purple-900/30 border-2 border-purple-500"
                      : "bg-gray-800/50 hover:bg-gray-800 border border-gray-700"
                  } disabled:opacity-50`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-purple-400">
                      {isRunning && currentScenario === "replay_attack" ? "◌" : "▶"}
                    </span>
                    <div>
                      <div className="font-medium text-white">Replay Attack</div>
                      <div className="text-sm text-gray-500">
                        Reuse payment proof → DENY
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* SpendGuard Logs (source of truth) */}
          <div className="lg:col-span-2 bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="text-emerald-400">🛡️</span> SpendGuard Logs
                <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
                  {logs.length}
                </span>
              </h2>
              <div className="flex items-center gap-4">
                <div className="text-xs text-gray-600 font-mono">
                  {lastUpdated ? `Updated: ${lastUpdated}` : "Not loaded"}
                </div>
                <button
                  onClick={handleRefresh}
                  disabled={isRefreshing || isRunning || isPreparingScenario}
                  className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <button
                  onClick={handleClearLogs}
                  disabled={isRunning || isClearingLogs || logs.length === 0}
                  className="text-xs text-gray-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isClearingLogs ? "Clearing..." : "Clear Logs"}
                </button>
                <div className="text-xs text-gray-500">
                  Tip: click a row to view details
                </div>
              </div>
            </div>

            {logs.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <span className="text-2xl">📭</span>
                <p className="mt-2">No logs yet</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[650px] overflow-y-auto">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    onClick={() => setExpandedLogId((prev) => (prev === log.id ? null : log.id))}
                    className={`p-4 rounded-lg border cursor-pointer transition-all ${
                      expandedLogId === log.id
                        ? "border-emerald-700 bg-gray-800"
                        : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500 font-mono">{formatTime(log.timestamp)}</span>
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${decisionBadge(log.decision)}`}>
                          {log.decision}
                        </span>
                        <span className="text-xs text-gray-600 font-mono">{log.id}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {expandedLogId === log.id ? "Hide" : "Show"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-500">{log.provider}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-400">{log.action}</span>
                      <span className="text-gray-600">→</span>
                      <span className="text-gray-400">{log.task}</span>
                      <span className="text-gray-600 ml-auto">{log.cost.toFixed(4)} USDC</span>
                    </div>

                    <div
                      className={`text-xs text-gray-500 mt-2 ${
                        expandedLogId === log.id ? "whitespace-pre-wrap" : "line-clamp-2"
                      }`}
                    >
                      {log.reason}
                    </div>

                    {expandedLogId === log.id && (
                      <div className="mt-4 pt-4 border-t border-gray-700 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                          <div className="bg-gray-950/60 border border-gray-800 rounded-lg p-3">
                            <div className="text-gray-500 mb-1">Payment</div>
                            <div className="text-gray-300 font-mono space-y-1">
                              <div>
                                Nonce: <span className="text-cyan-400">{log.payment_nonce || "-"}</span>
                              </div>
                              <div>
                                Payer: <span className="text-cyan-400">{log.payment_payer || "-"}</span>
                              </div>
                              <div>
                                Verified:{" "}
                                <span
                                  className={
                                    log.payment_verified === true
                                      ? "text-emerald-400"
                                      : log.payment_verified === false
                                        ? "text-red-400"
                                        : "text-gray-500"
                                  }
                                >
                                  {log.payment_verified === true
                                    ? "YES"
                                    : log.payment_verified === false
                                      ? "NO"
                                      : "-"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-950/60 border border-gray-800 rounded-lg p-3">
                            <div className="text-gray-500 mb-1">Request</div>
                            <div className="text-gray-300 font-mono space-y-1">
                              <div>
                                Provider: <span className="text-gray-200">{log.provider}</span>
                              </div>
                              <div>
                                Action: <span className="text-gray-200">{log.action}</span>
                              </div>
                              <div>
                                Task: <span className="text-gray-200">{log.task}</span>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-950/60 border border-gray-800 rounded-lg p-3">
                            <div className="text-gray-500 mb-1">Cost</div>
                            <div className="text-gray-300 font-mono space-y-1">
                              <div>
                                Cost: <span className="text-gray-200">{log.cost.toFixed(4)} USDC</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {log.payload && (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Payload</div>
                            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-gray-300 font-mono overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.payload, null, 2)}
                            </pre>
                          </div>
                        )}

                        {log.response && (
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Response</div>
                            <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">
                              {JSON.stringify(log.response, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
