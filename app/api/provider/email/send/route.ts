// Mock Email Provider API - x402 Demo
// Returns 402 Payment Required when no payment proof is provided

import { NextRequest, NextResponse } from "next/server";
import { processEmailSend } from "@/lib/provider/email";
import { EmailSendPayload } from "@/lib/provider/types";

export async function POST(request: NextRequest) {
  let body: EmailSendPayload;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  // Get payment proof header if present
  const paymentProofHeader = request.headers.get("X-PAYMENT-PROOF");

  // Process the request through the mock provider
  const result = processEmailSend(body, paymentProofHeader);

  return NextResponse.json(result.body, { status: result.status });
}
