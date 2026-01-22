import Link from "next/link";
import Mermaid from "./components/Mermaid";

const FLOW_MERMAID = `sequenceDiagram
  participant A as Agent/App
  participant S as SpendGuard
  participant P as Provider API

  A->>S: POST /execute (intent)
  S->>S: policy + budget checks
  S->>P: forward request (no payment)
  P-->>S: 402 Payment Required (x402)
  S-->>A: 402 forwarded (x402 metadata)
  A->>S: retry with X-PAYMENT-PROOF
  S->>S: verify payment proof (nonce + signature)
  S->>P: execute (paid)
  P-->>S: 200 OK
  S-->>A: APPROVED + audit log`;

export default function HomePage() {
  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-30">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                radial-gradient(circle at 25% 25%, rgba(16, 185, 129, 0.15) 0%, transparent 50%),
                radial-gradient(circle at 75% 75%, rgba(16, 185, 129, 0.1) 0%, transparent 50%)
              `,
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `linear-gradient(rgba(16, 185, 129, 0.03) 1px, transparent 1px),
                linear-gradient(90deg, rgba(16, 185, 129, 0.03) 1px, transparent 1px)`,
              backgroundSize: "50px 50px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-5xl px-6 py-24 sm:py-32">
          {/* Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10">
              <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-emerald-400 text-sm font-mono">
                Runtime Control Plane
              </span>
            </div>
          </div>

          {/* Main Heading */}
          <h1 className="text-center font-mono text-5xl sm:text-6xl font-bold text-zinc-100 mb-6 tracking-tight">
            <span className="text-emerald-400">Spend</span>Guard
          </h1>

          <p className="text-center text-xl text-zinc-400 max-w-2xl mx-auto mb-12 leading-relaxed">
            A control plane that sits between your agents and provider APIs.
            Real-time policy enforcement, budget controls, and complete audit trails.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
            <Link
              href="/demo"
              className="flex items-center gap-2 px-6 py-3 rounded-lg bg-emerald-500 text-zinc-950 font-mono font-semibold hover:bg-emerald-400 transition-all"
            >
              <span>▶</span>
              Try Demo
            </Link>
            <Link
              href="/dashboard"
              className="flex items-center gap-2 px-6 py-3 rounded-lg border border-zinc-700 bg-zinc-800/50 text-zinc-200 font-mono hover:bg-zinc-800 hover:border-zinc-600 transition-all"
            >
              View Dashboard
            </Link>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center font-mono text-2xl font-semibold text-zinc-100 mb-12">
            What this demo shows
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <FeatureCard
              icon="⚡"
              title="Intercept"
              description="All API calls flow through SpendGuard before reaching the provider"
            />
            <FeatureCard
              icon="⚙"
              title="Evaluate"
              description="Policy and budget checks happen in real-time with sub-millisecond latency"
            />
            <FeatureCard
              icon="✓"
              title="Decide"
              description="Approve or deny instantly. Every decision is logged for full auditability"
            />
          </div>

          {/* Instructions */}
          <div className="mt-16 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="font-mono text-sm text-zinc-200 mb-2">Guided demo</div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Use <span className="text-zinc-200 font-mono">Demo → Flow</span> for predefined scenarios (normal x402 flow,
                policy violation, budget exhausted, replay attack). Each run auto-clears logs and resets state so it’s deterministic.
              </p>
              <div className="mt-4">
                <Link
                  href="/demo"
                  className="inline-flex items-center gap-2 text-emerald-400 font-mono hover:text-emerald-300 transition-colors"
                >
                  Open Guided Flow <span>→</span>
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="font-mono text-sm text-zinc-200 mb-2">Custom testing</div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Use the other Demo tabs (<span className="text-zinc-200 font-mono">Agent / SpendGuard / Provider</span>) to craft custom requests,
                inspect decisions, and observe provider behavior.
              </p>
              <div className="mt-4 flex flex-wrap gap-4">
                <Link
                  href="/demo/agent"
                  className="inline-flex items-center gap-2 text-emerald-400 font-mono hover:text-emerald-300 transition-colors"
                >
                  Open Custom Test <span>→</span>
                </Link>
              </div>
            </div>
          </div>

          {/* Flow Visualization */}
          <div className="mt-16 p-8 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <h3 className="font-mono text-lg font-semibold text-zinc-100 mb-4">
              Flow (x402 + policy/budget enforcement)
            </h3>

            <div className="flex items-center justify-between gap-4 text-sm font-mono overflow-x-auto">
              <div className="min-w-[190px] px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 whitespace-nowrap">
                <div className="text-xs text-zinc-500">Client</div>
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400">◉</span> Agent / App
                </div>
              </div>
              <div className="text-zinc-600">→</div>
              <div className="min-w-[220px] px-4 py-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 whitespace-nowrap">
                <div className="text-xs text-emerald-400/70">Control plane</div>
                <div className="flex items-center gap-2">
                  <span>🛡️</span> SpendGuard
                </div>
              </div>
              <div className="text-zinc-600">→</div>
              <div className="min-w-[200px] px-4 py-3 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-200 whitespace-nowrap">
                <div className="text-xs text-zinc-500">Upstream</div>
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">◈</span> Provider API
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-zinc-400">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="font-mono text-zinc-200 mb-2">Decision path</div>
                <ul className="space-y-1">
                  <li><span className="text-zinc-300 font-mono">1.</span> Policy check (allowlist + max price)</li>
                  <li><span className="text-zinc-300 font-mono">2.</span> Budget check (remaining ≥ cost)</li>
                  <li><span className="text-zinc-300 font-mono">3.</span> If no payment proof: forward to provider → receive 402</li>
                  <li><span className="text-zinc-300 font-mono">4.</span> Forward 402 to agent (x402 metadata)</li>
                  <li><span className="text-zinc-300 font-mono">5.</span> If payment proof: verify nonce & signature → execute → deduct budget</li>
                </ul>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="font-mono text-zinc-200 mb-3">Mermaid diagram</div>

                <Mermaid chart={FLOW_MERMAID} className="bg-zinc-950/40 border border-zinc-800 rounded-lg p-3 overflow-x-auto" />

                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-zinc-400 font-mono">
                    Show Mermaid source
                  </summary>
                  <pre className="mt-2 text-xs text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap">
                    {FLOW_MERMAID}
                  </pre>
                </details>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Scenarios */}
      <div className="border-t border-zinc-800">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center font-mono text-2xl font-semibold text-zinc-100 mb-4">
            Scenarios included
          </h2>
          <p className="text-center text-zinc-400 mb-12">
            Available in Demo → Flow (guided scenarios)
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ScenarioCard
              number="01"
              title="Normal x402 Flow"
              description="Intent → 402 → pay → execute."
              outcome="MIXED"
            />
            <ScenarioCard
              number="02"
              title="Policy Violation"
              description="Invalid provider → DENY."
              outcome="DENIED"
            />
            <ScenarioCard
              number="03"
              title="Budget Exhausted"
              description="Spend until remaining is ~0 → next request DENY."
              outcome="DENIED"
            />
            <ScenarioCard
              number="04"
              title="Replay Attack"
              description="Reuse payment proof nonce → DENY."
              outcome="DENIED"
            />
          </div>

          <div className="text-center mt-12">
            <Link
              href="/demo"
              className="inline-flex items-center gap-2 text-emerald-400 font-mono hover:text-emerald-300 transition-colors"
            >
              Open Guided Flow
              <span>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 py-8">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center justify-between text-sm text-zinc-500">
            <div className="flex items-center gap-2 font-mono">
              <span className="text-emerald-400">🛡️</span>
              SpendGuard Demo
            </div>
            <div>No blockchain. No real money. Pure control-plane demo.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 card-hover">
      <div className="h-12 w-12 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-2xl mb-4">
        {icon}
      </div>
      <h3 className="font-mono text-lg font-semibold text-zinc-100 mb-2">
        {title}
      </h3>
      <p className="text-zinc-400 text-sm leading-relaxed">{description}</p>
    </div>
  );
}

function ScenarioCard({
  number,
  title,
  description,
  outcome,
}: {
  number: string;
  title: string;
  description: string;
  outcome: "APPROVED" | "DENIED" | "MIXED";
}) {
  const outcomeStyles = {
    APPROVED: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    DENIED: "bg-red-500/10 text-red-400 border-red-500/30",
    MIXED: "bg-amber-500/10 text-amber-400 border-amber-500/30",
  };

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-6 card-hover">
      <div className="flex items-center justify-between mb-4">
        <span className="font-mono text-xs text-zinc-500">{number}</span>
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono border ${outcomeStyles[outcome]}`}
        >
          {outcome}
        </span>
      </div>
      <h3 className="font-mono text-lg font-semibold text-zinc-100 mb-2">
        {title}
      </h3>
      <p className="text-zinc-400 text-sm">{description}</p>
    </div>
  );
}
