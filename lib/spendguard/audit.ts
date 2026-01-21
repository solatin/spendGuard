// Audit Log - SpendGuard Control Plane
// SQLite-backed audit trail for all API requests with x402 payment tracking

import { getDb } from "../db";

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
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  // x402 payment fields
  payment_nonce?: string;
  payment_payer?: string;
  payment_verified?: boolean;
}

interface AuditRow {
  id: number;
  provider: string;
  action: string;
  task: string;
  cost: number;
  decision: string;
  reason: string;
  timestamp: string;
  payload: string | null;
  response: string | null;
  payment_nonce: string | null;
  payment_payer: string | null;
  payment_verified: number | null;
}

function rowToEntry(row: AuditRow): AuditLogEntry {
  return {
    id: `log_${row.id}`,
    provider: row.provider,
    action: row.action,
    task: row.task,
    cost: row.cost,
    decision: row.decision as Decision,
    reason: row.reason,
    timestamp: row.timestamp,
    payload: row.payload ? JSON.parse(row.payload) : undefined,
    response: row.response ? JSON.parse(row.response) : undefined,
    payment_nonce: row.payment_nonce || undefined,
    payment_payer: row.payment_payer || undefined,
    payment_verified: row.payment_verified === 1 ? true : row.payment_verified === 0 ? false : undefined,
  };
}

export function logRequest(
  entry: Omit<AuditLogEntry, "id" | "timestamp">
): AuditLogEntry {
  const db = getDb();
  const timestamp = new Date().toISOString();

  const result = db.prepare(`
    INSERT INTO audit_log (
      provider, action, task, cost, decision, reason, timestamp, 
      payload, response, payment_nonce, payment_payer, payment_verified
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    entry.provider,
    entry.action,
    entry.task,
    entry.cost,
    entry.decision,
    entry.reason,
    timestamp,
    entry.payload ? JSON.stringify(entry.payload) : null,
    entry.response ? JSON.stringify(entry.response) : null,
    entry.payment_nonce || null,
    entry.payment_payer || null,
    entry.payment_verified !== undefined ? (entry.payment_verified ? 1 : 0) : null
  );

  return {
    ...entry,
    id: `log_${result.lastInsertRowid}`,
    timestamp,
  };
}

export function getLogs(limit: number = 1000): AuditLogEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM audit_log 
    ORDER BY id DESC 
    LIMIT ?
  `).all(limit) as AuditRow[];

  return rows.map(rowToEntry);
}

export function clearLogs(): void {
  const db = getDb();
  db.prepare("DELETE FROM audit_log").run();
}

export function getLogStats(): {
  total: number;
  approved: number;
  denied: number;
  paymentRequired: number;
  totalCost: number;
} {
  const db = getDb();

  const total = (db.prepare("SELECT COUNT(*) as count FROM audit_log").get() as { count: number }).count;
  const approved = (db.prepare("SELECT COUNT(*) as count FROM audit_log WHERE decision = 'APPROVED'").get() as { count: number }).count;
  const denied = (db.prepare("SELECT COUNT(*) as count FROM audit_log WHERE decision = 'DENIED'").get() as { count: number }).count;
  const paymentRequired = (db.prepare("SELECT COUNT(*) as count FROM audit_log WHERE decision = 'PAYMENT_REQUIRED'").get() as { count: number }).count;
  const totalCostResult = db.prepare("SELECT COALESCE(SUM(cost), 0) as total FROM audit_log WHERE decision = 'APPROVED'").get() as { total: number };

  return {
    total,
    approved,
    denied,
    paymentRequired,
    totalCost: totalCostResult.total,
  };
}

