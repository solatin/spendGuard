// Mock Payment Verifier - x402 Demo
// Simulates payment verification with replay prevention
// Redis-backed storage for Vercel deployment

import { redis, REDIS_KEYS } from "../redis";
import { PaymentProof, VerifyResult } from "./types";

/**
 * Verify a payment proof
 *
 * Checks:
 * 1. Nonce hasn't been used (replay prevention)
 * 2. Nonce matches expected
 * 3. Signature format is valid (mock check)
 * 4. Payer address format is valid (mock check)
 */
export async function verifyPayment(params: {
  proof: PaymentProof;
  expectedNonce: string;
  expectedAmount: number;
}): Promise<VerifyResult> {
  const { proof, expectedNonce, expectedAmount } = params;

  // Check nonce matches expected
  if (proof.nonce !== expectedNonce) {
    return {
      valid: false,
      reason: "invalid_nonce: Nonce mismatch",
      details: { nonce: proof.nonce },
    };
  }

  // Mock signature validation - check format
  if (!proof.signature || !proof.signature.startsWith("mock_signature_")) {
    return {
      valid: false,
      reason: "invalid_signature: Malformed signature",
    };
  }

  // Mock payer validation - check format
  if (!proof.payer || !proof.payer.startsWith("mock_payer_")) {
    return {
      valid: false,
      reason: "invalid_payer: Malformed payer address",
    };
  }

  // Mock amount validation (if provided in proof)
  if (proof.amount !== undefined && proof.amount < expectedAmount) {
    return {
      valid: false,
      reason: `insufficient_amount: Paid ${proof.amount}, expected ${expectedAmount}`,
      details: { amount: proof.amount },
    };
  }

  // All checks passed - atomically mark nonce as used (replay prevention)
  // SADD returns 1 if the member was added, 0 if it already existed.
  const added = await redis.sadd(REDIS_KEYS.USED_NONCES, proof.nonce);
  if (!added) {
    return {
      valid: false,
      reason: "replay_attack: Nonce already used",
      details: { nonce: proof.nonce },
    };
  }

  return {
    valid: true,
    reason: "payment_verified",
    details: {
      nonce: proof.nonce,
      payer: proof.payer,
      amount: proof.amount || expectedAmount,
    },
  };
}

/**
 * Check if a nonce has been used
 */
export async function isNonceUsed(nonce: string): Promise<boolean> {
  const isUsed = await redis.sismember(REDIS_KEYS.USED_NONCES, nonce);
  return Boolean(isUsed);
}

/**
 * Clear all used nonces (for testing)
 */
export async function clearNonces(): Promise<void> {
  await redis.del(REDIS_KEYS.USED_NONCES);
}

/**
 * Get count of used nonces (for debugging)
 */
export async function getUsedNonceCount(): Promise<number> {
  const count = await redis.scard(REDIS_KEYS.USED_NONCES);
  return count;
}

/**
 * Verify payment proof from header string
 */
export async function verifyPaymentFromHeader(
  header: string,
  expectedNonce: string,
  expectedAmount: number
): Promise<VerifyResult> {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const proof = JSON.parse(decoded) as PaymentProof;

    return verifyPayment({ proof, expectedNonce, expectedAmount });
  } catch {
    return {
      valid: false,
      reason: "invalid_proof: Could not parse payment proof",
    };
  }
}
