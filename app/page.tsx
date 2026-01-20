"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface BudgetStatus {
  daily_limit: number;
  remaining: number;
  percentage_used: number;
}

interface LogStats {
  total: number;
  approved: number;
  denied: number;
}

export default function HomePage() {
  const [budget, setBudget] = useState<BudgetStatus | null>(null);
  const [stats, setStats] = useState<LogStats | null>(null);

  const fetchData = useCallback(async () => {
    const [budgetRes, logsRes] = await Promise.all([
      fetch("/api/budget"),
      fetch("/api/logs"),
    ]);
    const budgetData = await budgetRes.json();
    const logsData = await logsRes.json();
    setBudget(budgetData);
    setStats(logsData.stats);
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

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
              href="/test"
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

          {/* Live Stats */}
          {(budget || stats) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
              <QuickStat
                label="Budget Remaining"
                value={budget ? `$${budget.remaining.toFixed(2)}` : "—"}
                status={
                  budget && budget.percentage_used > 80 ? "warning" : "normal"
                }
              />
              <QuickStat
                label="Total Requests"
                value={stats?.total?.toString() || "0"}
              />
              <QuickStat
                label="Approved"
                value={stats?.approved?.toString() || "0"}
                status="success"
              />
              <QuickStat
                label="Denied"
                value={stats?.denied?.toString() || "0"}
                status={stats && stats.denied > 0 ? "danger" : "normal"}
              />
            </div>
          )}
        </div>
      </div>

      {/* Features Section */}
      <div className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center font-mono text-2xl font-semibold text-zinc-100 mb-12">
            How It Works
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

          {/* Architecture Diagram */}
          <div className="mt-16 p-8 rounded-xl border border-zinc-800 bg-zinc-900/50">
            <div className="flex items-center justify-center gap-4 text-sm font-mono overflow-x-auto">
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 whitespace-nowrap">
                <span className="text-emerald-400">◉</span>
                Agent / App
              </div>
              <div className="text-zinc-600">→</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 whitespace-nowrap">
                <span>$</span>
                SpendGuard
              </div>
              <div className="text-zinc-600">→</div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 whitespace-nowrap">
                <span className="text-amber-400">◈</span>
                Provider API
              </div>
            </div>
            <p className="text-center text-zinc-500 text-sm mt-4">
              Policy Check → Budget Check → Allow/Deny → Audit Log
            </p>
          </div>
        </div>
      </div>

      {/* Demo Scenarios */}
      <div className="border-t border-zinc-800">
        <div className="mx-auto max-w-5xl px-6 py-20">
          <h2 className="text-center font-mono text-2xl font-semibold text-zinc-100 mb-4">
            Demo Scenarios
          </h2>
          <p className="text-center text-zinc-400 mb-12">
            Try these scenarios in the Test Console
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ScenarioCard
              number="01"
              title="Normal Flow"
              description="Send a single email request. Approved and logged."
              outcome="APPROVED"
            />
            <ScenarioCard
              number="02"
              title="Cost Violation"
              description="Request exceeds max price per call policy."
              outcome="DENIED"
            />
            <ScenarioCard
              number="03"
              title="Budget Exhaustion"
              description="Agent loop sends 20 rapid requests. Budget enforced."
              outcome="MIXED"
            />
          </div>

          <div className="text-center mt-12">
            <Link
              href="/test"
              className="inline-flex items-center gap-2 text-emerald-400 font-mono hover:text-emerald-300 transition-colors"
            >
              Open Test Console
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
              <span className="text-emerald-400">$</span>
              SpendGuard Demo
            </div>
            <div>No blockchain. No real money. Pure control-plane demo.</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickStat({
  label,
  value,
  status = "normal",
}: {
  label: string;
  value: string;
  status?: "normal" | "success" | "warning" | "danger";
}) {
  const statusColors = {
    normal: "text-zinc-100",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-center">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className={`font-mono text-xl font-semibold ${statusColors[status]}`}>
        {value}
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
