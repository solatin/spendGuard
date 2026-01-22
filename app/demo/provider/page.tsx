import { Suspense } from "react";
import ProviderPage from "../../provider/page";

export default function DemoProviderPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 p-8 text-gray-400">Loading…</div>}>
      <ProviderPage />
    </Suspense>
  );
}

