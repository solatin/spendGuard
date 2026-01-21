import { NextResponse } from "next/server";
import { getLogs, clearLogs, getLogStats } from "@/lib/spendguard/audit";

export async function GET() {
  const logs = getLogs();
  const stats = getLogStats();

  return NextResponse.json({
    logs,
    stats,
  });
}

export async function DELETE() {
  clearLogs();

  return NextResponse.json({
    success: true,
    message: "Audit logs cleared",
  });
}


