"use client";

import { useState, useEffect, useCallback } from "react";

interface ProviderLog {
  id: string;
  timestamp: string;
  phase: "request_1" | "response_402" | "request_2" | "response_200";
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  status?: number;
  statusText?: string;
  responseBody?: Record<string, unknown>;
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

export default function ProviderInspectorPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [providerLogs, setProviderLogs] = useState<ProviderLog[]>([]);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [emailCount, setEmailCount] = useState(0);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/logs");
    const data = await res.json();
    const recentLogs = data.logs.slice(0, 30) as AuditLogEntry[];
    setLogs(recentLogs);

    // Transform audit logs into provider-perspective logs
    const transformed: ProviderLog[] = [];
    let emailId = 1;

    recentLogs.forEach((log, index) => {
      const baseId = `prov_${index}`;

      if (log.decision === "PAYMENT_REQUIRED") {
        // First request - returns 402
        transformed.push({
          id: `${baseId}_req1`,
          timestamp: log.timestamp,
          phase: "request_1",
          method: "POST",
          path: "/api/provider/email/send",
          body: log.payload,
        });
        transformed.push({
          id: `${baseId}_res402`,
          timestamp: log.timestamp,
          phase: "response_402",
          method: "POST",
          path: "/api/provider/email/send",
          status: 402,
          statusText: "Payment Required",
          responseBody: {
            x402: {
              price: log.cost,
              asset: "USDC",
              network: "base-sepolia",
              nonce: log.payment_nonce || "nonce_xxx",
            },
          },
        });
      } else if (log.decision === "APPROVED" && log.payment_verified) {
        // Second request with payment - returns 200
        transformed.push({
          id: `${baseId}_req2`,
          timestamp: log.timestamp,
          phase: "request_2",
          method: "POST",
          path: "/api/provider/email/send",
          headers: {
            "Content-Type": "application/json",
            "X-PAYMENT-PROOF": log.payment_nonce ? `[verified: ${log.payment_nonce.substring(0, 15)}...]` : "[payment proof]",
          },
          body: log.payload,
        });
        transformed.push({
          id: `${baseId}_res200`,
          timestamp: log.timestamp,
          phase: "response_200",
          method: "POST",
          path: "/api/provider/email/send",
          status: 200,
          statusText: "OK",
          responseBody: log.response || {
            success: true,
            data: {
              status: "sent",
              id: `email_${emailId++}`,
              to: (log.payload as { to?: string })?.to || "demo@example.com",
            },
          },
        });
      }
    });

    // Count successful emails
    const approvedCount = recentLogs.filter(
      (l) => l.decision === "APPROVED" && l.payment_verified
    ).length;
    setEmailCount(approvedCount);

