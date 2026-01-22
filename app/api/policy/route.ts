import { NextResponse } from "next/server";
import { getPolicy, setPolicy } from "@/lib/spendguard/policy";

export async function GET() {
  const policy = await getPolicy();

  return NextResponse.json(policy);
}

function parseList(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof value === "string") {
    return value
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

export async function PATCH(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const updates: {
    max_price_per_call?: number;
    allowed_providers?: string[];
    allowed_actions?: string[];
    allowed_tasks?: string[];
  } = {};

  if (body.max_price_per_call !== undefined) {
    const n = Number(body.max_price_per_call);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: "max_price_per_call must be a non-negative number" }, { status: 400 });
    }
    updates.max_price_per_call = n;
  }

  const providers = parseList(body.allowed_providers);
  const actions = parseList(body.allowed_actions);
  const tasks = parseList(body.allowed_tasks);
  if (providers) updates.allowed_providers = providers;
  if (actions) updates.allowed_actions = actions;
  if (tasks) updates.allowed_tasks = tasks;

  const updated = await setPolicy(updates);
  return NextResponse.json(updated);
}
