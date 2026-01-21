// Provider Types - x402 Payment Protocol
// Types for provider requests, responses, and payment requirements

/**
 * x402 Payment Requirement
 * Returned by provider when payment is required (HTTP 402)
 */
export interface PaymentRequirement {
  /** Price in the specified asset (e.g., 0.001 for $0.001 USDC) */
  price: number;
  /** Asset type (e.g., "USDC") */
  asset: string;
  /** Network for payment (e.g., "base-sepolia") */
  network: string;
  /** Unique nonce for this payment request */
  nonce: string;
  /** Wallet address to pay to */
  payTo: string;
  /** Callback URL after payment */
  callbackUrl?: string;
}

/**
 * Request to a provider
 */
export interface ProviderRequest {
  /** Action to perform */
  action: string;
  /** Task identifier */
  task: string;
  /** Request payload */
  payload: Record<string, unknown>;
  /** Payment proof header (if paying) */
  paymentProof?: string;
}

/**
 * Result from a provider
 */
export interface ProviderResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Result data */
  data?: Record<string, unknown>;
  /** Error message if failed */
  error?: string;
}

/**
 * x402 Response - either payment required or success
 */
export type x402Response =
  | { status: 402; x402: PaymentRequirement }
  | { status: 200; result: ProviderResult };

/**
 * Email send payload
 */
export interface EmailSendPayload {
  to: string;
  subject: string;
  body?: string;
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  name: string;
  pricePerCall: number;
  asset: string;
  network: string;
  payTo: string;
}