    setProviderLogs(transformed.reverse()); // Most recent first
  }, []);

  useEffect(() => {
    fetchLogs();
    if (autoRefresh) {
      const interval = setInterval(fetchLogs, 1500);
      return () => clearInterval(interval);
    }
  }, [fetchLogs, autoRefresh]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getPhaseInfo = (phase: string) => {
    switch (phase) {
      case "request_1":
        return { label: "Request #1", color: "text-cyan-400", bg: "bg-cyan-900/20", icon: "→" };
      case "response_402":
        return { label: "402 Payment Required", color: "text-amber-400", bg: "bg-amber-900/20", icon: "←" };
      case "request_2":
        return { label: "Request #2 (with proof)", color: "text-purple-400", bg: "bg-purple-900/20", icon: "→" };
      case "response_200":
        return { label: "200 OK", color: "text-emerald-400", bg: "bg-emerald-900/20", icon: "←" };
      default:
        return { label: phase, color: "text-gray-400", bg: "bg-gray-900/20", icon: "•" };
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-white tracking-tight">
            📧 Provider Inspector
          </h1>
          <p className="text-gray-400">
            Mock Email Provider (x402) - View provider behavior
          </p>
        </div>

        {/* Provider Info */}
        <div className="grid grid-cols-3 gap-6">
          <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
            <div className="text-center">
              <div className="text-4xl mb-2">📧</div>
              <h3 className="text-lg font-semibold text-white">Email Provider</h3>
              <p className="text-sm text-gray-500 mt-1">Mock SendGrid-like API</p>
            </div>
          </div>

          <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-amber-400">$0.001</div>
              <p className="text-sm text-gray-500 mt-1">Price per email</p>
              <div className="mt-2 text-xs text-gray-600">
                Asset: USDC • Network: base-sepolia
              </div>
            </div>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-800 rounded-xl p-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-emerald-400">{emailCount}</div>
              <p className="text-sm text-gray-500 mt-1">Emails Sent</p>
              <div className="mt-2 text-xs text-gray-600">
                Successfully executed
              </div>
            </div>
          </div>
        </div>

        {/* x402 Flow Explanation */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <span className="text-amber-400">⚡</span> x402 Payment Flow
          </h2>
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-cyan-900/30 text-cyan-400 rounded-full flex items-center justify-center text-sm">1</span>
                <div>
                  <div className="text-white font-medium">Request #1 (No Payment)</div>
                  <div className="text-sm text-gray-500">Client sends request without payment proof</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-amber-900/30 text-amber-400 rounded-full flex items-center justify-center text-sm">2</span>
                <div>
                  <div className="text-amber-400 font-medium">402 Payment Required</div>
                  <div className="text-sm text-gray-500">Provider returns price, nonce, and payment info</div>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-purple-900/30 text-purple-400 rounded-full flex items-center justify-center text-sm">3</span>
                <div>
                  <div className="text-white font-medium">Request #2 (With Proof)</div>
                  <div className="text-sm text-gray-500">Client retries with X-PAYMENT-PROOF header</div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-emerald-900/30 text-emerald-400 rounded-full flex items-center justify-center text-sm">4</span>
                <div>
                  <div className="text-emerald-400 font-medium">200 OK - Email Sent!</div>
                  <div className="text-sm text-gray-500">Provider executes action and returns result</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Request/Response Logs */}
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <span className="text-purple-400">📜</span> Request/Response Log
            </h2>
            <div className="flex items-center gap-4">
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
                Auto-refresh
              </label>
            </div>
          </div>

          {providerLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-3xl">📭</span>
              <p className="mt-2">No provider requests yet</p>
              <p className="text-sm">Run the Agent Simulator to see requests!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {providerLogs.map((log) => {
                const phaseInfo = getPhaseInfo(log.phase);
                const isRequest = log.phase.startsWith("request");
                const isSuccess = log.status === 200;
                const is402 = log.status === 402;

                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border ${phaseInfo.bg} ${
                      is402 ? "border-amber-800" : isSuccess ? "border-emerald-800" : "border-gray-700"
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 border-b border-gray-800/50">
                      <div className="flex items-center gap-3">
                        <span className={`text-lg ${phaseInfo.color}`}>{phaseInfo.icon}</span>
                        <span className={`font-medium ${phaseInfo.color}`}>{phaseInfo.label}</span>
                        {log.status && (
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            is402 ? "bg-amber-900/50 text-amber-400" : "bg-emerald-900/50 text-emerald-400"
                          }`}>
                            HTTP {log.status}
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-gray-500">{formatTime(log.timestamp)}</span>
                    </div>

                    {/* Body */}
                    <div className="p-4">
                      {isRequest ? (
                        <div className="space-y-3">
                          <div className="text-sm">
                            <span className="text-gray-500">Endpoint:</span>{" "}
                            <span className="text-cyan-400 font-mono">{log.method} {log.path}</span>
                          </div>
                          {log.headers && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Headers:</div>
                              <pre className="bg-gray-950 rounded p-3 text-xs text-gray-300 font-mono">
{Object.entries(log.headers).map(([k, v]) => `${k}: ${v}`).join("\n")}
                              </pre>
                            </div>
                          )}
                          {log.body && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Request Body:</div>
                              <pre className="bg-gray-950 rounded p-3 text-xs text-cyan-300 font-mono overflow-x-auto">
{JSON.stringify(log.body, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <div className="text-sm">
                            <span className="text-gray-500">Status:</span>{" "}
                            <span className={is402 ? "text-amber-400" : "text-emerald-400"}>
                              {log.status} {log.statusText}
                            </span>
                          </div>
                          {log.responseBody && (
                            <div>
                              <div className="text-xs text-gray-500 mb-1">Response Body:</div>
                              <pre className={`bg-gray-950 rounded p-3 text-xs font-mono overflow-x-auto ${
                                is402 ? "text-amber-300" : "text-emerald-300"
                              }`}>
{JSON.stringify(log.responseBody, null, 2)}
                              </pre>
                            </div>
                          )}
                          {isSuccess && (
                            <div className="flex items-center gap-2 text-emerald-400 text-sm mt-2">
                              <span>✅</span>
                              <span>Email sent successfully!</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

