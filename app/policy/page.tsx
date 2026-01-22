"use client";

import { useCallback, useEffect, useState } from "react";

interface Policy {
  max_price_per_call: number;
  allowed_providers: string[];
  allowed_actions: string[];
  allowed_tasks: string[];
}

export default function PolicyPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [draft, setDraft] = useState<{
    max_price_per_call: string;
    allowed_providers: string;
    allowed_actions: string;
    allowed_tasks: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const fetchPolicy = useCallback(async () => {
    const res = await fetch("/api/policy");
    const data = (await res.json()) as Policy;
    setPolicy(data);
    setDraft({
      max_price_per_call: String(data.max_price_per_call),
      allowed_providers: data.allowed_providers.join(", "),
      allowed_actions: data.allowed_actions.join(", "),
      allowed_tasks: data.allowed_tasks.join(", "),
    });
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour12: false }));
  }, []);

  useEffect(() => {
    fetchPolicy();
  }, [fetchPolicy]);

  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      await fetchPolicy();
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSave = async () => {
    if (!draft) return;
    try {
      setIsSaving(true);
      const res = await fetch("/api/policy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          max_price_per_call: Number(draft.max_price_per_call),
          allowed_providers: draft.allowed_providers,
          allowed_actions: draft.allowed_actions,
          allowed_tasks: draft.allowed_tasks,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `save_failed: ${res.status}`);
      }
      const updated = (await res.json()) as Policy;
      setPolicy(updated);
      setDraft({
        max_price_per_call: String(updated.max_price_per_call),
        allowed_providers: updated.allowed_providers.join(", "),
        allowed_actions: updated.allowed_actions.join(", "),
        allowed_tasks: updated.allowed_tasks.join(", "),
      });
    } catch (error) {
      console.error("Failed to save policy:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDraft = () => {
    if (!policy) return;
    setDraft({
      max_price_per_call: String(policy.max_price_per_call),
      allowed_providers: policy.allowed_providers.join(", "),
      allowed_actions: policy.allowed_actions.join(", "),
      allowed_tasks: policy.allowed_tasks.join(", "),
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-mono text-3xl font-bold text-zinc-100 mb-2">Policy</h1>
            <p className="text-zinc-400">Edit the Redis-backed SpendGuard policy.</p>
            <div className="font-mono text-xs text-zinc-500 mt-2">
              {lastUpdated ? `Last updated: ${lastUpdated}` : "Loading..."}
            </div>
          </div>
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-300 text-sm font-mono hover:bg-zinc-700 hover:border-zinc-600 transition-all disabled:opacity-50"
          >
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-500 text-xs mb-1">Max Price Per Call</div>
              <div className="font-mono text-zinc-100">
                {policy ? policy.max_price_per_call.toFixed(4) : "—"} USDC
              </div>
            </div>
            <div className="bg-zinc-950/60 border border-zinc-800 rounded-lg p-4">
              <div className="text-zinc-500 text-xs mb-1">Allowlist Sizes</div>
              <div className="font-mono text-zinc-100 text-sm">
                providers={policy?.allowed_providers.length ?? "—"}, actions={policy?.allowed_actions.length ?? "—"}, tasks={policy?.allowed_tasks.length ?? "—"}
              </div>
            </div>
          </div>

          {draft && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 font-mono mb-1">Max price per call (USDC)</label>
                <input
                  value={draft.max_price_per_call}
                  onChange={(e) => setDraft({ ...draft, max_price_per_call: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  inputMode="decimal"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 font-mono mb-1">Allowed providers (comma-separated)</label>
                <input
                  value={draft.allowed_providers}
                  onChange={(e) => setDraft({ ...draft, allowed_providers: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  placeholder="email"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 font-mono mb-1">Allowed actions (comma-separated)</label>
                <input
                  value={draft.allowed_actions}
                  onChange={(e) => setDraft({ ...draft, allowed_actions: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  placeholder="send"
                />
              </div>

              <div>
                <label className="block text-sm text-zinc-400 font-mono mb-1">Allowed tasks (comma-separated)</label>
                <input
                  value={draft.allowed_tasks}
                  onChange={(e) => setDraft({ ...draft, allowed_tasks: e.target.value })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-100 font-mono"
                  placeholder="welcome_flow"
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  onClick={handleResetDraft}
                  disabled={isSaving}
                  className="px-4 py-2 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 font-mono text-sm hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Draft
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


