import { NextResponse } from "next/server";
import { getBudgetStatus, resetBudget } from "@/lib/budget";

export async function GET() {
  const status = getBudgetStatus();

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
    resetBudget();
    const status = getBudgetStatus();

    return NextResponse.json({
      success: true,
      message: "Budget reset to daily limit",
      status,
    });
  }

  return NextResponse.json(
    { error: "Unknown action. Use { action: 'reset' }" },
    { status: 400 }
  );
}


