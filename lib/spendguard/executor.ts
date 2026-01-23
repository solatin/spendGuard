// SpendGuard Executor - x402 Flow Orchestration
// Core orchestrator implementing "decide → pay → run" hard guard semantics

import { checkPolicy, PolicyCheckRequest } from "./policy";
import { checkBudget, deductBudget } from "./budget";
import { logRequest } from "./audit";
import { parsePaymentProofHeader } from "../client/payment";
import { isNonceUsed, verifyPayment } from "../verifier/mock";
import {
  processEmailSend,
  getPendingPayment,
  removePendingPayment,
  EMAIL_PROVIDER_CONFIG,
} from "../provider/email";
import { PaymentRequirement, EmailSendPayload } from "../provider/types";

/**
 * Execute request - input from client
 */
export interface ExecuteRequest {
  provider: string;
  action: string;
  task: string;
  payload: Record<string, unknown>;
}

/**
 * Execute result - returned to client
 */
export interface ExecuteResult {
  decision: "APPROVED" | "DENIED" | "PAYMENT_REQUIRED";
  reason: string;
  log_id: string;
  x402_payment_required?: PaymentRequirement;
  provider_response?: Record<string, unknown>;
}

/**
 * Execute the SpendGuard flow
 *
 * Flow:
 * 1. Policy check - ALLOW/DENY
 * 2. Budget check - sufficient funds?
 * 3. If no payment proof: forward to provider, get 402
 * 4. If payment proof: verify, then execute
 */
