// Provider Integration - SpendGuard Demo
// Routes approved requests to mock provider APIs

export interface ProviderResponse {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface EmailPayload {
  to: string;
  subject: string;
  body?: string;
}

// In-memory email counter for mock IDs
let emailCounter = 1;

// Mock email provider implementation (inline to avoid self-calling HTTP issues)
async function mockEmailSend(payload: Record<string, unknown>): Promise<ProviderResponse> {
  const { to, subject, body: emailBody } = payload as unknown as EmailPayload;

  if (!to || !subject) {
    return {
      success: false,
      error: "Missing required fields: to, subject",
    };
  }

  // Simulate a small delay (real API would have network latency)
  await new Promise((resolve) => setTimeout(resolve, 50));

  // Generate mock response
  const emailId = `email_${emailCounter++}`;

  return {
    success: true,
    data: {
      status: "sent",
      id: emailId,
      to,
      subject,
      body: emailBody || "(no body)",
      sent_at: new Date().toISOString(),
    },
  };
}

export async function callProvider(
  provider: string,
  action: string,
  payload: Record<string, unknown>
): Promise<ProviderResponse> {
  try {
    switch (provider) {
      case "email":
        if (action === "send") {
          return await mockEmailSend(payload);
        }
        break;

      default:
        return {
          success: false,
          error: `Unknown provider: ${provider}`,
        };
    }

    return {
      success: false,
      error: `Unknown action "${action}" for provider "${provider}"`,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Provider call failed",
    };
  }
}
