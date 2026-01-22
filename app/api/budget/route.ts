import { NextResponse } from "next/server";
import { getBudgetStatus, resetBudget, setDailyLimit } from "@/lib/spendguard/budget";
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

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.daily_limit === undefined) {
    return NextResponse.json({ error: "daily_limit is required" }, { status: 400 });
  }

  const limit = Number(body.daily_limit);
  if (!Number.isFinite(limit) || limit <= 0) {
    return NextResponse.json({ error: "daily_limit must be a positive number" }, { status: 400 });
  }

  const status = await setDailyLimit(limit);
  return NextResponse.json(status);
}