export async function executeSpendGuardFlow(
  request: ExecuteRequest,
  paymentProofHeader: string | null,
  opts?: { runId?: string }
): Promise<ExecuteResult> {
  const { provider, action, task, payload } = request;
  const runId = opts?.runId;

  // Get cost from provider config
  const costEstimated = EMAIL_PROVIDER_CONFIG.pricePerCall;

  // ═══════════════════════════════════════════════════════════
  // STEP 1: Policy Check (internal to SpendGuard)
  // ═══════════════════════════════════════════════════════════
  const policyRequest: PolicyCheckRequest = {
    provider,
    action,
    task,
    cost_estimated: costEstimated,
  };

  const [policyResult, budgetResult] = await Promise.all([
    checkPolicy(policyRequest),
    checkBudget(costEstimated),
  ]);

  if (!policyResult.allowed) {
    const logEntry = await logRequest({
      provider,
      action,
      task,
      cost: costEstimated,
      decision: "DENIED",
      reason: policyResult.reason,
      run_id: runId,
      payload,
    });

    return {
      decision: "DENIED",
      reason: policyResult.reason,
      log_id: logEntry.id,
    };
  }

  if (!budgetResult.allowed) {
    const logEntry = await logRequest({
      provider,
      action,
      task,
      cost: costEstimated,
      decision: "DENIED",
      reason: budgetResult.reason,
      run_id: runId,
      payload,
    });

    return {
      decision: "DENIED",
      reason: budgetResult.reason,
      log_id: logEntry.id,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 3: Handle Payment Proof (if provided)
  // ═══════════════════════════════════════════════════════════
  if (paymentProofHeader) {
    const proof = parsePaymentProofHeader(paymentProofHeader);

    if (!proof) {
      const logEntry = await logRequest({
        provider,
        action,
        task,
        cost: costEstimated,
        decision: "DENIED",
        reason: "invalid_payment_proof: Could not parse payment proof",
        run_id: runId,
        payload,
      });

      return {
        decision: "DENIED",
        reason: "invalid_payment_proof: Could not parse payment proof",
        log_id: logEntry.id,
      };
    }

    // Get pending payment requirement
    const pendingPayment = await getPendingPayment(proof.nonce);

    if (!pendingPayment) {
      // Preserve "replay_attack" semantics even if the pending payment was deleted/expired.
      if (await isNonceUsed(proof.nonce)) {
        const logEntry = await logRequest({
          provider,
          action,
          task,
          cost: costEstimated,
          decision: "DENIED",
          reason: "replay_attack: Nonce already used",
          run_id: runId,
          payload,
          payment_nonce: proof.nonce,
          payment_payer: proof.payer,
          payment_verified: false,
        });

        return {
          decision: "DENIED",
          reason: "replay_attack: Nonce already used",
          log_id: logEntry.id,
        };
      }

      const logEntry = await logRequest({
        provider,
        action,
        task,
        cost: costEstimated,
        decision: "DENIED",
        reason: "payment_not_found: No pending payment for this nonce",
        run_id: runId,
        payload,
        payment_nonce: proof.nonce,
        payment_payer: proof.payer,
        payment_verified: false,
      });

      return {
        decision: "DENIED",
        reason: "payment_not_found: No pending payment for this nonce",
        log_id: logEntry.id,
      };
    }

    // Verify the payment proof
    const verifyResult = await verifyPayment({
      proof,
      expectedNonce: pendingPayment.nonce,
      expectedAmount: pendingPayment.price,
    });

    if (!verifyResult.valid) {
      const logEntry = await logRequest({
        provider,
        action,
        task,
        cost: costEstimated,
        decision: "DENIED",
        reason: verifyResult.reason,
        run_id: runId,
        payload,
        payment_nonce: proof.nonce,
        payment_payer: proof.payer,
        payment_verified: false,
      });

      return {
        decision: "DENIED",
        reason: verifyResult.reason,
        log_id: logEntry.id,
      };
    }

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Payment Verified - Execute Provider Request
    // ═══════════════════════════════════════════════════════════
    const providerResult = await processEmailSend(
      payload as unknown as EmailSendPayload,
      paymentProofHeader
    );

    if (providerResult.status === 200) {
      // Deduct budget + remove pending payment AFTER successful execution
      await Promise.all([deductBudget(costEstimated), removePendingPayment(proof.nonce)]);

      const logEntry = await logRequest({
        provider,
        action,
        task,
        cost: costEstimated,
        decision: "APPROVED",
        reason: "payment_verified",
        run_id: runId,
        payload,
        response: providerResult.body as Record<string, unknown>,
        payment_nonce: proof.nonce,
        payment_payer: proof.payer,
        payment_verified: true,
      });

      return {
        decision: "APPROVED",
        reason: "payment_verified",
        log_id: logEntry.id,
        provider_response: providerResult.body as Record<string, unknown>,
      };
    }

    // Provider returned error even with valid payment
    const logEntry = await logRequest({
      provider,
      action,
      task,
      cost: costEstimated,
      decision: "DENIED",
      reason: `provider_error: ${(providerResult.body as { error?: string }).error || "unknown"}`,
      run_id: runId,
      payload,
      payment_nonce: proof.nonce,
      payment_payer: proof.payer,
      payment_verified: true,
    });

    return {
      decision: "DENIED",
      reason: `provider_error: ${(providerResult.body as { error?: string }).error || "unknown"}`,
      log_id: logEntry.id,
    };
  }

  // ═══════════════════════════════════════════════════════════
  // STEP 5: No Payment - Get 402 from Provider
  // ═══════════════════════════════════════════════════════════
  const providerResult = await processEmailSend(payload as unknown as EmailSendPayload, null);

  if (providerResult.status === 402) {
    const x402 = (providerResult.body as { x402: PaymentRequirement }).x402;

    const logEntry = await logRequest({
      provider,
      action,
      task,
      cost: costEstimated,
      decision: "PAYMENT_REQUIRED",
      reason: "x402_payment_required",
      run_id: runId,
      payload,
      payment_nonce: x402.nonce,
    });

    return {
      decision: "PAYMENT_REQUIRED",
      reason: "x402_payment_required",
      log_id: logEntry.id,
      x402_payment_required: x402,
    };
  }

  // Unexpected response
  const logEntry = await logRequest({
    provider,
    action,
    task,
    cost: costEstimated,
    decision: "DENIED",
    reason: `unexpected_provider_response: status ${providerResult.status}`,
    run_id: runId,
    payload,
  });

  return {
    decision: "DENIED",
    reason: `unexpected_provider_response: status ${providerResult.status}`,
    log_id: logEntry.id,
  };
}
