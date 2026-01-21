import { NextResponse } from "next/server";
import { getLogs, clearLogs, getLogStats } from "@/lib/spendguard/audit";

export async function GET() {
  const [logs, stats] = await Promise.all([getLogs(), getLogStats()]);

  return NextResponse.json({
    logs,
    stats,
  });
}

export async function DELETE() {
  await clearLogs();

  return NextResponse.json({
    success: true,
    message: "Audit logs cleared",
  });
}
