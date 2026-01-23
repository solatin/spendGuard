import { NextResponse } from "next/server";
import { getLogs, clearLogs, getLogStats } from "@/lib/spendguard/audit";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limitParam = url.searchParams.get("limit");
  const runId = url.searchParams.get("run_id") || undefined;
  const parsed = limitParam ? Number(limitParam) : NaN;
  const limit = Number.isFinite(parsed) ? Math.min(500, Math.max(1, parsed)) : 50;

  const [logs, stats] = await Promise.all([getLogs(limit, runId), getLogStats(runId)]);

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
