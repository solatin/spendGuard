// Mock Email Provider - x402 Demo
// Simulates an email provider that requires payment (HTTP 402)
// Redis-backed storage for Vercel deployment

import { redis } from "../redis";
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

// Redis key prefix for pending payments
const PENDING_PAYMENTS_PREFIX = "spendguard:pending_payments:";
const EMAIL_COUNTER_KEY = "spendguard:email_counter";

/**
 * Create a payment requirement for an email send
 */
export async function createPaymentRequirement(
  price: number = EMAIL_PROVIDER_CONFIG.pricePerCall,
  callbackUrl: string = "/api/provider/email/send"
): Promise<PaymentRequirement> {
  const nonce = `nonce_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

  const requirement: PaymentRequirement = {
    price,
    asset: EMAIL_PROVIDER_CONFIG.asset,
    network: EMAIL_PROVIDER_CONFIG.network,
    payTo: EMAIL_PROVIDER_CONFIG.payTo,
    nonce,
    callbackUrl,
  };

  // Store for later verification (expires in 1 hour)
  await redis.set(`${PENDING_PAYMENTS_PREFIX}${nonce}`, requirement, { ex: 3600 });

  return requirement;
}

/**
 * Process an email send request
 *
 * If no payment proof: returns 402 with payment requirement
 * If valid payment proof: executes and returns result
 */
export async function processEmailSend(
  payload: EmailSendPayload,
  paymentProofHeader: string | null
): Promise<{ status: 200 | 402; body: ProviderResult | { x402: PaymentRequirement } }> {
  // If no payment proof, return 402 with payment requirement
  if (!paymentProofHeader) {
    const requirement = await createPaymentRequirement();

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
  const counter = await redis.incr(EMAIL_COUNTER_KEY);
  const emailId = `email_${counter}`;
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
export async function getPendingPayment(nonce: string): Promise<PaymentRequirement | null> {
  const payment = await redis.get<PaymentRequirement>(`${PENDING_PAYMENTS_PREFIX}${nonce}`);
  return payment;
}

/**
 * Remove a pending payment (after successful verification)
 */
export async function removePendingPayment(nonce: string): Promise<void> {
  await redis.del(`${PENDING_PAYMENTS_PREFIX}${nonce}`);
}

/**
 * Clear all pending payments (for testing)
 */
export async function clearAllPendingPayments(): Promise<void> {
  // Scan and delete all pending payment keys
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: `${PENDING_PAYMENTS_PREFIX}*`, count: 100 });
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== "0");
}

/**
 * Get count of pending payments (for debugging)
 */
export async function getPendingPaymentCount(): Promise<number> {
  let count = 0;
  let cursor = "0";
  do {
    const [nextCursor, keys] = await redis.scan(cursor, { match: `${PENDING_PAYMENTS_PREFIX}*`, count: 100 });
    cursor = nextCursor;
    count += keys.length;
  } while (cursor !== "0");
  return count;
}
