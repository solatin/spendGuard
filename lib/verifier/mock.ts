// Mock Payment Verifier - x402 Demo
// Simulates payment verification with replay prevention

import { PaymentProof, VerifyResult } from "./types";

// In-memory set to store used nonces for replay prevention
const usedNonces = new Set<string>();

/**
 * Verify a payment proof
 *
 * Checks:
 * 1. Nonce hasn't been used (replay prevention)
 * 2. Nonce matches expected
 * 3. Signature format is valid (mock check)
 * 4. Payer address format is valid (mock check)
 */
export function verifyPayment(params: {
  proof: PaymentProof;
  expectedNonce: string;
  expectedAmount: number;
}): VerifyResult {
  const { proof, expectedNonce, expectedAmount } = params;

  // Check if nonce has been used (replay attack prevention)
  if (usedNonces.has(proof.nonce)) {
    return {
      valid: false,
      reason: "replay_attack: Nonce already used",
      details: { nonce: proof.nonce },
    };
  }

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

  // All checks passed - mark nonce as used
  usedNonces.add(proof.nonce);

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
export function isNonceUsed(nonce: string): boolean {
  return usedNonces.has(nonce);
}

/**
 * Clear all used nonces (for testing)
 */
export function clearNonces(): void {
  usedNonces.clear();
}

/**
 * Get count of used nonces (for debugging)
 */
export function getUsedNonceCount(): number {
  return usedNonces.size;
}

/**
 * Verify payment proof from header string
 */
export function verifyPaymentFromHeader(
  header: string,
  expectedNonce: string,
  expectedAmount: number
): VerifyResult {
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

