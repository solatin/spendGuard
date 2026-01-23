import { Suspense } from "react";
import ProviderInspectorClient from "./ProviderInspectorClient";

export default function ProviderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 p-8 text-gray-400">
          Loading…
        </div>
      }
    >
      <ProviderInspectorClient />
    </Suspense>
  );
}



