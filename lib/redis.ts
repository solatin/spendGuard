// Redis client configuration for Vercel deployment
// Uses Upstash Redis for serverless-compatible storage

import { Redis } from "@upstash/redis";

// Create Redis client
// Set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN in your environment
export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || "",
  token: process.env.UPSTASH_REDIS_REST_TOKEN || "",
});

// Redis key prefixes for different data types
export const REDIS_KEYS = {
  BUDGET: "spendguard:budget",
  POLICY: "spendguard:policy",
  AUDIT_LOGS: "spendguard:audit_logs",
  LOG_COUNTER: "spendguard:log_counter",
  USED_NONCES: "spendguard:used_nonces",
} as const;



