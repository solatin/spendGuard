"use client";

import { useState, useEffect, useCallback } from "react";

interface PaymentRequirement {
  price: number;
  asset: string;
  network: string;
  nonce: string;
  payTo: string;
}

interface TimelineStep {
  id: string;
  name: string;
  status: "pending" | "active" | "success" | "error";
  description?: string;
  request?: string;
  response?: string;
  timestamp: string;
}

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
}

// Static agent payload
const AGENT_PAYLOAD = {
  provider: "email",
  action: "send",
  task: "welcome_flow",
  payload: {
    to: "demo@example.com",
    subject: "Hello from Agent",
    body: "This is an automated message from the AI agent.",
  },
};

export default function AgentPage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [steps, setSteps] = useState<TimelineStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<"idle" | "awaiting_payment" | "completed" | "denied">("idle");
  const [paymentRequired, setPaymentRequired] = useState<PaymentRequirement | null>(null);
  const [currentPaymentProof, setCurrentPaymentProof] = useState<Record<string, unknown> | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set());
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchBudget = useCallback(async () => {
    const res = await fetch("/api/budget");
    const data = await res.json();
    setBudget(data);
  }, []);

  useEffect(() => {
    fetchBudget();
    if (autoRefresh) {
      const interval = setInterval(fetchBudget, 1500);
      return () => clearInterval(interval);
    }
  }, [fetchBudget, autoRefresh]);

  const toggleExpand = (stepId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const addStep = (step: TimelineStep) => {
    setSteps((prev) => [...prev, step]);
  };

  const updateStep = (stepId: string, updates: Partial<TimelineStep>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === stepId ? { ...s, ...updates } : s))
    );
  };

  const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // Sign mock payment proof
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

  // Phase 1: Send Intent (no payment)
  const handleSendIntent = async () => {
    setIsRunning(true);
    setPhase("idle");
    setPaymentRequired(null);
    setCurrentPaymentProof(null);
    setSteps([]);
    setExpandedSteps(new Set());

    try {
      // Step 1: Agent sends request
      addStep({
        id: "send_request",
        name: "📤 Send Request",
        status: "active",
        timestamp: new Date().toISOString(),
      });
      await delay(300);

      const requestBody = JSON.stringify(AGENT_PAYLOAD, null, 2);
      updateStep("send_request", {
        request: `POST /api/spendguard/execute\nContent-Type: application/json\n\n${requestBody}`,
      });

      const response = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(AGENT_PAYLOAD),
      });

      const result = await response.json();
      const responseBody = JSON.stringify(result, null, 2);

      updateStep("send_request", {
        status: "success",
        description: "Request sent",
        response: `HTTP ${response.status}\n\n${responseBody}`,
      });

      // Step 2: Agent receives response
      await delay(200);
      addStep({
        id: "receive_response",
        name: "📥 Receive Response",
        status: "active",
        timestamp: new Date().toISOString(),
      });
      await delay(300);

      if (result.decision === "DENIED") {
        updateStep("receive_response", {
          status: "error",
          description: `DENIED: ${result.reason}`,
          response: responseBody,
        });
        setPhase("denied");
        setIsRunning(false);
        return;
      }

      if (result.decision === "PAYMENT_REQUIRED" && result.x402_payment_required) {
        const x402 = result.x402_payment_required;
        setPaymentRequired(x402);

        updateStep("receive_response", {
          status: "success",
          description: `402 Payment Required - ${x402.price} ${x402.asset}`,
          response: `HTTP 402 Payment Required\n\n${JSON.stringify({ x402 }, null, 2)}`,
        });

        setPhase("awaiting_payment");
        setIsRunning(false);
        return;
      }

      // Unexpected response
      updateStep("receive_response", {
        status: "error",
        description: `Unexpected: ${result.decision}`,
        response: responseBody,
      });

    } catch (error) {
      console.error("Send intent error:", error);
      updateStep("send_request", {
        status: "error",
        description: `Error: ${error instanceof Error ? error.message : "Unknown"}`,
      });
    }

    setIsRunning(false);
  };

  // Phase 2: Send Payment Proof
  const handleSendPaymentProof = async () => {
    if (!paymentRequired) return;

    setIsRunning(true);
    setCurrentPaymentProof(null);

    try {
      // Step 3: Agent signs payment proof (local action)
      addStep({
        id: "sign_proof",
        name: "✍️ Sign Payment Proof",
        status: "active",
        timestamp: new Date().toISOString(),
        description: "Signing locally...",
      });
      await delay(400);

      const paymentProof = signPaymentProof(paymentRequired);
      const decodedProof = JSON.parse(atob(paymentProof));
      setCurrentPaymentProof(decodedProof);

      updateStep("sign_proof", {
        status: "success",
        description: "Payment proof signed",
        request: `Payment Requirement:\n${JSON.stringify({
          price: paymentRequired.price,
          asset: paymentRequired.asset,
          network: paymentRequired.network,
          nonce: paymentRequired.nonce,
          payTo: paymentRequired.payTo,
        }, null, 2)}`,
        response: `Mock Payment Proof (signed):\n${JSON.stringify(decodedProof, null, 2)}`,
      });

      // Step 4: Agent retries with payment proof
      await delay(200);
      addStep({
        id: "retry_request",
        name: "📤 Retry with Payment",
        status: "active",
        timestamp: new Date().toISOString(),
      });
      await delay(300);

      const requestBody = JSON.stringify(AGENT_PAYLOAD, null, 2);
      updateStep("retry_request", {
        request: `POST /api/spendguard/execute\nContent-Type: application/json\nX-PAYMENT-PROOF: <base64-encoded>\n\n--- Payment Proof (decoded) ---\n${JSON.stringify(decodedProof, null, 2)}\n\n--- Request Body ---\n${requestBody}`,
      });

      const response = await fetch("/api/spendguard/execute", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT-PROOF": paymentProof,
        },
        body: JSON.stringify(AGENT_PAYLOAD),
      });

      const result = await response.json();
      const responseBody = JSON.stringify(result, null, 2);

      updateStep("retry_request", {
        status: "success",
        description: "Request sent with payment proof",
        response: `HTTP ${response.status}\n\n${responseBody}`,
      });

      // Step 5: Agent receives final response
      await delay(200);
      addStep({
        id: "final_response",
        name: "📥 Final Response",
        status: "active",
        timestamp: new Date().toISOString(),
      });
      await delay(300);

      if (result.decision === "APPROVED") {
        updateStep("final_response", {
          status: "success",
          description: "✅ Action completed successfully!",
          response: responseBody,
        });
        setPhase("completed");
      } else {
        updateStep("final_response", {
          status: "error",
          description: `DENIED: ${result.reason}`,
          response: responseBody,
        });
        setPhase("denied");
      }

      await fetchBudget();

    } catch (error) {
      console.error("Send payment proof error:", error);
    }

    setIsRunning(false);
  };

  const handleReset = () => {
    setSteps([]);
    setPhase("idle");
    setPaymentRequired(null);
    setCurrentPaymentProof(null);
    setExpandedSteps(new Set());
  };

  return (
    <main className="min-h-screen bg-gray-950 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            🤖 Agent Simulator
          </h1>
          <p className="text-gray-400">
            Simulate an autonomous agent calling a pay-per-use API
          </p>
          <p className="text-xs text-gray-600">
            Agent view only — internal SpendGuard/Provider operations are hidden
          </p>
        </div>

        {/* Agent Payload */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-cyan-400">📦</span> My Payload (Static)
          </h2>
          <pre className="bg-gray-950 border border-gray-800 rounded-lg p-4 text-sm text-gray-300 font-mono overflow-x-auto">
{JSON.stringify(AGENT_PAYLOAD, null, 2)}
          </pre>
        </div>

        {/* Controls */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-emerald-400">▶</span> Actions
            </h2>
            <div className="text-sm text-gray-500">
              Budget: <span className="text-emerald-400 font-mono">{budget?.remaining.toFixed(4) || "0.0000"} USDC</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleSendIntent}
              disabled={isRunning || phase === "awaiting_payment"}
              className={`flex-1 px-6 py-4 rounded-lg font-medium transition-all ${
                (phase === "idle" || phase === "completed" || phase === "denied") && !isRunning
                  ? "bg-cyan-600 hover:bg-cyan-500 text-white"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              <div className="text-lg">{isRunning && phase !== "awaiting_payment" ? "⏳" : "1️⃣"}</div>
              <div className="text-sm mt-1">Send Intent</div>
              <div className="text-xs text-gray-400 mt-0.5">(no payment)</div>
            </button>

            <button
              onClick={handleSendPaymentProof}
              disabled={isRunning || phase !== "awaiting_payment"}
              className={`flex-1 px-6 py-4 rounded-lg font-medium transition-all ${
                phase === "awaiting_payment" && !isRunning
                  ? "bg-amber-600 hover:bg-amber-500 text-white animate-pulse"
                  : "bg-gray-800 text-gray-500 cursor-not-allowed"
              }`}
            >
              <div className="text-lg">{isRunning && phase === "awaiting_payment" ? "⏳" : "2️⃣"}</div>
              <div className="text-sm mt-1">Send Payment</div>
              <div className="text-xs text-gray-400 mt-0.5">(with proof)</div>
            </button>

            <button
              onClick={handleReset}
              disabled={isRunning}
              className="px-6 py-4 bg-gray-800 hover:bg-gray-700 text-white rounded-lg font-medium transition-all disabled:opacity-50"
            >
              <div className="text-lg">🔄</div>
              <div className="text-sm mt-1">Reset</div>
            </button>
          </div>

          {/* Payment Required Banner */}
          {paymentRequired && phase === "awaiting_payment" && (
            <div className="mt-4 p-4 bg-amber-900/30 border border-amber-700 rounded-lg">
              <div className="flex items-center gap-2 text-amber-400 font-semibold mb-2">
                ⚡ I received 402 Payment Required!
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Price:</span>{" "}
                  <span className="text-white font-mono">{paymentRequired.price} {paymentRequired.asset}</span>
                </div>
                <div>
                  <span className="text-gray-500">Network:</span>{" "}
                  <span className="text-white font-mono">{paymentRequired.network}</span>
                </div>
              </div>
              <p className="text-xs text-amber-300/70 mt-3">
                → Click &quot;Send Payment&quot; to sign and retry with proof
              </p>
            </div>
          )}

          {/* Current Payment Proof Display */}
          {currentPaymentProof && (
            <div className="mt-4 p-4 bg-purple-900/30 border border-purple-700 rounded-lg">
              <div className="flex items-center gap-2 text-purple-400 font-semibold mb-3">
                🔐 Mock Payment Proof (Signed)
              </div>
              <pre className="bg-gray-950 border border-gray-800 rounded-lg p-3 text-xs text-purple-300 font-mono overflow-x-auto">
{JSON.stringify(currentPaymentProof, null, 2)}
              </pre>
              <div className="mt-3 text-xs text-gray-500">
                This mock proof contains: nonce, payer address, signature, amount, asset, network, and timestamp
              </div>
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-purple-400">📜</span> Activity Log
              {steps.length > 0 && (
                <span className="text-xs bg-gray-700 px-2 py-1 rounded-full ml-2">
                  {steps.length}
                </span>
              )}
            </h2>
            <div className="flex items-center gap-4">
              {steps.length > 0 && (
                <button
                  onClick={handleReset}
                  disabled={isRunning}
                  className="text-xs text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                >
                  Clear Log
                </button>
              )}
              <label className="flex items-center gap-2 cursor-pointer text-sm text-gray-400">
                <div
                  className={`w-10 h-5 rounded-full transition-colors ${
                    autoRefresh ? "bg-emerald-600" : "bg-gray-700"
                  }`}
                  onClick={() => setAutoRefresh(!autoRefresh)}
                >
                  <div
                    className={`w-4 h-4 bg-white rounded-full shadow-md transform transition-transform ${
                      autoRefresh ? "translate-x-5" : "translate-x-0.5"
                    } mt-0.5`}
                  />
                </div>
                Live
              </label>
            </div>
          </div>

          {steps.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-3xl">⏳</span>
              <p className="mt-2">Click &quot;Send Intent&quot; to start</p>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[19px] top-6 bottom-6 w-0.5 bg-gray-700" />
              
              <div className="space-y-3">
                {steps.map((step, index) => (
                  <div key={step.id} className="relative flex gap-4">
                    {/* Timeline node */}
                    <div className="relative z-10 shrink-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium border-2 ${
                          step.status === "success"
                            ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                            : step.status === "error"
                            ? "bg-red-500/20 border-red-500 text-red-400"
                            : step.status === "active"
                            ? "bg-cyan-500/20 border-cyan-500 text-cyan-400 animate-pulse"
                            : "bg-gray-800 border-gray-600 text-gray-400"
                        }`}
                      >
                        {step.status === "success" ? "✓" : step.status === "error" ? "✕" : step.status === "active" ? "◌" : index + 1}
                      </div>
                    </div>

                    {/* Card content */}
                    <div
                      className={`flex-1 p-4 rounded-lg border transition-all ${
                        step.status === "active"
                          ? "bg-cyan-900/20 border-cyan-700"
                          : step.status === "success"
                          ? "bg-emerald-900/10 border-emerald-800"
                          : step.status === "error"
                          ? "bg-red-900/10 border-red-800"
                          : "bg-gray-900/30 border-gray-800"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <h3
                          className={`font-medium ${
                            step.status === "success"
                              ? "text-emerald-400"
                              : step.status === "error"
                              ? "text-red-400"
                              : step.status === "active"
                              ? "text-cyan-400"
                              : "text-gray-400"
                          }`}
                        >
                          {step.name}
                        </h3>
                        {step.timestamp && (
                          <span className="text-xs text-gray-500 ml-2">
                            {new Date(step.timestamp).toLocaleTimeString()}
                          </span>
                        )}
                      </div>

                      {step.description && (
                        <p className="text-sm text-gray-400">{step.description}</p>
                      )}

                      {/* Expandable Raw Data */}
                      {(step.request || step.response) && (
                        <button
                          onClick={() => toggleExpand(step.id)}
                          className="mt-2 text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
                        >
                          {expandedSteps.has(step.id) ? "▼" : "▶"} View Raw Data
                        </button>
                      )}

                      {expandedSteps.has(step.id) && (
                        <div className="mt-3 space-y-3">
                          {step.request && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Request:</div>
                              <pre className="bg-gray-950 border border-gray-800 rounded p-3 text-xs text-cyan-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                {step.request}
                              </pre>
                            </div>
                          )}
                          {step.response && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Response:</div>
                              <pre className="bg-gray-950 border border-gray-800 rounded p-3 text-xs text-emerald-300 font-mono overflow-x-auto whitespace-pre-wrap">
                                {step.response}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Result Banners */}
        {phase === "completed" && (
          <div className="bg-emerald-900/30 border border-emerald-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">✅</div>
            <h3 className="text-xl font-semibold text-emerald-400">Task Completed!</h3>
            <p className="text-gray-400 mt-1">
              Email sent to demo@example.com
            </p>
          </div>
        )}

        {phase === "denied" && (
          <div className="bg-red-900/30 border border-red-700 rounded-xl p-6 text-center">
            <div className="text-4xl mb-2">❌</div>
            <h3 className="text-xl font-semibold text-red-400">Request Denied</h3>
            <p className="text-gray-400 mt-1">
              Check the activity log for details
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
