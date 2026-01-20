import { NextResponse } from "next/server";
import { getPolicy } from "@/lib/policy";

export async function GET() {
  const policy = getPolicy();

  return NextResponse.json(policy);
}


