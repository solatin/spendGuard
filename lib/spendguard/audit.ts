// Audit Log - SpendGuard Control Plane
// Redis-backed storage for Vercel deployment

import { redis, REDIS_KEYS } from "../redis";

export type Decision = "APPROVED" | "DENIED" | "PAYMENT_REQUIRED";

export interface AuditLogEntry {
  id: string;
  provider: string;
  action: string;
  task: string;
  cost: number;
  decision: Decision;
  reason: string;
  timestamp: string;
  run_id?: string;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  payment_nonce?: string;
  payment_payer?: string;
  payment_verified?: boolean;
}

const MAX_LOGS = 100;

export async function logRequest(
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): Promise<AuditLogEntry> {
  const timestamp = new Date().toISOString();
  
  // Get and increment counter
  const counter = await redis.incr(REDIS_KEYS.LOG_COUNTER);
  const id = `log_${counter}`;

  const logEntry: AuditLogEntry = {
    id,
    timestamp,
    ...entry,
  };

  // Add to beginning of list (most recent first)
  await redis.lpush(REDIS_KEYS.AUDIT_LOGS, JSON.stringify(logEntry));
  
  // Trim to keep only last MAX_LOGS entries
  await redis.ltrim(REDIS_KEYS.AUDIT_LOGS, 0, MAX_LOGS - 1);

  return logEntry;
}

function parseLog(log: unknown): AuditLogEntry {
  if (typeof log === "string") {
    return JSON.parse(log) as AuditLogEntry;
  }
  return log as AuditLogEntry;
}

export async function getLogs(
  limit: number = 50,
  runId?: string
): Promise<AuditLogEntry[]> {
  // If runId is provided, fetch a small bounded window and filter in-memory.
  // (We only keep MAX_LOGS anyway.)
  const fetchCount = runId ? MAX_LOGS : limit;
  const rawLogs = await redis.lrange(REDIS_KEYS.AUDIT_LOGS, 0, fetchCount - 1);
  const parsed = rawLogs.map(parseLog);
  if (!runId) return parsed;
  return parsed.filter((l) => l.run_id === runId).slice(0, limit);
}

export async function clearLogs(): Promise<void> {
  await redis.del(REDIS_KEYS.AUDIT_LOGS);
  await redis.set(REDIS_KEYS.LOG_COUNTER, 0);
}

export async function getLogStats(runId?: string): Promise<{
  total: number;
  approved: number;
  denied: number;
  paymentRequired: number;
}> {
  const logs = await getLogs(MAX_LOGS, runId);
  
  return {
    total: logs.length,
    approved: logs.filter((l) => l.decision === "APPROVED").length,
    denied: logs.filter((l) => l.decision === "DENIED").length,
    paymentRequired: logs.filter((l) => l.decision === "PAYMENT_REQUIRED").length,
  };
}
