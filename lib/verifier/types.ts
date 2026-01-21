// Verifier Types - Payment Proof Verification
// Types for payment proofs and verification results

/**
 * Payment Proof
 * Signed proof that payment was made
 */
export interface PaymentProof {
  /** Unique nonce matching the payment requirement */
  nonce: string;
  /** Payer wallet address */
  payer: string;
  /** Cryptographic signature (mock in demo) */
  signature: string;
  /** Amount paid */
  amount?: number;
  /** Asset type */
  asset?: string;
  /** Network */
  network?: string;
  /** Timestamp of payment */
  timestamp?: string;
}

/**
 * Verification Result
 */
export interface VerifyResult {
  /** Whether the payment proof is valid */
  valid: boolean;
  /** Reason for the result */
  reason: string;
  /** Additional details */
  details?: {
    nonce?: string;
    payer?: string;
    amount?: number;
  };
}

/**
 * Verification Request
 */
export interface VerifyRequest {
  /** The payment proof to verify */
  proof: PaymentProof;
  /** Expected nonce from payment requirement */
  expectedNonce: string;
  /** Expected amount */
  expectedAmount: number;
}

