// Policy Engine - SpendGuard Control Plane
// Redis-backed storage for Vercel deployment

import { redis, REDIS_KEYS } from "../redis";

export interface Policy {
  max_price_per_call: number;
  allowed_providers: string[];
  allowed_actions: string[];
  allowed_tasks: string[];
}

export interface PolicyCheckRequest {
  provider: string;
  action: string;
  task: string;
  cost_estimated: number;
}

export interface PolicyCheckResult {
  allowed: boolean;
  reason: string;
}

// Default policy values
const DEFAULT_POLICY: Policy = {
  max_price_per_call: 0.5,
  allowed_providers: ["email"],
  allowed_actions: ["send"],
  allowed_tasks: ["welcome_flow"],
};

export async function getPolicy(): Promise<Policy> {
  const policy = await redis.get<Policy>(REDIS_KEYS.POLICY);
  return policy || { ...DEFAULT_POLICY };
}

export async function setPolicy(updates: Partial<Policy>): Promise<Policy> {
  const currentPolicy = await getPolicy();
  const updatedPolicy = { ...currentPolicy, ...updates };
  await redis.set(REDIS_KEYS.POLICY, updatedPolicy);
  return updatedPolicy;
}

export async function checkPolicy(request: PolicyCheckRequest): Promise<PolicyCheckResult> {
  const policyState = await getPolicy();

  // Check provider allowlist
  if (!policyState.allowed_providers.includes(request.provider)) {
    return {
      allowed: false,
      reason: `provider_not_allowed: "${request.provider}" not in allowlist`,
    };
  }

  // Check action allowlist
  if (!policyState.allowed_actions.includes(request.action)) {
    return {
      allowed: false,
      reason: `action_not_allowed: "${request.action}" not in allowlist`,
    };
  }

  // Check task allowlist
  if (!policyState.allowed_tasks.includes(request.task)) {
    return {
      allowed: false,
      reason: `task_not_allowed: "${request.task}" not in allowlist`,
    };
  }

  // Check price limit
  if (request.cost_estimated > policyState.max_price_per_call) {
    return {
      allowed: false,
      reason: `price_exceeded: $${request.cost_estimated.toFixed(4)} exceeds max $${policyState.max_price_per_call.toFixed(4)}`,
    };
  }

  return {
    allowed: true,
    reason: "policy_check_passed",
  };
}
