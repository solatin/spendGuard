import { NextResponse } from "next/server";
import { redis } from "@/lib/redis";
import { clearLogs } from "@/lib/spendguard/audit";
import { clearBudget } from "@/lib/spendguard/budget";
import { clearPolicy } from "@/lib/spendguard/policy";
import { clearNonces } from "@/lib/verifier/mock";
import { clearAllPendingPayments } from "@/lib/provider/email";

/**
 * Clear ALL SpendGuard persisted state (Redis):
 * - audit logs (+ counter)
 * - budget
 * - policy
 * - used payment nonces
 * - provider pending payments + counters
 */
export async function DELETE() {
  try {
    await Promise.all([
      clearLogs(),
      clearBudget(),
      clearPolicy(),
      clearNonces(),
      clearAllPendingPayments(),
      redis.del("spendguard:email_counter"),
    ]);

    return NextResponse.json({
      success: true,
      message: "SpendGuard DB cleared (logs, budget, policy, nonces, pending payments)",
    });
  } catch (error) {
    console.error("Failed to clear SpendGuard DB:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to clear SpendGuard DB",
      },
      { status: 500 }
    );
  }
}



