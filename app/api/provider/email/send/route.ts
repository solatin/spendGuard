import { NextResponse } from "next/server";

// Mock Email Provider API
// Simulates an external email service like SendGrid or MailerSend

let emailCounter = 1;

export async function POST(request: Request) {
  let body: { to?: string; subject?: string; body?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { to, subject, body: emailBody } = body;

  if (!to || !subject) {
    return NextResponse.json(
      { error: "Missing required fields: to, subject" },
      { status: 400 }
    );
  }

  // Simulate a small delay (real API would have network latency)
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Generate mock response
  const emailId = `email_${emailCounter++}`;

  return NextResponse.json(
    {
      status: "sent",
      id: emailId,
      to,
      subject,
      body: emailBody || "(no body)",
      sent_at: new Date().toISOString(),
    },
    { status: 200 }
  );
}


