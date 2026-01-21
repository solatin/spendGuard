import { NextResponse } from "next/server";
import { getPolicy } from "@/lib/spendguard/policy";

export async function GET() {
  const policy = getPolicy();

  return NextResponse.json(policy);
}


