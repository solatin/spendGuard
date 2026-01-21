import { NextResponse } from "next/server";
import { getBudgetStatus, resetBudget } from "@/lib/spendguard/budget";
import { clearNonces } from "@/lib/verifier/mock";
import { clearAllPendingPayments } from "@/lib/provider/email";

export async function GET() {
  const status = await getBudgetStatus();

  return NextResponse.json(status);
}

export async function POST(request: Request) {
  let body: { action?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  if (body.action === "reset") {
    await resetBudget();
    const status = await getBudgetStatus();

    return NextResponse.json({
      success: true,
      message: "Budget reset to daily limit",
      status,
    });
  }

  if (body.action === "clear_nonces") {
    await clearNonces();
    await clearAllPendingPayments();
    
    return NextResponse.json({
      success: true,
      message: "Payment nonces and pending payments cleared",
    });
  }

  return NextResponse.json(
    { error: "Unknown action. Use { action: 'reset' } or { action: 'clear_nonces' }" },
    { status: 400 }
  );
}
