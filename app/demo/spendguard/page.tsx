import { Suspense } from "react";
import SpendGuardPage from "../../spendguard/page";

export default function DemoSpendGuardPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 p-8 text-gray-400">Loading…</div>}>
      <SpendGuardPage />
    </Suspense>
  );
}

