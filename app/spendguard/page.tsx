import { Suspense } from "react";
import SpendGuardInspectorClient from "./SpendGuardInspectorClient";

export default function SpendGuardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-950 p-8 text-gray-400">
          Loading…
        </div>
      }
    >
      <SpendGuardInspectorClient />
    </Suspense>
  );
}


