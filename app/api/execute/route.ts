import { NextResponse } from "next/server";
import { checkPolicy, type PolicyCheckRequest } from "@/lib/policy";
import { checkBudget, deductBudget } from "@/lib/budget";
import { logRequest } from "@/lib/audit";
import { callProvider } from "@/lib/provider";

export interface ExecuteRequest {
  provider: string;
  action: string;
  task: string;
  cost_estimated: number;
  payload: Record<string, unknown>;
}

export async function POST(request: Request) {
  let body: ExecuteRequest;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { provider, action, task, cost_estimated, payload } = body;

  // Validate required fields
  if (!provider || !action || !task || cost_estimated === undefined) {
    return NextResponse.json(
      { error: "Missing required fields: provider, action, task, cost_estimated" },
      { status: 400 }
    );
  }

  // Step 1: Policy Check
  const policyRequest: PolicyCheckRequest = {
    provider,
    action,
    task,
    cost_estimated,
  };

  const policyResult = checkPolicy(policyRequest);

  if (!policyResult.allowed) {
    // Log the denied request
    const logEntry = logRequest({
      provider,
      action,
      task,
      cost: cost_estimated,
      decision: "DENIED",
      reason: policyResult.reason,
      payload,
    });

    return NextResponse.json(
      {
        decision: "DENIED",
        reason: policyResult.reason,
        log_id: logEntry.id,
      },
      { status: 403 }
    );
  }

  // Step 2: Budget Check
  const budgetResult = checkBudget(cost_estimated);

  if (!budgetResult.allowed) {
    // Log the denied request
    const logEntry = logRequest({
      provider,
      action,
      task,
      cost: cost_estimated,
      decision: "DENIED",
      reason: budgetResult.reason,
      payload,
    });

    return NextResponse.json(
      {
        decision: "DENIED",
        reason: budgetResult.reason,
        log_id: logEntry.id,
      },
      { status: 403 }
    );
  }

  // Step 3: Deduct budget BEFORE calling provider
  deductBudget(cost_estimated);

  // Step 4: Call the provider
  const providerResponse = await callProvider(provider, action, payload);

  if (!providerResponse.success) {
    // Log as approved but with provider error
    const logEntry = logRequest({
      provider,
      action,
      task,
      cost: cost_estimated,
      decision: "APPROVED",
      reason: `provider_error: ${providerResponse.error}`,
      payload,
      response: { error: providerResponse.error },
    });

    return NextResponse.json(
      {
        decision: "APPROVED",
        provider_status: "error",
        provider_error: providerResponse.error,
        log_id: logEntry.id,
      },
      { status: 200 }
    );
  }

  // Step 5: Log success
  const logEntry = logRequest({
    provider,
    action,
    task,
    cost: cost_estimated,
    decision: "APPROVED",
    reason: "ok",
    payload,
    response: providerResponse.data,
  });

  return NextResponse.json(
    {
      decision: "APPROVED",
      reason: "ok",
      provider_response: providerResponse.data,
      log_id: logEntry.id,
    },
    { status: 200 }
  );
}


