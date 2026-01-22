"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";

interface ProviderExchange {
  id: string;
  auditLogId: string;
  timestamp: string;
  kind: "payment_required" | "success";
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: Record<string, unknown>;
  };
  response: {
    status: number;
    statusText: string;
    body?: Record<string, unknown>;
  };
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

export default function ProviderInspectorClient() {
  const searchParams = useSearchParams();
  const selectedLogId = searchParams.get("logId"); // audit log id
  const [providerLogs, setProviderLogs] = useState<ProviderExchange[]>([]);
  const [emailCount, setEmailCount] = useState(0);
  const [isClearing, setIsClearing] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/logs?limit=200");
    const data = await res.json();
    const recentLogs = (data.logs || []) as AuditLogEntry[];

    // Transform audit logs into provider-perspective logs
    const transformed: ProviderExchange[] = [];
    let emailId = 1;

    recentLogs.forEach((log) => {
      const baseId = `prov_${log.id}`;

      if (log.decision === "PAYMENT_REQUIRED") {
        // One exchange: request (no proof) -> 402
        transformed.push({
          id: `${baseId}_402`,
          auditLogId: log.id,
          timestamp: log.timestamp,
          kind: "payment_required",
          request: {
            method: "POST",
            path: "/api/provider/email/send",
            headers: {
              "Content-Type": "application/json",
            },
            body: log.payload,
          },
          response: {
            status: 402,
            statusText: "Payment Required",
            body: {
              x402: {
                price: log.cost,
                asset: "USDC",
                network: "base-sepolia",
                nonce: log.payment_nonce || "nonce_xxx",
              },
            },
          },
        });
      } else if (log.decision === "APPROVED" && log.payment_verified) {
        // One exchange: request (with proof) -> 200
        transformed.push({
          id: `${baseId}_200`,
          auditLogId: log.id,
          timestamp: log.timestamp,
          kind: "success",
          request: {
            method: "POST",
            path: "/api/provider/email/send",
            headers: {
              "Content-Type": "application/json",
              "X-PAYMENT-PROOF": log.payment_nonce
                ? `[verified: ${log.payment_nonce.substring(0, 15)}...]`
                : "[payment proof]",
            },
            body: log.payload,
          },
          response: {
            status: 200,
            statusText: "OK",
            body:
              log.response || {
                success: true,
                data: {
                  status: "sent",
                  id: `email_${emailId++}`,
                  to:
                    (log.payload as { to?: string })?.to || "demo@example.com",
                },
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

    // Newest -> oldest
    transformed.sort((a, b) => {
      const ta = new Date(a.timestamp).getTime();
      const tb = new Date(b.timestamp).getTime();
      return tb - ta;
    });

    setProviderLogs(transformed);
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchLogs();
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (!selectedLogId) return;
    // Expand the exchange(s) derived from this audit log id
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      next.add(`prov_${selectedLogId}_402`);
      next.add(`prov_${selectedLogId}_200`);
      return next;
    });
  }, [selectedLogId]);

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const handleClear = async () => {
    try {
      setIsClearing(true);
      setProviderLogs([]);
      setEmailCount(0);
      setExpandedLogs(new Set());

      const res = await fetch("/api/spendguard/clear", { method: "DELETE" });
      if (!res.ok) {
        throw new Error(`clear_failed: ${res.status}`);
      }

      await fetchLogs();
    } catch (error) {
      console.error("Failed to clear provider logs:", error);
    } finally {
      setIsClearing(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getExchangeInfo = (kind: ProviderExchange["kind"]) => {
    switch (kind) {
      case "payment_required":
        return {
          label: "402 Payment Required",
          color: "text-amber-400",
          bg: "bg-amber-900/20",
          border: "border-amber-800",
          badge: "bg-amber-900/50 text-amber-400",
        };
      case "success":
        return {
          label: "200 OK",
          color: "text-emerald-400",
          bg: "bg-emerald-900/20",
          border: "border-emerald-800",
          badge: "bg-emerald-900/50 text-emerald-400",
        };
      default:
        return {
          label: kind,
          color: "text-gray-400",
          bg: "bg-gray-900/20",
          border: "border-gray-700",
          badge: "bg-gray-800 text-gray-300",
        };
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-gray-950 via-gray-900 to-gray-950 p-8">
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
              <div className="text-3xl font-bold text-amber-400">0.001 USDC</div>
              <p className="text-sm text-gray-500 mt-1">Price per email</p>
              <div className="mt-2 text-xs text-gray-600">
                Network: base-sepolia
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
              {providerLogs.length > 0 && (
                <span className="text-xs bg-gray-700 px-2 py-1 rounded-full ml-2">
                  {providerLogs.length}
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
                {isRefreshing ? "Refreshing..." : providerLogs.length > 0 ? "Refresh" : "Load"}
              </button>
              {providerLogs.length > 0 && (
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

          {providerLogs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <span className="text-3xl">📭</span>
              <p className="mt-2">No provider requests yet</p>
              <p className="text-sm">Run the Agent Simulator to see requests!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {providerLogs.map((log) => {
                const info = getExchangeInfo(log.kind);
                const isExpanded = expandedLogs.has(log.id);

                return (
                  <div
                    key={log.id}
                    className={`rounded-lg border ${info.bg} ${info.border}`}
                  >
                    {/* Header */}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(log.id)}
                      className="w-full text-left"
                    >
                      <div className={`flex items-center justify-between p-4 ${isExpanded ? "border-b border-gray-800/50" : ""}`}>
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-gray-400 shrink-0">
                            {isExpanded ? "▾" : "▸"}
                          </span>
                          <span className={`font-medium ${info.color} shrink-0`}>{info.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded ${info.badge} shrink-0`}>
                            HTTP {log.response.status}
                          </span>
                          <span className="text-xs text-gray-500 font-mono truncate">
                            {log.request.method} {log.request.path}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500 shrink-0">{formatTime(log.timestamp)}</span>
                      </div>
                    </button>

                    {/* Body */}
                    {isExpanded && (
                      <div className="p-4">
                        <div className="space-y-4">
                          {/* Received */}
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Received (from SpendGuard)</div>
                            <div className="text-sm mb-2">
                              <span className="text-gray-500">Endpoint:</span>{" "}
                              <span className="text-cyan-400 font-mono">
                                {log.request.method} {log.request.path}
                              </span>
                            </div>
                            {log.request.headers && (
                              <div className="mb-3">
                                <div className="text-xs text-gray-500 mb-1">Headers:</div>
                                <pre className="bg-gray-950 rounded p-3 text-xs text-gray-300 font-mono">
{Object.entries(log.request.headers)
  .map(([k, v]) => `${k}: ${v}`)
  .join("\n")}
                                </pre>
                              </div>
                            )}
                            {log.request.body && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Body:</div>
                                <pre className="bg-gray-950 rounded p-3 text-xs text-cyan-300 font-mono overflow-x-auto">
{JSON.stringify(log.request.body, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>

                          {/* Responded */}
                          <div>
                            <div className="text-xs text-gray-500 mb-2">Responded (back to SpendGuard)</div>
                            <div className="text-sm mb-2">
                              <span className="text-gray-500">Status:</span>{" "}
                              <span className={log.response.status === 402 ? "text-amber-400" : "text-emerald-400"}>
                                {log.response.status} {log.response.statusText}
                              </span>
                            </div>
                            {log.response.body && (
                              <div>
                                <div className="text-xs text-gray-500 mb-1">Body:</div>
                                <pre
                                  className={`bg-gray-950 rounded p-3 text-xs font-mono overflow-x-auto ${
                                    log.response.status === 402 ? "text-amber-300" : "text-emerald-300"
                                  }`}
                                >
{JSON.stringify(log.response.body, null, 2)}
                                </pre>
                              </div>
                            )}
                            {log.kind === "success" && (
                              <div className="flex items-center gap-2 text-emerald-400 text-sm mt-3">
                                <span>✅</span>
                                <span>Email sent successfully!</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
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


