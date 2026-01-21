// Client Payment Helpers - Mock Payment Proof Generation
// Simulates client-side payment signing for x402 demo

import { PaymentProof } from "../verifier/types";
import { PaymentRequirement } from "../provider/types";

/**
 * Generate a unique nonce for payment
 */
export function generateNonce(): string {
  return `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
}

/**
 * Sign a mock payment proof
 * In production, this would use actual wallet signing
 */
export function signPaymentProof(
  requirement: PaymentRequirement,
  payerAddress: string = `mock_payer_${Date.now()}`
): PaymentProof {
  // Mock signature - in production this would be a real cryptographic signature
  const signature = `mock_signature_${requirement.nonce}_${payerAddress}_${Date.now()}`;

  return {
    nonce: requirement.nonce,
    payer: payerAddress,
    signature,
    amount: requirement.price,
    asset: requirement.asset,
    network: requirement.network,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Encode payment proof as header string
 */
export function encodePaymentProofHeader(proof: PaymentProof): string {
  return Buffer.from(JSON.stringify(proof)).toString("base64");
}

/**
 * Parse payment proof from header string
 */
export function parsePaymentProofHeader(header: string): PaymentProof | null {
  try {
    const decoded = Buffer.from(header, "base64").toString("utf-8");
    const proof = JSON.parse(decoded) as PaymentProof;

    // Validate required fields
    if (!proof.nonce || !proof.payer || !proof.signature) {
      return null;
    }

    return proof;
  } catch {
    return null;
  }
}

/**
 * Create a complete payment flow helper
 * Used by test console to simulate client payment
 */
export function createMockPayment(requirement: PaymentRequirement): {
  proof: PaymentProof;
  header: string;
} {
  const proof = signPaymentProof(requirement);
  const header = encodePaymentProofHeader(proof);

  return { proof, header };
}

