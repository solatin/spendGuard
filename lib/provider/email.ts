// Mock Email Provider - x402 Demo
// Simulates an email provider that requires payment (HTTP 402)

import {
  PaymentRequirement,
  ProviderResult,
  EmailSendPayload,
  ProviderConfig,
} from "./types";

// Provider configuration
export const EMAIL_PROVIDER_CONFIG: ProviderConfig = {
  name: "email",
  pricePerCall: 0.001, // $0.001 per email
  asset: "USDC",
  network: "base-sepolia",
  payTo: "0xMockWalletAddress",
};

// In-memory store for pending payment requirements
const pendingPayments = new Map<string, PaymentRequirement>();

// Counter for mock email IDs
let emailCounter = 1;

/**
 * Create a payment requirement for an email send
 */
export function createPaymentRequirement(
  price: number = EMAIL_PROVIDER_CONFIG.pricePerCall,
  callbackUrl: string = "/api/provider/email/send"
): PaymentRequirement {
  const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  const requirement: PaymentRequirement = {
    price,
    asset: EMAIL_PROVIDER_CONFIG.asset,
    network: EMAIL_PROVIDER_CONFIG.network,
    payTo: EMAIL_PROVIDER_CONFIG.payTo,
    nonce,
    callbackUrl,
  };

  // Store for later verification
  pendingPayments.set(nonce, requirement);

  return requirement;
}

/**
 * Process an email send request
 *
 * If no payment proof: returns 402 with payment requirement
 * If valid payment proof: executes and returns result
 */
export function processEmailSend(
  payload: EmailSendPayload,
  paymentProofHeader: string | null
): { status: 200 | 402; body: ProviderResult | { x402: PaymentRequirement } } {
  // If no payment proof, return 402 with payment requirement
  if (!paymentProofHeader) {
    const requirement = createPaymentRequirement();

    return {
      status: 402,
      body: { x402: requirement },
    };
  }

  // If payment proof is provided, SpendGuard has already verified it
  // Provider trusts SpendGuard's verification and executes the request

  // Validate payload
  if (!payload.to || !payload.subject) {
    return {
      status: 200,
      body: {
        success: false,
        error: "Missing required fields: to, subject",
      },
    };
  }

  // Execute the email send (mock)
  const emailId = `email_${emailCounter++}`;
  const result: ProviderResult = {
    success: true,
    data: {
      status: "sent",
      id: emailId,
      to: payload.to,
      subject: payload.subject,
      body: payload.body || "(no body)",
      sent_at: new Date().toISOString(),
    },
  };

  return {
    status: 200,
    body: result,
  };
}

/**
 * Get a pending payment requirement by nonce
 */
export function getPendingPayment(nonce: string): PaymentRequirement | undefined {
  return pendingPayments.get(nonce);
}

/**
 * Remove a pending payment (after successful verification)
 */
export function removePendingPayment(nonce: string): void {
  pendingPayments.delete(nonce);
}

/**
 * Clear all pending payments (for testing)
 */
export function clearAllPendingPayments(): void {
  pendingPayments.clear();
}

/**
 * Get count of pending payments (for debugging)
 */
export function getPendingPaymentCount(): number {
  return pendingPayments.size;
}

