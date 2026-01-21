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

interface FlowStep {
  name: string;
  status: "pending" | "active" | "success" | "error";
  detail?: string;
}

interface TestResult {
  id: string;
  scenario: string;
  decision: "APPROVED" | "DENIED" | "PAYMENT_REQUIRED";
  reason: string;
  timestamp: string;
}

export default function TestPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [results, setResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentScenario, setCurrentScenario] = useState<string | null>(null);
  const [flowSteps, setFlowSteps] = useState<FlowStep[]>([]);
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequirement | null>(null);

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

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  const updateStep = (index: number, updates: Partial<FlowStep>) => {
    setFlowSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, ...updates } : step))
    );
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
    setPaymentRequired(null);

    const steps: FlowStep[] = [
      { name: "Send Intent (no payment)", status: "pending" },
      { name: "Policy Check", status: "pending" },
      { name: "Provider returns 402", status: "pending" },
      { name: "Sign Payment Proof", status: "pending" },
      { name: "Verify Payment", status: "pending" },
      { name: "Provider Executes", status: "pending" },
    ];
    setFlowSteps(steps);

    try {
      // Step 1: Send intent
      updateStep(0, { status: "active" });
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
      updateStep(0, { status: "success", detail: "Request sent" });

      // Step 2: Policy passed (implied by getting 402)
      updateStep(1, { status: "active" });
      await delay(200);
      updateStep(1, { status: "success", detail: "ALLOWED" });

      if (result1.decision !== "PAYMENT_REQUIRED" || !result1.x402_payment_required) {
        throw new Error(`Expected 402, got ${result1.decision}`);
      }

      // Step 3: Got 402
      updateStep(2, { status: "active" });
      await delay(200);
      setPaymentRequired(result1.x402_payment_required);
      updateStep(2, {
        status: "success",
        detail: `Price: ${result1.x402_payment_required.price} ${result1.x402_payment_required.asset}`,
      });

      // Step 4: Sign payment
      updateStep(3, { status: "active" });
      await delay(300);
      const paymentProof = signPaymentProof(result1.x402_payment_required);
      updateStep(3, {
        status: "success",
        detail: `Nonce: ${result1.x402_payment_required.nonce.substring(0, 15)}...`,
      });

      // Step 5: Retry with payment proof
      updateStep(4, { status: "active" });
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
        updateStep(4, { status: "error", detail: result2.reason });
        throw new Error(result2.reason);
      }

      updateStep(4, { status: "success", detail: "Payment verified" });

      // Step 6: Success
      updateStep(5, { status: "active" });
      await delay(200);
      updateStep(5, { status: "success", detail: "Email sent!" });

      setResults((prev) => [
        {
          id: result2.log_id,
          scenario: "normal",
          decision: result2.decision,
          reason: result2.reason,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Normal flow error:", error);
    }

    setIsRunning(false);
  };

  // Policy Violation Flow
  const runPolicyViolation = async () => {
    setIsRunning(true);
    setCurrentScenario("policy_violation");
    setPaymentRequired(null);

    const steps: FlowStep[] = [
      { name: "Send Intent (invalid provider)", status: "pending" },
      { name: "Policy Check", status: "pending" },
    ];
    setFlowSteps(steps);

    try {
      updateStep(0, { status: "active" });
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

      const result: ExecuteResult = await response.json();
      updateStep(0, { status: "success" });

      updateStep(1, { status: "active" });
      await delay(200);
      updateStep(1, { status: "error", detail: result.reason });

      setResults((prev) => [
        {
          id: result.log_id,
          scenario: "policy_violation",
          decision: result.decision,
          reason: result.reason,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Policy violation error:", error);
    }

    setIsRunning(false);
  };

  // Budget Exhausted Flow
  const runBudgetExhausted = async () => {
    setIsRunning(true);
    setCurrentScenario("budget_exhausted");
    setPaymentRequired(null);

    const steps: FlowStep[] = [
      { name: "Exhaust Budget", status: "pending" },
      { name: "Send New Request", status: "pending" },
      { name: "Budget Check", status: "pending" },
    ];
    setFlowSteps(steps);

    try {
      // First, run many successful requests to exhaust budget
      updateStep(0, { status: "active" });

      // Run multiple successful flows to deplete budget
      for (let i = 0; i < 5; i++) {
        // Get 402
        const res1 = await fetch("/api/spendguard/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            provider: "email",
            action: "send",
            task: "welcome_flow",
            payload: { to: "test@test.com", subject: `Deplete ${i}` },
          }),
        });
        const r1: ExecuteResult = await res1.json();

        if (r1.x402_payment_required) {
          const proof = signPaymentProof(r1.x402_payment_required);

          // Complete payment
          await fetch("/api/spendguard/execute", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-PAYMENT-PROOF": proof,
            },
            body: JSON.stringify({
              provider: "email",
              action: "send",
              task: "welcome_flow",
              payload: { to: "test@test.com", subject: `Deplete ${i}` },
            }),
          });
        }

        await fetchBudget();
        await delay(100);
      }

      updateStep(0, { status: "success", detail: "Budget depleted" });

      // Now try one more
      updateStep(1, { status: "active" });
      await delay(300);

      const response = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "email",
          action: "send",
          task: "welcome_flow",
          payload: { to: "final@test.com", subject: "Over budget" },
        }),
      });

      const result: ExecuteResult = await response.json();
      updateStep(1, { status: "success" });

      updateStep(2, { status: "active" });
      await delay(200);

      if (result.decision === "DENIED" && result.reason.includes("budget")) {
        updateStep(2, { status: "error", detail: result.reason });
      } else {
        updateStep(2, { status: "success", detail: "Budget OK (try again)" });
      }

      setResults((prev) => [
        {
          id: result.log_id,
          scenario: "budget_exhausted",
          decision: result.decision,
          reason: result.reason,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Budget exhausted error:", error);
    }

    setIsRunning(false);
  };

  // Replay Attack Flow
  const runReplayAttack = async () => {
    setIsRunning(true);
    setCurrentScenario("replay_attack");
    setPaymentRequired(null);

    const steps: FlowStep[] = [
      { name: "First Request (get 402)", status: "pending" },
      { name: "Pay and Execute", status: "pending" },
      { name: "Replay Same Proof", status: "pending" },
      { name: "Replay Detection", status: "pending" },
    ];
    setFlowSteps(steps);

    try {
      // Step 1: Get 402
      updateStep(0, { status: "active" });
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

      updateStep(0, {
        status: "success",
        detail: `Got nonce: ${result1.x402_payment_required.nonce.substring(0, 15)}...`,
      });

      // Step 2: Sign and pay
      updateStep(1, { status: "active" });
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

      const result2: ExecuteResult = await res2.json();
      updateStep(1, { status: "success", detail: "Payment accepted" });

      // Step 3: Try to replay
      updateStep(2, { status: "active" });
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

      const result3: ExecuteResult = await res3.json();
      updateStep(2, { status: "success", detail: "Replay attempted" });

      // Step 4: Should be denied
      updateStep(3, { status: "active" });
      await delay(200);

      if (result3.decision === "DENIED") {
        updateStep(3, { status: "success", detail: "🛡️ Replay blocked!" });
      } else {
        updateStep(3, { status: "error", detail: "Replay NOT blocked!" });
      }

      setResults((prev) => [
        {
          id: result3.log_id,
          scenario: "replay_attack",
          decision: result3.decision,
          reason: result3.reason,
          timestamp: new Date().toLocaleTimeString(),
        },
        ...prev,
      ]);
    } catch (error) {
      console.error("Replay attack error:", error);
    }

    setIsRunning(false);
  };

  const handleResetBudget = async () => {
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset" }),
    });
    await fetchBudget();
  };

  const handleClearNonces = async () => {
    await fetch("/api/budget", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear_nonces" }),
    });
  };

  const clearResults = () => {
    setResults([]);
    setFlowSteps([]);
    setPaymentRequired(null);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            x402 Test Console
          </h1>
          <p className="text-gray-400">
            Demo the x402 hard guard flow:{" "}
            <span className="text-emerald-400">decide</span> →{" "}
            <span className="text-amber-400">pay</span> →{" "}
            <span className="text-cyan-400">run</span>
          </p>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Budget & Scenarios */}
          <div className="space-y-6">
            {/* Budget Card */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-emerald-400">◈</span> Live Budget
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
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
                    style={{
                      width: `${100 - (budget?.percentage_used || 0)}%`,
                    }}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleResetBudget}
                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Reset Budget
                  </button>
                  <button
                    onClick={handleClearNonces}
                    className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                  >
                    Clear Nonces
                  </button>
                </div>
              </div>
            </div>

            {/* Test Scenarios */}
            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <span className="text-amber-400">▶</span> Test Scenarios
              </h2>
              <div className="space-y-3">
                <button
                  onClick={runNormalFlow}
                  disabled={isRunning}
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
                  disabled={isRunning}
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
                  disabled={isRunning}
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
                  disabled={isRunning}
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

            {/* Payment Required Info */}
            {paymentRequired && (
              <div className="bg-amber-900/20 border border-amber-700 rounded-xl p-6">
                <h2 className="text-lg font-semibold text-amber-400 mb-4 flex items-center gap-2">
                  <span>⚡</span> Payment Required
                </h2>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price:</span>
                    <span className="text-white font-mono">
                      {paymentRequired.price} {paymentRequired.asset}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Network:</span>
                    <span className="text-white font-mono">
                      {paymentRequired.network}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Nonce:</span>
                    <span className="text-white font-mono text-xs">
                      {paymentRequired.nonce}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Middle Column: Flow Progress */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="text-cyan-400">◈</span> Flow Progress
            </h2>
            {flowSteps.length > 0 ? (
              <div className="space-y-4">
                {flowSteps.map((step, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        step.status === "success"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : step.status === "error"
                          ? "bg-red-500/20 text-red-400"
                          : step.status === "active"
                          ? "bg-cyan-500/20 text-cyan-400 animate-pulse"
                          : "bg-gray-800 text-gray-500"
                      }`}
                    >
                      {step.status === "success"
                        ? "✓"
                        : step.status === "error"
                        ? "✕"
                        : step.status === "active"
                        ? "◌"
                        : i + 1}
                    </div>
                    <div className="flex-1">
                      <div
                        className={`font-medium ${
                          step.status === "success"
                            ? "text-emerald-400"
                            : step.status === "error"
                            ? "text-red-400"
                            : step.status === "active"
                            ? "text-cyan-400"
                            : "text-gray-500"
                        }`}
                      >
                        {step.name}
                      </div>
                      {step.detail && (
                        <div className="text-sm text-gray-500">{step.detail}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <span className="text-2xl">▶</span>
                <p className="mt-2">Run a scenario to see the flow</p>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="text-gray-400">☰</span> Results
                {results.length > 0 && (
                  <span className="text-xs bg-gray-700 px-2 py-1 rounded-full">
                    {results.length}
                  </span>
                )}
              </h2>
              {results.length > 0 && (
                <button
                  onClick={clearResults}
                  className="text-sm text-gray-500 hover:text-white transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            {results.length > 0 ? (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {results.map((result, i) => (
                  <div
                    key={i}
                    className="p-4 bg-gray-800/50 rounded-lg border border-gray-700"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">
                        {result.scenario}
                      </span>
                      <span
                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                          result.decision === "APPROVED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : result.decision === "PAYMENT_REQUIRED"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {result.decision}
                      </span>
                    </div>
                    <div className="text-sm text-gray-300">{result.reason}</div>
                    <div className="text-xs text-gray-500 mt-1">
                      {result.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <span className="text-2xl">◇</span>
                <p className="mt-2">No results yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Architecture Diagram */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-6">
            x402 Hard Guard Architecture
          </h2>
          
          {/* Actors */}
          <div className="grid grid-cols-4 gap-4 mb-8">
            <div className="text-center">
              <div className="bg-cyan-900/30 border border-cyan-700 rounded-lg p-3">
                <div className="text-cyan-400 font-semibold">Client</div>
                <div className="text-xs text-gray-500">(Agent)</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-emerald-900/30 border border-emerald-700 rounded-lg p-3">
                <div className="text-emerald-400 font-semibold">SpendGuard</div>
                <div className="text-xs text-gray-500">(Control Plane)</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-purple-900/30 border border-purple-700 rounded-lg p-3">
                <div className="text-purple-400 font-semibold">Verifier</div>
                <div className="text-xs text-gray-500">(Mock Payment)</div>
              </div>
            </div>
            <div className="text-center">
              <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-3">
                <div className="text-amber-400 font-semibold">Provider</div>
                <div className="text-xs text-gray-500">(x402 Mock)</div>
              </div>
            </div>
          </div>

          {/* Flow Steps */}
          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 w-6">1.</span>
              <span className="text-gray-400">Client</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-emerald-400">→</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-500 ml-2">POST intent (no payment)</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 w-6">2.</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-500 ml-2">Policy Check → ALLOW</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 w-6">3.</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-amber-400">→</span>
              <span className="text-gray-400">Provider</span>
              <span className="text-gray-500 ml-2">Forward request</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-amber-400 w-6">4.</span>
              <span className="text-gray-400">Provider</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-emerald-400">←</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-amber-500 ml-2 font-mono">402 Payment Required</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 w-6">5.</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-cyan-400">←</span>
              <span className="text-gray-400">Client</span>
              <span className="text-gray-500 ml-2">402 + x402 data (price, nonce)</span>
            </div>
            
            <div className="flex items-center gap-2 pl-6">
              <span className="text-cyan-400 w-6">6.</span>
              <span className="text-gray-400">Client signs mock payment proof</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-cyan-400 w-6">7.</span>
              <span className="text-gray-400">Client</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-emerald-400">→</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-500 ml-2">Retry + X-PAYMENT-PROOF</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 w-6">8.</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-purple-400">→</span>
              <span className="text-gray-400">Verifier</span>
              <span className="text-gray-500 ml-2">Verify proof → VALID</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 w-6">9.</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-amber-400">→</span>
              <span className="text-gray-400">Provider</span>
              <span className="text-gray-500 ml-2">Forward + proof</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-amber-400 w-6">10.</span>
              <span className="text-gray-400">Provider</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-emerald-400">←</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-emerald-500 ml-2 font-mono">200 OK + result</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-emerald-400 w-6">11.</span>
              <span className="text-gray-400">SpendGuard</span>
              <span className="text-gray-600 flex-1 border-t border-dashed border-gray-700 mx-2"></span>
              <span className="text-cyan-400">←</span>
              <span className="text-gray-400">Client</span>
              <span className="text-emerald-500 ml-2 font-semibold">APPROVED</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
