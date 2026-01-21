// Policy Engine - SpendGuard Control Plane
// Internal decision engine for ALLOW/DENY based on policy rules

import { getDb } from "../db";

/**
 * Policy configuration
 */
export interface Policy {
  max_price_per_call: number;
  allowed_providers: string[];
  allowed_actions: string[];
  allowed_tasks: string[];
}

/**
 * Policy check request
 */
export interface PolicyCheckRequest {
  provider: string;
  action: string;
  task: string;
  cost_estimated: number;
}

/**
 * Policy check result
 */
export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
}

interface PolicyRow {
  max_price_per_call: number;
  allowed_providers: string;
  allowed_actions: string;
  allowed_tasks: string;
}

/**
 * Get current policy from database
 */
export function getPolicy(): Policy {
  const db = getDb();
  const row = db.prepare("SELECT * FROM policy WHERE id = 1").get() as PolicyRow;

  return {
    max_price_per_call: row.max_price_per_call,
    allowed_providers: JSON.parse(row.allowed_providers),
    allowed_actions: JSON.parse(row.allowed_actions),
    allowed_tasks: JSON.parse(row.allowed_tasks),
  };
}

/**
 * Update policy in database
 */
export function setPolicy(policy: Partial<Policy>): Policy {
  const db = getDb();
  const current = getPolicy();

  const updated = {
    ...current,
    ...policy,
  };

  db.prepare(`
    UPDATE policy SET
      max_price_per_call = ?,
      allowed_providers = ?,
      allowed_actions = ?,
      allowed_tasks = ?
    WHERE id = 1
  `).run(
    updated.max_price_per_call,
    JSON.stringify(updated.allowed_providers),
    JSON.stringify(updated.allowed_actions),
    JSON.stringify(updated.allowed_tasks)
  );

  return updated;
}

/**
 * Check if a request is allowed by policy
 * This is the core decision engine - ALLOW or DENY
 */
export function checkPolicy(request: PolicyCheckRequest): PolicyCheckResult {
  const policy = getPolicy();

  // Check provider allowlist
  if (!policy.allowed_providers.includes(request.provider)) {
    return {
      allowed: false,
      reason: `provider_not_allowed: "${request.provider}" not in allowlist`,
    };
  }

  // Check action allowlist
  if (!policy.allowed_actions.includes(request.action)) {
    return {
      allowed: false,
      reason: `action_not_allowed: "${request.action}" not in allowlist`,
    };
  }

  // Check task allowlist
  if (!policy.allowed_tasks.includes(request.task)) {
    return {
      allowed: false,
      reason: `task_not_allowed: "${request.task}" not in allowlist`,
    };
  }

  // Check price limit
  if (request.cost_estimated > policy.max_price_per_call) {
    return {
      allowed: false,
      reason: `price_exceeded: $${request.cost_estimated.toFixed(4)} exceeds max $${policy.max_price_per_call.toFixed(4)}`,
    };
  }

  return {
    allowed: true,
    reason: "policy_check_passed",
  };
}

