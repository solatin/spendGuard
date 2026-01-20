"use client";

import { useEffect, useState, useCallback } from "react";

interface AuditLogEntry {
  id: string;
  provider: string;
  action: string;
  task: string;
  cost: number;
  decision: "APPROVED" | "DENIED";
  reason: string;
  timestamp: string;
  payload?: Record<string, unknown>;
}

export default function LogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [isClearing, setIsClearing] = useState(false);

  const fetchLogs = useCallback(async () => {
    const res = await fetch("/api/logs");
    const data = await res.json();
    setLogs(data.logs);
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 1000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  const handleClearLogs = async () => {
    setIsClearing(true);
    await fetch("/api/logs", { method: "DELETE" });
    await fetchLogs();
    setIsClearing(false);
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const approvedCount = logs.filter((l) => l.decision === "APPROVED").length;
  const deniedCount = logs.filter((l) => l.decision === "DENIED").length;

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-mono text-3xl font-bold text-zinc-100 mb-2">
              Audit Logs
            </h1>
            <p className="text-zinc-400">
              Complete history of all API requests processed by SpendGuard
            </p>
          </div>
          <button
            onClick={handleClearLogs}
            disabled={isClearing || logs.length === 0}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm font-mono hover:bg-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50"
          >
            {isClearing ? "Clearing..." : "Clear Logs"}
          </button>
        </div>

        {/* Stats Bar */}
        <div className="flex items-center gap-6 mb-6 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-sm">Total:</span>
            <span className="font-mono text-zinc-100">{logs.length}</span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="text-zinc-500 text-sm">Approved:</span>
            <span className="font-mono text-emerald-400">{approvedCount}</span>
          </div>
          <div className="h-4 w-px bg-zinc-700" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-red-500" />
            <span className="text-zinc-500 text-sm">Denied:</span>
            <span className="font-mono text-red-400">{deniedCount}</span>
          </div>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs text-zinc-500">Live</span>
          </div>
        </div>

        {/* Logs Table */}
        {logs.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-12 text-center">
            <div className="text-zinc-600 text-4xl mb-4">☰</div>
            <div className="text-zinc-400 mb-2">No audit logs yet</div>
            <div className="text-zinc-500 text-sm">
              Go to the Test Console to generate some requests
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900">
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Time
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Provider
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Action
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Task
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Cost
                  </th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Decision
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                    Reason
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {logs.map((log) => (
                  <tr
                    key={log.id}
                    className={`
                      transition-colors
                      ${
                        log.decision === "DENIED"
                          ? "bg-red-500/5 hover:bg-red-500/10"
                          : "hover:bg-zinc-800/50"
                      }
                    `}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-zinc-400">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-zinc-500">
                      {log.id}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-mono">
                        {log.provider}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-zinc-300">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm text-zinc-400">
                      {log.task}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-sm text-zinc-300">
                      ${log.cost.toFixed(4)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`
                          inline-flex items-center px-2 py-1 rounded text-xs font-mono font-medium
                          ${
                            log.decision === "APPROVED"
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : "bg-red-500/15 text-red-400 border border-red-500/30"
                          }
                        `}
                      >
                        {log.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-zinc-400 max-w-xs truncate">
                      {log.reason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


