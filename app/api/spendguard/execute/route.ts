// SpendGuard Execute API Route
// Main entry point for x402 hard guard flow

import { NextRequest, NextResponse } from "next/server";
import { executeSpendGuardFlow, ExecuteRequest } from "@/lib/spendguard/executor";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate required fields
    const { provider, action, task, payload } = body as ExecuteRequest;

    if (!provider || !action || !task) {
      return NextResponse.json(
        {
          decision: "DENIED",
          reason: "missing_required_fields: provider, action, task are required",
          log_id: "error",
        },
        { status: 400 }
      );
    }

    // Get payment proof header if present
    const paymentProofHeader = request.headers.get("X-PAYMENT-PROOF");
    const runIdHeader = request.headers.get("X-RUN-ID") || undefined;

    // Execute the SpendGuard flow
    const result = await executeSpendGuardFlow(
      {
        provider,
        action,
        task,
        payload: payload || {},
      },
      paymentProofHeader,
      { runId: runIdHeader }
    );

    // Return appropriate HTTP status based on decision
    let status = 200;
    if (result.decision === "DENIED") {
      status = 403;
    } else if (result.decision === "PAYMENT_REQUIRED") {
      status = 402;
    }

    return NextResponse.json(result, { status });
  } catch (error) {
    console.error("SpendGuard execute error:", error);

    return NextResponse.json(
      {
        decision: "DENIED",
        reason: `internal_error: ${error instanceof Error ? error.message : "unknown"}`,
        log_id: "error",
      },
      { status: 500 }
    );
  }
}
